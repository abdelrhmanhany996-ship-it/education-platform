import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  User,
  Course,
  Lecture,
  StudentLectureState,
  LeaderboardEntry,
  BadgePolicy,
  Certificate,
  ActivityLog,
  WhatsAppNotificationLog,
  TelegramNotificationLog,
  QuestionBankItem,
  QuizSettings,
  StudentGroup,
  AlertSettings,
  CertificateSettings,
  Enrollment,
  ChatMessage
} from '../types';
import {
  calculateLeaderboard,
  calculateStudentAlarms,
  isLectureReleased,
  DEFAULT_ALERT_SETTINGS
} from '../utils/scoring';
import {
  buildAttemptPlan,
  getQuizAccess,
  getQuizDeadline,
  gradeAttempt,
  sumEssayGrades,
  QuizAccess
} from '../utils/quizEngine';
import { putFile, deleteFile } from '../utils/fileStore';
import { api, ApiError, BootstrapData, CatalogCourse, clearToken, getToken, Session, setToken } from '../api';
import { useServerSync } from '../sync';

type Answers = Record<string, { selectedOptionIndex?: number; textAnswer?: string }>;
type MessageType = 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award' | 'enrollment_contact';

export interface PendingEssay {
  studentId: string;
  studentName: string;
  studentAcademicId: string;
  lectureId: string;
  lectureTitle: string;
  questionId: string;
  prompt: string;
  answer: string;
  maxPoints: number;
}

export interface MessageQuota {
  sentThisWeek: number;
  max: number;
  canSend: boolean;
  reason?: string;
}

export type ConnectionStatus = 'loading' | 'ready' | 'anon' | 'offline';

interface SignupInput {
  name: string;
  username: string;
  email: string;
  phone: string;
  faculty: string;
  department: string;
  password: string;
  courseIds: string[];
}

interface AppContextType {
  /** 'loading' while the first data load runs, 'offline' when the server cannot be reached. */
  status: ConnectionStatus;
  syncState: 'idle' | 'saving' | 'offline';
  retryConnect: () => void;

  users: User[];
  currentUser: User | null;
  originalDoctor: User | null;
  isImpersonating: boolean;
  /** The doctor account this session's data belongs to: the doctor themself, or who an assistant works for. */
  doctorScopeId: string | undefined;
  courses: Course[];
  groups: StudentGroup[];
  studentStates: StudentLectureState[];
  badgePolicy: BadgePolicy;
  alertSettings: AlertSettings;
  certSettings: CertificateSettings;
  certificates: Certificate[];
  activityLogs: ActivityLog[];
  whatsappLogs: WhatsAppNotificationLog[];
  telegramLogs: TelegramNotificationLog[];
  enrollments: Enrollment[];
  chatMessages: ChatMessage[];

  // Auth & session
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signup: (
    userData: SignupInput
  ) => Promise<{ success: boolean; pending?: boolean; message?: string; telegramLink?: string; error?: string }>;
  getCatalog: () => Promise<CatalogCourse[]>;
  addUserByDoctor: (
    userData: Partial<User> & { password?: string; subjects?: string[]; courseId?: string }
  ) => Promise<{ success: boolean; error?: string; user?: User }>;
  updateStudent: (studentId: string, updates: Partial<User> & { password?: string }) => void;
  logout: () => void;
  quickLogin: (username: string) => Promise<void>;
  impersonateStudent: (studentId: string) => boolean;
  impersonateAssistant: (assistantId: string) => boolean;
  exitImpersonation: () => void;

  // Enrollment requests (doctor / assistant)
  contactEnrollment: (id: string, note?: string) => Promise<void>;
  approveEnrollment: (id: string) => Promise<void>;
  rejectEnrollment: (id: string) => Promise<void>;

  // In-platform chat between a student and their doctor (separate from WhatsApp/Telegram outreach)
  getChatDoctors: () => { doctorId: string; doctorName: string }[];
  getChatThread: (doctorId: string) => ChatMessage[];
  getChatThreadsForStaff: () => { studentId: string; studentName: string; messages: ChatMessage[]; unread: number }[];
  sendChatMessage: (params: { doctorId: string; studentId?: string; text: string }) => void;
  markChatRead: (doctorId: string, studentId?: string) => void;

  // Telegram
  telegramInfo: { configured: boolean; bot: boolean; userConnected: boolean } | null;
  refreshTelegramInfo: () => void;
  linkTelegram: () => Promise<{ linked: boolean; deepLink?: string; error?: string }>;
  getMessageQuota: (studentId: string, channel: 'whatsapp' | 'telegram') => MessageQuota;
  sendWhatsAppMessage: (
    studentId: string,
    type: MessageType,
    message: string
  ) => Promise<{ success: boolean; error?: string; via?: 'text' | 'template' }>;
  sendTelegramMessage: (studentId: string, type: MessageType, message: string) => Promise<{ success: boolean; error?: string }>;

  // Student lecture flow
  getStudentLectureState: (studentId: string, lectureId: string) => StudentLectureState | undefined;
  completeStage1: (lectureId: string, studentId: string) => void;
  submitAttendanceAndFeedback: (
    lectureId: string,
    studentId: string,
    starRating: number,
    feedbackComment: string
  ) => { success: boolean; quizWindowEnd?: string; error?: string };
  getAccess: (lectureId: string, studentId: string) => QuizAccess | null;
  startQuiz: (lectureId: string, studentId: string) => { success: boolean; error?: string };
  saveQuizDraft: (lectureId: string, studentId: string, answers: Answers) => void;
  submitQuiz: (
    lectureId: string,
    studentId: string,
    answers: Answers
  ) => {
    success: boolean;
    score: number;
    totalPoints: number;
    essayPending?: number;
    late?: boolean;
    error?: string;
  };
  logTabSwitch: (lectureId: string, studentId: string) => void;

  // Doctor: content
  createCourse: (title: string) => void;
  setCoursePrice: (courseId: string, price: number | null) => void;
  addQuestionsToLecture: (lectureId: string, newQuestions: QuestionBankItem[]) => void;
  updateQuestion: (lectureId: string, questionId: string, patch: Partial<QuestionBankItem>) => void;
  deleteQuestion: (lectureId: string, questionId: string) => void;
  updateLectureQuizSettings: (lectureId: string, settings: Partial<QuizSettings>) => void;
  updateLecture: (
    lectureId: string,
    patch: Partial<Pick<Lecture, 'title' | 'summary' | 'duration' | 'releaseAt'>>
  ) => void;
  addNewWeek: (courseId: string, title: string, description: string) => void;
  addNewLecture: (
    courseId: string,
    weekId: string,
    data: {
      title: string;
      duration: string;
      summary: string;
      releaseAt?: string;
      pdfTitle: string;
      pdfFile?: File | null;
    }
  ) => Promise<{ success: boolean; error?: string }>;
  replaceLecturePdf: (lectureId: string, file: File) => Promise<{ success: boolean; error?: string }>;
  deleteLecture: (lectureId: string) => void;

