export type UserRole = 'doctor' | 'student' | 'assistant';

export type BadgeTier = 'gold' | 'silver' | 'bronze' | 'none';

export interface UserStats {
  completedLectures: number;
  totalLectures: number;
  quizAverage: number;
  totalPoints: number;
  submittedAssignments: number;
  attendanceRate: number;
  consecutiveAbsences: number;
  performanceDropPercentage?: number;
  hasAbsenceAlarm?: boolean;
  hasPerformanceAlarm?: boolean;
}

export interface User {
  id: string;
  academicId: string; // Unique student code or doctor ID
  username: string;   // Unique username
  name: string;
  email: string;
  phone: string;      // WhatsApp phone number
  role: UserRole;
  department: string;
  /** Faculty (كلية) the account belongs to; `department` holds its chosen departments. */
  faculty?: string;
  /** Never sent to the browser: passwords are hashed on the server. Only used to type the seed data. */
  password?: string;
  avatar?: string;
  joinedDate: string;
  /** 'pending' = signed up but no course has been approved yet; cannot log in until a doctor approves one. */
  status: 'active' | 'inactive' | 'suspended' | 'pending';
  lastLogin?: string;
  stats?: UserStats;
  notes?: string;
  /** Doctor only: the subjects they teach, entered when their account is created. One Course is created per subject. */
  subjects?: string[];
  /** Assistant only: the doctor this assistant works for. An assistant sees exactly what that doctor sees. */
  assistantForDoctorId?: string;
  /** Telegram chat id once the user has linked their account (see /start deep link). */
  telegramChatId?: string;
  /** One-time code shown to the user to link Telegram; cleared once linked. */
  telegramLinkCode?: string;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'essay';

export interface QuestionBankItem {
  id: string;
  lectureId: string;
  questionNumber: number;
  type: QuestionType;
  prompt: string;
  options: string[]; // ['أ) ...', 'ب) ...'] or ['أ) صح', 'ب) خطأ']
  correctOptionIndex?: number; // 0-based index or undefined for essay
  correctAnswerText?: string;  // e.g. "ب" or "صح"
  explanation?: string;
  points: number; // default 1
  /** Set by the importer when the answer key could not be read from the file. */
  needsReview?: boolean;
}

/** How the quiz opens (PDF plan §3): A = public window, B = per group, C = per student. */
export type QuizAccessMode = 'window' | 'groups' | 'per_student';

export interface QuizSchedule {
  opensAt: string;  // ISO
  closesAt: string; // ISO
  durationMinutes?: number; // overrides QuizSettings.durationMinutes
}

export interface QuizSettings {
  validityWindowHours: number; // per-student window starting at attendance (legacy / option A without public dates)
  durationMinutes: number;     // time to finish the quiz once the student starts it
  randomizeQuestions: boolean; // anti-cheat shuffle
  randomizeChoices: boolean;   // anti-cheat shuffle choices
  preventGoBack: boolean;      // anti-cheat prevent revisiting questions
  questionsToDraw: number;     // subset from bank
  passingPercentage: number;
  accessMode?: QuizAccessMode;
  /** Option A: one public window shared by everybody; the timer still starts when each student enters. */
  publicWindow?: QuizSchedule;
  /** Option B: one schedule per group. */
  groupSchedules?: (QuizSchedule & { groupId: string })[];
  /** Option C: one schedule per student. */
  studentSchedules?: (QuizSchedule & { studentId: string })[];
  /** When the correct answers become visible to students after they submit. */
  revealAnswers?: 'after_submit' | 'after_close' | 'never';
}

export interface StudentGroup {
  id: string;
  courseId: string;
  name: string;
  memberIds: string[];
}

export interface AlertSettings {
  absenceConsecutive: number; // consecutive lectures not completed
  graceHours: number;         // a lecture only counts as missed this long after its release
  dropPercent: number;        // relative drop between two averages, in %
  dropWindow: number;         // how many quizzes per average (plan: 3)
  maxMessagesPerWeek: number; // message cap per student, rolling 7 days (shared by whatsapp + telegram)
  minHoursBetween: number;    // minimum gap between two messages to the same student
  /** Which channels the automatic alert sender uses. The server sends without any click when a channel is configured. */
  channels: ('whatsapp' | 'telegram')[];
}

export interface CertificateSettings {
  institutionName: string;
  autoApprove: boolean;
  signatureDataUrl?: string;
}

export interface ExplanationPdf {
  title: string;
  url: string;
  /** Key of the uploaded PDF on the server (see utils/fileStore). Absent for the demo lectures. */
  fileId?: string;
  pageCount: number;
  topics: string[];
  pages: {
    pageNumber: number;
    title: string;
    content: string;
    diagramType?: 'flowchart' | 'tree' | 'table' | 'code' | 'summary';
  }[];
}

export interface Lecture {
  id: string;
  weekId: string;
  courseId: string;
  title: string;
  order: number;
  duration: string;
  summary: string;
  videoUrl?: string;
  /** When the lecture becomes available. Missing = available from the start. */
  releaseAt?: string;
  explanationPdf: ExplanationPdf;
  questionBank: QuestionBankItem[];
  quizSettings: QuizSettings;
}

export interface CourseWeek {
  id: string;
  courseId: string;
  weekNumber: number;
  title: string;
  description: string;
  lectures: Lecture[];
}

export interface Course {
  id: string;
  title: string;
  code: string;
  doctorName: string;
  doctorId: string;
  department: string;
  description: string;
  color: string;
  weeks: CourseWeek[];
  lectures?: Lecture[]; // flat helper
  isCompleted?: boolean;
  endedAt?: string;
  /** Price the doctor set for this course, shown to students during enrollment. Absent = free / not priced yet. */
  price?: number;
}

export interface StudentLectureState {
  id: string;
  studentId: string;
  lectureId: string;
  courseId: string;
  weekId: string;
  
