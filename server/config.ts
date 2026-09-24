import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
export const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, 'server', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const flag = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.split('=')[1];

/** Signing key for login tokens. Generated once and kept on disk when AUTH_SECRET is not set. */
function authSecret(): string {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  const file = path.join(DATA_DIR, '.auth-secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(32).toString('hex');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

export const config = {
  root,
  port: Number(flag('port') || process.env.PORT || 3000),
  isProd: process.env.NODE_ENV === 'production' || process.argv.includes('--prod'),
  authSecret: authSecret(),
  tokenHours: Number(process.env.TOKEN_HOURS || 12),
  /** One-click demo logins. Turn off with ALLOW_DEMO_LOGIN=false before real students use the system. */
  allowDemoLogin: process.env.ALLOW_DEMO_LOGIN !== 'false',

  firebase: {
    /** Path to the service-account JSON downloaded from Firebase, or the JSON itself. */
    credential: process.env.FIREBASE_SERVICE_ACCOUNT || '',
    /** Keyless mode: use the Google account signed in with `gcloud auth application-default login`. */
    useAdc: process.env.FIREBASE_USE_ADC === 'true',
    projectId: process.env.FIREBASE_PROJECT_ID || ''
  },

  whatsapp: {
    token: process.env.WHATSAPP_TOKEN || '',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    apiBase: process.env.WHATSAPP_API_BASE || 'https://graph.facebook.com/v21.0',
    /** Approved template used when the 24-hour customer window is closed. Body needs one variable: {{1}}. */
    templateName: process.env.WHATSAPP_TEMPLATE_NAME || '',
    templateLang: process.env.WHATSAPP_TEMPLATE_LANG || 'ar',
    /** Prepended to local numbers such as 01012345678 (Egypt = 20). */
    defaultCountryCode: process.env.DEFAULT_COUNTRY_CODE || '20'
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    /** Shown in the deep link t.me/<username>?start=CODE. Auto-detected from getMe if left empty. */
    botUsername: process.env.TELEGRAM_BOT_USERNAME || '',
    apiBase: process.env.TELEGRAM_API_BASE || 'https://api.telegram.org',
    /** From https://my.telegram.org > API development tools. Lets the server message any number from a personal account. */
    apiId: Number(process.env.TELEGRAM_API_ID || 0),
    apiHash: process.env.TELEGRAM_API_HASH || ''
  },

  email: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || process.env.SMTP_USER || '',
    /** Base URL used to build the "قبول الطلب" link the doctor gets by email. */
    appUrl: (process.env.APP_URL || `http://localhost:${Number(flag('port') || process.env.PORT || 3000)}`).replace(/\/$/, '')
  },

  /** Runs the automatic alert check this often. */
  alertCheckMs: Number(process.env.ALERT_CHECK_MS || 5 * 60 * 1000)
};

export const whatsappConfigured = () => !!(config.whatsapp.token && config.whatsapp.phoneNumberId);
export const telegramConfigured = () => !!config.telegram.botToken;
export const telegramUserConfigured = () => !!(config.telegram.apiId && config.telegram.apiHash);
export const emailConfigured = () => !!(config.email.host && config.email.user && config.email.pass);