  // Doctor: grading & schedules
  getPendingEssays: () => PendingEssay[];
  gradeEssay: (studentId: string, lectureId: string, questionId: string, points: number) => void;
  allowRetake: (studentId: string, lectureId: string) => void;
  createGroup: (name: string, courseId?: string) => void;
  updateGroup: (groupId: string, patch: Partial<Pick<StudentGroup, 'name' | 'memberIds'>>) => void;
  deleteGroup: (groupId: string) => void;

  // Doctor: policies, certificates
  updateBadgePolicy: (newPolicy: BadgePolicy) => void;
  updateAlertSettings: (patch: Partial<AlertSettings>) => void;
  updateCertSettings: (patch: Partial<CertificateSettings>) => void;
  approveCertificate: (certId: string) => void;
  endCourse: (courseId: string) => { created: number };
  reopenCourse: (courseId: string) => void;

  getLeaderboard: (courseId?: string, weekId?: string) => LeaderboardEntry[];
  getStudentAnalytics: (studentId: string) => ReturnType<typeof calculateStudentAlarms> | undefined;

  resetAllData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEFAULT_BADGE_POLICY: BadgePolicy = {
  type: 'fixed_ranks',
  goldThreshold: 3,
  silverThreshold: 10,
  bronzeThreshold: 30
};

const DEFAULT_CERT_SETTINGS: CertificateSettings = {
  institutionName: 'المنصة التعليمية الأكاديمية',
  autoApprove: false
};

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const MAX_PDF_BYTES = 25 * 1024 * 1024;

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<ConnectionStatus>(() => (getToken() ? 'loading' : 'anon'));
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'offline'>('idle');
  const [bootTry, setBootTry] = useState(0);

