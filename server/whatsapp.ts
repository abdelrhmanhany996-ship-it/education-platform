import { config, whatsappConfigured } from './config';
import type { Doc, Store } from './store';

/** 01012345678 / +20 101 234 5678 / 0020101… -> 201012345678 (digits only, country code included). */
export function normalizePhone(raw: string): string | null {
  let d = (raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  else if (d.startsWith('00')) d = d.slice(2);
  else if (d.startsWith('0')) d = config.whatsapp.defaultCountryCode + d.slice(1);
  return /^\d{8,15}$/.test(d) ? d : null;
}

type Result =
  | { ok: true; id: string; via: 'text' | 'template' }
  | { ok: false; error: string; code?: number };

async function post(payload: Record<string, unknown>) {
  const { apiBase, phoneNumberId, token } = config.whatsapp;
  const res = await fetch(`${apiBase}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...payload }),
    signal: AbortSignal.timeout(15000)
  });
  const json: any = await res.json().catch(() => ({}));
  return { res, json };
}

const arabicError = (code: number | undefined, fallback: string): string => {
  switch (code) {
    case 190:
      return 'انتهت صلاحية رمز واتساب (WHATSAPP_TOKEN). ولّد رمزاً جديداً من Meta.';
    case 131030:
      return 'هذا الرقم غير مضاف كمستلم تجريبي في حساب Meta. أضفه من لوحة واتساب في Meta for Developers.';
    case 131026:
      return 'تعذّر تسليم الرسالة: الرقم غير مسجّل على واتساب.';
    case 131047:
    case 470:
      return 'مرّت أكثر من 24 ساعة على آخر رسالة من الطالب، وواتساب يسمح حينها بقالب معتمد فقط.';
    case 132001:
      return 'القالب المحدد غير موجود أو غير معتمد بعد. راجع WHATSAPP_TEMPLATE_NAME واللغة.';
    default:
      return fallback;
  }
};

/** Meta rejects template variables with new lines, tabs, or runs of spaces. */
const forTemplate = (text: string) =>
  text.replace(/[\r\n\t]+/g, ' • ').replace(/ {2,}/g, ' ').trim().slice(0, 900);

export async function sendWhatsApp(to: string, message: string): Promise<Result> {
  try {
    const text = await post({ to, type: 'text', text: { body: message, preview_url: false } });
    if (text.res.ok && text.json?.messages?.[0]?.id) {
      return { ok: true, id: text.json.messages[0].id, via: 'text' };
    }

    const err = text.json?.error;
    const outsideWindow = err?.code === 131047 || err?.code === 470;

    if (outsideWindow && config.whatsapp.templateName) {
      const tpl = await post({
        to,
        type: 'template',
        template: {
          name: config.whatsapp.templateName,
          language: { code: config.whatsapp.templateLang },
          components: [{ type: 'body', parameters: [{ type: 'text', text: forTemplate(message) }] }]
        }
      });
      if (tpl.res.ok && tpl.json?.messages?.[0]?.id) {
        return { ok: true, id: tpl.json.messages[0].id, via: 'template' };
      }
      const terr = tpl.json?.error;
      return { ok: false, code: terr?.code, error: arabicError(terr?.code, terr?.message || 'فشل إرسال القالب') };
    }

    return { ok: false, code: err?.code, error: arabicError(err?.code, err?.message || `خطأ ${text.res.status} من واتساب`) };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'انتهت مهلة الاتصال بواتساب' : 'تعذّر الاتصال بواتساب' };
  }
}

/** Same rule the doctor sees in the app: N messages per rolling week and a minimum gap. */
export async function quotaFor(store: Store, studentId: string) {
  const { checkQuota } = await import('./quota');
  return checkQuota(store, 'whatsappLogs', studentId);
}

export const status = () => ({
  configured: whatsappConfigured(),
  template: !!config.whatsapp.templateName
});
