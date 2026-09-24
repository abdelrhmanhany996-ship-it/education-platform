import { CollectionName, Doc, Store } from './store';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Never leaves the server. */
const PRIVATE_USER_FIELDS = ['pw', 'password', 'telegramLinkCode'];

export const publicUser = (u: Doc): Doc => {
  const out = { ...u };
  PRIVATE_USER_FIELDS.forEach(k => delete out[k]);
  return out;
};

/** What a student may know about a classmate: enough for the leaderboard, nothing personal. */
const classmate = (u: Doc): Doc => ({
  id: u.id,
  name: u.name,
  academicId: u.academicId,
  avatar: u.avatar,
  role: u.role,
  username: u.username,
  department: u.department,
  status: u.status,
  joinedDate: u.joinedDate,
  email: '',
  phone: ''
});

const STATE_PUBLIC_FIELDS = [
  'id',
  'studentId',
  'lectureId',
  'courseId',
  'weekId',
  'currentStage',
  'stage1Completed',
  'stage2Completed',
  'attended',
  'quizCompleted',
  'quizScore',
  'quizTotalPoints',
  'quizAttemptsCount',
  'quizFinishedAt',
  '_ts'
];
const pick = (d: Doc, keys: string[]) => Object.fromEntries(keys.filter(k => k in d).map(k => [k, d[k]]));

export interface Bootstrap {
  me: Doc;
  users: Doc[];
  courses: Doc[];
  groups: Doc[];
  studentStates: Doc[];
  certificates: Doc[];
  activityLogs: Doc[];
  whatsappLogs: Doc[];
  telegramLogs: Doc[];
  enrollments: Doc[];
  chatMessages: Doc[];
  settings: Doc[];
}

/** The doctor whose data a doctor-or-assistant account should see. */
export const doctorScopeOf = (me: Doc): string | undefined => (me.role === 'doctor' ? me.id : me.assistantForDoctorId);

export async function buildBootstrap(store: Store, me: Doc): Promise<Bootstrap> {
  const [users, courses, groups, states, certs, waLogs, tgLogs, enrollments, chats, settings] = await Promise.all([
    store.getAll('users'),
    store.getAll('courses'),
    store.getAll('groups'),
    store.getAll('studentStates'),
    store.getAll('certificates'),
    store.getAll('whatsappLogs'),
    store.getAll('telegramLogs'),
    store.getAll('enrollments'),
    store.getAll('chatMessages'),
    store.getAll('settings')
  ]);
  const logs = await store.getAll('activityLogs');

  /* ------------------------------ doctor / assistant ----------------------------- */
  const doctorId = doctorScopeOf(me);
  if (doctorId) {
    const ownCourses = courses.filter(c => c.doctorId === doctorId);
    const ownCourseIds = new Set(ownCourses.map(c => c.id));
    const myEnrollments = enrollments.filter(e => ownCourseIds.has(e.courseId));
    // Anyone who ever requested or is enrolled in one of this doctor's courses is visible to them.
    const relatedStudentIds = new Set(myEnrollments.map(e => e.studentId));
    const assistants = users.filter(u => u.role === 'assistant' && u.assistantForDoctorId === doctorId);
    const visibleIds = new Set<string>([doctorId, me.id, ...relatedStudentIds, ...assistants.map(a => a.id)]);

    return {
      me: publicUser(me),
      users: users.filter(u => visibleIds.has(u.id)).map(publicUser),
      courses: ownCourses,
      groups: groups.filter(g => ownCourseIds.has(g.courseId)),
      studentStates: states.filter(s => ownCourseIds.has(s.courseId)),
      certificates: certs.filter(c => ownCourseIds.has(c.courseId)),
      activityLogs: logs.filter(l => visibleIds.has(l.userId)),
      whatsappLogs: waLogs.filter(l => relatedStudentIds.has(l.studentId)),
      telegramLogs: tgLogs.filter(l => relatedStudentIds.has(l.studentId)),
      enrollments: myEnrollments,
      chatMessages: chats.filter(c => c.doctorId === doctorId),
      settings
    };
  }

  /* --------------------------------- student -------------------------------- */
  const myApproved = enrollments.filter(e => e.studentId === me.id && e.status === 'approved');
  const myCourseIds = new Set(myApproved.map(e => e.courseId));
  const myCourses = courses.filter(c => myCourseIds.has(c.id));
  const doctorIds = new Set(myCourses.map(c => c.doctorId));
  const classmateIds = new Set(
    enrollments.filter(e => e.status === 'approved' && myCourseIds.has(e.courseId)).map(e => e.studentId)
  );

  return {
    me: publicUser(me),
    users: users
      .filter(u => u.id === me.id || doctorIds.has(u.id) || classmateIds.has(u.id))
      .map(u => (u.id === me.id ? publicUser(u) : classmate(u))),
    courses: myCourses,
    groups: groups.filter(g => myCourseIds.has(g.courseId) && g.memberIds?.includes(me.id)).map(g => ({ ...g, memberIds: [me.id] })),
    studentStates: states
      .filter(s => s.studentId === me.id || myCourseIds.has(s.courseId))
      .map(s => (s.studentId === me.id ? s : (pick(s, STATE_PUBLIC_FIELDS) as Doc))),
    certificates: certs.filter(c => c.studentId === me.id),
    activityLogs: logs.filter(l => l.userId === me.id),
    whatsappLogs: [],
    telegramLogs: [],
    enrollments: enrollments.filter(e => e.studentId === me.id),
    chatMessages: chats.filter(c => c.studentId === me.id),
    settings: settings.filter(s => s.id === 'badgePolicy' || s.id === 'certSettings')
  };
}