  const [users, setUsers] = useState<User[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [studentStates, setStudentStates] = useState<StudentLectureState[]>([]);
  const [badgePolicy, setBadgePolicy] = useState<BadgePolicy>(DEFAULT_BADGE_POLICY);
  const [alertSettings, setAlertSettings] = useState<AlertSettings>(DEFAULT_ALERT_SETTINGS);
  const [certSettings, setCertSettings] = useState<CertificateSettings>(DEFAULT_CERT_SETTINGS);
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppNotificationLog[]>([]);
  const [telegramLogs, setTelegramLogs] = useState<TelegramNotificationLog[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [telegramInfo, setTelegramInfo] = useState<{ configured: boolean; bot: boolean; userConnected: boolean } | null>(null);
  const refreshTelegramInfo = () => {
    api.telegramStatus().then(setTelegramInfo).catch(() => setTelegramInfo(null));
  };

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [originalDoctor, setOriginalDoctor] = useState<User | null>(null);
  const isImpersonating = !!originalDoctor;
  const isDoctor = currentUser?.role === 'doctor' || !!originalDoctor;
  const isStaff = isDoctor || currentUser?.role === 'assistant';
  const doctorScopeId = originalDoctor?.id || (currentUser?.role === 'doctor' ? currentUser.id : currentUser?.assistantForDoctorId);

  // Keep the latest state visible to async helpers without re-creating them
  const statesRef = useRef(studentStates);
  statesRef.current = studentStates;
  const coursesRef = useRef(courses);
  coursesRef.current = courses;

  // Scratch copy taken when the doctor starts previewing a student (see impersonateStudent)
  const snapshotRef = useRef<{
    studentStates: StudentLectureState[];
    activityLogs: ActivityLog[];
    whatsappLogs: WhatsAppNotificationLog[];
    telegramLogs: TelegramNotificationLog[];
  } | null>(null);

  /* ------------------------- settings <-> documents ------------------------ */
  // The three settings live in one collection, one document each, shared across all doctors on this platform.
  const settingsDocs = useMemo(() => {
    const all = [
      { id: 'badgePolicy', value: badgePolicy },
      { id: 'alertSettings', value: alertSettings },
      { id: 'certSettings', value: certSettings }
    ];
    // students never receive (or write) the alert thresholds
    return isStaff ? all : all.filter(d => d.id !== 'alertSettings');
  }, [badgePolicy, alertSettings, certSettings, isStaff]);

  const setSettingsDocs = (docs: any[]) => {
    for (const d of docs) {
      if (d.id === 'badgePolicy') setBadgePolicy({ ...DEFAULT_BADGE_POLICY, ...d.value });
      if (d.id === 'alertSettings') setAlertSettings({ ...DEFAULT_ALERT_SETTINGS, ...d.value });
      if (d.id === 'certSettings') setCertSettings({ ...DEFAULT_CERT_SETTINGS, ...d.value });
    }
  };

  /* ------------------------------ server sync ----------------------------- */
  // Enrollments are never pushed through the generic diff-sync (the server only accepts changes to
  // them through the dedicated endpoints below), so they are not in this list; a bootstrap refetch
  // after each enrollment action keeps them current.

  const sync = useServerSync({
    active: status === 'ready' && !!currentUser && !originalDoctor,
    onState: setSyncState,
    collections: [
      { name: 'users', items: users as any[], set: setUsers },
      { name: 'courses', items: courses as any[], set: setCourses },
      { name: 'groups', items: groups as any[], set: setGroups },
      { name: 'studentStates', items: studentStates as any[], set: setStudentStates },
      { name: 'certificates', items: certificates as any[], set: setCertificates },
      { name: 'activityLogs', items: activityLogs as any[], set: setActivityLogs },
      { name: 'whatsappLogs', items: whatsappLogs as any[], set: setWhatsappLogs },
      { name: 'chatMessages', items: chatMessages as any[], set: setChatMessages },
      { name: 'settings', items: settingsDocs as any[], set: setSettingsDocs }
    ]
  });

  const applyBootstrap = (b: BootstrapData) => {
    setCurrentUser(b.me);
    setEnrollments((b.enrollments || []) as Enrollment[]);
    setTelegramLogs((b.telegramLogs || []) as TelegramNotificationLog[]);
    sync.apply({
      users: b.users,
      courses: b.courses,
      groups: b.groups,
      studentStates: b.studentStates,
      certificates: b.certificates,
      activityLogs: b.activityLogs,
      whatsappLogs: b.whatsappLogs,
      chatMessages: b.chatMessages,
      settings: b.settings
    });
  };

  const refreshFromServer = async () => {
    applyBootstrap(await api.bootstrap());
  };

  const clearAll = () => {
    sync.clear();
    setUsers([]);
    setCourses([]);
    setGroups([]);
    setStudentStates([]);
    setCertificates([]);
    setActivityLogs([]);
    setWhatsappLogs([]);
    setTelegramLogs([]);
    setEnrollments([]);
    setChatMessages([]);
    setBadgePolicy(DEFAULT_BADGE_POLICY);
    setAlertSettings(DEFAULT_ALERT_SETTINGS);
    setCertSettings(DEFAULT_CERT_SETTINGS);
    setCurrentUser(null);
    setOriginalDoctor(null);
    snapshotRef.current = null;
  };

  // Old versions kept everything in localStorage; that data is no longer used
  useEffect(() => {
    try {
      Object.keys(localStorage)
        .filter(k => /^lms_.*_v[23]$/.test(k))
        .forEach(k => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
  }, []);

  // First load: resume the session if there is a token
  useEffect(() => {
    if (!getToken()) {
      setStatus('anon');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    api
      .bootstrap()
      .then(b => {
        if (cancelled) return;
        applyBootstrap(b);
        setStatus('ready');
      })
      .catch(e => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 401) {
          clearToken();
          setStatus('anon');
        } else setStatus('offline');
      });
    return () => {
      cancelled = true;
    };
  }, [bootTry]);

  // The server rejected our token (expired, account removed…)
  useEffect(() => {
    const onUnauthorized = () => {
      clearAll();
      setStatus('anon');
    };
    window.addEventListener('lms:unauthorized', onUnauthorized);
    return () => window.removeEventListener('lms:unauthorized', onUnauthorized);
  }, []);

  // Telegram availability, checked once signed in (used to show/hide the "تليجرام" send button).
  useEffect(() => {
    if (status !== 'ready' || !currentUser) return;
    api.telegramStatus().then(setTelegramInfo).catch(() => setTelegramInfo(null));
  }, [status, currentUser?.id]);

  const retryConnect = () => setBootTry(n => n + 1);

  /* ------------------------------- helpers ------------------------------- */

  const findLecture = (lectureId: string): Lecture | undefined =>
    courses.flatMap(c => c.weeks.flatMap(w => w.lectures)).find(l => l.id === lectureId);

  const patchLecture = (lectureId: string, fn: (l: Lecture) => Lecture) =>
    setCourses(prev =>
      prev.map(c => ({
        ...c,
        weeks: c.weeks.map(w => ({
          ...w,
          lectures: w.lectures.map(l => (l.id === lectureId ? fn(l) : l))
        }))
      }))
    );

  const patchState = (
    studentId: string,
    lectureId: string,
    fn: (s: StudentLectureState) => StudentLectureState
  ) =>
    setStudentStates(prev =>
      prev.map(s => (s.studentId === studentId && s.lectureId === lectureId ? fn(s) : s))
    );

  const logActivity = (action: string, type: ActivityLog['type'], user: User, details?: string) => {
    const entry: ActivityLog = {
      id: uid('log'),
      userId: user.id,
      userName: user.name,
      userAcademicId: user.academicId,
      userRole: user.role,
      action,
      timestamp: new Date().toISOString(),
      type,
      details
    };
    setActivityLogs(prev => [entry, ...prev.slice(0, 299)]);
  };

  /* ------------------------ preview (impersonation) ---------------------- */
  // While the doctor previews a student's account, everything is written to a scratch copy and
  // nothing is sent to the server. On exit the real progress is restored.

  const restoreSnapshot = () => {
    const snap = snapshotRef.current;
    if (snap) {
      setStudentStates(snap.studentStates);
      setActivityLogs(snap.activityLogs);
      setWhatsappLogs(snap.whatsappLogs);
      setTelegramLogs(snap.telegramLogs);
      snapshotRef.current = null;
    }
  };

  const impersonateStudent = (studentId: string) => {
    const target = users.find(u => u.id === studentId && u.role === 'student');
    if (!target) return false;
    if (currentUser?.role !== 'doctor' && !originalDoctor) return false;

    if (!originalDoctor && currentUser) {
      snapshotRef.current = { studentStates, activityLogs, whatsappLogs, telegramLogs };
      setOriginalDoctor(currentUser);
    }
    setCurrentUser(target);
    return true;
  };

  /** Lets a doctor see exactly what one of their assistants sees, read-only, same as previewing a student. */
  const impersonateAssistant = (assistantId: string) => {
    const target = users.find(u => u.id === assistantId && u.role === 'assistant' && u.assistantForDoctorId === currentUser?.id);
    if (!target) return false;
    if (currentUser?.role !== 'doctor' || originalDoctor) return false;

    snapshotRef.current = { studentStates, activityLogs, whatsappLogs, telegramLogs };
    setOriginalDoctor(currentUser);
    setCurrentUser(target);
    return true;
  };

  const exitImpersonation = () => {
    if (originalDoctor) {
      restoreSnapshot();
      setCurrentUser(originalDoctor);
      setOriginalDoctor(null);
    }
  };

  /* --------------------------------- auth -------------------------------- */

  const enter = async (session: Session) => {
    setToken(session.token);
    const b = await api.bootstrap();
    applyBootstrap(b);
    setStatus('ready');
    return b.me;
  };

  const startSession = async (get: () => Promise<Session>, activity: string) => {
    try {
      const session = await get();
      if (originalDoctor) restoreSnapshot();
      setOriginalDoctor(null);
      const me = await enter(session);
      logActivity(activity, 'login', me);
      return { success: true as const };
    } catch (e) {
      clearToken();
      return { success: false as const, error: e instanceof Error ? e.message : 'تعذر تسجيل الدخول' };
    }
  };

  const login: AppContextType['login'] = (username, pass) =>
    startSession(() => api.login(username.trim(), pass.trim()), 'تسجيل دخول إلى المنصة');

  const quickLogin: AppContextType['quickLogin'] = async username => {
    await startSession(() => api.demoLogin(username), 'تسجيل دخول سريع');
  };

  const getCatalog = () => api.catalog();

  const signup: AppContextType['signup'] = async data => {
    try {
      const res = await api.signup({ ...data });
      return { success: true, pending: res.pending, message: res.message, telegramLink: res.telegramLink };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'تعذر إرسال الطلب' };
    }
  };

  const logout = () => {
    clearToken();
    clearAll();
    setStatus('anon');
  };

  const addUserByDoctor: AppContextType['addUserByDoctor'] = async data => {
    if (!isDoctor) return { success: false, error: 'هذه العملية للدكتور فقط' };
    try {
      const { user } = await api.createUser({ ...data });
      // A new doctor/assistant/enrolled student can also add courses or an enrollment on the
      // server side, so re-sync the whole picture instead of guessing what changed.
      await refreshFromServer();
      if (currentUser) {
        logActivity(
          `إضافة حساب ${user.role === 'doctor' ? 'دكتور' : user.role === 'assistant' ? 'مساعد' : 'طالب'} جديد: ${user.name}`,
          'admin',
          originalDoctor || currentUser
        );
      }
      return { success: true, user };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'تعذرت الإضافة' };
    }
  };

  const updateStudent: AppContextType['updateStudent'] = (studentId, updates) => {
    const { password, ...profile } = updates;
    if (password?.trim()) {
      api.setPassword(studentId, password.trim()).catch(() => undefined);
    }
    if (Object.keys(profile).length) {
      setUsers(prev => prev.map(u => (u.id === studentId ? { ...u, ...profile } : u)));
      if (currentUser?.id === studentId) setCurrentUser(prev => (prev ? { ...prev, ...profile } : null));
    }
    if (currentUser) logActivity(`تحديث بيانات الطالب (${studentId})`, 'admin', currentUser);
  };

  /* ------------------------------ enrollment ------------------------------ */

  const contactEnrollment: AppContextType['contactEnrollment'] = async (id, note) => {
    if (!isStaff) return;
    await api.contactEnrollment(id, note);
    await refreshFromServer();
  };

  const approveEnrollment: AppContextType['approveEnrollment'] = async id => {
    if (!isDoctor) return;
    await api.approveEnrollment(id);
    await refreshFromServer();
    if (currentUser) {
      const enr = enrollments.find(e => e.id === id);
      if (enr) logActivity(`قبول طلب تسجيل ${enr.studentName} في ${enr.courseTitle}`, 'admin', originalDoctor || currentUser);
    }
  };

  const rejectEnrollment: AppContextType['rejectEnrollment'] = async id => {
    if (!isDoctor) return;
    await api.rejectEnrollment(id);
    await refreshFromServer();
  };

  /* ---------------------------------- chat ---------------------------------- */
  // A student's in-platform question/problem thread with their doctor(s). WhatsApp/Telegram stay
  // for the doctor reaching out; this is for the student to reach the doctor.

  const getChatDoctors: AppContextType['getChatDoctors'] = () => {
    const map = new Map<string, string>();
    courses.forEach(c => map.set(c.doctorId, c.doctorName));
    return [...map.entries()].map(([doctorId, doctorName]) => ({ doctorId, doctorName }));
  };

  /** The current student's thread with one doctor. Staff use getChatThreadsForStaff instead. */
  const getChatThread: AppContextType['getChatThread'] = doctorId => {
    if (!currentUser) return [];
    return chatMessages
      .filter(m => m.doctorId === doctorId && m.studentId === currentUser.id)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const getChatThreadsForStaff: AppContextType['getChatThreadsForStaff'] = () => {
    if (!isStaff) return [];
    const byStudent = new Map<string, ChatMessage[]>();
    chatMessages.forEach(m => {
      const list = byStudent.get(m.studentId) || [];
      list.push(m);
      byStudent.set(m.studentId, list);
    });
    return [...byStudent.entries()]
      .map(([studentId, messages]) => {
        const sorted = messages.slice().sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        const student = users.find(u => u.id === studentId);
        const unread = sorted.filter(m => m.senderRole === 'student' && !m.readByDoctor).length;
        return { studentId, studentName: student?.name || 'طالب', messages: sorted, unread };
      })
      .sort((a, b) => {
        const at = a.messages[a.messages.length - 1]?.createdAt || '';
        const bt = b.messages[b.messages.length - 1]?.createdAt || '';
        return bt.localeCompare(at);
      });
  };

  const sendChatMessage: AppContextType['sendChatMessage'] = ({ doctorId, studentId, text }) => {
    if (!currentUser || !text.trim()) return;
    const sid = isStaff ? studentId : currentUser.id;
    if (!sid) return;
    const msg: ChatMessage = {
      id: uid('chat'),
      studentId: sid,
      doctorId,
      senderId: currentUser.id,
      senderName: currentUser.name,
      senderRole: currentUser.role,
      text: text.trim(),
      createdAt: new Date().toISOString(),
      readByDoctor: isStaff,
      readByStudent: !isStaff
    };
    setChatMessages(prev => [...prev, msg]);
  };

  const markChatRead: AppContextType['markChatRead'] = (doctorId, studentId) => {
    if (!currentUser) return;
    const sid = isStaff ? studentId : currentUser.id;
    if (!sid) return;
    setChatMessages(prev =>
      prev.map(m => {
        if (m.doctorId !== doctorId || m.studentId !== sid) return m;
        if (isStaff) return m.readByDoctor ? m : { ...m, readByDoctor: true };
        return m.readByStudent ? m : { ...m, readByStudent: true };
      })
    );
  };

  /* ------------------------------- telegram -------------------------------- */

  const linkTelegram: AppContextType['linkTelegram'] = async () => {
    try {
      return await api.telegramLinkCode();
    } catch (e) {
      return { linked: false, error: e instanceof Error ? e.message : 'تعذر إنشاء رابط الربط' };
    }
  };

  const getMessageQuota = (studentId: string, channel: 'whatsapp' | 'telegram'): MessageQuota => {
    const now = Date.now();
    const weekMs = 7 * 24 * 3600 * 1000;
    const source = channel === 'whatsapp' ? whatsappLogs : telegramLogs;
    const times = source
      .filter(l => l.studentId === studentId && l.status !== 'failed')
      .map(l => new Date(l.sentAt).getTime())
      .filter(t => !Number.isNaN(t));
    const inWeek = times.filter(t => now - t < weekMs);
    const last = times.length ? Math.max(...times) : 0;
    const max = alertSettings.maxMessagesPerWeek;

    if (inWeek.length >= max) {
      return { sentThisWeek: inWeek.length, max, canSend: false, reason: `وصلت للحد الأقصى (${max} رسائل أسبوعياً) لهذا الطالب` };
    }
    if (last && now - last < alertSettings.minHoursBetween * 3600 * 1000) {
      return {
        sentThisWeek: inWeek.length,
        max,
        canSend: false,
        reason: `يجب مرور ${alertSettings.minHoursBetween} ساعة بين رسالتين لنفس الطالب`
      };
    }
    return { sentThisWeek: inWeek.length, max, canSend: true };
  };

  const sendWhatsAppMessage: AppContextType['sendWhatsAppMessage'] = async (studentId, type, message) => {
    if (!isStaff) return { success: false, error: 'هذه العملية للدكتور أو المساعد فقط' };
    if (isImpersonating) return { success: false, error: 'لا تُرسل رسائل من وضع المعاينة' };
    try {
      const r = await api.whatsappSend({ studentId, type, message });
      const log = r.log as unknown as WhatsAppNotificationLog;
      setWhatsappLogs(prev => [log, ...prev]);
      sync.markSynced('whatsappLogs', log as any);
      if (currentUser) {
        const name = users.find(u => u.id === studentId)?.name || '';
        logActivity(r.ok ? `إرسال رسالة واتساب إلى ${name}` : `فشل إرسال رسالة واتساب إلى ${name}`, 'admin', currentUser);
      }
      return { success: r.ok, error: r.error, via: r.log.via };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'تعذر الإرسال' };
    }
  };

  const sendTelegramMessage: AppContextType['sendTelegramMessage'] = async (studentId, type, message) => {
    if (!isStaff) return { success: false, error: 'هذه العملية للدكتور أو المساعد فقط' };
    if (isImpersonating) return { success: false, error: 'لا تُرسل رسائل من وضع المعاينة' };
    try {
      const r = await api.telegramSend({ studentId, type, message });
      const log = r.log as unknown as TelegramNotificationLog;
      setTelegramLogs(prev => [log, ...prev]);
      if (currentUser) {
        const name = users.find(u => u.id === studentId)?.name || '';
        logActivity(r.ok ? `إرسال رسالة تليجرام إلى ${name}` : `فشل إرسال رسالة تليجرام إلى ${name}`, 'admin', currentUser);
      }
      return { success: r.ok, error: r.error };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : 'تعذر الإرسال' };
    }
  };

