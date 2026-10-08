import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config, DATA_DIR, SERVERLESS } from './config';
import {
  hashPassword,
  loginAllowed,
  loginFailed,
  loginSucceeded,
  requireAuth,
  requireDoctor,
  requireDoctorOrAssistant,
  signActionToken,
  signToken,
  verifyActionToken,
  verifyPassword
} from './auth';
import { COLLECTIONS, CollectionName, Doc, createStore } from './store';
import { doctorScopeOf, HttpError, authorizeWrite, buildBootstrap, publicUser } from './access';
import { seedAll, seedIfEmpty } from './seed';
import { normalizePhone, quotaFor, sendWhatsApp, status as whatsappStatus } from './whatsapp';
import { deliverToStudent, fullStatus, getBotUsername, startTelegramLinker, status as telegramStatus, telegramDeepLink } from './telegram';
import { finishLogin, logoutUser, startLogin, userStatus } from './telegramUser';
import { checkQuota } from './quota';
import { sendMail, status as emailStatus } from './email';
import { startAlertScheduler } from './alertScheduler';
import { GoogleGenAI, Type } from '@google/genai';
import type { Readable } from 'node:stream';
import { startQuiz, submitQuiz } from './quiz';
import { assertUid, createDirectUpload, deleteVideo, ensureSigned, getVideo, manifestUrl, playbackToken, posterUrl, streamEnabled, tokenSeconds } from './cloudflare';
import { pipeline } from 'node:stream/promises';
import {
  BIND_COOKIE,
  TMP_DIR,
  assertFileId,
  assertLectureAccess,
  findLecture,
  authorizeFileRead,
  authorizeFileWrite,
  bindingFor,
  chunkSessionDir,
  createFileBackend,
  BlobBackend,
  sniffContentType,
  type FirebaseBackend,
  findFileRef,
  isVideoType,
  parseRange,
  readCookie,
  signGrant,
  sniffFile,
  sweepFiles,
  verifyGrant
} from './files';

// Vercel without AUTH_SECRET: one signing secret for all instances, or logins break between requests
if (SERVERLESS && !process.env.AUTH_SECRET) {
  const { blobConfigured, loadSharedAuthSecret } = await import('./blobStore');
  if (blobConfigured()) config.authSecret = await loadSharedAuthSecret();
}
const store = await createStore();
const files = await createFileBackend(store);
await seedIfEmpty(store);
// Background loops need a long-lived process; a serverless function only lives for one request
if (!SERVERLESS) {
  startTelegramLinker(store);
  startAlertScheduler(store);
}

