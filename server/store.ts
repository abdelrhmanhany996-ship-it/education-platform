import fs from 'node:fs';
import path from 'node:path';
import { DATA_DIR, config } from './config';

export type Doc = { id: string; [key: string]: any };

export const COLLECTIONS = [
  'users',
  'courses',
  'groups',
  'studentStates',
  'certificates',
  'activityLogs',
  'whatsappLogs',
  'telegramLogs',
  'enrollments',
  'chatMessages',
  'settings'
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

/**
 * Every document gets a server-side `_ts` (insertion order) the first time it is written.
 * It keeps lists in a stable order and lets the client show newest logs first.
 */
export interface Store {
  kind: 'firestore' | 'file';
  getAll(collection: CollectionName): Promise<Doc[]>;
  get(collection: CollectionName, id: string): Promise<Doc | undefined>;
  upsertMany(collection: CollectionName, docs: Doc[]): Promise<void>;
  deleteMany(collection: CollectionName, ids: string[]): Promise<void>;
  replaceAll(collection: CollectionName, docs: Doc[]): Promise<void>;
  isEmpty(): Promise<boolean>;
}

let counter = Date.now() * 1000;
const nextTs = () => ++counter;

/* -------------------------------------------------------------------------- */
/*  Local JSON file: used when no Firebase credentials are configured          */
/* -------------------------------------------------------------------------- */

class FileStore implements Store {
  kind = 'file' as const;
  private file = path.join(DATA_DIR, 'db.json');
  private data: Record<string, Record<string, Doc>> = {};
  private timer?: NodeJS.Timeout;

  constructor() {
    if (fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      } catch {
        fs.copyFileSync(this.file, this.file + '.corrupt');
        this.data = {};
      }
    }
    COLLECTIONS.forEach(c => (this.data[c] ||= {}));
    const max = Math.max(0, ...Object.values(this.data).flatMap(c => Object.values(c).map(d => d._ts || 0)));
    if (max > counter) counter = max;
  }

  private persist() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.data));
      fs.renameSync(tmp, this.file);
    }, 150);
  }

  async getAll(c: CollectionName) {
    return Object.values(this.data[c]).sort((a, b) => (a._ts || 0) - (b._ts || 0));
  }
  async get(c: CollectionName, id: string) {
    return this.data[c][id];
  }
  async upsertMany(c: CollectionName, docs: Doc[]) {
    for (const d of docs) {
      const prev = this.data[c][d.id];
      this.data[c][d.id] = { ...d, _ts: prev?._ts || d._ts || nextTs() };
    }
    this.persist();
  }
  async deleteMany(c: CollectionName, ids: string[]) {
    ids.forEach(id => delete this.data[c][id]);
    this.persist();
  }
  async replaceAll(c: CollectionName, docs: Doc[]) {
    this.data[c] = {};
    await this.upsertMany(c, docs);
  }
  async isEmpty() {
    return Object.keys(this.data.users).length === 0;
  }
}

/* -------------------------------------------------------------------------- */
/*  Firebase Firestore                                                         */
/* -------------------------------------------------------------------------- */

class FirestoreStore implements Store {
  kind = 'firestore' as const;
  private db: FirebaseFirestore.Firestore;

  constructor(db: FirebaseFirestore.Firestore) {
    this.db = db;
  }

  private col(c: CollectionName) {
    return this.db.collection(c);
  }

  async getAll(c: CollectionName) {
    const snap = await this.col(c).get();
    return snap.docs.map(d => ({ ...d.data(), id: d.id }) as Doc).sort((a, b) => (a._ts || 0) - (b._ts || 0));
  }

  async get(c: CollectionName, id: string) {
    const snap = await this.col(c).doc(id).get();
    return snap.exists ? ({ ...snap.data(), id: snap.id } as Doc) : undefined;
  }

