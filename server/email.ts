import { config, emailConfigured } from './config';

/**
 * Best-effort email sender. With no SMTP configured it just logs the message and returns
 * `skipped: true` — the enrollment flow still works entirely inside the app (the doctor/assistant
 * see the request on the "طلبات التسجيل" page), email is only a convenience notification.
 */
export async function sendMail(to: string, subject: string, html: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!to) return { ok: false, error: 'لا يوجد بريد إلكتروني للمستلم' };
  if (!emailConfigured()) {
    console.log(`• [email skipped, SMTP not configured] to=${to} subject="${subject}"`);
    return { ok: false, skipped: true };
  }

  try {
    const nodemailer = await import('nodemailer');
    const transport = nodemailer.default.createTransport({
      host: config.email.host,
      port: config.email.port,
      secure: config.email.secure,
      auth: { user: config.email.user, pass: config.email.pass }
    });
    await transport.sendMail({ from: config.email.from, to, subject, html });
    return { ok: true };
  } catch (e: any) {
    console.error('email send failed:', e?.message || e);
    return { ok: false, error: e?.message || 'تعذر إرسال البريد' };
  }
}

export const status = () => ({ configured: emailConfigured() });