const app = express();
app.disable('x-powered-by');
// Large files never come through these parsers: they are uploaded in chunks (see /api/upload/chunk).
// Vercel passes the function's OIDC token per request; the Blob SDK reads it from the environment
app.use((req, _res, next) => {
  const oidc = req.headers['x-vercel-oidc-token'];
  if (SERVERLESS && typeof oidc === 'string' && oidc) process.env.VERCEL_OIDC_TOKEN = oidc;
  next();
});
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));
app.use(express.raw({ limit: '64mb', type: ['video/*', 'application/pdf', 'application/octet-stream'] }));

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 12)}`;
const today = () => new Date().toISOString().split('T')[0];
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const findByUsername = async (username: string) =>
  (await store.getAll('users')).find(u => u.username?.toLowerCase() === username.trim().toLowerCase());

const session = (user: Doc, demo = false) => ({ token: signToken(user.id, user.role, demo), user: publicUser(user) });

const html = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

/** Only a doctor's own students/assistants — never a rival doctor's account. */
async function assertVisibleToDoctor(doctorId: string, targetId: string) {
  if (targetId === doctorId) return;
  const target = await store.get('users', targetId);
  if (!target) throw new HttpError(404, 'الحساب غير موجود');
  if (target.role === 'assistant' && target.assistantForDoctorId === doctorId) return;
  if (target.role === 'student') {
    const courses = await store.getAll('courses');
    const ownCourseIds = new Set(courses.filter(c => c.doctorId === doctorId).map(c => c.id));
    const enrollments = await store.getAll('enrollments');
    if (enrollments.some(e => e.studentId === targetId && ownCourseIds.has(e.courseId))) return;
  }
  throw new HttpError(403, 'هذا الحساب ليس ضمن طلابك');
}

/* -------------------------------------------------------------------------- */
/*  Health & public catalog                                                    */
/* -------------------------------------------------------------------------- */

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    storage: store.kind,
    whatsapp: whatsappStatus(),
    telegram: telegramStatus(),
    email: emailStatus(),
    demoLogin: config.allowDemoLogin
  });
});

app.get(
  '/api/catalog',
  wrap(async (_req, res) => {
    const courses = await store.getAll('courses');
    res.json(
      courses
        .filter(c => !c.isCompleted)
        .map(c => ({
          courseId: c.id,
          title: c.title,
          code: c.code,
          department: c.department,
          description: c.description,
          doctorId: c.doctorId,
          doctorName: c.doctorName,
          price: typeof c.price === 'number' ? c.price : undefined
        }))
    );
  })
);

/* -------------------------------------------------------------------------- */
/*  Auth                                                                       */
/* -------------------------------------------------------------------------- */

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string') throw new HttpError(400, 'أدخل اسم المستخدم وكلمة المرور');

    const key = `${req.ip}|${username.toLowerCase()}`;
    if (!loginAllowed(key)) throw new HttpError(429, 'محاولات كثيرة، حاول بعد 10 دقائق');

    const user = await findByUsername(username);
    if (!user) {
      loginFailed(key);
      throw new HttpError(401, 'اسم المستخدم غير موجود بالمنظومة');
    }
    if (!verifyPassword(password.trim(), user.pw)) {
      loginFailed(key);
      throw new HttpError(401, 'كلمة المرور غير صحيحة');
    }
    if (user.status === 'pending' && user.role === 'doctor') {
      throw new HttpError(403, 'طلب حساب الدكتور لا يزال قيد المراجعة من إدارة المنصة. تقدر تسجّل الدخول بعد الموافقة.');
    }
    if (user.status === 'pending') {
      throw new HttpError(403, 'طلبك لا يزال قيد المراجعة. سيتواصل معك الدكتور أو المساعد، وتقدر تسجّل الدخول بعد الموافقة.');
    }
    if (user.status && user.status !== 'active') {
      throw new HttpError(403, user.deviceLockedAt ? DEVICE_LOCK_MESSAGE : 'هذا الحساب موقوف، تواصل مع الدكتور');
    }
    loginSucceeded(key);
    await checkStudentDevice(user, req);
    res.json(session(user));
  })
);

app.post(
  '/api/auth/demo',
  wrap(async (req, res) => {
    if (!config.allowDemoLogin) throw new HttpError(403, 'الدخول التجريبي معطّل');
    const user = await findByUsername(String(req.body?.username || ''));
    if (!user) throw new HttpError(404, 'الحساب غير موجود');
    res.json(session(user, true));
  })
);

app.post(
  '/api/auth/signup',
  wrap(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '').trim();
    const phone = String(b.phone || '').trim();
    const email = String(b.email || '').trim();
    const courseIds: string[] = Array.isArray(b.courseIds) ? [...new Set(b.courseIds.map(String))] : [];

    if (!name) throw new HttpError(400, 'يرجى إدخال الاسم الكامل');
    if (username.length < 3) throw new HttpError(400, 'اسم المستخدم يجب ألا يقل عن 3 أحرف');
    if (password.length < 5) throw new HttpError(400, 'كلمة المرور يجب ألا تقل عن 5 أحرف');
    if (phone.replace(/\D/g, '').length < 8) throw new HttpError(400, 'رقم الهاتف مطلوب وصحيح (سيُستخدم للتواصل والواتساب)');
    if (!looksLikeEmail(email)) throw new HttpError(400, 'البريد الإلكتروني مطلوب وبصيغة صحيحة');
    if (!courseIds.length) throw new HttpError(400, 'اختر مادة واحدة على الأقل');

    const courses = await store.getAll('courses');
    const chosen = courseIds.map(id => courses.find(c => c.id === id)).filter(Boolean) as Doc[];
    if (chosen.length !== courseIds.length) throw new HttpError(400, 'إحدى المواد المختارة غير موجودة');

    // Pending: the student cannot sign in until a doctor approves at least one enrollment.
    const created = await createUser({
      name,
      username,
      password,
      email,
      phone,
      department: b.department ? String(b.department) : undefined,
      faculty: b.faculty ? String(b.faculty) : undefined,
      role: 'student',
      status: 'pending'
    });

    // The student cannot sign in yet, so hand them the bot link right now: pressing Start links their
    // Telegram chat, and the doctor/assistant can then message them directly before approval.
    let telegramLink: string | undefined;
    let user = created;
    if (telegramStatus().configured) {
      const botName = await getBotUsername().catch(() => undefined);
      if (botName) {
        const code = crypto.randomBytes(6).toString('hex');
        user = { ...created, telegramLinkCode: code };
        await store.upsertMany('users', [user]);
        telegramLink = telegramDeepLink(botName, code);
      }
    }

    const now = new Date().toISOString();
    const enrollments: Doc[] = chosen.map(course => ({
      id: uid('enr'),
      studentId: user.id,
      studentName: user.name,
      studentAcademicId: user.academicId,
      studentPhone: user.phone,
      studentEmail: user.email,
      courseId: course.id,
      courseTitle: course.title,
      doctorId: course.doctorId,
      doctorName: course.doctorName,
      status: 'pending_contact',
      requestedAt: now
    }));
    await store.upsertMany('enrollments', enrollments);

    // Best-effort email to each doctor with a one-click approve link; the app's "طلبات التسجيل"
    // screen works regardless of whether email is configured or delivered.
    for (const enr of enrollments) {
      const doctor = await store.get('users', enr.doctorId);
      if (!doctor?.email) continue;
      const approveUrl = `${config.email.appUrl}/api/enrollments/${enr.id}/approve?token=${signActionToken('enroll_approve', enr.id)}`;
      await sendMail(
        doctor.email,
        `طلب تسجيل جديد: ${user.name} - ${enr.courseTitle}`,
        `<div dir="rtl" style="font-family:sans-serif;line-height:1.8">
          <h2>طلب تسجيل جديد</h2>
          <p>الطالب <b>${html(user.name)}</b> (${html(user.academicId)}) يريد الالتحاق بمقرر <b>${html(enr.courseTitle)}</b>.</p>
          <p>الهاتف: ${html(user.phone)} · البريد: ${html(user.email)}</p>
          <p>تواصل مع الطالب لإتمام الدفع، ثم اعتمد الطلب:</p>
          <p><a href="${approveUrl}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">قبول الطلب</a></p>
          <p style="color:#666;font-size:12px">أو افتح المنصة وراجع "طلبات التسجيل".</p>
        </div>`
      ).catch(() => undefined);
    }

    res.json({
      pending: true,
      message: 'تم إرسال طلبك بنجاح. سيتواصل معك الدكتور أو المساعد لإتمام التسجيل والدفع، وستقدر تسجّل الدخول بعد الموافقة.',
      telegramLink
    });
  })
);

const parseSubjects = (raw: unknown): string[] =>
  Array.isArray(raw)
    ? [...new Set(raw.map(s => String(s).trim().slice(0, 80)).filter(Boolean))].slice(0, 10)
    : [];

/**
 * A doctor applies for an account. Doctors can reach platform-wide settings, so the account stays
 * pending (no sign-in, no courses) until an existing doctor approves it from Settings.
 */
app.post(
  '/api/auth/signup-doctor',
  wrap(async (req, res) => {
    const b = req.body || {};
    const name = String(b.name || '').trim();
    const username = String(b.username || '').trim().toLowerCase();
    const password = String(b.password || '').trim();
    const phone = String(b.phone || '').trim();
    const email = String(b.email || '').trim();
    const subjects = parseSubjects(b.subjects);

    if (!loginAllowed(`signup-doctor|${req.ip}`)) throw new HttpError(429, 'طلبات كثيرة، حاول بعد 10 دقائق');
    if (!name) throw new HttpError(400, 'يرجى إدخال الاسم الكامل');
    if (!/^[a-z0-9_.-]{3,32}$/.test(username)) throw new HttpError(400, 'اسم المستخدم 3 أحرف على الأقل (حروف إنجليزية وأرقام و _ فقط)');
    if (password.length < 6) throw new HttpError(400, 'كلمة المرور يجب ألا تقل عن 6 أحرف');
    if (phone.replace(/\D/g, '').length < 8) throw new HttpError(400, 'رقم الهاتف مطلوب وصحيح');
    if (!looksLikeEmail(email)) throw new HttpError(400, 'البريد الإلكتروني مطلوب وبصيغة صحيحة');
    loginFailed(`signup-doctor|${req.ip}`);

    const user = await createUser({
      name,
      username,
      password,
      email,
      phone,
      faculty: b.faculty ? String(b.faculty) : undefined,
      department: b.department ? String(b.department) : undefined,
      role: 'doctor',
      status: 'pending'
    });
    await store.upsertMany('users', [{ ...user, requestedSubjects: subjects, requestedAt: new Date().toISOString() }]);

    const doctors = (await store.getAll('users')).filter(u => u.role === 'doctor' && u.status === 'active' && u.email);
    for (const d of doctors) {
      await sendMail(
        d.email,
        `طلب حساب دكتور جديد: ${name}`,
        `<div dir="rtl" style="font-family:sans-serif;line-height:1.8">
          <h2>طلب حساب دكتور جديد</h2>
          <p><b>${html(name)}</b> (${html(username)}) يطلب حساب دكتور${subjects.length ? ` للمواد: ${subjects.map(html).join('، ')}` : ''}.</p>
          <p>الهاتف: ${html(phone)} · البريد: ${html(email)}</p>
          <p>راجع الطلب من المنصة: الإعدادات ← طلبات حسابات الدكاترة.</p>
        </div>`
      ).catch(() => undefined);
    }

    res.json({
      pending: true,
      message: 'تم إرسال طلب حساب الدكتور. ستتم مراجعته من إدارة المنصة، وتقدر تسجّل الدخول بعد الموافقة.'
    });
  })
);

const pendingDoctorView = (u: Doc) => ({
  ...publicUser(u),
  requestedSubjects: u.requestedSubjects || [],
  requestedAt: u.requestedAt
});

async function activeDoctor(req: Request): Promise<Doc> {
  const me = await store.get('users', req.auth!.sub);
  if (!me || me.role !== 'doctor' || (me.status && me.status !== 'active')) throw new HttpError(403, 'هذه العملية للدكتور فقط');
  return me;
}

async function pendingDoctor(id: string): Promise<Doc> {
  const u = await store.get('users', id);
  if (!u || u.role !== 'doctor' || u.status !== 'pending') throw new HttpError(404, 'الطلب غير موجود أو تمت مراجعته');
  return u;
}

app.get(
  '/api/doctor-requests',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    await activeDoctor(req);
    const pending = (await store.getAll('users')).filter(u => u.role === 'doctor' && u.status === 'pending');
    res.json(pending.map(pendingDoctorView));
  })
);

app.post(
  '/api/doctor-requests/:id/approve',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const me = await activeDoctor(req);
    const u = await pendingDoctor(String(req.params.id));
    const subjects = parseSubjects(req.body?.subjects).length ? parseSubjects(req.body?.subjects) : parseSubjects(u.requestedSubjects);
    const { requestedSubjects: _r, ...rest } = u;
    const approved = { ...rest, status: 'active', approvedBy: me.id, approvedAt: new Date().toISOString() };
    await store.upsertMany('users', [approved]);
    for (const subject of subjects) await createCourseForDoctor(approved, subject);
    await store.upsertMany('activityLogs', [
      {
        id: uid('log'),
        userId: me.id,
        userName: me.name,
        userAcademicId: me.academicId,
        userRole: me.role,
        action: `قبول حساب الدكتور ${u.name}${subjects.length ? ` (${subjects.join('، ')})` : ''}`,
        timestamp: new Date().toISOString(),
        type: 'admin'
      }
    ]);
    if (u.email) {
      await sendMail(
        u.email,
        'تم تفعيل حسابك كدكتور',
        `<div dir="rtl" style="font-family:sans-serif;line-height:1.8"><p>مرحباً د. ${html(u.name)}، تم تفعيل حسابك. تقدر تسجّل الدخول الآن باسم المستخدم <b>${html(u.username)}</b>.</p>
          <p><a href="${config.email.appUrl}">فتح المنصة</a></p></div>`
      ).catch(() => undefined);
    }
    res.json({ user: publicUser(approved), subjects });
  })
);

app.post(
  '/api/doctor-requests/:id/reject',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const me = await activeDoctor(req);
    const u = await pendingDoctor(String(req.params.id));
    await store.deleteMany('users', [u.id]);
    await store.upsertMany('activityLogs', [
      {
        id: uid('log'),
        userId: me.id,
        userName: me.name,
        userAcademicId: me.academicId,
        userRole: me.role,
        action: `رفض طلب حساب الدكتور ${u.name}`,
        timestamp: new Date().toISOString(),
        type: 'admin'
      }
    ]);
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------------------- */
/*  Accounts                                                                   */
/* -------------------------------------------------------------------------- */

async function createUser(b: Record<string, any>): Promise<Doc> {
  const users = await store.getAll('users');
  const username = String(b.username).trim().toLowerCase();
  if (users.some(u => u.username?.toLowerCase() === username)) throw new HttpError(409, 'اسم المستخدم مسجل مسبقاً');

  const role: 'doctor' | 'student' | 'assistant' = ['doctor', 'assistant'].includes(b.role) ? b.role : 'student';
  const taken = (id: string) => users.some(u => u.academicId?.trim().toLowerCase() === id.trim().toLowerCase());

  let academicId = String(b.academicId || '').trim();
  if (!academicId) {
    const year = new Date().getFullYear();
    let n = users.filter(u => u.role === role).length + (role === 'doctor' ? 101 : role === 'assistant' ? 1 : 1);
    const make = (k: number) =>
      role === 'doctor' ? `DOC-${k}` : role === 'assistant' ? `AST-${k}` : `STD-${year}-${String(k).padStart(3, '0')}`;
    while (taken(make(n))) n++;
    academicId = make(n);
  } else if (taken(academicId)) {
    throw new HttpError(409, 'الكود الأكاديمي مستخدم بالفعل');
  }

  const user: Doc = {
    id: uid('usr'),
    academicId,
    username,
    name: String(b.name).trim(),
    email: String(b.email || `${username}@university.edu`).trim(),
    phone: String(b.phone || '').trim(),
    role,
    department: String(b.department || 'علوم الحاسب'),
    faculty: b.faculty ? String(b.faculty).trim() : undefined,
    pw: hashPassword(String(b.password || '123456').trim()),
    joinedDate: today(),
    status: b.status === 'pending' ? 'pending' : b.status === 'inactive' || b.status === 'suspended' ? b.status : 'active',
    notes: b.notes,
    assistantForDoctorId: role === 'assistant' ? b.assistantForDoctorId : undefined
  };
  await store.upsertMany('users', [user]);
  return user;
}

const slug = (s: string) =>
  s
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
    .toUpperCase() || 'GEN';

async function createCourseForDoctor(doctor: Doc, subject: string): Promise<Doc> {
  const courses = await store.getAll('courses');
  let code = `${slug(subject).slice(0, 3)}-${100 + courses.length}`;
  while (courses.some(c => c.code === code)) code = `${slug(subject).slice(0, 3)}-${Math.floor(100 + Math.random() * 900)}`;

  const course: Doc = {
    id: uid('crs'),
    title: subject,
    code,
    doctorName: doctor.name,
    doctorId: doctor.id,
    department: doctor.department || 'علوم الحاسب',
    description: `مقرر ${subject} مع د. ${doctor.name}`,
    color: 'from-indigo-600 to-blue-600',
    weeks: []
  };
  await store.upsertMany('courses', [course]);
  return course;
}

app.post(
  '/api/users',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.name || !b.username) throw new HttpError(400, 'الاسم واسم المستخدم مطلوبان');
    if (b.password && String(b.password).trim().length < 5) throw new HttpError(400, 'كلمة المرور يجب ألا تقل عن 5 أحرف');

    const me = await store.get('users', req.auth!.sub);
    if (!me) throw new HttpError(401, 'الحساب لم يعد موجوداً');

    if (b.role === 'doctor') {
      const subjects: string[] = Array.isArray(b.subjects)
        ? [...new Set(b.subjects.map((s: unknown) => String(s).trim()).filter(Boolean))]
        : [];
      if (!subjects.length) throw new HttpError(400, 'أدخل مادة واحدة على الأقل يدرّسها الدكتور');
      const user = await createUser(b);
      for (const subject of subjects) await createCourseForDoctor(user, subject);
      return res.json({ user: publicUser({ ...user, subjects }) });
    }

    if (b.role === 'assistant') {
      const user = await createUser({ ...b, assistantForDoctorId: me.id });
      return res.json({ user: publicUser(user) });
    }

    // student, added directly by the doctor: skip the enrollment-request flow and enroll them now.
    const ownCourses = (await store.getAll('courses')).filter(c => c.doctorId === me.id);
    const courseId = ownCourses.some(c => c.id === b.courseId) ? b.courseId : ownCourses.length === 1 ? ownCourses[0].id : undefined;
    // Without an enrollment the student would be invisible to the doctor who just added them
    if (!courseId) throw new HttpError(400, ownCourses.length ? 'اختر المقرر الذي يُسجَّل فيه الطالب' : 'أنشئ مقرراً أولاً حتى يُسجَّل الطالب فيه');
    const user = await createUser({ ...b, role: 'student', status: 'active' });

    {
      const course = ownCourses.find(c => c.id === courseId)!;
      const now = new Date().toISOString();
      await store.upsertMany('enrollments', [
        {
          id: uid('enr'),
          studentId: user.id,
          studentName: user.name,
          studentAcademicId: user.academicId,
          studentPhone: user.phone,
          studentEmail: user.email,
          courseId: course.id,
          courseTitle: course.title,
          doctorId: course.doctorId,
          doctorName: course.doctorName,
          status: 'approved',
          requestedAt: now,
          decidedAt: now,
          decidedBy: me.name
        }
      ]);
    }
    res.json({ user: publicUser(user) });
  })
);

app.post(
  '/api/users/:id/password',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const password = String(req.body?.password || '').trim();
    if (password.length < 5) throw new HttpError(400, 'كلمة المرور يجب ألا تقل عن 5 أحرف');
    await assertVisibleToDoctor(req.auth!.sub, String(req.params.id));
    const user = await store.get('users', String(req.params.id));
    if (!user) throw new HttpError(404, 'الحساب غير موجود');
    await store.upsertMany('users', [{ ...user, pw: hashPassword(password) }]);
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------------------- */
/*  Data                                                                       */
/* -------------------------------------------------------------------------- */

const currentUser = async (req: Request) => {
  const me = await store.get('users', req.auth!.sub);
  if (!me) throw new HttpError(401, 'الحساب لم يعد موجوداً');
  if (me.status && me.status !== 'active') throw new HttpError(401, me.deviceLockedAt ? DEVICE_LOCK_MESSAGE : 'هذا الحساب موقوف');
  // A session copied to (or kept open on) another device ends the account's access
  const seenId = String(req.headers['x-device-id'] || '').slice(0, 80);
  if (me.role === 'student' && seenId && !req.auth!.demo) {
    if (me.boundDevice?.id && seenId !== me.boundDevice.id) {
      await lockForSecondDevice(me, req);
      throw new HttpError(401, DEVICE_LOCK_MESSAGE);
    }
    // A session that outlived a re-activation binds the device it is used on
    if (!me.boundDevice?.id) {
      const boundDevice = {
        id: seenId,
        fp: String(req.headers['x-device-fp'] || '').slice(0, 40),
        label: shortAgent(String(req.headers['user-agent'] || '')),
        at: new Date().toISOString()
      };
      await store.upsertMany('users', [{ ...me, boundDevice }]);
      return { ...me, boundDevice };
    }
  }
  return me;
};

/* ---------------------------- one device per student ---------------------------- */

const DEVICE_LOCK_MESSAGE = 'تم إيقاف حسابك تلقائياً لأنه فُتح من أكثر من جهاز. تواصل مع الدكتور لإعادة تفعيله.';

const shortAgent = (ua: string) => {
  // Order matters: Android user agents also say "Linux", iPhones also say "Mac OS"
  const os = ['Android', 'iPhone', 'iPad', 'Windows', 'Mac OS', 'Linux'].find(k => ua.includes(k)) || 'جهاز';
  const browser = /Edg|OPR|Chrome|Firefox|Safari/.exec(ua)?.[0]?.replace('Edg', 'Edge').replace('OPR', 'Opera') || 'متصفح';
  return `${browser} / ${os}`;
};

/** Suspends a student whose account showed up on a second device and tells their doctors. */
async function lockForSecondDevice(user: Doc, req: Request) {
  if (user.deviceLockedAt) return;
  const now = new Date().toISOString();
  const reason = `دخول من جهاز آخر (${shortAgent(String(req.headers['user-agent'] || ''))}) بينما الحساب مربوط بـ ${user.boundDevice?.label || 'جهاز آخر'}`;
  await store.upsertMany('users', [{ ...user, status: 'suspended', deviceLockedAt: now, deviceLockReason: reason }]);
  await store.upsertMany('activityLogs', [
    {
      id: uid('log'),
      userId: user.id,
      userName: user.name,
      userAcademicId: user.academicId,
      userRole: user.role,
      action: `إيقاف تلقائي للحساب: ${reason}`,
      timestamp: now,
      type: 'login'
    }
  ]);
  const courseIds = new Set(
    (await store.getAll('enrollments')).filter(e => e.studentId === user.id && e.status === 'approved').map(e => e.courseId)
  );
  const doctorIds = new Set((await store.getAll('courses')).filter(c => courseIds.has(c.id)).map(c => c.doctorId));
  for (const id of doctorIds) {
    const doctor = await store.get('users', id);
    if (!doctor?.email) continue;
    await sendMail(
      doctor.email,
      `إنذار: حساب ${user.name} فُتح من أكثر من جهاز`,
      `<div dir="rtl" style="font-family:sans-serif;line-height:1.8">
        <h2>تم إيقاف حساب طالب تلقائياً</h2>
        <p>الطالب <b>${html(user.name)}</b> (${html(user.academicId || '')}) حاول استخدام حسابه من جهاز ثانٍ.</p>
        <p>${html(reason)}</p>
        <p>لإعادة تفعيله: المنصة ← التنبيهات والرسائل ← إعادة تفعيل.</p>
      </div>`
    ).catch(() => undefined);
  }
}

/**
 * At sign-in: the first device a student uses becomes theirs. The same browser after its site data was
 * cleared (new random id, same fingerprint) is still accepted; any other device suspends the account.
 */
async function checkStudentDevice(user: Doc, req: Request) {
  if (user.role !== 'student') return;
  const b = req.body || {};
  const id = String(b.deviceId || '').slice(0, 80);
  const fp = String(b.deviceFp || '').slice(0, 40);
  if (!id) return; // very old clients
  const label = shortAgent(String(req.headers['user-agent'] || ''));
  const bound = user.boundDevice;
  if (!bound?.id) {
    await store.upsertMany('users', [{ ...user, boundDevice: { id, fp, label, at: new Date().toISOString() } }]);
    return;
  }
  if (bound.id === id) return;
  if (b.deviceFresh === true && fp && bound.fp === fp) {
    await store.upsertMany('users', [{ ...user, boundDevice: { ...bound, id } }]);
    return;
  }
  await lockForSecondDevice(user, req);
  throw new HttpError(403, DEVICE_LOCK_MESSAGE);
}

app.get(
  '/api/bootstrap',
  requireAuth,
  wrap(async (req, res) => {
    res.json(await buildBootstrap(store, await currentUser(req)));
  })
);

app.post(
  '/api/sync',
  requireAuth,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const collection = req.body?.collection as CollectionName;
    if (!COLLECTIONS.includes(collection) || collection === 'files') throw new HttpError(400, 'مجموعة غير معروفة');
    const upserts: Doc[] = Array.isArray(req.body?.upserts) ? req.body.upserts : [];
    const deletes: string[] = Array.isArray(req.body?.deletes) ? req.body.deletes : [];

    const safe = await authorizeWrite(store, me, collection, upserts, deletes);
    if (safe.upserts.length) await store.upsertMany(collection, safe.upserts);
    if (safe.deletes.length) await store.deleteMany(collection, safe.deletes);
    res.json({ ok: true });
  })
);

app.post(
  '/api/admin/reset',
  requireAuth,
  requireDoctor,
  wrap(async (_req, res) => {
    await seedAll(store);
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------------------- */
/*  Enrollment requests (course + doctor picker at signup)                     */
/* -------------------------------------------------------------------------- */

async function assertOwnEnrollment(doctorId: string, enrollmentId: string) {
  const enr = await store.get('enrollments', enrollmentId);
  if (!enr) throw new HttpError(404, 'الطلب غير موجود');
  const course = await store.get('courses', enr.courseId);
  if (!course || course.doctorId !== doctorId) throw new HttpError(403, 'هذا الطلب ليس ضمن مقرراتك');
  return enr;
}

app.post(
  '/api/enrollments/:id/contact',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const doctorId = doctorScopeOf(await currentUser(req));
    if (!doctorId) throw new HttpError(403, 'غير مسموح');
    const enr = await assertOwnEnrollment(doctorId, String(req.params.id));
    const note = req.body?.note !== undefined ? String(req.body.note).slice(0, 2000) : enr.paymentNote;
    await store.upsertMany('enrollments', [{ ...enr, contactedAt: new Date().toISOString(), paymentNote: note }]);
    res.json({ ok: true });
  })
);

async function approveEnrollment(enrollmentId: string, decidedBy: string) {
  const enr = await store.get('enrollments', enrollmentId);
  if (!enr) throw new HttpError(404, 'الطلب غير موجود');
  if (enr.status === 'approved') return enr;

  await store.upsertMany('enrollments', [
    { ...enr, status: 'approved', decidedAt: new Date().toISOString(), decidedBy }
  ]);

  const student = await store.get('users', enr.studentId);
  if (student && student.status === 'pending') {
    await store.upsertMany('users', [{ ...student, status: 'active' }]);
  }
  return enr;
}

app.post(
  '/api/enrollments/:id/approve',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    await assertOwnEnrollment(me.id, String(req.params.id));
    await approveEnrollment(String(req.params.id), me.name);
    res.json({ ok: true });
  })
);

// Clicked from the doctor's email — no login needed, the signed token proves it is genuine.
app.get(
  '/api/enrollments/:id/approve',
  wrap(async (req, res) => {
    const id = String(req.params.id);
    const okToken = verifyActionToken('enroll_approve', String(req.query.token || '')) === id;
    if (!okToken) {
      return res.status(403).send('<div dir="rtl" style="font-family:sans-serif;padding:40px;text-align:center">رابط غير صالح أو منتهي.</div>');
    }
    const enr = await store.get('enrollments', id);
    if (!enr) return res.status(404).send('<div dir="rtl" style="font-family:sans-serif;padding:40px;text-align:center">الطلب غير موجود.</div>');
    const doctor = await store.get('users', enr.doctorId);
    await approveEnrollment(id, doctor?.name || 'الدكتور');
    res.send(
      `<div dir="rtl" style="font-family:sans-serif;padding:40px;text-align:center">
        <h2 style="color:#059669">تم قبول الطلب ✓</h2>
        <p>${html(enr.studentName)} أصبح بإمكانه الآن تسجيل الدخول إلى مقرر ${html(enr.courseTitle)}.</p>
      </div>`
    );
  })
);

app.post(
  '/api/enrollments/:id/reject',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const enr = await assertOwnEnrollment(me.id, String(req.params.id));
    await store.upsertMany('enrollments', [
      { ...enr, status: 'rejected', decidedAt: new Date().toISOString(), decidedBy: me.name }
    ]);
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------------------- */
/*  WhatsApp                                                                   */
/* -------------------------------------------------------------------------- */

app.get('/api/whatsapp/status', requireAuth, requireDoctorOrAssistant, (_req, res) => {
  res.json(whatsappStatus());
});

app.post(
  '/api/whatsapp/send',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const doctorId = doctorScopeOf(me)!;
    const { studentId, type, message } = req.body || {};
    const text = String(message || '').trim();
    if (!text || text.length > 1000) throw new HttpError(400, 'نص الرسالة مطلوب (حتى 1000 حرف)');

    await assertVisibleToDoctor(doctorId, String(studentId));
    const student = await store.get('users', String(studentId));
    if (!student || student.role !== 'student') throw new HttpError(404, 'الطالب غير موجود');

    if (!whatsappStatus().configured) {
      throw new HttpError(503, 'واتساب غير مُعدّ على الخادم. أضف WHATSAPP_TOKEN و WHATSAPP_PHONE_NUMBER_ID في ملف .env');
    }

    const to = normalizePhone(student.phone);
    if (!to) throw new HttpError(400, `رقم ${student.name} غير صالح. عدّله من بيانات الطالب.`);

    const quota = await quotaFor(store, student.id);
    if (!quota.ok) throw new HttpError(429, quota.error);

    const result = await sendWhatsApp(to, text);
    const log: Doc = {
      id: uid('wa'),
      studentId: student.id,
      studentName: student.name,
      phone: student.phone,
      messageType: type,
      messageText: text,
      sentAt: new Date().toISOString(),
      status: result.ok ? 'sent' : 'failed',
      ...(result.ok ? { waMessageId: result.id, via: result.via } : { error: result.error })
    };
    await store.upsertMany('whatsappLogs', [log]);

    // Meta accepted it => "sent". Delivery/read receipts need a public webhook, which a local run does not have.
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, log, error: result.ok ? undefined : result.error });
  })
);

/* -------------------------------------------------------------------------- */
/*  Telegram                                                                   */
/* -------------------------------------------------------------------------- */

app.get(
  '/api/telegram/status',
  requireAuth,
  wrap(async (_req, res) => {
    res.json(await fullStatus());
  })
);

/* Personal account (like WhatsApp Business): connect once from Settings, then it messages any number. */

app.get(
  '/api/telegram/account',
  requireAuth,
  requireDoctor,
  wrap(async (_req, res) => {
    res.json(await userStatus());
  })
);

app.post(
  '/api/telegram/account/code',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const phone = String(req.body?.phone || '').trim();
    if (phone.replace(/\D/g, '').length < 8) throw new HttpError(400, 'اكتب رقم الموبايل المسجّل على تليجرام');
    try {
      await startLogin(phone);
    } catch (e: any) {
      throw new HttpError(400, e?.errorMessage === 'PHONE_NUMBER_INVALID' ? 'رقم غير صحيح' : e?.message || 'تعذّر إرسال الكود');
    }
    res.json({ ok: true });
  })
);

app.post(
  '/api/telegram/account/verify',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    try {
      const r = await finishLogin(String(req.body?.code || ''), req.body?.password ? String(req.body.password) : undefined);
      res.json(r === 'password' ? { needsPassword: true } : { ok: true, ...(await userStatus()) });
    } catch (e: any) {
      throw new HttpError(400, e?.errorMessage === 'PASSWORD_HASH_INVALID' ? 'كلمة مرور التحقق بخطوتين غير صحيحة' : e?.message || 'تعذّر تسجيل الدخول');
    }
  })
);

app.post(
  '/api/telegram/account/logout',
  requireAuth,
  requireDoctor,
  wrap(async (_req, res) => {
    await logoutUser();
    res.json({ ok: true });
  })
);

app.post(
  '/api/telegram/link-code',
  requireAuth,
  wrap(async (req, res) => {
    if (!telegramStatus().configured) throw new HttpError(503, 'تليجرام غير مُعدّ على الخادم بعد. أضف TELEGRAM_BOT_TOKEN في ملف .env');
    const me = await currentUser(req);
    if (me.telegramChatId) return res.json({ linked: true });

    const code = me.telegramLinkCode || crypto.randomBytes(6).toString('hex');
    if (!me.telegramLinkCode) await store.upsertMany('users', [{ ...me, telegramLinkCode: code }]);

    const username = await getBotUsername();
    if (!username) throw new HttpError(503, 'تعذّر التعرف على اسم البوت. تأكد من صحة TELEGRAM_BOT_TOKEN.');
    res.json({ linked: false, deepLink: telegramDeepLink(username, code) });
  })
);

app.post(
  '/api/telegram/send',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const doctorId = doctorScopeOf(me)!;
    const { studentId, type, message } = req.body || {};
    const text = String(message || '').trim();
    if (!text || text.length > 2000) throw new HttpError(400, 'نص الرسالة مطلوب');

    await assertVisibleToDoctor(doctorId, String(studentId));
    const student = await store.get('users', String(studentId));
    if (!student || student.role !== 'student') throw new HttpError(404, 'الطالب غير موجود');

    const st = await fullStatus();
    if (!st.configured) throw new HttpError(503, 'تليجرام غير مُعدّ. اربط حسابك الشخصي من الإعدادات، أو أضف TELEGRAM_BOT_TOKEN في ملف .env');

    const quota = await checkQuota(store, 'telegramLogs', student.id);
    if (!quota.ok) throw new HttpError(429, quota.error);

    const result = await deliverToStudent(student, text);
    const log: Doc = {
      id: uid('tg'),
      studentId: student.id,
      studentName: student.name,
      chatId: student.telegramChatId || student.phone,
      via: result.via,
      messageType: type,
      messageText: text,
      sentAt: new Date().toISOString(),
      status: result.ok ? 'sent' : 'failed',
      ...(result.ok ? { telegramMessageId: result.id } : { error: result.error })
    };
    await store.upsertMany('telegramLogs', [log]);
    res.status(result.ok ? 200 : 502).json({ ok: result.ok, log, error: result.ok ? undefined : result.error });
  })
);

/* -------------------------------------------------------------------------- */
/*  AI questions (Gemini): extract the questions in a file, or write new ones  */
/* -------------------------------------------------------------------------- */

const geminiKey = () =>
  process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.API_KEY || process.env.VITE_GEMINI_API_KEY;

const QUESTIONS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          prompt: { type: Type.STRING },
          type: { type: Type.STRING, description: 'multiple_choice or multiple_select or true_false or essay' },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctOptionIndex: { type: Type.INTEGER, description: '0-based index for single choice' },
          correctOptionIndexes: { type: Type.ARRAY, items: { type: Type.INTEGER }, description: '0-based indexes for multi-select MSQ' },
          explanation: { type: Type.STRING }
        },
        required: ['prompt', 'type', 'options']
      }
    }
  },
  required: ['questions']
};

/** Sends the parts to Gemini (with model fallbacks and a hard deadline) and returns the questions array. */
async function geminiQuestions(apiKey: string, parts: any[]): Promise<any[]> {
  const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
  // Fallbacks when a model is overloaded (503) or not offered to this key (404)
  const modelsToTry = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest', 'gemini-3.1-pro-preview'];
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  // On Vercel the whole function is cut at 60 s, so stop earlier and let the browser read the file itself
  const deadline = Date.now() + (SERVERLESS ? 50_000 : 85_000);
  const withTimeout = <T,>(p: Promise<T>, ms: number) =>
    Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error('AI_TIMEOUT'), { status: 504 })), ms))]);

  let responseText = '';
  let lastError: any = null;
  for (const modelName of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 5000) break;
      try {
        const response = await withTimeout(
          ai.models.generateContent({
            model: modelName,
            contents: parts,
            config: { responseMimeType: 'application/json', responseSchema: QUESTIONS_SCHEMA }
          }),
          Math.min(60_000, left)
        );
        responseText = response.text || '';
        if (responseText) break;
      } catch (mErr: any) {
        lastError = mErr;
        const status = mErr?.status || mErr?.code;
        const isTransient = status === 503 || status === 429 || /high demand|unavailable|rate/i.test(String(mErr?.message || ''));
        console.warn(`[Gemini] Model ${modelName} attempt ${attempt} failed:`, mErr?.message || mErr);
        if (mErr?.message === 'AI_TIMEOUT') break; // Move to next model on timeout
        if (isTransient && attempt < 2) {
          await delay(attempt * 1000);
          continue;
        }
        break;
      }
    }
    if (responseText || Date.now() > deadline - 5000) break;
  }
  if (!responseText && lastError) throw lastError;
  const json = JSON.parse(responseText || '{}');
  return Array.isArray(json.questions) ? json.questions : [];
}

/** The document as Gemini parts: the file itself (PDF/image) or its text. */
function documentParts(b: Record<string, any>, instruction: string): any[] {
  const fileBase64 = b.fileBase64 || b.pdfBase64;
  if (fileBase64) {
    return [{ inlineData: { mimeType: b.mimeType || b.pdfMimeType || 'application/pdf', data: fileBase64 } }, { text: instruction }];
  }
  return [{ text: `${instruction}\n\nالنص:\n${String(b.text).slice(0, 60000)}` }];
}

const QUESTION_EXTRACTION_PROMPT = `أنت مساعد لأستاذ جامعي. استخرج كل الأسئلة الموجودة في المستند المرفق كما هي بدون تأليف أسئلة جديدة.
- اكتب نص السؤال واختياراته بنفس لغة المستند، بدون حروف الترقيم (أ) ب) a) b)) في بداية الاختيارات.
- type: "multiple_choice" لإجابة واحدة، "multiple_select" لأكثر من إجابة صحيحة (MSQ)، "true_false" لصح/خطأ (options: ["صح","خطأ"])، "essay" للمقالي (options فارغة).
- إذا وُجد مفتاح إجابات أو علامة على الإجابة الصحيحة فضع correctOptionIndexes (أرقام تبدأ من 0). إذا لم تُذكر الإجابة، حدّدها بمعرفتك العلمية فقط إن كنت متأكداً، وإلا اتركها فارغة.
- ضع شرحاً قصيراً في explanation إن كان موجوداً في المستند.
- تجاهل العناوين وأرقام الصفحات والتعليمات والشرح والحلول التي ليست أسئلة. إذا لم يحتوِ المستند على أسئلة فأرجع قائمة فارغة.`;

app.post(
  '/api/ai/parse-questions',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.text && !b.fileBase64 && !b.pdfBase64) throw new HttpError(400, 'يرجى تقديم نص أو رفع ملف PDF للتحليل');
    const apiKey = geminiKey();
    if (!apiKey) return res.json({ ai: false, message: 'مفتاح Gemini API غير متاح في الخادم' });
    try {
      res.json({ ai: true, questions: await geminiQuestions(apiKey, documentParts(b, QUESTION_EXTRACTION_PROMPT)) });
    } catch (e: any) {
      console.error('Gemini parse error:', e);
      res.json({ ai: false, error: String(e?.message || e) });
    }
  })
);

const TYPE_TEXT: Record<string, string> = {
  multiple_choice: 'اختيار من متعدد بإجابة واحدة صحيحة (multiple_choice، 4 اختيارات)',
  multiple_select: 'اختيار من متعدد بأكثر من إجابة صحيحة (multiple_select / MSQ، 4-5 اختيارات منها 2 أو 3 صحيحة)',
  true_false: 'صح أو خطأ (true_false، options: ["صح","خطأ"])',
  essay: 'مقالي (essay، options فارغة) يقيس الفهم والتحليل وليس الحفظ فقط، واكتب في explanation إجابة نموذجية مختصرة على شكل نقاط تصحيح'
};

/** Writes new exam questions about a lecture/explanation file (for files that contain no questions). */
app.post(
  '/api/ai/generate-questions',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const b = req.body || {};
    if (!b.text && !b.fileBase64) throw new HttpError(400, 'ارفع ملف المحاضرة أو الصق نصها أولاً');
    const apiKey = geminiKey();
    if (!apiKey) {
      throw new HttpError(503, 'توليد الأسئلة يحتاج مفتاح الذكاء الاصطناعي (GEMINI_API_KEY) في إعدادات الخادم.');
    }
    const count = Math.min(30, Math.max(1, Math.round(Number(b.count) || 10)));
    const types = (Array.isArray(b.types) ? b.types : ['multiple_choice', 'multiple_select']).filter((t: string) => t in TYPE_TEXT);
    if (!types.length) throw new HttpError(400, 'اختر نوع سؤال واحد على الأقل');
    const language =
      b.language === 'en'
        ? 'English'
        : b.language === 'same'
        ? 'نفس لغة المستند'
        : 'العربية الفصحى، مع إبقاء المصطلحات والرموز العلمية (مثل K-Map, Minterms, F = A + B) كما هي بالإنجليزية';

    const instruction = `أنت أستاذ جامعي تضع امتحاناً. اكتب ${count} سؤالاً جديداً يقيس فهم الطالب للمحتوى العلمي في المستند المرفق.
