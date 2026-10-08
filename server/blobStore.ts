import crypto from 'node:crypto';
import { config } from './config';
import { COLLECTIONS, CollectionName, Doc, Store } from './store';

/**
 * Serverless (Vercel) without Firebase: every function instance has its own empty /tmp, so the JSON database
 * and the login secret would differ per instance (logins rejected, data missing). These keep both in the
 * private Blob store instead, shared by all instances.
 */

const DB_PATH = 'system/db.json';
const SECRET_PATH = 'system/auth-secret';
/** How long an instance trusts its copy before checking the store for writes made by other instances. */
const FRESH_MS = Number(process.env.BLOB_DB_FRESH_MS || 20_000);

export const blobConfigured = () => !!(config.blob.token || config.blob.storeId);
const creds = () => (config.blob.token ? { token: config.blob.token } : { storeId: config.blob.storeId });
const sdk = () => import('@vercel/blob');

async function readText(pathname: string, ifNoneMatch?: string) {
  const { get } = await sdk();
  const res = await get(pathname, { access: 'private', useCache: false, ...(ifNoneMatch ? { ifNoneMatch } : {}), ...creds() });
  if (!res) return null;
  if (res.statusCode === 304) return { unchanged: true as const, etag: ifNoneMatch! };
  return { unchanged: false as const, etag: res.blob.etag, text: await new Response(res.stream).text() };
}

/** The same token-signing secret on every instance, created once and kept in the store. */
export async function loadSharedAuthSecret(): Promise<string> {
  const existing = await readText(SECRET_PATH);
  if (existing && !existing.unchanged && existing.text.trim()) return existing.text.trim();
  const { put } = await sdk();
  const secret = crypto.randomBytes(32).toString('hex');
  try {
    await put(SECRET_PATH, secret, { access: 'private', addRandomSuffix: false, allowOverwrite: false, contentType: 'text/plain', ...creds() });
    return secret;
  } catch (e) {
    // Another instance created it first: use theirs
    const again = await readText(SECRET_PATH);
    if (again && !again.unchanged && again.text.trim()) return again.text.trim();
    throw e;
  }
}

type Data = Record<string, Record<string, Doc>>;
type Op =
  | { kind: 'upsert'; c: CollectionName; docs: Doc[] }
  | { kind: 'delete'; c: CollectionName; ids: string[] }
  | { kind: 'replace'; c: CollectionName; docs: Doc[] };

let counter = Date.now() * 1000;
const nextTs = () => ++counter;

function apply(data: Data, op: Op) {
  const col = (data[op.c] ||= {});
  if (op.kind === 'replace') {
    data[op.c] = {};
    for (const d of op.docs) data[op.c][d.id] = d;
  } else if (op.kind === 'upsert') {
    for (const d of op.docs) col[d.id] = d;
  } else {
    for (const id of op.ids) delete col[id];
  }
}

/**
 * The whole database as one JSON blob. Writes are applied to the latest stored copy with an ETag check,
 * so two instances writing at the same time both keep their changes.
 */
export class BlobStore implements Store {
  kind = 'file' as const;
  private data: Data = {};
  private etag = '';
  private checkedAt = 0;
  private pending: Op[] = [];
  private flushing: Promise<void> | null = null;

  static async open() {
    const s = new BlobStore();
    await s.load(false);
    return s;
  }

  /** Increases with every save; a read that returns an older copy (cache lag) is ignored. */
  private version = 0;

  private setData(text: string) {
    let parsed: any = {};
    try {
      parsed = JSON.parse(text) || {};
    } catch {
      parsed = {};
    }
    this.version = Number(parsed.__v) || 0;
    delete parsed.__v;
    this.data = parsed;
    COLLECTIONS.forEach(c => (this.data[c] ||= {}));
    const max = Math.max(0, ...Object.values(this.data).flatMap(c => Object.values(c).map(d => d._ts || 0)));
    if (max > counter) counter = max;
  }