  /* --------------------------- student lecture flow ---------------------- */

  const getStudentLectureState = (studentId: string, lectureId: string) =>
    studentStates.find(s => s.studentId === studentId && s.lectureId === lectureId);

  const completeStage1 = (lectureId: string, studentId: string) => {
    const lecture = findLecture(lectureId);
    if (!lecture || !isLectureReleased(lecture.releaseAt, Date.now())) return;

    setStudentStates(prev => {
      const existing = prev.find(s => s.studentId === studentId && s.lectureId === lectureId);
      if (existing) {
        if (existing.stage1Completed) return prev;
        return prev.map(s =>
          s === existing
            ? { ...s, stage1Completed: true, stage1CompletedAt: new Date().toISOString(), currentStage: 2 }
            : s
        );
      }
      const fresh: StudentLectureState = {
        id: uid('state'),
        studentId,
        lectureId,
        courseId: lecture.courseId,
        weekId: lecture.weekId,
        currentStage: 2,
        stage1Completed: true,
        stage1CompletedAt: new Date().toISOString(),
        stage2Completed: false,
        attended: false,
        quizCompleted: false,
        quizAttemptsCount: 0
      };
      return [...prev, fresh];
    });

    const student = users.find(u => u.id === studentId) || currentUser;
    if (student) logActivity(`فتح شرح المحاضرة: ${lecture.title}`, 'lecture', student);
  };