- لغة الأسئلة والاختيارات والشرح: ${language}.
- الأنواع المطلوبة (وزّع العدد عليها بالتساوي تقريباً):
${types.map((t: string) => `  • ${TYPE_TEXT[t]}`).join('\n')}
- كل سؤال يعتمد على معلومة أو خطوة أو نتيجة موجودة في المستند، بدون أسئلة عامة خارج المحتوى.
- الاختيارات الخاطئة معقولة ومن نفس الموضوع، ولا تكتب حروف الترقيم (أ) ب)) في بداية الاختيارات.
- correctOptionIndexes: أرقام الاختيارات الصحيحة تبدأ من 0 (أكثر من رقم في multiple_select).
- explanation: سطر يوضح سبب الإجابة من المستند.
- تجاهل أخطاء القراءة الضوئية الواضحة في النص (مثل © بدلاً من C).`;

    try {
      const questions = await geminiQuestions(apiKey, documentParts(b, instruction));
      res.json({ ai: true, questions });
    } catch (e: any) {
      console.error('Gemini generate error:', e);
      throw new HttpError(502, `تعذّر توليد الأسئلة الآن، حاول مرة أخرى بعد قليل. (${String(e?.message || e).slice(0, 160)})`);
    }
  })
);

/* -------------------------------------------------------------------------- */
/*  Lecture files: uploads, private reads, secure video streaming              */
/*  (storage + access rules live in server/files.ts)                           */
/* -------------------------------------------------------------------------- */

const MAX_UPLOAD_BYTES = 1100 * 1024 * 1024;
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;

const chunkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, TMP_DIR),
    // Never let the client's file name reach the disk
    filename: (_req, _file, cb) => cb(null, `rx_${crypto.randomUUID()}`)
  }),
  limits: { fileSize: MAX_CHUNK_BYTES, files: 1, fields: 8 }
});

/** File ids currently being written, so a double-submit cannot interleave two writes of the same file. */
const writing = new Set<string>();
const lockFile = (id: string) => {
  if (writing.has(id)) throw new HttpError(409, 'جارٍ حفظ هذا الملف بالفعل، انتظر لحظة');
  writing.add(id);
  return () => writing.delete(id);
};

/**
 * Moves a finished temp file into private storage and records its owner.
 * If the record cannot be written, the stored object is rolled back so storage and database never disagree.
 */
async function commitUpload(me: Doc, doctorId: string, id: string, tmpPath: string, uploadId?: string) {
  const size = fs.statSync(tmpPath).size;
  if (!size) throw new HttpError(400, 'محتوى الملف فارغ');
  if (size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'حجم الملف أكبر من 1 جيجابايت');
  const contentType = sniffFile(tmpPath);
  if (!contentType) throw new HttpError(415, 'نوع الملف غير مدعوم. المسموح: PDF أو فيديو MP4 / WebM / MOV');

  const prev = await store.get('files', id);
  await files.saveFromPath(id, tmpPath, contentType);
  try {
    await store.upsertMany('files', [
      {
        id,
        ownerDoctorId: doctorId,
        uploadedBy: me.id,
        uploadId: uploadId || '',
        contentType,
        size,
        status: prev?.status || 'pending',
        createdAt: prev?.createdAt || Date.now(),
        lastSeenAt: prev?.lastSeenAt || 0
      }
    ]);
  } catch (e) {
    if (!prev) await files.remove(id).catch(() => undefined);
    throw e;
  }
  return { ok: true, fileId: id, bytes: size, contentType };
}

/** Streams `src` into the response; stops reading as soon as the viewer goes away. */
function pipeToResponse(src: Readable, res: Response) {
  return new Promise<void>(resolve => {
    src.on('error', err => {
      console.warn('• File stream error:', (err as Error)?.message);
      if (!res.headersSent) res.status(502).json({ error: 'تعذرت قراءة الملف من التخزين، حاول مرة أخرى' });
      else res.destroy();
      resolve();
    });
    res.on('close', () => {
      src.destroy();
      resolve();
    });
    src.pipe(res);
  });
}

const appendTo = (out: fs.WriteStream, part: string) =>
  new Promise<void>((resolve, reject) => {
    const rs = fs.createReadStream(part);
    rs.on('error', reject);
    out.once('error', reject);
    rs.on('end', () => {
      out.off('error', reject);
      resolve();
    });
    rs.pipe(out, { end: false });
  });

// Small files (<= 5 MB) in one request. Idempotent for the owning doctor, so the client may retry.
app.put(
  '/api/files/:id',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const id = assertFileId(String(req.params.id));
    const doctorId = await authorizeFileWrite(store, me, id);
    if (Number(req.headers['content-length'] || 0) > MAX_UPLOAD_BYTES) throw new HttpError(413, 'حجم الملف أكبر من 1 جيجابايت');
    const unlock = lockFile(id);
    const tmp = path.join(TMP_DIR, `put_${crypto.randomUUID()}`);
    try {
      if (Buffer.isBuffer(req.body)) fs.writeFileSync(tmp, req.body);
      else await pipeline(req, fs.createWriteStream(tmp));
      res.json(await commitUpload(me, doctorId, id, tmp));
    } finally {
      unlock();
      fs.rmSync(tmp, { force: true });
    }
  })
);

/* ------------------------- Vercel Blob direct uploads ------------------------ */

/** Issues a short-lived client token for one file id; the browser then uploads to the Blob store itself. */
app.post(
  '/api/blob/upload',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    if (files.kind !== 'blob') throw new HttpError(404, 'التخزين المباشر غير مفعّل');
    const me = await currentUser(req);
    const checkPath = async (pathname: string, clientPayload: string | null) => {
      const fileId = assertFileId(String(JSON.parse(clientPayload || '{}').fileId || ''));
      if (pathname !== BlobBackend.pathname(fileId)) throw new HttpError(400, 'مسار الملف غير صالح');
      await authorizeFileWrite(store, me, fileId);
    };
    const allowedContentTypes = ['video/*', 'application/pdf', 'application/octet-stream'];
    const validUntil = Date.now() + 2 * 3600_000;
    const { handleUpload, handleUploadPresigned } = await import('@vercel/blob/client');
    const result = (files as BlobBackend).presigned
      ? // OIDC store: a presigned URL scoped to this one file, signed with a short-lived delegation
        await handleUploadPresigned({
          request: req,
          body: req.body,
          // Completion is reported by the browser (/api/blob/complete), no webhook is used
          webhookPublicKey: process.env.BLOB_WEBHOOK_PUBLIC_KEY || 'unused',
          getSignedToken: async (pathname, clientPayload) => {
            await checkPath(pathname, clientPayload);
            const { issueSignedToken } = await import('@vercel/blob');
            const token = await issueSignedToken({
              storeId: config.blob.storeId,
              pathname,
              operations: ['put'],
              allowedContentTypes,
              maximumSizeInBytes: MAX_UPLOAD_BYTES,
              validUntil
            });
            return { token, urlOptions: { allowedContentTypes, maximumSizeInBytes: MAX_UPLOAD_BYTES, allowOverwrite: true, addRandomSuffix: false } };
          }
        })
      : await handleUpload({
          token: config.blob.token,
          request: req,
          body: req.body,
          onBeforeGenerateToken: async (pathname, clientPayload) => {
            await checkPath(pathname, clientPayload);
            return {
              allowedContentTypes,
              maximumSizeInBytes: MAX_UPLOAD_BYTES,
              addRandomSuffix: false,
              allowOverwrite: true,
              validUntil
            };
          }
        });
    res.json(result);
  })
);

/** After a direct upload: checks the stored file and records it like a server-side upload. */
app.post(
  '/api/blob/complete',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    if (files.kind !== 'blob') throw new HttpError(404, 'التخزين المباشر غير مفعّل');
    const me = await currentUser(req);
    const id = assertFileId(String(req.body?.fileId || ''));
    const doctorId = await authorizeFileWrite(store, me, id);
    const info = await files.stat(id);
    if (!info) throw new HttpError(404, 'لم يتم العثور على الملف المرفوع، أعد رفعه');
    if (info.size > MAX_UPLOAD_BYTES) {
      await files.remove(id);
      throw new HttpError(413, 'حجم الملف أكبر من 1 جيجابايت');
    }
    // Trust the bytes, not the name the browser sent
    const head = await new Promise<Buffer>((resolve, reject) => {
      const parts: Buffer[] = [];
      files.read(id, { start: 0, end: 63 }).then(s => {
        s.on('data', (c: Buffer) => parts.push(c));
        s.on('end', () => resolve(Buffer.concat(parts).subarray(0, 64)));
        s.on('error', reject);
      }, reject);
    });
    const contentType = sniffContentType(head);
    if (!contentType) {
      await files.remove(id);
      throw new HttpError(415, 'نوع الملف غير مدعوم. المسموح: PDF أو فيديو MP4 / WebM / MOV');
    }
    const prev = await store.get('files', id);
    await store.upsertMany('files', [
      {
        id,
        ownerDoctorId: doctorId,
        uploadedBy: me.id,
        uploadId: String(req.body?.uploadId || ''),
        contentType,
        size: info.size,
        status: prev?.status || 'pending',
        createdAt: prev?.createdAt || Date.now(),
        lastSeenAt: prev?.lastSeenAt || 0
      }
    ]);
    res.json({ ok: true, fileId: id, bytes: info.size, contentType });
  })
);

// Large files: chunks first (each one retryable), then one assemble call.
app.post(
  '/api/upload/chunk',
  requireAuth,
  requireDoctorOrAssistant,
  chunkUpload.single('chunk'),
  wrap(async (req, res) => {
    const received = req.file?.path;
    try {
      const idx = Number(req.body?.chunkIndex);
      const total = Number(req.body?.totalChunks);
      if (!req.file || !Number.isInteger(idx) || !Number.isInteger(total) || idx < 0 || total < 1 || idx >= total) {
        throw new HttpError(400, 'بيانات مقطع الملف غير مكتملة');
      }
      if (total > 2000) throw new HttpError(413, 'حجم الملف أكبر من المسموح');
      const dir = chunkSessionDir(req.auth!.sub, String(req.body?.uploadId || ''));
      const bucket = chunksInBucket();
      if (bucket) {
        // A retried chunk simply replaces the earlier copy
        await bucket.putChunk(path.basename(dir), idx, req.file.path);
        return res.json({ ok: true, chunkIndex: idx });
      }
      fs.mkdirSync(dir, { recursive: true });
      // A retried chunk simply replaces the earlier copy
      fs.renameSync(req.file.path, path.join(dir, `chunk_${idx}.part`));
      res.json({ ok: true, chunkIndex: idx });
    } finally {
      if (received) fs.rmSync(received, { force: true });
    }
  })
);

app.post(
  '/api/upload/assemble',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const uploadId = String(req.body?.uploadId || '');
    const id = assertFileId(String(req.body?.fileId || ''));
    const total = Number(req.body?.totalChunks);
    if (!Number.isInteger(total) || total < 1 || total > 2000) throw new HttpError(400, 'بيانات تجميع الملف غير مكتملة');
    const doctorId = await authorizeFileWrite(store, me, id);
    const dir = chunkSessionDir(me.id, uploadId);
    const bucket = chunksInBucket();

    if (bucket) {
      const session = path.basename(dir);
      const unlock = lockFile(id);
      const tmp = path.join(TMP_DIR, `asm_${crypto.randomUUID()}`);
      try {
        const missing = await bucket.missingChunk(session, total);
        if (missing >= 0) {
          // The client retried after a successful assemble whose response was lost on the way back
          const rec = await store.get('files', id);
          if (missing === 0 && rec && rec.ownerDoctorId === doctorId && rec.uploadId === uploadId) {
            return res.json({ ok: true, fileId: id, bytes: rec.size, contentType: rec.contentType });
          }
          throw new HttpError(missing === 0 ? 404 : 400, missing === 0 ? 'لم يتم العثور على أجزاء الملف المرفوعة، أعد رفع الملف' : `الجزء ${missing + 1} مفقود، أعد رفع الملف`);
        }
        const out = fs.createWriteStream(tmp);
        try {
          for (let i = 0; i < total; i++) {
            await new Promise<void>((resolve, reject) => {
              const src = bucket.chunkStream(session, i);
              src.on('error', reject);
              src.on('end', () => resolve());
              src.pipe(out, { end: false });
            });
          }
        } finally {
          await new Promise<void>(resolve => out.end(resolve));
        }
        if (fs.statSync(tmp).size > MAX_UPLOAD_BYTES) throw new HttpError(413, 'حجم الملف أكبر من 1 جيجابايت');
        const result = await commitUpload(me, doctorId, id, tmp, uploadId);
        await bucket.removeChunks(session);
        return res.json(result);
      } catch (e) {
        await bucket.removeChunks(session);
        throw e;
      } finally {
        unlock();
        fs.rmSync(tmp, { force: true });
      }
    }

    if (!fs.existsSync(dir)) {
      // The client retried after a successful assemble whose response was lost on the way back
      const rec = await store.get('files', id);
      if (rec && rec.ownerDoctorId === doctorId && rec.uploadId === uploadId) {
        return res.json({ ok: true, fileId: id, bytes: rec.size, contentType: rec.contentType });
      }
      throw new HttpError(404, 'لم يتم العثور على أجزاء الملف المرفوعة، أعد رفع الملف');
    }

    const unlock = lockFile(id);
    const tmp = path.join(TMP_DIR, `asm_${crypto.randomUUID()}`);
    try {
      const parts = Array.from({ length: total }, (_, i) => path.join(dir, `chunk_${i}.part`));
      const missing = parts.findIndex(p => !fs.existsSync(p));
      if (missing >= 0) throw new HttpError(400, `الجزء ${missing + 1} مفقود، أعد رفع الملف`);
      const bytes = parts.reduce((n, p) => n + fs.statSync(p).size, 0);
      if (bytes > MAX_UPLOAD_BYTES) throw new HttpError(413, 'حجم الملف أكبر من 1 جيجابايت');

      const out = fs.createWriteStream(tmp);
      try {
        for (const p of parts) {
          await appendTo(out, p);
          fs.rmSync(p, { force: true }); // keep peak disk use near one copy of the file
        }
      } finally {
        await new Promise<void>(resolve => out.end(resolve));
      }
      const result = await commitUpload(me, doctorId, id, tmp, uploadId);
      fs.rmSync(dir, { recursive: true, force: true });
      res.json(result);
    } catch (e) {
      // Chunks are partly consumed now; the client starts over with a fresh upload id
      fs.rmSync(dir, { recursive: true, force: true });
      throw e;
    } finally {
      unlock();
      fs.rmSync(tmp, { force: true });
    }
  })
);

// PDFs (and videos for the doctor's own team). Students never receive a whole video file.
app.get(
  '/api/files/:id',
  requireAuth,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const id = assertFileId(String(req.params.id));
    const ref = await authorizeFileRead(store, me, id);
    const info = await files.stat(id);
    if (!info) throw new HttpError(404, 'الملف غير موجود');
    if (!doctorScopeOf(me) && (ref?.kind === 'video' || isVideoType(info.contentType))) {
      throw new HttpError(403, 'الفيديو متاح للمشاهدة من داخل المحاضرة فقط');
    }
    res.setHeader('Content-Type', info.contentType);
    res.setHeader('Content-Length', String(info.size));
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    await pipeToResponse(await files.read(id), res);
  })
);

// Lectures are saved in the background, so a file the database still points at is never deleted here;
// the sweeper removes it once no lecture uses it any more.
app.delete(
  '/api/files/:id',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    const me = await currentUser(req);
    const id = assertFileId(String(req.params.id));
    await authorizeFileWrite(store, me, id);
    if (await findFileRef(store, id)) return res.json({ ok: true, deferred: true });
    await files.remove(id);
    await store.deleteMany('files', [id]);
    res.json({ ok: true });
  })
);

/* ------------------------------ video playback ------------------------------ */

const grantHits = new Map<string, { n: number; t: number }>();
const grantAllowed = (sub: string) => {
  const now = Date.now();
  const h = grantHits.get(sub);
  if (!h || now - h.t > 60_000) {
    grantHits.set(sub, { n: 1, t: now });
    return true;
  }
  return ++h.n <= 30;
};

/**
 * Step 1: an authenticated viewer asks to watch a lecture's video. After the lesson permission check:
 *  - Cloudflare Stream video -> a short-lived signed HLS manifest URL (played straight from Cloudflare's CDN)
 *  - video uploaded to this server -> a short-lived, browser-bound /api/stream link
 */
app.post(
  '/api/lectures/:lectureId/video-access',
  requireAuth,
  wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const me = await currentUser(req);
    if (!grantAllowed(me.id)) throw new HttpError(429, 'طلبات كثيرة، انتظر دقيقة ثم أعد المحاولة');
    const lectureId = String(req.params.lectureId);
    if (!/^[\w-]{1,100}$/.test(lectureId)) throw new HttpError(400, 'معرّف محاضرة غير صالح');
    const ref = await findLecture(store, lectureId);
    if (!ref) throw new HttpError(404, 'هذا المحتوى غير متاح لحسابك');
    await assertLectureAccess(store, me, ref);
    const { lecture, course } = ref;

    if (lecture.videoUid) {
      if (!streamEnabled()) throw new HttpError(503, 'خدمة الفيديو غير مهيأة على الخادم');
      const uid = assertUid(String(lecture.videoUid));
      // The UID must belong to this course's doctor: a doctor cannot attach someone else's video to their course
      const rec = await store.get('files', uid);
      if (!rec || rec.provider !== 'cloudflare' || rec.ownerDoctorId !== course.doctorId) throw new HttpError(404, 'الفيديو غير موجود');
      const info = rec.status === 'ready' ? rec : await refreshStreamVideo(rec);
      if (info.status !== 'ready') {
        return res.json({ provider: 'cloudflare', status: info.status, retryAfterMs: 15_000 });
      }
      const { token, expiresAt } = await playbackToken(uid, tokenSeconds(info.duration || 0));
      return res.json({ provider: 'cloudflare', status: 'ready', hlsUrl: manifestUrl(token), poster: posterUrl(token), expiresAt });
    }

    if (lecture.videoFileId) {
      const id = assertFileId(String(lecture.videoFileId));
      const info = await files.stat(id);
      if (!info || !isVideoType(info.contentType)) throw new HttpError(404, 'الفيديو غير موجود');
      const grant = signGrant(id, me.id);
      res.cookie(BIND_COOKIE, bindingFor(me.id), {
        httpOnly: true,
        sameSite: 'strict',
        secure: req.secure || req.headers['x-forwarded-proto'] === 'https',
        path: '/api/stream',
        maxAge: config.tokenHours * 3600 * 1000
      });
      return res.json({ provider: 'internal', status: 'ready', url: `/api/stream/${grant.token}`, expiresAt: grant.expiresAt });
    }

    throw new HttpError(404, 'لا يوجد فيديو لهذه المحاضرة');
  })
);

/* ---------------------------------- quizzes ---------------------------------- */

const quizLecture = async (req: Request) => {
  const me = await currentUser(req);
  const lectureId = String(req.params.lectureId);
  if (!/^[\w-]{1,100}$/.test(lectureId)) throw new HttpError(400, 'معرّف محاضرة غير صالح');
  const ref = await findLecture(store, lectureId);
  if (!ref) throw new HttpError(404, 'المحاضرة غير موجودة');
  await assertLectureAccess(store, me, ref);
  return { me, ref };
};

app.post(
  '/api/quiz/:lectureId/start',
  requireAuth,
  wrap(async (req, res) => {
    const { me, ref } = await quizLecture(req);
    res.json(await startQuiz(store, me, ref));
  })
);

app.post(
  '/api/quiz/:lectureId/submit',
  requireAuth,
  wrap(async (req, res) => {
    const { me, ref } = await quizLecture(req);
    res.json(await submitQuiz(store, me, ref, req.body?.answers));
  })
);

/** A student pressed a screenshot shortcut on protected content: recorded for the doctor's activity log. */
const captureReports = new Map<string, number[]>();
app.post(
  '/api/security/capture-attempt/:lectureId',
  requireAuth,
  wrap(async (req, res) => {
    const { me, ref } = await quizLecture(req);
    if (me.role !== 'student') return res.json({ ok: true });
    const now = Date.now();
    const recent = (captureReports.get(me.id) || []).filter(t => now - t < 3600_000);
    if (recent.length >= 20) return res.json({ ok: true }); // enough evidence already
    captureReports.set(me.id, [...recent, now]);
    const where = req.body?.where === 'pdf' ? 'ملف الشرح' : 'فيديو';
    await store.upsertMany('activityLogs', [
      {
        id: `log_${crypto.randomUUID().slice(0, 12)}`,
        userId: me.id,
        userName: me.name,
        userAcademicId: me.academicId,
        userRole: me.role,
        action: `⚠️ محاولة تصوير الشاشة أثناء مشاهدة ${where}: ${ref.lecture.title}`,
        timestamp: new Date(now).toISOString(),
        type: 'lecture'
      }
    ]);
    res.json({ ok: true });
  })
);

/* ------------------------- Cloudflare Stream uploads ------------------------ */

const STREAM_MAX_BYTES = 30 * 1024 ** 3; // Cloudflare Stream's per-file limit

/** Pulls processing state from Cloudflare into the upload record. */
async function refreshStreamVideo(rec: Doc) {
  const info = await getVideo(rec.id);
  if (info.status === 'ready' && !info.requireSignedURLs) await ensureSigned(rec.id);
  const next = { ...rec, status: info.status, duration: info.duration, thumbnail: info.thumbnail, errorReason: info.errorReason || '', checkedAt: Date.now() };
  await store.upsertMany('files', [next]);
  return { ...next, pctComplete: info.pctComplete };
}

const streamRecordFor = async (me: Doc, uid: string) => {
  const doctorId = doctorScopeOf(me);
  const rec = await store.get('files', assertUid(uid));
  if (!doctorId || !rec || rec.provider !== 'cloudflare' || rec.ownerDoctorId !== doctorId) throw new HttpError(404, 'الفيديو غير موجود');
  return rec;
};

/** Why videos cannot be uploaded here, or undefined when they can. */
const videoUploadBlocker = () =>
  // A serverless function keeps no disk between requests: chunks and the finished video need Cloud Storage
  // (or the video goes straight from the browser to Cloudflare Stream)
  !(SERVERLESS && !streamEnabled() && files.kind === 'local')
    ? undefined
    : 'رفع الفيديو على Vercel يحتاج تخزيناً دائماً: من Vercel ← Storage أنشئ Blob store واربطه بالمشروع (يضيف BLOB_READ_WRITE_TOKEN)، ثم أعد النشر. لحين ذلك استخدم رابط فيديو خارجي (YouTube / Drive).';

/** On a serverless host each request may land on another instance, so upload chunks go to Cloud Storage. */
const chunksInBucket = () => (SERVERLESS && files.kind === 'firebase' ? (files as unknown as FirebaseBackend) : null);

app.get('/api/video/config', requireAuth, requireDoctorOrAssistant, (_req, res) => {
  const reason = videoUploadBlocker();
  res.json({
    ...(streamEnabled() ? { provider: 'cloudflare', maxBytes: STREAM_MAX_BYTES } : { provider: 'internal', maxBytes: MAX_UPLOAD_BYTES }),
    // Files go from the browser straight to the Blob store (no request size limit on the way)
    ...(files.kind === 'blob' ? { direct: 'blob', ...((files as BlobBackend).presigned ? { presigned: true } : {}) } : {}),
    available: !reason,
    ...(reason ? { reason } : {})
  });
});

/** One-time direct upload URL: the browser sends the file to Cloudflare itself (TUS, resumable). */
app.post(
  '/api/stream-videos/uploads',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    if (!streamEnabled()) throw new HttpError(503, 'خدمة Cloudflare Stream غير مهيأة على الخادم');
    const me = await currentUser(req);
    const doctorId = doctorScopeOf(me)!;
    const course = await store.get('courses', String(req.body?.courseId || ''));
    if (!course || course.doctorId !== doctorId) throw new HttpError(403, 'هذا المقرر ليس ضمن مقرراتك');
    const size = Number(req.body?.size);
    if (!Number.isSafeInteger(size) || size <= 0) throw new HttpError(400, 'حجم الملف غير صالح');
    if (size > STREAM_MAX_BYTES) throw new HttpError(413, 'حجم الفيديو أكبر من 30 جيجابايت');
    const name = String(req.body?.name || 'lecture-video').slice(0, 200);
    if (!/\.(mp4|m4v|mov|webm|mkv|avi|mpe?g|flv|3gp)$/i.test(name)) throw new HttpError(415, 'الملف يجب أن يكون فيديو (MP4, MOV, WebM, MKV)');

    const { uid, uploadUrl } = await createDirectUpload({ size, name, creator: me.id });
    try {
      await store.upsertMany('files', [
        { id: uid, provider: 'cloudflare', ownerDoctorId: doctorId, uploadedBy: me.id, courseId: course.id, name, size, status: 'uploading', createdAt: Date.now(), lastSeenAt: 0 }
      ]);
    } catch (e) {
      await deleteVideo(uid).catch(() => undefined);
      throw e;
    }
    res.json({ uid, uploadUrl });
  })
);

app.get(
  '/api/stream-videos/:uid',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const rec = await streamRecordFor(await currentUser(req), String(req.params.uid));
    const info = rec.status === 'ready' ? rec : await refreshStreamVideo(rec);
    res.json({ uid: rec.id, status: info.status, duration: info.duration || 0, thumbnail: info.thumbnail || '', errorReason: info.errorReason || '', pctComplete: info.pctComplete });
  })
);

/** Cancel / replace. A video a lecture still points at is left for the sweeper. */
app.delete(
  '/api/stream-videos/:uid',
  requireAuth,
  requireDoctorOrAssistant,
  wrap(async (req, res) => {
    const rec = await streamRecordFor(await currentUser(req), String(req.params.uid));
    if (await findFileRef(store, rec.id)) return res.json({ ok: true, deferred: true });
    await deleteVideo(rec.id);
    await store.deleteMany('files', [rec.id]);
    res.json({ ok: true });
  })
);

/** Recent positive access checks, so a playing video does not hit the database on every range request. */
const streamAccess = new Map<string, number>();
const STREAM_RECHECK_MS = 60_000;

/** Step 2: the player streams the video in byte ranges with that link. */
app.get(
  '/api/stream/:grant',
  wrap(async (req, res) => {
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Robots-Tag', 'noindex');
    const grant = verifyGrant(String(req.params.grant));
    if (!grant) throw new HttpError(401, 'انتهت صلاحية رابط التشغيل');

    // Bound to the browser it was issued to: a copied link does not play anywhere else.
    // iOS fetches media through AppleCoreMedia, which may omit cookies; the short grant lifetime still applies there.
    const bound = readCookie(req.headers.cookie, BIND_COOKIE);
    const coreMedia = !req.headers['sec-fetch-dest'] && /AppleCoreMedia/i.test(String(req.headers['user-agent'] || ''));
    if (bound ? bound !== bindingFor(grant.sub) : !coreMedia) throw new HttpError(403, 'رابط التشغيل خاص بالحساب الذي طلبه');

    // Opening the link as a page (where the browser offers "Save video as") is refused; only players may load it.
    const dest = String(req.headers['sec-fetch-dest'] || '');
    if (['document', 'iframe', 'frame', 'embed', 'object'].includes(dest)) {
      throw new HttpError(403, 'التشغيل متاح من داخل المنصة فقط');
    }

    const key = `${grant.sub}:${grant.fid}`;
    if (Date.now() - (streamAccess.get(key) || 0) > STREAM_RECHECK_MS) {
      const me = await store.get('users', grant.sub);
      if (!me || (me.status && me.status !== 'active')) throw new HttpError(401, 'هذا الحساب موقوف');
      const ref = await authorizeFileRead(store, me, grant.fid);
      if (ref && ref.kind !== 'video') throw new HttpError(404, 'الفيديو غير موجود');
      streamAccess.set(key, Date.now());
      if (streamAccess.size > 5000) streamAccess.clear();
    }

    const info = await files.stat(grant.fid);
    if (!info || !isVideoType(info.contentType)) throw new HttpError(404, 'الفيديو غير موجود');
    const range = parseRange(req.headers.range, info.size);
    if (!range) {
      res.setHeader('Content-Range', `bytes */${info.size}`);
      return res.status(416).end();
    }

    res.status(206);
    res.setHeader('Content-Type', info.contentType);
    res.setHeader('Content-Length', String(range.end - range.start + 1));
    res.setHeader('Content-Range', `bytes ${range.start}-${range.end}/${info.size}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (req.method === 'HEAD') return res.end();
    await pipeToResponse(await files.read(grant.fid, range), res);
  })
);

