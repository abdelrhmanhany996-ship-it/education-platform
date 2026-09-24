import { config, telegramConfigured } from './config';
import type { Store } from './store';
import { sendToPhone, userStatus } from './telegramUser';

type SendResult = { ok: true; id: number } | { ok: false; error: string };

const arabicError = (description: string | undefined, fallback: string): string => {
  if (!description) return fallback;
  if (/chat not found/i.test(description)) return 'لم يبدأ الطالب محادثة مع البوت بعد. اطلب منه الضغط على رابط الربط أولاً.';
  if (/bot was blocked/i.test(description)) return 'الطالب حظر البوت على تليجرام.';
  if (/Unauthorized/i.test(description)) return 'رمز بوت تليجرام (TELEGRAM_BOT_TOKEN) غير صالح.';
  return description;
};

async function call(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${config.telegram.apiBase}/bot${config.telegram.botToken}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000)
  });
  const json: any = await res.json().catch(() => ({}));
  return { res, json };
}

export async function sendTelegram(chatId: string, text: string): Promise<SendResult> {
  try {
    const { res, json } = await call('sendMessage', { chat_id: chatId, text });
    if (res.ok && json?.result?.message_id) return { ok: true, id: json.result.message_id };
    return { ok: false, error: arabicError(json?.description, `خطأ ${res.status} من تليجرام`) };
  } catch (e: any) {
    return { ok: false, error: e?.name === 'TimeoutError' ? 'انتهت مهلة الاتصال بتليجرام' : 'تعذّر الاتصال بتليجرام' };
  }
}

let cachedUsername = '';
export async function getBotUsername(): Promise<string> {
  if (config.telegram.botUsername) return config.telegram.botUsername;
  if (cachedUsername) return cachedUsername;
  if (!telegramConfigured()) return '';
  try {
    const { json } = await call('getMe', {});
    cachedUsername = json?.result?.username || '';
  } catch {
    /* leave empty; the UI will show a setup notice */
  }
  return cachedUsername;
}

export const telegramDeepLink = (username: string, code: string) => `https://t.me/${username}?start=${code}`;

/**
 * No public URL is available on a machine run locally, so instead of a webhook the server
 * long-polls Telegram's getUpdates for "/start <code>" messages and links the matching student.
 */
let polling = false;
export function startTelegramLinker(store: Store) {
  if (polling || !telegramConfigured()) return;
  polling = true;
  let offset = 0;

  const tick = async () => {
    try {
      const { res, json } = await call('getUpdates', { offset, timeout: 25, allowed_updates: ['message'] });
      if (!res.ok || !Array.isArray(json?.result)) return;

      for (const update of json.result) {
        offset = update.update_id + 1;
        const msg = update.message;
        const text: string = msg?.text || '';
        const match = text.match(/^\/start\s+(\S+)/);
        if (!match) continue;

        const code = match[1];
        const users = await store.getAll('users');
        const user = users.find(u => u.telegramLinkCode === code);
        if (!user) {
          await call('sendMessage', { chat_id: msg.chat.id, text: 'رابط غير صالح أو منتهي. أعد نسخ رابط الربط من المنصة.' });
          continue;
        }
        await store.upsertMany('users', [{ ...user, telegramChatId: String(msg.chat.id), telegramLinkCode: undefined }]);
        await call('sendMessage', {
          chat_id: msg.chat.id,
          text: `تم ربط حسابك بنجاح يا ${user.name}! ستصلك تنبيهات المنصة هنا.`
        });
      }
    } catch {
      /* network hiccup: the next tick tries again */
    } finally {
      if (polling) setTimeout(tick, 1000);
    }
  };

  tick();
  console.log('• Telegram: linking bot is polling for /start messages');
}

/**
 * One way to reach a student: through the personal account when it is linked (works for any number,
 * no Start needed), otherwise through the bot if the student linked it.
 */
export async function deliverToStudent(student: { name: string; phone?: string; telegramChatId?: string }, text: string) {
  const user = await userStatus();
  if (user.connected && student.phone) {
    const r = await sendToPhone(student.phone, student.name, text);
    if (r.ok || !student.telegramChatId || !telegramConfigured()) return { ...r, via: 'account' as const };
  }
  if (student.telegramChatId && telegramConfigured()) return { ...(await sendTelegram(student.telegramChatId, text)), via: 'bot' as const };
  return {
    ok: false as const,
    error: 'مفيش وسيلة تليجرام متاحة: اربط حسابك الشخصي من الإعدادات، أو خلّي الطالب يربط البوت.',
    via: 'none' as const
  };
}

/** Bot only: used where a bot link is needed. */
export const status = () => ({ configured: telegramConfigured() });

/** Any way of sending: the bot and/or the linked personal account. */
export const fullStatus = async () => {
  const user = await userStatus();
  return { configured: telegramConfigured() || user.connected, bot: telegramConfigured(), userConnected: user.connected };
};
