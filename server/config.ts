import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = path.resolve(import.meta.dirname, '..');
/** Running as a Vercel serverless function: no long-lived process, and only /tmp is writable. */
export const SERVERLESS = !!process.env.VERCEL;
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : SERVERLESS
  ? '/tmp/lms-data'
  : path.join(root, 'server', 'data');
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

let firebaseAppletProjectId = '';
let firebaseAppletDatabaseId = '';
let firebaseAppletStorageBucket = '';
try {
  const cfgPath = path.join(root, 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    const json = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    firebaseAppletProjectId = json.projectId || '';
    firebaseAppletDatabaseId = json.firestoreDatabaseId || '';
    firebaseAppletStorageBucket = json.storageBucket || '';
  }
} catch {
  /* ignore */
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
    // Vercel has no Google default credentials, so there Firebase needs FIREBASE_SERVICE_ACCOUNT
    useAdc:
      process.env.FIREBASE_USE_ADC === 'true' ||
      (process.env.FIREBASE_USE_ADC !== 'false' && !SERVERLESS && !process.env.FIREBASE_SERVICE_ACCOUNT && !!firebaseAppletProjectId),
    projectId: process.env.FIREBASE_PROJECT_ID || firebaseAppletProjectId,
    /** Named Firestore database (AI Studio provisions one per app). Empty = "(default)". */
    databaseId: process.env.FIREBASE_DATABASE_ID || firebaseAppletDatabaseId,
    /** Private Cloud Storage bucket for lecture videos/PDFs. Used only when Firestore is connected. FIREBASE_STORAGE_BUCKET=off keeps files on local disk. */
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || firebaseAppletStorageBucket
  },

  /** Vercel Blob store (Vercel → Storage → Blob). Lecture videos/PDFs go there when no Cloud Storage bucket is set up. */
  blob: {
    token: process.env.BLOB_READ_WRITE_TOKEN || ''
  },

  video: {
    /** Lifetime of one playback grant. The player re-authorizes transparently when it runs out. */
    grantMinutes: Number(process.env.VIDEO_GRANT_MINUTES || 15)
  },

  /** Cloudflare Stream: when configured, lecture videos are uploaded to and played from Cloudflare, never through this server. */
  cloudflareStream: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID || '',
    /** API token with "Stream:Edit" permission. Server only. */
    apiToken: process.env.CLOUDFLARE_STREAM_API_TOKEN || '',
    /** The xxxx in customer-xxxx.cloudflarestream.com (Stream dashboard). */
    customerCode: process.env.CLOUDFLARE_STREAM_CUSTOMER_CODE || '',
    /** Signing key (POST /stream/keys) for minting playback tokens locally; without it each token costs an API call. */
    signingKeyId: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_ID || '',
    signingKeyPem: process.env.CLOUDFLARE_STREAM_SIGNING_KEY_PEM || '',
    /** Optional comma-separated hostnames allowed to embed/play the videos, e.g. "lms.example.com". */
    allowedOrigins: process.env.CLOUDFLARE_STREAM_ALLOWED_ORIGINS || '',
    /** Fixed playback token lifetime. Empty = video length + 15 min (30 min .. 4 h). */
    tokenMinutes: Number(process.env.CLOUDFLARE_STREAM_TOKEN_MINUTES || 0),
    apiBase: (process.env.CLOUDFLARE_API_BASE || 'https://api.cloudflare.com/client/v4').replace(/\/$/, ''),
    deliveryBase: (process.env.CLOUDFLARE_STREAM_DELIVERY_BASE || '').replace(/\/$/, '')
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
export const cloudflareStreamConfigured = () => !!(config.cloudflareStream.accountId && config.cloudflareStream.apiToken);
export const emailConfigured = () => !!(config.email.host && config.email.user && config.email.pass);