  const submitAttendanceAndFeedback: AppContextType['submitAttendanceAndFeedback'] = (
    lectureId,
    studentId,
    starRating,
    feedbackComment
  ) => {
    const lecture = findLecture(lectureId);
    if (!lecture) return { success: false, error: 'المحاضرة غير موجودة' };
    const current = getStudentLectureState(studentId, lectureId);
    if (!current?.stage1Completed) return { success: false, error: 'افتح شرح المحاضرة أولاً' };

    const hours = lecture.quizSettings.validityWindowHours || 24;
    const now = new Date();
    const start = now.toISOString();
    const end = new Date(now.getTime() + hours * 3600 * 1000).toISOString();

    patchState(studentId, lectureId, s => ({
      ...s,
      stage2Completed: true,
      attended: true,
      attendanceSubmittedAt: s.attendanceSubmittedAt || start,
      starRating,
      feedbackComment: feedbackComment.trim(),
      quizWindowStart: s.quizWindowStart || start,
      quizWindowEnd: s.quizWindowEnd || end,
      currentStage: s.currentStage === 'completed' ? 'completed' : 3
    }));

    const student = users.find(u => u.id === studentId) || currentUser;
    if (student) {
      logActivity(`تسجيل حضور وتقييم ${starRating} نجوم لمحاضرة ${lecture.title}`, 'attendance', student);
    }
    return { success: true, quizWindowEnd: current.quizWindowEnd || end };
  };

  const getAccess = (lectureId: string, studentId: string): QuizAccess | null => {
    const lecture = findLecture(lectureId);
    if (!lecture) return null;
    return getQuizAccess(lecture, studentId, groups, getStudentLectureState(studentId, lectureId));
  };

  const startQuiz: AppContextType['startQuiz'] = (lectureId, studentId) => {
    const lecture = findLecture(lectureId);
    const state = getStudentLectureState(studentId, lectureId);
    if (!lecture || !state) return { success: false, error: 'المحاضرة غير متاحة' };
    if (state.quizCompleted) return { success: false, error: 'سلّمت هذا الكويز بالفعل' };
    if (state.quizStartedAt) return { success: true }; // resume the running attempt
    if (!lecture.questionBank.length) return { success: false, error: 'لا توجد أسئلة في هذا الكويز بعد' };

    const access = getQuizAccess(lecture, studentId, groups, state);
    if (access.status === 'locked' || access.status === 'not_scheduled') {
      return { success: false, error: access.reason };
    }
    if (access.status === 'not_open') return { success: false, error: 'الكويز لم يُفتح بعد' };
    if (access.status === 'closed') return { success: false, error: 'انتهت مدة الكويز' };

    const plan = buildAttemptPlan(lecture, studentId, (state.quizAttemptsCount || 0) + 1);
    patchState(studentId, lectureId, s => ({
      ...s,
      quizStartedAt: new Date().toISOString(),
      quizQuestionOrder: plan.questionOrder,
      quizOptionOrders: plan.optionOrders,
      draftAnswers: {},
      tabSwitches: 0,
      currentStage: 3
    }));

    const student = users.find(u => u.id === studentId) || currentUser;
    if (student) logActivity(`بدء كويز ${lecture.title}`, 'quiz', student);
    return { success: true };
  };

  const saveQuizDraft = (lectureId: string, studentId: string, answers: Answers) => {
    const s = getStudentLectureState(studentId, lectureId);
    if (!s || s.quizCompleted || !s.quizStartedAt) return;
    patchState(studentId, lectureId, st => ({ ...st, draftAnswers: answers }));
  };

  const logTabSwitch = (lectureId: string, studentId: string) => {
    const s = getStudentLectureState(studentId, lectureId);
    if (!s || s.quizCompleted || !s.quizStartedAt) return;
    patchState(studentId, lectureId, st => ({ ...st, tabSwitches: (st.tabSwitches || 0) + 1 }));
  };