/**
 * Who may write what. Returns the documents that are actually safe to store.
 * (Quiz grading still happens in the browser; moving it here is the next hardening step.)
 */
export async function authorizeWrite(
  store: Store,
  me: Doc,
  collection: CollectionName,
  upserts: Doc[],
  deletes: string[]
): Promise<{ upserts: Doc[]; deletes: string[] }> {
  if (upserts.some(d => !d || typeof d.id !== 'string' || !d.id) || deletes.some(id => typeof id !== 'string')) {
    throw new HttpError(400, 'بيانات غير صالحة');
  }

  // Enrollment decisions only ever happen through the dedicated endpoints (approve/reject/contact),
  // which also update the student's account status — never through the generic sync.
  if (collection === 'enrollments') throw new HttpError(403, 'استخدم شاشة طلبات التسجيل');

  const doctorId = doctorScopeOf(me);

  if (doctorId) {
    const ownCourses = await store.getAll('courses');
    const ownCourseIds = new Set(ownCourses.filter(c => c.doctorId === doctorId).map(c => c.id));

    if (collection === 'users') {
      if (me.role !== 'doctor') throw new HttpError(403, 'هذه العملية للدكتور فقط');
      const safe: Doc[] = [];
      for (const d of upserts) {
        const existing = await store.get('users', d.id);
        // New accounts go through POST /api/users so their password gets hashed
        if (!existing) throw new HttpError(400, 'أنشئ الحسابات من شاشة الإضافة');
        const { password, pw, role, ...rest } = d;
        safe.push({ ...existing, ...rest, role: existing.role, pw: existing.pw });
      }
      for (const id of deletes) {
        const target = await store.get('users', id);
        if (target?.role === 'doctor' || id === me.id) throw new HttpError(403, 'لا يمكن حذف حساب دكتور');
      }
      return { upserts: safe, deletes };
    }

    if (collection === 'courses' || collection === 'groups') {
      if (me.role !== 'doctor') throw new HttpError(403, 'هذه العملية للدكتور فقط');
      for (const d of upserts) {
        const cId = collection === 'courses' ? d.id : d.courseId;
        const existing = await store.get(collection, d.id);
        const ownsExisting = existing ? ownCourseIds.has(collection === 'courses' ? existing.id : existing.courseId) : true;
        if (!ownCourseIds.has(cId) && !(collection === 'groups' && !cId)) {
          if (!ownsExisting) throw new HttpError(403, 'هذا المقرر ليس ملكك');
        }
      }
      return { upserts, deletes };
    }

    if (collection === 'studentStates') {
      if (me.role !== 'doctor') throw new HttpError(403, 'هذه العملية للدكتور فقط'); // grading/retakes are doctor-only
      for (const d of upserts) {
        if (!ownCourseIds.has(d.courseId)) throw new HttpError(403, 'هذا الطالب ليس في أحد مقرراتك');
      }
      return { upserts, deletes };
    }

    if (collection === 'chatMessages') {
      if (deletes.length) throw new HttpError(403, 'غير مسموح');
      const safe: Doc[] = [];
      for (const d of upserts) {
        if (d.doctorId !== doctorId) throw new HttpError(403, 'هذا الطالب ليس ضمن طلابك');
        const existing = await store.get('chatMessages', d.id);
        if (existing) {
          // Only the read flags may change on an existing message; the text/sender are fixed once sent.
          safe.push({ ...existing, readByDoctor: d.readByDoctor ?? existing.readByDoctor, readByStudent: d.readByStudent ?? existing.readByStudent });
        } else {
          if (d.senderId !== me.id) throw new HttpError(403, 'غير مسموح');
          safe.push({ ...d, senderRole: me.role, senderName: me.name });
        }
      }
      return { upserts: safe, deletes };
    }

    // whatsappLogs / telegramLogs are written only by the server itself when sending; certificates,
    // activityLogs and settings are fine to allow broadly for a doctor/assistant of a small platform.
    return { upserts, deletes };
  }

  // Student
  if (deletes.length) throw new HttpError(403, 'غير مسموح');

  if (collection === 'chatMessages') {
    const myEnrollments = (await store.getAll('enrollments')).filter(e => e.studentId === me.id && e.status === 'approved');
    const myDoctorIds = new Set(
      (await Promise.all(myEnrollments.map(e => store.get('courses', e.courseId)))).filter(Boolean).map(c => c!.doctorId)
    );
    const safe: Doc[] = [];
    for (const d of upserts) {
      if (d.studentId !== me.id) throw new HttpError(403, 'غير مسموح');
      const existing = await store.get('chatMessages', d.id);
      if (existing) {
        if (existing.studentId !== me.id) throw new HttpError(403, 'غير مسموح');
        safe.push({ ...existing, readByStudent: d.readByStudent ?? existing.readByStudent });
      } else {
        if (d.senderId !== me.id) throw new HttpError(403, 'غير مسموح');
        if (!myDoctorIds.has(d.doctorId)) throw new HttpError(403, 'هذا ليس دكتورك');
        safe.push({ ...d, senderRole: me.role, senderName: me.name });
      }
    }
    return { upserts: safe, deletes };
  }

  if (collection === 'users') {
    // A student may only edit their own contact details, nothing else about their own account.
    const SELF_EDITABLE = ['phone', 'email', 'avatar'];
    const safe: Doc[] = [];
    for (const d of upserts) {
      if (d.id !== me.id) throw new HttpError(403, 'لا يمكنك تعديل حساب آخر');
      const patch: Doc = { ...me };
      for (const key of SELF_EDITABLE) if (key in d) patch[key] = d[key];
      safe.push(patch);
    }
    return { upserts: safe, deletes };
  }

  if (collection === 'studentStates') {
    for (const d of upserts) {
      if (d.studentId !== me.id) throw new HttpError(403, 'لا يمكنك تعديل سجل طالب آخر');
      const existing = await store.get('studentStates', d.id);
      if (existing && existing.studentId !== me.id) throw new HttpError(403, 'لا يمكنك تعديل سجل طالب آخر');
    }
    return { upserts, deletes };
  }

  if (collection === 'activityLogs') {
    for (const d of upserts) {
      if (d.userId !== me.id) throw new HttpError(403, 'غير مسموح');
      const existing = await store.get('activityLogs', d.id);
      if (existing && existing.userId !== me.id) throw new HttpError(403, 'غير مسموح');
    }
    return { upserts, deletes };
  }

  throw new HttpError(403, 'غير مسموح');
}
