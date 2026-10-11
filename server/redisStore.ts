import crypto from 'node:crypto';
import { COLLECTIONS, CollectionName, Doc, Store } from './store';

/**
 * Upstash Redis (Vercel Storage → Upstash, free tier) over its REST API. Used on Vercel when its variables
 * are present; much cheaper than keeping the whole database as one Blob file, which every instance re-reads
 * and every change rewrites.
 *
 * Layout: one hash per collection (`lms:c:<name>`, field = doc id, value = JSON) plus a version counter per
 * collection (`lms:v:<name>`). Each instance caches collections and re-reads one only when its counter moved;
 * checking all counters is a single MGET, at most every CHECK_MS.
 */

const PREFIX = 'lms:';
const CHECK_MS = Number(process.env.STORE_CHECK_MS || 3_000);
const MAX_BATCH_BYTES = 512 * 1024;

const url = () => (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const token = () => process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '';
export const redisConfigured = () => !!(url() && token());

type Cmd = (string | number)[];

async function call(path: string, body: unknown): Promise<any> {
  const res = await fetch(`${url()}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000)
  });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Redis ${res.status}: ${data?.error || res.statusText}`);
  return data;
}

async function cmd(c: Cmd) {
  const r = await call('', c);
  if (r.error) throw new Error(`Redis: ${r.error}`);
  return r.result;
}
async function pipeline(cmds: Cmd[]) {
  if (!cmds.length) return [];
  const r: any[] = await call('/pipeline', cmds);
  return r.map(x => {
    if (x.error) throw new Error(`Redis: ${x.error}`);
    return x.result;
  });
}
/** Runs atomically (MULTI/EXEC), so the version counter always moves together with the data. */
async function transaction(cmds: Cmd[]) {
  const r: any[] = await call('/multi-exec', cmds);
  return r.map(x => {
    if (x.error) throw new Error(`Redis: ${x.error}`);
    return x.result;
  });
}

const hashKey = (c: CollectionName) => `${PREFIX}c:${c}`;
const verKey = (c: CollectionName) => `${PREFIX}v:${c}`;

/** Splits field/value pairs so a single request stays small. */
function hsetBatches(c: CollectionName, docs: Doc[]): Cmd[] {
  const out: Cmd[] = [];
  let cur: Cmd = ['HSET', hashKey(c)];
  let size = 0;
  for (const d of docs) {
    const json = JSON.stringify(d);
    if (cur.length > 2 && size + json.length > MAX_BATCH_BYTES) {
      out.push(cur);
      cur = ['HSET', hashKey(c)];
      size = 0;
    }
    cur.push(d.id, json);
    size += json.length;
  }
  if (cur.length > 2) out.push(cur);
  return out;
}

let counter = Date.now() * 1000;
const nextTs = () => ++counter;

/**
 * The same token-signing secret on every instance. The first time it takes over the existing secret (from
 * the Blob store), so nobody is signed out by the switch.
 */
export async function loadRedisAuthSecret(existing?: () => Promise<string | null>): Promise<string> {
  const key = `${PREFIX}auth-secret`;
  const have = await cmd(['GET', key]);
  if (have) return String(have);
  const seed = (existing && (await existing().catch(() => null))) || crypto.randomBytes(32).toString('hex');
  await cmd(['SET', key, seed, 'NX']);
  return String(await cmd(['GET', key]));
}

export class RedisStore implements Store {
  kind = 'file' as const;
  private cache = new Map<CollectionName, { ver: number; docs: Map<string, Doc> }>();
  private versions = new Map<CollectionName, number>();
  private checkedAt = 0;
  private checking: Promise<void> | null = null;

  /** Opens the store; the first time, copies the existing Blob database over so nothing is lost. */
  static async open(importFrom?: () => Promise<Store | null>) {
    const s = new RedisStore();
    const migrated = await cmd(['GET', `${PREFIX}migrated`]);
    if (!migrated && importFrom) {
      const old = await importFrom().catch(e => {
        console.warn('• Redis: could not read the old database:', e?.message || e);
        return null;
      });
      if (old && !(await old.isEmpty())) {
        for (const c of COLLECTIONS) {
          const docs = await old.getAll(c);
          if (docs.length) await s.replaceAll(c, docs);
        }
        console.log('• Redis: copied the existing database from Vercel Blob');
      }
      await cmd(['SET', `${PREFIX}migrated`, String(Date.now())]);
    } else if (!migrated) {
      await cmd(['SET', `${PREFIX}migrated`, String(Date.now())]);
    }
    return s;
  }

  /** Reads all version counters (one request) at most every CHECK_MS. */
  private async checkVersions() {
    if (Date.now() - this.checkedAt < CHECK_MS) return;
    this.checking ||= (async () => {
      const vals: (string | null)[] = await cmd(['MGET', ...COLLECTIONS.map(verKey)]);
      COLLECTIONS.forEach((c, i) => this.versions.set(c, Number(vals[i]) || 0));
      this.checkedAt = Date.now();
    })().finally(() => (this.checking = null));
    await this.checking;
  }

  private async collection(c: CollectionName) {
    await this.checkVersions();
    const want = this.versions.get(c) || 0;
    const hit = this.cache.get(c);
    if (hit && hit.ver >= want) return hit.docs;
    const [raw, ver] = await pipeline([['HGETALL', hashKey(c)], ['GET', verKey(c)]]);
    const docs = new Map<string, Doc>();
    // HGETALL over REST: a flat [field, value, field, value, …] list
    const list: string[] = Array.isArray(raw) ? raw : [];
    for (let i = 0; i + 1 < list.length; i += 2) {
      try {
        const d = JSON.parse(list[i + 1]);
        docs.set(list[i], d);
        if (d?._ts > counter) counter = d._ts;
      } catch {
        /* skip a broken entry */
      }
    }
    const v = Number(ver) || 0;
    this.cache.set(c, { ver: v, docs });
    this.versions.set(c, Math.max(v, this.versions.get(c) || 0));
    return docs;
  }

  /** After this instance's own write, its cache is current without re-reading. */
  private afterWrite(c: CollectionName, newVer: number, mutate: (docs: Map<string, Doc>) => void) {
    const hit = this.cache.get(c);
    if (hit && hit.ver === newVer - 1) {
      mutate(hit.docs);
      hit.ver = newVer;
    } else {
      this.cache.delete(c); // someone else wrote in between: re-read next time
    }
    this.versions.set(c, Math.max(newVer, this.versions.get(c) || 0));
  }

  async getAll(c: CollectionName) {
    const docs = await this.collection(c);
    return [...docs.values()].sort((a, b) => (a._ts || 0) - (b._ts || 0));
  }
  async get(c: CollectionName, id: string) {
    return (await this.collection(c)).get(id);
  }
  async upsertMany(c: CollectionName, docs: Doc[]) {
    if (!docs.length) return;
    const current = await this.collection(c);
    const stamped = docs.map(d => ({ ...d, _ts: current.get(d.id)?._ts || d._ts || nextTs() }));
    const res = await transaction([...hsetBatches(c, stamped), ['INCR', verKey(c)]]);
    this.afterWrite(c, Number(res[res.length - 1]), m => stamped.forEach(d => m.set(d.id, d)));
  }
  async deleteMany(c: CollectionName, ids: string[]) {
    if (!ids.length) return;
    const res = await transaction([['HDEL', hashKey(c), ...ids], ['INCR', verKey(c)]]);
    this.afterWrite(c, Number(res[res.length - 1]), m => ids.forEach(id => m.delete(id)));
  }
  async replaceAll(c: CollectionName, docs: Doc[]) {
    const stamped = docs.map(d => ({ ...d, _ts: d._ts || nextTs() }));
    const res = await transaction([['DEL', hashKey(c)], ...hsetBatches(c, stamped), ['INCR', verKey(c)]]);
    this.afterWrite(c, Number(res[res.length - 1]), m => {
      m.clear();
      stamped.forEach(d => m.set(d.id, d));
    });
  }
  async isEmpty() {
    return Number(await cmd(['HLEN', hashKey('users')])) === 0;
  }
}
