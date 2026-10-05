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
  'settings',
  /** Upload bookkeeping (owner, size, type). Written by the server only, never synced to browsers. */
  'files'
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

/**
 * Firestore with a per-collection in-memory cache.
 *
 * Every signed-in browser polls /api/bootstrap, which reads whole collections. Without a cache each poll
 * re-reads every document from Firestore (300 students x a poll every few seconds = billions of reads).
 * Browsers never write to Firestore directly (see firestore.rules), so this server sees every write and can
 * keep the cache current itself; the TTL only bounds staleness between several server instances.
 */
const CACHE_TTL_MS = Number(process.env.STORE_CACHE_TTL_MS || 60_000);

export class FirestoreStore implements Store {
  kind = 'firestore' as const;
  private db: FirebaseFirestore.Firestore;
  private cache = new Map<CollectionName, { docs: Map<string, Doc>; loadedAt: number }>();
  /** Concurrent cold reads of one collection share a single Firestore query. */
  private loading = new Map<CollectionName, Promise<Map<string, Doc>>>();
  /** Bumped on every write; a load that overlapped a write is not trusted as fresh. */
  private version = new Map<CollectionName, number>();
  private bump(c: CollectionName) {
    this.version.set(c, (this.version.get(c) || 0) + 1);
  }

  constructor(db: FirebaseFirestore.Firestore) {
    this.db = db;
  }

  private col(c: CollectionName) {
    return this.db.collection(c);
  }

  private fresh(c: CollectionName) {
    const hit = this.cache.get(c);
    return hit && Date.now() - hit.loadedAt < CACHE_TTL_MS ? hit.docs : undefined;
  }

  private async load(c: CollectionName): Promise<Map<string, Doc>> {
    const cached = this.fresh(c);
    if (cached) return cached;
    let p = this.loading.get(c);
    if (!p) {
      const startedAt = this.version.get(c) || 0;
      p = this.col(c)
        .get()
        .then(snap => {
          const docs = new Map(snap.docs.map(d => [d.id, { ...d.data(), id: d.id } as Doc]));
          const overlapped = (this.version.get(c) || 0) !== startedAt;
          this.cache.set(c, { docs, loadedAt: overlapped ? 0 : Date.now() });
          return docs;
        })
        .finally(() => this.loading.delete(c));
      this.loading.set(c, p);
    }
    return p;
  }

  async getAll(c: CollectionName) {
    return [...(await this.load(c)).values()].sort((a, b) => (a._ts || 0) - (b._ts || 0));
  }

  async get(c: CollectionName, id: string) {
    const cached = this.fresh(c);
    if (cached) return cached.get(id);
    const snap = await this.col(c).doc(id).get();
    return snap.exists ? ({ ...snap.data(), id: snap.id } as Doc) : undefined;
  }

  async upsertMany(c: CollectionName, docs: Doc[]) {
    // Firestore batches are limited to 500 writes
    for (let i = 0; i < docs.length; i += 400) {
      const batch = this.db.batch();
      const chunk = docs.slice(i, i + 400);
      const cached = this.fresh(c);
      // _ts is kept from the stored version; the cache already knows it, so only cold writes read first
      const prevTs = cached
        ? chunk.map(d => cached.get(d.id)?._ts)
        : (await this.db.getAll(...chunk.map(d => this.col(c).doc(d.id)))).map(s => (s.exists ? s.data()?._ts : undefined));
      const written = chunk.map((d, k) => ({ ...d, _ts: prevTs[k] || d._ts || nextTs() }));
      written.forEach(d => batch.set(this.col(c).doc(d.id), d));
      await batch.commit();
      this.bump(c);
      const after = this.cache.get(c);
      if (after) written.forEach(d => after.docs.set(d.id, d));
    }
  }

  async deleteMany(c: CollectionName, ids: string[]) {
    for (let i = 0; i < ids.length; i += 400) {
      const batch = this.db.batch();
      ids.slice(i, i + 400).forEach(id => batch.delete(this.col(c).doc(id)));
      await batch.commit();
    }
    this.bump(c);
    const hit = this.cache.get(c);
    if (hit) ids.forEach(id => hit.docs.delete(id));
  }

  async replaceAll(c: CollectionName, docs: Doc[]) {
    this.cache.delete(c);
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
    const { initializeApp, getApps, cert, applicationDefault } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    let credential: any;
    let projectId = config.firebase.projectId;

    // A key file path that does not exist (e.g. a stale secret) falls back to Application Default Credentials
    const credIsMissingFile = !!cred && !cred.startsWith('{') && !fs.existsSync(path.resolve(config.root, cred));
    if (credIsMissingFile) console.warn(`• FIREBASE_SERVICE_ACCOUNT file not found (${cred}); using Application Default Credentials instead.`);

    if (cred && !credIsMissingFile) {
      const json = cred.startsWith('{') ? cred : fs.readFileSync(path.resolve(config.root, cred), 'utf8');
      const serviceAccount = JSON.parse(json);
      credential = cert(serviceAccount);
      projectId = projectId || serviceAccount.project_id;
    } else {
      // No key file: use the runtime's Google credentials (Cloud Run service account or gcloud login)
      if (!projectId) throw new Error('MISSING_PROJECT_ID');
      credential = applicationDefault();
    }

    const fbApp = getApps()[0] || initializeApp({ credential, projectId });
    const databaseId = config.firebase.databaseId;
    const db = databaseId ? getFirestore(fbApp, databaseId) : getFirestore(fbApp);
    db.settings({ ignoreUndefinedProperties: true });
    // Fail early with a clear message when the project or the credentials are wrong
    await db.collection('users').limit(1).get();
    console.log(`• Storage: Firebase Firestore (project ${projectId}${databaseId ? ', database ' + databaseId : ''}${cred && !credIsMissingFile ? '' : ', default credentials'})`);
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
    console.warn('\n⚠️ تعذّر الاتصال بـ Firebase: ' + why + ' -> Falling back to local FileStore.\n');
    return new FileStore();
  }
}