const runSweep = () => sweepFiles(store, files).catch(e => console.warn('• File sweep failed:', e?.message || e));
if (!SERVERLESS) {
  setTimeout(runSweep, 60_000).unref();
  setInterval(runSweep, 3600_000).unref();
}

/* -------------------------------------------------------------------------- */
/*  Errors, then the web app                                                   */
/* -------------------------------------------------------------------------- */

app.use('/api', (_req, res) => res.status(404).json({ error: 'غير موجود' }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.too.large' || err?.status === 413 || err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'حجم الملف كبير جداً، يرجى رفع ملف فيديو بحجم أقل أو استخدامه عبر رابط خارجي.' });
  }
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

/** Used by the Vercel function (api/index.ts); there Vercel serves the built frontend itself. */
export default app;

const server = http.createServer(app);

if (SERVERLESS) {
  // nothing to start
} else if (config.isProd) {
  const dist = path.join(config.root, 'dist');
  // The bundled server lives in dist/ too; never serve it as a static file
  app.use(/^\/server\.mjs(\.map)?$/, (_req, res) => res.status(404).end());
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  // Specifier kept out of static analysis so serverless bundles do not pull in vite
  const viteModule = 'vite';
  const { createServer: createVite } = await import(viteModule);
  const vite = await createVite({
    root: config.root,
    appType: 'spa',
    server: { middlewareMode: true, ws: { server } }
  });
  app.use(vite.middlewares);
}

if (!SERVERLESS) server.listen(config.port, '0.0.0.0', () => {
  console.log(`\n✓ http://localhost:${config.port}  (${config.isProd ? 'production' : 'development'})`);
  console.log(`• WhatsApp: ${whatsappStatus().configured ? 'configured' : 'not configured'}`);
  console.log(`• Telegram: ${telegramStatus().configured ? 'configured' : 'not configured'}`);
  console.log(`• Videos: ${streamEnabled() ? 'Cloudflare Stream (direct uploads + signed playback)' : 'stored by this server (set CLOUDFLARE_* to use Cloudflare Stream)'}`);
  console.log(`• Email: ${emailStatus().configured ? 'configured' : 'not configured (enrollment emails are skipped, logged instead)'}`);
  if (config.allowDemoLogin) console.log('• Demo one-click login is ON (set ALLOW_DEMO_LOGIN=false for real use)');
});
