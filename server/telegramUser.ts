import fs from 'node:fs';
import path from 'node:path';
import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { config, DATA_DIR, telegramUserConfigured } from './config';

/**
 * Sends Telegram messages from a personal account (like WhatsApp Business): unlike a bot, it can
 * message any number that has Telegram without the person pressing Start first.
 * The login session lives in server/data (never committed).
 */

const SESSION_FILE = path.join(DATA_DIR, '.telegram-user-session');

type Result = { ok: true; id?: number } | { ok: false; error: string };

let client: TelegramClient | null = null;
let connectedName = '';

const readSession = () => (fs.existsSync(SESSION_FILE) ? fs.readFileSync(SESSION_FILE, 'utf8').trim() : '');

async function getClient(session = readSession()): Promise<TelegramClient> {
  if (client && client.connected) return client;
  client = new TelegramClient(new StringSession(session), config.telegram.apiId, config.telegram.apiHash, {
    connectionRetries: 3
  });
  client.setLogLevel('none' as any);
  await client.connect();
  return client;
}

/** E.164 digits for a local number such as 01012345678. */
export function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) return digits.slice(2);
  if (digits.startsWith('0')) return `${config.whatsapp.defaultCountryCode}${digits.slice(1)}`;
  return digits;
}

export async function userStatus(): Promise<{ configured: boolean; connected: boolean; name?: string }> {
  if (!telegramUserConfigured()) return { configured: false, connected: false };
  if (!readSession()) return { configured: true, connected: false };
  try {
    const c = await getClient();
    if (!(await c.checkAuthorization())) return { configured: true, connected: false };
    if (!connectedName) {
      const me: any = await c.getMe();
      connectedName = [me.firstName, me.lastName].filter(Boolean).join(' ') || me.username || me.phone || 'حساب تليجرام';
    }
    return { configured: true, connected: true, name: connectedName };
  } catch {
    return { configured: true, connected: false };
  }
}

/* ------------------------------------ login ------------------------------------ */

let pending: { client: TelegramClient; phone: string; hash: string } | null = null;

export async function startLogin(phone: string): Promise<void> {
  if (!telegramUserConfigured()) throw new Error('أضف TELEGRAM_API_ID و TELEGRAM_API_HASH في ملف .env أولاً.');
  const c = new TelegramClient(new StringSession(''), config.telegram.apiId, config.telegram.apiHash, { connectionRetries: 3 });
  c.setLogLevel('none' as any);
  await c.connect();
  const intl = `+${toInternational(phone)}`;
  const sent = await c.sendCode({ apiId: config.telegram.apiId, apiHash: config.telegram.apiHash }, intl);
  pending = { client: c, phone: intl, hash: sent.phoneCodeHash };
}

/** Returns 'password' when the account has two-step verification and needs its password too. */
export async function finishLogin(code: string, password?: string): Promise<'ok' | 'password'> {
  if (!pending) throw new Error('ابدأ بطلب كود الدخول أولاً.');
  const { client: c, phone, hash } = pending;
  try {
    await c.invoke(new Api.auth.SignIn({ phoneNumber: phone, phoneCodeHash: hash, phoneCode: code.trim() }));
  } catch (e: any) {
    if (e?.errorMessage === 'SESSION_PASSWORD_NEEDED') {
      if (!password) return 'password';
      await c.signInWithPassword(
        { apiId: config.telegram.apiId, apiHash: config.telegram.apiHash },
        { password: async () => password, onError: async err => { throw err; } }
      );
    } else if (e?.errorMessage === 'PHONE_CODE_INVALID') throw new Error('الكود غير صحيح.');
    else if (e?.errorMessage === 'PHONE_CODE_EXPIRED') throw new Error('انتهت صلاحية الكود، اطلب كوداً جديداً.');
    else throw e;
  }
  fs.writeFileSync(SESSION_FILE, String(c.session.save()), { mode: 0o600 });
  client = c;
  pending = null;
  connectedName = '';
  return 'ok';
}

export async function logoutUser(): Promise<void> {
  try {
    if (client) await client.invoke(new Api.auth.LogOut());
  } catch {
    /* already invalid */
  }
  client = null;
  connectedName = '';
  if (fs.existsSync(SESSION_FILE)) fs.unlinkSync(SESSION_FILE);
}

/* ------------------------------------ sending ---------------------------------- */

export async function sendToPhone(phone: string, name: string, text: string): Promise<Result> {
  try {
    const st = await userStatus();
    if (!st.connected) return { ok: false, error: 'حساب تليجرام الشخصي غير مربوط. اربطه من الإعدادات.' };
    const c = await getClient();
    const imported: any = await c.invoke(
      new Api.contacts.ImportContacts({
        contacts: [
          new Api.InputPhoneContact({
            clientId: BigInt(Date.now()) as any,
            phone: `+${toInternational(phone)}`,
            firstName: name || 'طالب',
            lastName: ''
          })
        ]
      })
    );
    const user = imported.users?.[0];
    if (!user) return { ok: false, error: 'الرقم ده مش عليه تليجرام (أو الخصوصية عنده بتمنع).' };
    const msg = await c.sendMessage(user, { message: text });
    return { ok: true, id: msg.id };
  } catch (e: any) {
    const m = String(e?.errorMessage || e?.message || '');
    if (/FLOOD/i.test(m)) return { ok: false, error: 'تليجرام طلب الانتظار قبل إرسال رسائل جديدة (حد الإرسال). حاول لاحقاً.' };
    if (/PEER_FLOOD/i.test(m)) return { ok: false, error: 'تليجرام قيّد الإرسال لأرقام جديدة مؤقتاً على هذا الحساب.' };
    return { ok: false, error: 'تعذّر الإرسال عبر حساب تليجرام الشخصي.' };
  }
}