  /** Reads the stored copy; true when it replaced this instance's copy. */
  private async load(useEtag: boolean) {
    const r = await readText(DB_PATH, useEtag && this.etag ? this.etag : undefined);
    this.checkedAt = Date.now();
    if (!r) {
      if (!this.version) this.setData('{}');
      return false;
    }
    if (r.unchanged) return false;
    const v = Number((/"__v":(\d+)/.exec(r.text) || [])[1]) || 0;
    if (v < this.version) return false; // stale copy from a cache
    this.etag = r.etag;
    this.setData(r.text);
    return true;
  }

  /** Picks up what other instances wrote (a cheap 304 when nothing changed). */
  private async refresh(force = false) {
    if (!force && (this.pending.length || Date.now() - this.checkedAt < FRESH_MS)) return;
    await this.load(!force);
  }

  private async write(op: Op) {
    apply(this.data, op);
    this.pending.push(op);
    // Wait for any write in progress, then send everything queued meanwhile in one request
    while (this.pending.length) {
      if (this.flushing) {
        await this.flushing;
        continue;
      }
      this.flushing = this.flush().finally(() => (this.flushing = null));
      await this.flushing;
    }
  }

  private async save(base: Data, conditional: boolean) {
    const { put } = await sdk();
    const version = this.version + 1;
    const res = await put(DB_PATH, JSON.stringify({ __v: version, ...base }), {
      access: 'private',
      addRandomSuffix: false,
      contentType: 'application/json',
      ...(conditional && this.etag ? { ifMatch: this.etag } : { allowOverwrite: true }),
      ...creds()
    });
    this.etag = res.etag || '';
    this.version = version;
    this.checkedAt = Date.now();
    this.data = base;
    // Ops queued while this request was in flight are applied on top again
    for (const op of this.pending) apply(this.data, op);
  }

  /**
   * Saves with an ETag check so concurrent instances keep each other's changes; on a conflict it re-reads
   * the stored copy and replays this instance's changes. If the check keeps failing (e.g. a lagging read),
   * it saves the merged copy anyway rather than refusing the write.
   */
  private async flush() {
    const ops = this.pending.splice(0);
    let base = this.data;
    let lastError: unknown;
    for (let attempt = 0; attempt < 7; attempt++) {
      try {
        await this.save(base, attempt < 6);
        return;
      } catch (e) {
        lastError = e;
        console.warn(`• Blob DB save attempt ${attempt + 1} failed:`, (e as Error)?.message || e);
        // Start from the latest stored copy and replay this instance's changes
        await new Promise(r => setTimeout(r, 80 + Math.random() * 220 * (attempt + 1)));
        try {
          await this.load(false);
        } catch (re) {
          console.warn('• Blob DB re-read failed:', (re as Error)?.message || re);
        }
        base = this.data;
        for (const op of ops) apply(base, op);
      }
    }
    this.pending.unshift(...ops);
    throw lastError instanceof Error ? lastError : new Error('تعذّر حفظ البيانات، أعد المحاولة');
  }

  async getAll(c: CollectionName) {
    await this.refresh();
    return Object.values(this.data[c] || {}).sort((a, b) => (a._ts || 0) - (b._ts || 0));
  }
  async get(c: CollectionName, id: string) {
    await this.refresh();
    return this.data[c]?.[id];
  }
  async upsertMany(c: CollectionName, docs: Doc[]) {
    if (!docs.length) return;
    await this.refresh();
    const col = this.data[c] || {};
    const stamped = docs.map(d => ({ ...d, _ts: col[d.id]?._ts || d._ts || nextTs() }));
    await this.write({ kind: 'upsert', c, docs: stamped });
  }
  async deleteMany(c: CollectionName, ids: string[]) {
    if (!ids.length) return;
    await this.write({ kind: 'delete', c, ids });
  }
  async replaceAll(c: CollectionName, docs: Doc[]) {
    await this.write({ kind: 'replace', c, docs: docs.map(d => ({ ...d, _ts: d._ts || nextTs() })) });
  }
  async isEmpty() {
    await this.refresh();
    return Object.keys(this.data.users || {}).length === 0;
  }
}
