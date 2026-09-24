import { config, telegramConfigured, whatsappConfigured } from './config';
import type { Doc, Store } from './store';
import { calculateStudentAlarms, DEFAULT_ALERT_SETTINGS } from '../src/utils/scoring';
import { normalizePhone, sendWhatsApp } from './whatsapp';
import { deliverToStudent } from './telegram';
import { userStatus } from './telegramUser';
import { checkQuota } from './quota';

const uid = (p: string) => `${p}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

const absenceText = (student: Doc, course: Doc, count: number) =>
  `السلام عليكم يا ${student.name}،\nمعك أستاذ مقرر (${course.title}).\nلوحظ عدم إكمالك لـ ${count} محاضرات متتالية. برجاء مراجعة المنصة والاطمئنان عليك.\n(تنبيه تلقائي)`;

const dropText = (student: Doc, course: Doc, drop: number) =>
  `السلام عليكم يا ${student.name}،\nمعك أستاذ مقرر (${course.title}).\nلوحظ انخفاض أدائك بنسبة ${drop}% في آخر كويزات مقارنة بأدائك السابق. تواصل معنا إن احتجت مساعدة.\n(تنبيه تلقائي)`;

/**
 * Sends the doctor's configured alerts on its own, on a timer — no click required. Runs once per
 * `config.alertCheckMs` and relies on the existing per-student weekly quota to avoid duplicates.
 */
export function startAlertScheduler(store: Store) {
  const tick = async () => {
    try {
      await runOnce(store);
    } catch (e) {
      console.error('alert scheduler tick failed:', e);
    } finally {
      setTimeout(tick, config.alertCheckMs);
    }
  };
  setTimeout(tick, 15000); // give the server a moment to finish booting first
  console.log(`• Automatic alerts: checking every ${Math.round(config.alertCheckMs / 60000)} min (channels need WhatsApp/Telegram configured)`);
}

async function runOnce(store: Store) {
  const tgAccount = (await userStatus()).connected;
  if (!whatsappConfigured() && !telegramConfigured() && !tgAccount) return; // nothing to send through

  const [users, courses, states, enrollments, settingsDocs] = await Promise.all([
    store.getAll('users'),
    store.getAll('courses'),
    store.getAll('studentStates'),
    store.getAll('enrollments'),
    store.getAll('settings')
  ]);

  const alertSettings = { ...DEFAULT_ALERT_SETTINGS, ...((settingsDocs.find(s => s.id === 'alertSettings') as any)?.value || {}) };
  const channels: string[] = alertSettings.channels || ['whatsapp'];
  if (!channels.length) return;

  const doctors = users.filter(u => u.role === 'doctor');

  for (const doctor of doctors) {
    const ownCourses = courses.filter(c => c.doctorId === doctor.id && !c.isCompleted);
    for (const course of ownCourses) {
      const approvedStudentIds = new Set(
        enrollments.filter(e => e.courseId === course.id && e.status === 'approved').map(e => e.studentId)
      );
      const courseStates = states.filter(s => s.courseId === course.id);

      for (const studentId of approvedStudentIds) {
        const student = users.find(u => u.id === studentId && u.status === 'active');
        if (!student) continue;

        const alarms = calculateStudentAlarms(student as any, course as any, courseStates as any, alertSettings);
        if (!alarms.hasAbsenceAlarm && !alarms.hasPerformanceAlarm) continue;

        const type = alarms.hasAbsenceAlarm ? 'consecutive_absence' : 'performance_drop';
        const text = alarms.hasAbsenceAlarm
          ? absenceText(student, course, alarms.consecutiveAbsences)
          : dropText(student, course, alarms.performanceDropPercentage);

        if (channels.includes('whatsapp') && whatsappConfigured()) {
          await trySend('whatsappLogs', student, type, text, async () => {
            const to = normalizePhone(student.phone);
            if (!to) return { ok: false as const, error: 'رقم غير صالح' };
            const r = await sendWhatsApp(to, text);
            return r.ok ? { ok: true as const, id: r.id, via: r.via } : { ok: false as const, error: r.error };
          }, store);
        }

        if (channels.includes('telegram') && (tgAccount || (telegramConfigured() && student.telegramChatId))) {
          await trySend('telegramLogs', student, type, text, async () => {
            const r = await deliverToStudent(student as any, text);
            return r.ok ? { ok: true as const, id: r.id ?? 0 } : { ok: false as const, error: r.error };
          }, store);
        }
      }
    }
  }
}

async function trySend(
  collection: 'whatsappLogs' | 'telegramLogs',
  student: Doc,
  type: string,
  text: string,
  send: () => Promise<{ ok: true; id: number | string; via?: string } | { ok: false; error: string }>,
  store: Store
) {
  const quota = await checkQuota(store, collection, student.id);
  if (!quota.ok) return; // rate-limited: this is normal, not an error

  const result = await send();
  const base = {
    id: uid(collection === 'whatsappLogs' ? 'wa' : 'tg'),
    studentId: student.id,
    studentName: student.name,
    messageType: type,
    messageText: text,
    sentAt: new Date().toISOString(),
    auto: true
  };

  const log: Doc =
    collection === 'whatsappLogs'
      ? { ...base, phone: student.phone, status: result.ok ? 'sent' : 'failed', ...(result.ok ? { waMessageId: result.id, via: (result as any).via } : { error: result.error }) }
      : { ...base, chatId: student.telegramChatId, status: result.ok ? 'sent' : 'failed', ...(result.ok ? { telegramMessageId: result.id } : { error: result.error }) };

  await store.upsertMany(collection, [log]);
}