  const submitQuiz: AppContextType['submitQuiz'] = (lectureId, studentId, answers) => {
    const lecture = findLecture(lectureId);
    // Read the freshest copy: the timer may call this right after a draft save
    const state = statesRef.current.find(s => s.studentId === studentId && s.lectureId === lectureId);
    if (!lecture || !state) return { success: false, score: 0, totalPoints: 0, error: 'المحاضرة غير متاحة' };
    if (state.quizCompleted) return { success: false, score: 0, totalPoints: 0, error: 'تم تسليم الكويز من قبل' };
    if (!state.quizStartedAt || !state.quizQuestionOrder) {
      return { success: false, score: 0, totalPoints: 0, error: 'ابدأ الكويز أولاً' };
    }

    const access = getQuizAccess(lecture, studentId, groups, state);
    const deadline = getQuizDeadline(state, access);
    const now = Date.now();
    // Late submissions are graded on what was auto-saved before the deadline.
    const late = deadline !== null && now > deadline + 15000;
    const finalAnswers = late ? state.draftAnswers || {} : answers;

    const graded = gradeAttempt(lecture.questionBank, state.quizQuestionOrder, finalAnswers);
    const finishedAt = new Date(now).toISOString();
    const duration = Math.max(0, Math.round((now - new Date(state.quizStartedAt).getTime()) / 1000));

    patchState(studentId, lectureId, s => ({
      ...s,
      quizCompleted: true,
      quizAutoScore: graded.autoScore,
      essayGrades: {},
      essayPending: graded.essayPending,
      quizScore: graded.autoScore,
      quizTotalPoints: graded.totalPoints,
      quizAttemptsCount: (s.quizAttemptsCount || 0) + 1,
      quizFinishedAt: finishedAt,
      quizDurationSeconds: duration,
      submittedLate: late || undefined,
      currentStage: 'completed',
      answers: finalAnswers
    }));

    const student = users.find(u => u.id === studentId) || currentUser;
    if (student) {
      logActivity(
        `تسليم كويز ${lecture.title}: ${graded.autoScore}/${graded.totalPoints}` +
          (graded.essayPending ? ` (${graded.essayPending} مقالي بانتظار التصحيح)` : ''),
        'quiz',
        student,
        `${duration} ثانية`
      );
    }
    return {
      success: true,
      score: graded.autoScore,
      totalPoints: graded.totalPoints,
      essayPending: graded.essayPending,
      late
    };
  };

  /* ------------------------------ doctor: content ------------------------ */

  const requireDoctor = () => isDoctor;

  const createCourse: AppContextType['createCourse'] = title => {
    if (!requireDoctor() || !title.trim() || !currentUser) return;
    const owner = originalDoctor || currentUser;
    const course: Course = {
      id: uid('crs'),
      title: title.trim(),
      code: `GEN-${Math.floor(100 + Math.random() * 900)}`,
      doctorName: owner.name,
      doctorId: owner.id,
      department: owner.department,
      description: `مقرر ${title.trim()} مع ${owner.name}`,
      color: 'from-indigo-600 to-blue-600',
      weeks: []
    };
    setCourses(prev => [...prev, course]);
    logActivity(`إنشاء مقرر جديد: ${course.title}`, 'admin', owner);
  };

  const setCoursePrice: AppContextType['setCoursePrice'] = (courseId, price) => {
    if (!requireDoctor()) return;
    setCourses(prev => prev.map(c => (c.id === courseId ? { ...c, price: price === null ? undefined : price } : c)));
  };

  const addQuestionsToLecture = (lectureId: string, newQuestions: QuestionBankItem[]) => {
    if (!requireDoctor()) return;
    patchLecture(lectureId, l => ({ ...l, questionBank: [...(l.questionBank || []), ...newQuestions] }));
    if (currentUser) logActivity(`إضافة ${newQuestions.length} سؤال إلى بنك أسئلة المحاضرة`, 'admin', originalDoctor || currentUser);
  };

  /**
   * Changing the correct answer of a question re-grades every student who already submitted a quiz
   * that included it, so a doctor's correction is reflected in everyone's score automatically.
   */
  const regradeForQuestion = (lectureId: string, questionId: string, bank: QuestionBankItem[]) => {
    const q = bank.find(x => x.id === questionId);
    if (!q || q.type === 'essay') return; // essay grades are entered by hand, never auto-graded

    setStudentStates(prev =>
      prev.map(s => {
        if (s.lectureId !== lectureId || !s.quizCompleted || !s.quizQuestionOrder?.includes(questionId) || !s.answers) return s;
        const graded = gradeAttempt(bank, s.quizQuestionOrder, s.answers);
        return {
          ...s,
          quizAutoScore: graded.autoScore,
          quizTotalPoints: graded.totalPoints,
          quizScore: graded.autoScore + sumEssayGrades(s.essayGrades)
        };
      })
    );
  };

  const updateQuestion = (lectureId: string, questionId: string, patch: Partial<QuestionBankItem>) => {
    if (!requireDoctor()) return;
    let nextBank: QuestionBankItem[] = [];
    patchLecture(lectureId, l => {
      nextBank = l.questionBank.map(q => {
        if (q.id !== questionId) return q;
        const next = { ...q, ...patch };
        if (patch.correctOptionIndex !== undefined) next.needsReview = undefined;
        return next;
      });
      return { ...l, questionBank: nextBank };
    });
    if (patch.correctOptionIndex !== undefined) {
      regradeForQuestion(lectureId, questionId, nextBank);
      if (currentUser) logActivity('تعديل إجابة سؤال (أُعيد احتساب درجات من سبق أن أجاب عليه)', 'admin', originalDoctor || currentUser);
    }
  };

  const deleteQuestion = (lectureId: string, questionId: string) => {
    if (!requireDoctor()) return;
    patchLecture(lectureId, l => ({ ...l, questionBank: l.questionBank.filter(q => q.id !== questionId) }));
  };

  const updateLectureQuizSettings = (lectureId: string, settings: Partial<QuizSettings>) => {
    if (!requireDoctor()) return;
    patchLecture(lectureId, l => ({ ...l, quizSettings: { ...l.quizSettings, ...settings } }));
  };

  const updateLecture: AppContextType['updateLecture'] = (lectureId, patch) => {
    if (!requireDoctor()) return;
    patchLecture(lectureId, l => ({ ...l, ...patch }));
  };

  const addNewWeek = (courseId: string, title: string, description: string) => {
    if (!requireDoctor()) return;
    setCourses(prev =>
      prev.map(c => {
        if (c.id !== courseId) return c;
        const n = c.weeks.length + 1;
        return {
          ...c,
          weeks: [
            ...c.weeks,
            { id: uid('week'), courseId, weekNumber: n, title: `الأسبوع ${n}: ${title}`, description, lectures: [] }
          ]
        };
      })
    );
  };

