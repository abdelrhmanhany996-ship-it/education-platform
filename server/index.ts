import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import express, { NextFunction, Request, Response } from 'express';
import { config, DATA_DIR } from './config';
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

const store = await createStore();
await seedIfEmpty(store);
startTelegramLinker(store);
startAlertScheduler(store);

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '15mb' }));

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next);

const uid = (p: string) => `${p}_${crypto.randomUUID().slice(0, 12)}`;
const today = () => new Date().toISOString().split('T')[0];
const looksLikeEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

const findByUsername = async (username: string) =>
  (await store.getAll('users')).find(u => u.username?.toLowerCase() === username.trim().toLowerCase());

const session = (user: Doc) => ({ token: signToken(user.id, user.role), user: publicUser(user) });

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
    if (user.status === 'pending') {
      throw new HttpError(403, 'طلبك لا يزال قيد المراجعة. سيتواصل معك الدكتور أو المساعد، وتقدر تسجّل الدخول بعد الموافقة.');
    }
    if (user.status && user.status !== 'active') throw new HttpError(403, 'هذا الحساب موقوف، تواصل مع الدكتور');
    loginSucceeded(key);
    res.json(session(user));
  })
);

app.post(
  '/api/auth/demo',
  wrap(async (req, res) => {
    if (!config.allowDemoLogin) throw new HttpError(403, 'الدخول التجريبي معطّل');
    const user = await findByUsername(String(req.body?.username || ''));
    if (!user) throw new HttpError(404, 'الحساب غير موجود');
    res.json(session(user));
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
    const user = await createUser({ ...b, role: 'student', status: 'active' });

    if (courseId) {
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
  if (me.status && me.status !== 'active') throw new HttpError(401, 'هذا الحساب موقوف');
  return me;
};

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
    if (!COLLECTIONS.includes(collection)) throw new HttpError(400, 'مجموعة غير معروفة');
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
/*  Uploaded PDFs                                                              */
/* -------------------------------------------------------------------------- */

const uploads = path.join(DATA_DIR, 'uploads');
fs.mkdirSync(uploads, { recursive: true });
const fileId = (raw: string) => {
  if (!/^[\w-]{6,80}$/.test(raw)) throw new HttpError(400, 'معرّف ملف غير صالح');
  return raw;
};

app.put(
  '/api/files/:id',
  requireAuth,
  requireDoctor,
  express.raw({ type: '*/*', limit: '26mb' }),
  wrap(async (req, res) => {
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length < 5 || body.subarray(0, 5).toString() !== '%PDF-') {
      throw new HttpError(400, 'الملف ليس PDF صالحاً');
    }
    fs.writeFileSync(path.join(uploads, fileId(String(req.params.id))), body);
    res.json({ ok: true });
  })
);

app.get(
  '/api/files/:id',
  requireAuth,
  wrap(async (req, res) => {
    const file = path.join(uploads, fileId(String(req.params.id)));
    if (!fs.existsSync(file)) throw new HttpError(404, 'الملف غير موجود');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(file);
  })
);

app.delete(
  '/api/files/:id',
  requireAuth,
  requireDoctor,
  wrap(async (req, res) => {
    fs.rmSync(path.join(uploads, fileId(String(req.params.id))), { force: true });
    res.json({ ok: true });
  })
);

/* -------------------------------------------------------------------------- */
/*  Errors, then the web app                                                   */
/* -------------------------------------------------------------------------- */

app.use('/api', (_req, res) => res.status(404).json({ error: 'غير موجود' }));

app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'الحجم كبير جداً' });
  console.error(err);
  res.status(500).json({ error: 'حدث خطأ في الخادم' });
});

const server = http.createServer(app);

if (config.isProd) {
  const dist = path.join(config.root, 'dist');
  app.use(express.static(dist));
  app.get('*', (_req, res) => res.sendFile(path.join(dist, 'index.html')));
} else {
  const { createServer: createVite } = await import('vite');
  const vite = await createVite({
    root: config.root,
    appType: 'spa',
    server: { middlewareMode: true, ws: { server } }
  });
  app.use(vite.middlewares);
}

server.listen(config.port, '0.0.0.0', () => {
  console.log(`\n✓ http://localhost:${config.port}  (${config.isProd ? 'production' : 'development'})`);
  console.log(`• WhatsApp: ${whatsappStatus().configured ? 'configured' : 'not configured'}`);
  console.log(`• Telegram: ${telegramStatus().configured ? 'configured' : 'not configured'}`);
  console.log(`• Email: ${emailStatus().configured ? 'configured' : 'not configured (enrollment emails are skipped, logged instead)'}`);
  if (config.allowDemoLogin) console.log('• Demo one-click login is ON (set ALLOW_DEMO_LOGIN=false for real use)');
});