  // 3-Stage Progress: 1 (PDF) -> 2 (Attendance & Rating) -> 3 (Quiz) -> Completed
  currentStage: 1 | 2 | 3 | 'completed';
  
  // Stage 1: PDF Viewer
  stage1Completed: boolean;
  stage1CompletedAt?: string;
  
  // Stage 2: Attendance + Rating + Comment
  stage2Completed: boolean;
  attended: boolean;
  attendanceSubmittedAt?: string;
  starRating?: number; // 1 to 5
  feedbackComment?: string;
  
  // Individual Student Quiz Window Timer (Requirement: starts when student enters stage 2)
  quizWindowStart?: string; // ISO string
  quizWindowEnd?: string;   // ISO string (start + validityWindowHours)
  isWindowExpired?: boolean;
  
  // Stage 3: Quiz Execution
  quizCompleted: boolean;
  quizScore?: number;
  quizTotalPoints?: number;
  quizAttemptsCount: number;
  quizStartedAt?: string;
  quizFinishedAt?: string;
  quizQuestionOrder?: string[]; // IDs of randomized questions drawn
  quizOptionOrders?: Record<string, number[]>; // per question: display position -> original option index
  answers?: Record<string, { selectedOptionIndex?: number; textAnswer?: string }>;
  /** Auto-saved while the quiz is running so a reload never loses answers or restarts the timer. */
  draftAnswers?: Record<string, { selectedOptionIndex?: number; textAnswer?: string }>;
  quizAutoScore?: number;                 // points from MCQ / true-false
  essayGrades?: Record<string, number>;   // points the doctor gave to essay answers
  essayPending?: number;                  // essay answers still waiting for the doctor
  tabSwitches?: number;                   // times the student left the quiz tab
  quizDurationSeconds?: number;           // start -> submit
  submittedLate?: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  studentId: string;
  studentName: string;
  studentAcademicId: string;
  studentAvatar?: string;
  totalPoints: number;
  quizzesCompleted: number;
  latestQuizScore: number;
  latestQuizFinishedAt?: string;
  totalAttempts: number;
  badge: BadgeTier;
  isCurrentUser?: boolean;
}

export interface BadgePolicy {
  type: 'fixed_ranks' | 'percentage' | 'percentiles';
  goldThreshold: number;   // ranks 1-3 or top 5%
  silverThreshold: number; // ranks 4-10 or next 10%
  bronzeThreshold: number; // ranks 11-30 or next 20%
}

export interface Certificate {
  id: string;
  certificateCode: string;
  studentId: string;
  studentName: string;
  studentAcademicId: string;
  courseId: string;
  courseTitle: string;
  courseCode: string;
  doctorName: string;
  rankAchieved: 1 | 2 | 3;
  rankTitle: string; // 'المركز الأول' | 'المركز الثاني' | 'المركز الثالث'
  totalPoints: number;
  issueDate: string;
  status: 'pending_approval' | 'approved' | 'issued';
  doctorApprovedAt?: string;
  sealImageUrl: string;
  signatureImageUrl: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  userAcademicId: string;
  userRole: UserRole;
  action: string;
  timestamp: string;
  type: 'login' | 'lecture' | 'quiz' | 'attendance' | 'certificate' | 'admin';
  details?: string;
}

export interface WhatsAppNotificationLog {
  id: string;
  studentId: string;
  studentName: string;
  phone: string;
  messageType: 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award' | 'enrollment_contact';
  messageText: string;
  sentAt: string;
  /** 'sent' = accepted by WhatsApp Cloud API. 'opened' = old manual flow. 'failed' = rejected (see error). */
  status: 'sent' | 'simulated' | 'opened' | 'failed';
  /** WhatsApp message id returned by Meta when it accepted the message. */
  waMessageId?: string;
  /** 'template' when the 24-hour window was closed and the approved template was used. */
  via?: 'text' | 'template';
  error?: string;
  /** True for messages the automatic alert sender fired on its own, without a doctor clicking. */
  auto?: boolean;
}

export interface TelegramNotificationLog {
  id: string;
  studentId: string;
  studentName: string;
  chatId: string;
  messageType: 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award' | 'enrollment_contact';
  messageText: string;
  sentAt: string;
  status: 'sent' | 'failed';
  telegramMessageId?: number;
  error?: string;
  auto?: boolean;
}

/* --------------------------------- enrollment --------------------------------- */
// PDF plan: a student picks the course(s)/doctor(s) they want, the doctor's assistant contacts them
// for payment off-platform, and the doctor approves the request (from the app or the emailed link)
// before the student can sign in.

export type EnrollmentStatus = 'pending_contact' | 'approved' | 'rejected';

export interface Enrollment {
  id: string;
  studentId: string;
  studentName: string;
  studentAcademicId: string;
  studentPhone: string;
  studentEmail: string;
  courseId: string;
  courseTitle: string;
  doctorId: string;
  doctorName: string;
  status: EnrollmentStatus;
  requestedAt: string;
  /** Assistant/doctor note: has the student been contacted, and any payment note. */
  contactedAt?: string;
  paymentNote?: string;
  decidedAt?: string;
  decidedBy?: string; // doctor name
}

/* ----------------------------------- chat ---------------------------------- */
// A student's in-platform question/problem thread with their doctor. Separate from the
// WhatsApp/Telegram outreach logs: this is for the student to reach the doctor, not the other way.

export interface ChatMessage {
  id: string;
  studentId: string;
  doctorId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
  readByDoctor?: boolean;
  readByStudent?: boolean;
}