  const storePdf = async (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      return { error: 'الملف يجب أن يكون بصيغة PDF' } as const;
    }
    if (file.size > MAX_PDF_BYTES) return { error: 'حجم الملف أكبر من 25 ميجابايت' } as const;
    let pages: number;
    try {
      const { loadPdf } = await import('../utils/pdfText');
      pages = (await loadPdf(await file.arrayBuffer())).numPages;
    } catch {
      return { error: 'تعذر قراءة الملف، تأكد أنه PDF سليم وغير محمي بكلمة مرور' } as const;
    }
    try {
      const fileId = uid('pdf');
      await putFile(fileId, file);
      return { fileId, pages } as const;
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'تعذر رفع الملف إلى الخادم' } as const;
    }
  };

  const addNewLecture: AppContextType['addNewLecture'] = async (courseId, weekId, data) => {
    if (!requireDoctor()) return { success: false, error: 'هذه العملية للدكتور فقط' };
    let fileId: string | undefined;
    let pages = 1;
    if (data.pdfFile) {
      const stored = await storePdf(data.pdfFile);
      if ('error' in stored) return { success: false, error: stored.error };
      fileId = stored.fileId;
      pages = stored.pages;
    }

    setCourses(prev =>
      prev.map(course => {
        if (course.id !== courseId) return course;
        const total = course.weeks.flatMap(w => w.lectures).length;
        return {
          ...course,
          weeks: course.weeks.map(week => {
            if (week.id !== weekId) return week;
            const lecture: Lecture = {
              id: uid('lec'),
              weekId,
              courseId,
              title: data.title,
              order: total + 1,
              duration: data.duration || '45 دقيقة',
              summary: data.summary,
              releaseAt: data.releaseAt,
              explanationPdf: {
                title: data.pdfTitle || data.title,
                url: '',
                fileId,
                pageCount: pages,
                topics: [],
                pages: []
              },
              questionBank: [],
              quizSettings: {
                validityWindowHours: 24,
                durationMinutes: 15,
                randomizeQuestions: true,
                randomizeChoices: true,
                preventGoBack: false,
                questionsToDraw: 10,
                passingPercentage: 60,
                accessMode: 'window',
                revealAnswers: 'after_close'
              }
            };
            return { ...week, lectures: [...week.lectures, lecture] };
          })
        };
      })
    );
    if (currentUser) logActivity(`إضافة محاضرة جديدة: ${data.title}`, 'admin', originalDoctor || currentUser);
    return { success: true };
  };

  const replaceLecturePdf: AppContextType['replaceLecturePdf'] = async (lectureId, file) => {
    if (!requireDoctor()) return { success: false, error: 'هذه العملية للدكتور فقط' };
    const stored = await storePdf(file);
    if ('error' in stored) return { success: false, error: stored.error };
    const old = findLecture(lectureId)?.explanationPdf.fileId;
    patchLecture(lectureId, l => ({
      ...l,
      explanationPdf: { ...l.explanationPdf, fileId: stored.fileId, pageCount: stored.pages, pages: [], url: '' }
    }));
    if (old) deleteFile(old).catch(() => undefined);
    return { success: true };
  };

  const deleteLecture = (lectureId: string) => {
    if (!requireDoctor()) return;
    const fileId = findLecture(lectureId)?.explanationPdf.fileId;
    setCourses(prev =>
      prev.map(c => ({
        ...c,
        weeks: c.weeks.map(w => ({ ...w, lectures: w.lectures.filter(l => l.id !== lectureId) }))
      }))
    );
    setStudentStates(prev => prev.filter(s => s.lectureId !== lectureId));
    if (fileId) deleteFile(fileId).catch(() => undefined);
  };

  /* ---------------------------- doctor: grading -------------------------- */

  const getPendingEssays = (): PendingEssay[] => {
    const out: PendingEssay[] = [];
    for (const st of studentStates) {
      if (!st.quizCompleted || !st.quizQuestionOrder || !st.answers) continue;
      const lecture = findLecture(st.lectureId);
      const student = users.find(u => u.id === st.studentId);
      if (!lecture || !student) continue;
      for (const qid of st.quizQuestionOrder) {
        const q = lecture.questionBank.find(x => x.id === qid);
        const answer = st.answers[qid]?.textAnswer?.trim();
        if (q?.type === 'essay' && answer && st.essayGrades?.[qid] === undefined) {
          out.push({
            studentId: st.studentId,
            studentName: student.name,
            studentAcademicId: student.academicId,
            lectureId: lecture.id,
            lectureTitle: lecture.title,
            questionId: qid,
            prompt: q.prompt,
            answer,
            maxPoints: q.points
          });
        }
      }
    }
    return out;
  };

  const gradeEssay = (studentId: string, lectureId: string, questionId: string, points: number) => {
    if (!requireDoctor()) return;
    patchState(studentId, lectureId, s => {
      const lecture = findLecture(lectureId);
      const q = lecture?.questionBank.find(x => x.id === questionId);
      const clamped = Math.max(0, Math.min(points, q?.points ?? 1));
      const grades = { ...(s.essayGrades || {}), [questionId]: clamped };
      const stillPending = (s.quizQuestionOrder || []).filter(id => {
        const item = lecture?.questionBank.find(x => x.id === id);
        return item?.type === 'essay' && s.answers?.[id]?.textAnswer?.trim() && grades[id] === undefined;
      }).length;
      return {
        ...s,
        essayGrades: grades,
        essayPending: stillPending,
        quizScore: (s.quizAutoScore || 0) + sumEssayGrades(grades)
      };
    });
    if (currentUser) logActivity(`تصحيح إجابة مقالية (${points} نقطة)`, 'admin', originalDoctor || currentUser);
  };

  const allowRetake = (studentId: string, lectureId: string) => {
    if (!requireDoctor()) return;
    const lecture = findLecture(lectureId);
    patchState(studentId, lectureId, s => {
      const hours = lecture?.quizSettings.validityWindowHours || 24;
      const now = new Date();
      return {
        ...s,
        quizCompleted: false,
        quizScore: 0,
        quizAutoScore: 0,
        quizStartedAt: undefined,
        quizQuestionOrder: undefined,
        quizOptionOrders: undefined,
        draftAnswers: undefined,
        answers: undefined,
        essayGrades: undefined,
        essayPending: undefined,
        submittedLate: undefined,
        quizWindowStart: now.toISOString(),
        quizWindowEnd: new Date(now.getTime() + hours * 3600 * 1000).toISOString(),
        currentStage: 3
      };
    });
    if (currentUser) logActivity('السماح بإعادة الكويز لطالب', 'admin', originalDoctor || currentUser);
  };

  const createGroup: AppContextType['createGroup'] = (name, courseId) => {
    if (!requireDoctor() || !name.trim()) return;
    setGroups(prev => [
      ...prev,
      { id: uid('grp'), courseId: courseId || coursesRef.current[0]?.id || '', name: name.trim(), memberIds: [] }
    ]);
  };
  const updateGroup: AppContextType['updateGroup'] = (groupId, patch) => {
    if (!requireDoctor()) return;
    setGroups(prev => prev.map(g => (g.id === groupId ? { ...g, ...patch } : g)));
  };
  const deleteGroup = (groupId: string) => {
    if (!requireDoctor()) return;
    setGroups(prev => prev.filter(g => g.id !== groupId));
    setCourses(prev =>
      prev.map(c => ({
        ...c,
        weeks: c.weeks.map(w => ({
          ...w,
          lectures: w.lectures.map(l => ({
            ...l,
            quizSettings: {
              ...l.quizSettings,
              groupSchedules: l.quizSettings.groupSchedules?.filter(x => x.groupId !== groupId)
            }
          }))
        }))
      }))
    );
  };

  /* ------------------- doctor: policies, certificates -------------- */

  const updateBadgePolicy = (policy: BadgePolicy) => {
    if (!requireDoctor()) return;
    setBadgePolicy(policy);
    if (currentUser) {
      logActivity(
        `تحديث سياسة الدروع إلى (${policy.type === 'fixed_ranks' ? 'المراكز الثابتة' : 'النسب المئوية'})`,
        'admin',
        originalDoctor || currentUser
      );
    }
  };

  const updateAlertSettings = (patch: Partial<AlertSettings>) => {
    if (!requireDoctor()) return;
    setAlertSettings(prev => ({ ...prev, ...patch }));
  };

  const updateCertSettings = (patch: Partial<CertificateSettings>) => {
    if (!requireDoctor()) return;
    setCertSettings(prev => ({ ...prev, ...patch }));
  };

  const approveCertificate = (certId: string) => {
    if (!requireDoctor()) return;
    setCertificates(prev =>
      prev.map(c => (c.id === certId ? { ...c, status: 'approved', doctorApprovedAt: new Date().toISOString() } : c))
    );
    const cert = certificates.find(c => c.id === certId);
    if (cert && currentUser) logActivity(`اعتماد شهادة الطالب ${cert.studentName}`, 'certificate', originalDoctor || currentUser);
  };

  const rankTitles: Record<number, string> = {
    1: 'المركز الأول',
    2: 'المركز الثاني',
    3: 'المركز الثالث'
  };

  const issueCertificates = (course: Course): number => {
    const board = getLeaderboard(course.id).filter(e => e.quizzesCompleted > 0);
    const top = board.slice(0, 3);
    const fresh: Certificate[] = [];

    top.forEach((entry, i) => {
      const exists = certificates.some(c => c.studentId === entry.studentId && c.courseId === course.id);
      if (exists) return;
      const rank = (i + 1) as 1 | 2 | 3;
      fresh.push({
        id: uid('cert'),
        certificateCode: `CERT-${new Date().getFullYear()}-${course.code}-${entry.studentAcademicId}`,
        studentId: entry.studentId,
        studentName: entry.studentName,
        studentAcademicId: entry.studentAcademicId,
        courseId: course.id,
        courseTitle: course.title,
        courseCode: course.code,
        doctorName: course.doctorName,
        rankAchieved: rank,
        rankTitle: rankTitles[rank],
        totalPoints: entry.totalPoints,
        issueDate: new Date().toISOString().split('T')[0],
        status: certSettings.autoApprove ? 'approved' : 'pending_approval',
        doctorApprovedAt: certSettings.autoApprove ? new Date().toISOString() : undefined,
        sealImageUrl: '',
        signatureImageUrl: ''
      });
    });
    if (fresh.length) setCertificates(prev => [...fresh, ...prev]);
    return fresh.length;
  };

  const endCourse = (courseId: string) => {
    if (!requireDoctor()) return { created: 0 };
    const course = courses.find(c => c.id === courseId);
    if (!course) return { created: 0 };
    setCourses(prev =>
      prev.map(c => (c.id === courseId ? { ...c, isCompleted: true, endedAt: new Date().toISOString() } : c))
    );
    const created = issueCertificates(course);
    if (currentUser) logActivity(`إنهاء الكورس وإصدار ${created} شهادة`, 'certificate', originalDoctor || currentUser);
    return { created };
  };

  const reopenCourse = (courseId: string) => {
    if (!requireDoctor()) return;
    setCourses(prev => prev.map(c => (c.id === courseId ? { ...c, isCompleted: false, endedAt: undefined } : c)));
    // Approved certificates were already handed out; only drafts are withdrawn.
    setCertificates(prev => prev.filter(c => !(c.courseId === courseId && c.status === 'pending_approval')));
  };

  /* ------------------------------ analytics ------------------------------ */

  const getLeaderboard: AppContextType['getLeaderboard'] = (courseId, weekId) => {
    if (!courseId) {
      return calculateLeaderboard(users.filter(u => u.role === 'student'), studentStates, badgePolicy, weekId);
    }
    const approvedIds = new Set(
      enrollments.filter(e => e.courseId === courseId && e.status === 'approved').map(e => e.studentId)
    );
    const pool = users.filter(u => u.role === 'student' && approvedIds.has(u.id));
    const states = studentStates.filter(s => s.courseId === courseId);
    return calculateLeaderboard(pool, states, badgePolicy, weekId);
  };

  const getStudentAnalytics = (studentId: string) => {
    const student = users.find(u => u.id === studentId);
    if (!student) return undefined;
    const myCourseIds = new Set(
      enrollments.filter(e => e.studentId === studentId && e.status === 'approved').map(e => e.courseId)
    );
    const course = courses.find(c => myCourseIds.has(c.id)) || courses[0];
    if (!course) return undefined;
    return calculateStudentAlarms(student, course, studentStates, alertSettings);
  };

  const resetAllData = async () => {
    if (!isDoctor) return;
    try {
      await api.reset();
      await refreshFromServer();
    } catch {
      /* a 401 here means the account no longer exists: the unauthorized handler signs out */
    }
  };

  return (
    <AppContext.Provider
      value={{
        status,
        syncState,
        retryConnect,
        users,
        currentUser,
        originalDoctor,
        isImpersonating,
        doctorScopeId,
        courses,
        groups,
        studentStates,
        badgePolicy,
        alertSettings,
        certSettings,
        certificates,
        activityLogs,
        whatsappLogs,
        telegramLogs,
        enrollments,
        chatMessages,
        login,
        signup,
        getCatalog,
        addUserByDoctor,
        updateStudent,
        logout,
        quickLogin,
        impersonateStudent,
        impersonateAssistant,
        exitImpersonation,
        contactEnrollment,
        approveEnrollment,
        rejectEnrollment,
        getChatDoctors,
        getChatThread,
        getChatThreadsForStaff,
        sendChatMessage,
        markChatRead,
        telegramInfo,
        refreshTelegramInfo,
        linkTelegram,
        getMessageQuota,
        sendWhatsAppMessage,
        sendTelegramMessage,
        getStudentLectureState,
        completeStage1,
        submitAttendanceAndFeedback,
        getAccess,
        startQuiz,
        saveQuizDraft,
        submitQuiz,
        logTabSwitch,
        createCourse,
        setCoursePrice,
        addQuestionsToLecture,
        updateQuestion,
        deleteQuestion,
        updateLectureQuizSettings,
        updateLecture,
        addNewWeek,
        addNewLecture,
        replaceLecturePdf,
        deleteLecture,
        getPendingEssays,
        gradeEssay,
        allowRetake,
        createGroup,
        updateGroup,
        deleteGroup,
        updateBadgePolicy,
        updateAlertSettings,
        updateCertSettings,
        approveCertificate,
        endCourse,
        reopenCourse,
        getLeaderboard,
        getStudentAnalytics,
        resetAllData
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