  async upsertMany(c: CollectionName, docs: Doc[]) {
    // Firestore batches are limited to 500 writes
    for (let i = 0; i < docs.length; i += 400) {
      const batch = this.db.batch();
      const chunk = docs.slice(i, i + 400);
      const existing = await this.db.getAll(...chunk.map(d => this.col(c).doc(d.id)));
      chunk.forEach((d, k) => {
        const prevTs = existing[k].exists ? existing[k].data()?._ts : undefined;
        batch.set(this.col(c).doc(d.id), { ...d, _ts: prevTs || d._ts || nextTs() });
      });
      await batch.commit();
    }
  }

  async deleteMany(c: CollectionName, ids: string[]) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = this.db.batch();
      ids.slice(i, i + 400).forEach(id => batch.delete(this.col(c).doc(id)));
      await batch.commit();
    }
  }

  async replaceAll(c: CollectionName, docs: Doc[]) {
    const snap = await this.col(c).get();
    await this.deleteMany(c, snap.docs.map(d => d.id));
    await this.upsertMany(c, docs);
  }

  async isEmpty() {
    const snap = await this.col('users').limit(1).get();
    return snap.empty;
  }
}

/* -------------------------------------------------------------------------- */

export async function createStore(): Promise<Store> {
  const cred = config.firebase.credential.trim();
  const useAdc = config.firebase.useAdc;
  if (!cred && !useAdc) {
    console.log('• Storage: local file (server/data/db.json). Add FIREBASE_SERVICE_ACCOUNT or FIREBASE_USE_ADC=true to use Firebase.');
    return new FileStore();
  }

  try {
    const admin = await import('firebase-admin');
    const app = admin.default;
    let credential: any;
    let projectId = config.firebase.projectId;

    if (cred) {
      const json = cred.startsWith('{') ? cred : fs.readFileSync(path.resolve(config.root, cred), 'utf8');
      const serviceAccount = JSON.parse(json);
      credential = app.credential.cert(serviceAccount);
      projectId = projectId || serviceAccount.project_id;
    } else {
      // No key file: use the Google account signed in on this machine
      if (!projectId) throw new Error('MISSING_PROJECT_ID');
      credential = app.credential.applicationDefault();
    }

    if (!app.apps.length) app.initializeApp({ credential, projectId });
    const db = app.firestore();
    db.settings({ ignoreUndefinedProperties: true });
    // Fail early with a clear message when the project or the credentials are wrong
    await db.collection('users').limit(1).get();
    console.log(`• Storage: Firebase Firestore (project ${projectId}${cred ? '' : ', signed-in Google account'})`);
    return new FirestoreStore(db);
  } catch (e: any) {
    const msg = String(e?.message || e);
    const why =
      e?.code === 'ENOENT'
        ? 'ملف مفتاح الخدمة غير موجود: ' + cred
        : e instanceof SyntaxError
        ? 'ملف مفتاح الخدمة ليس JSON صالحاً'
        : msg === 'MISSING_PROJECT_ID'
        ? 'اكتب FIREBASE_PROJECT_ID في ملف .env'
        : /Could not load the default credentials|default credentials/i.test(msg)
        ? 'لم يتم تسجيل الدخول بحساب Google على هذا الجهاز. نفّذ: gcloud auth application-default login'
        : /invalid_grant|reauth|Reauthentication/i.test(msg)
        ? 'انتهت جلسة Google. نفّذ من جديد: gcloud auth application-default login'
        : /Cloud Firestore API has not been used|PERMISSION_DENIED|NOT_FOUND|5 NOT_FOUND/.test(msg)
        ? 'فعّل Firestore في مشروع Firebase (Build > Firestore Database > Create database) وتأكد أن الحساب له صلاحية على المشروع'
        : msg;
    console.error('\n✗ تعذّر الاتصال بـ Firebase\n  ' + why + '\n  (احذف FIREBASE_USE_ADC و FIREBASE_SERVICE_ACCOUNT من .env لاستخدام الملف المحلي مؤقتاً)\n');
    process.exit(1);
  }
}