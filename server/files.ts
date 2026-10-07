/**
 * Private lecture files (videos + PDFs).
 *
 *  - Storage: a private Firebase Cloud Storage bucket when Firestore is connected, local disk otherwise.
 *    Objects are never public; browsers only ever reach them through this server.
 *  - Access: every read is re-checked against the course that references the file (owner doctor,
 *    their assistants, or a student with an approved enrollment and a released lecture).
 *  - Videos: students get a short-lived playback grant bound to their account and browser
 *    (signed URL + httpOnly cookie), streamed with HTTP range requests. No permanent links.
 *  - Bookkeeping: each upload gets a `files` record; files no course references are swept after a grace period.
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { Readable } from 'node:stream';
import { config, DATA_DIR } from './config';
import type { Doc, Store } from './store';
import { HttpError, doctorScopeOf } from './access';
import { deleteVideo } from './cloudflare';

export interface StoredFile {
  size: number;
  contentType: string;
}

export interface ByteRange {
  start: number;
  end: number; // inclusive
}

export interface FileBackend {
  kind: 'local' | 'firebase';
  /** Moves a finished temp file into storage (the temp file is consumed). */
  saveFromPath(id: string, srcPath: string, contentType: string): Promise<void>;
  stat(id: string): Promise<StoredFile | null>;
  read(id: string, range?: ByteRange): Promise<Readable>;
  remove(id: string): Promise<void>;
}

export const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
export const TMP_DIR = path.join(DATA_DIR, 'chunks');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

export const FILE_ID_RE = /^[\w-]{6,80}$/;
export const assertFileId = (raw: string) => {
  if (!FILE_ID_RE.test(raw)) throw new HttpError(400, 'معرّف ملف غير صالح');
  return raw;
};

/* ------------------------------ content types ------------------------------ */

/** Identifies the formats lecture files may have from their first bytes. Anything else is refused. */
export function sniffContentType(head: Buffer): string | null {
  if (head.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  if (head.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = head.subarray(8, 12).toString('latin1');
    return brand.startsWith('qt') ? 'video/quicktime' : 'video/mp4';
  }
  if (head.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'video/webm';
  if (head.subarray(0, 4).toString('latin1') === 'RIFF' && head.subarray(8, 11).toString('latin1') === 'AVI') return 'video/x-msvideo';
  return null;
}

export function sniffFile(p: string): string | null {
  const fd = fs.openSync(p, 'r');
  try {
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    return sniffContentType(head);
  } finally {
    fs.closeSync(fd);
  }
}

export const isVideoType = (t?: string) => !!t && t.startsWith('video/');

/* --------------------------------- backends -------------------------------- */

class LocalBackend implements FileBackend {
  kind = 'local' as const;
  private p(id: string) {
    return path.join(UPLOADS_DIR, assertFileId(id));
  }
  async saveFromPath(id: string, src: string) {
    const dest = this.p(id);
    try {
      fs.renameSync(src, dest);
    } catch {
      fs.copyFileSync(src, dest);
      fs.rmSync(src, { force: true });
    }
  }
  async stat(id: string) {
    const p = this.p(id);
    if (!fs.existsSync(p)) return null;
    const st = fs.statSync(p);
    if (!st.isFile()) return null;
    return { size: st.size, contentType: sniffFile(p) || 'application/octet-stream' };
  }
  async read(id: string, range?: ByteRange) {
    return fs.createReadStream(this.p(id), range ? { start: range.start, end: range.end } : undefined);
  }
  async remove(id: string) {
    fs.rmSync(this.p(id), { force: true });
  }
}

export class FirebaseBackend implements FileBackend {
  kind = 'firebase' as const;
  /** Files uploaded before Cloud Storage was enabled stay readable from disk. */
  private legacy = new LocalBackend();
  constructor(private bucket: any) {}

  private obj(id: string) {
    return this.bucket.file(`private/lecture-files/${assertFileId(id)}`);
  }
  async saveFromPath(id: string, src: string, contentType: string) {
    try {
      await this.bucket.upload(src, {
        destination: `private/lecture-files/${assertFileId(id)}`,
        resumable: true,
        // No public ACL and no download token: only the server's credentials can read the object.
        metadata: { contentType, cacheControl: 'private, no-store', contentDisposition: 'inline' }
      });
    } finally {
      fs.rmSync(src, { force: true });
    }
  }
  async stat(id: string) {
    try {
      const [m] = await this.obj(id).getMetadata();
      return { size: Number(m.size), contentType: m.contentType || 'application/octet-stream' };
    } catch (e: any) {
      if (e?.code === 404) return this.legacy.stat(id);
      throw e;
    }
  }
  async read(id: string, range?: ByteRange) {
    const [exists] = await this.obj(id).exists();
    if (!exists) return this.legacy.read(id, range);
    // Checksums cannot be validated on partial reads
    return this.obj(id).createReadStream(range ? { start: range.start, end: range.end, validation: false } : {});
  }
  async remove(id: string) {
    await this.obj(id).delete({ ignoreNotFound: true });
    await this.legacy.remove(id);
  }

  /*
   * Upload chunks kept in the bucket instead of local disk. A serverless host (Vercel) may run each chunk
   * request on a different instance with its own /tmp, so local chunks could not be joined later.
   */
  private chunk(session: string, idx: number) {
    return this.bucket.file(`private/upload-chunks/${session}/chunk_${idx}.part`);
  }
  async putChunk(session: string, idx: number, srcPath: string) {
    await this.bucket.upload(srcPath, {
      destination: `private/upload-chunks/${session}/chunk_${idx}.part`,
      resumable: false,
      metadata: { contentType: 'application/octet-stream', cacheControl: 'private, no-store' }
    });
  }
  async missingChunk(session: string, total: number): Promise<number> {
    for (let i = 0; i < total; i++) {
      const [exists] = await this.chunk(session, i).exists();
      if (!exists) return i;
    }
    return -1;
  }
  chunkStream(session: string, idx: number): Readable {
    return this.chunk(session, idx).createReadStream();
  }
  async removeChunks(session: string) {
    await this.bucket.deleteFiles({ prefix: `private/upload-chunks/${session}/` }).catch(() => undefined);
  }
}

export async function createFileBackend(store: Store): Promise<FileBackend> {
  const bucketName = config.firebase.storageBucket;
  if (store.kind === 'firestore' && bucketName && bucketName !== 'off') {
    try {
      const { getApps } = await import('firebase-admin/app');
      const { getStorage } = await import('firebase-admin/storage');
      const bucket = getStorage(getApps()[0]).bucket(bucketName);
      const [exists] = await bucket.exists();
      if (!exists) throw new Error(`bucket ${bucketName} not found`);
      console.log(`• Files: private Cloud Storage bucket ${bucketName}`);
      return new FirebaseBackend(bucket);
    } catch (e: any) {
      console.warn(`⚠️ Cloud Storage unavailable (${e?.message || e}) -> keeping lecture files on local disk.`);
    }
  }
  console.log('• Files: local disk (server/data/uploads)');
  return new LocalBackend();
}

/* ------------------------------- access rules ------------------------------ */

export interface FileRef {
  course: Doc;
  lecture: Doc;
  kind: 'video' | 'pdf';
}

export interface LectureRef {
  course: Doc;
  lecture: Doc;
}

const lecturesOf = (course: Doc): Doc[] => (course.weeks || []).flatMap((w: Doc) => w.lectures || []);

export async function findLecture(store: Store, lectureId: string): Promise<LectureRef | null> {
  for (const course of await store.getAll('courses')) {
    const lecture = lecturesOf(course).find(l => l.id === lectureId);
    if (lecture) return { course, lecture };
  }
  return null;
}

/** Which lecture (if any) uses this file / Cloudflare video. The courses collection is the source of truth. */
export async function findFileRef(store: Store, fileId: string): Promise<FileRef | null> {
  for (const course of await store.getAll('courses')) {
    for (const lecture of lecturesOf(course)) {
      if (lecture.videoFileId === fileId || lecture.videoUid === fileId) return { course, lecture, kind: 'video' };
      if (lecture.explanationPdf?.fileId === fileId) return { course, lecture, kind: 'pdf' };
    }
  }
  return null;
}

export async function referencedFileIds(store: Store): Promise<Set<string>> {
  const ids = new Set<string>();
  for (const course of await store.getAll('courses'))
    for (const lecture of lecturesOf(course)) {
      if (lecture.videoFileId) ids.add(lecture.videoFileId);
      if (lecture.videoUid) ids.add(lecture.videoUid);
      if (lecture.explanationPdf?.fileId) ids.add(lecture.explanationPdf.fileId);
    }
  return ids;
}

const released = (lecture: Doc) => {
  const at = lecture.releaseAt ? Date.parse(lecture.releaseAt) : NaN;
  return Number.isNaN(at) || at <= Date.now();
};

/**
 * Lesson permission: the course's doctor and their assistants always; a student only with an approved
 * enrollment in that course and once the lecture is released. Students get the same 404 either way.
 */
export async function assertLectureAccess(store: Store, me: Doc, ref: LectureRef) {
  const doctorId = doctorScopeOf(me);
  if (doctorId) {
    if (ref.course.doctorId !== doctorId) throw new HttpError(403, 'هذا المحتوى ليس ضمن مقرراتك');
    return;
  }
  const hidden = new HttpError(404, 'هذا المحتوى غير متاح لحسابك');
  if (me.role !== 'student' || !released(ref.lecture)) throw hidden;
  const enrolled = (await store.getAll('enrollments')).some(
    e => e.studentId === me.id && e.courseId === ref.course.id && e.status === 'approved'
  );
  if (!enrolled) throw hidden;
}

/**
 * Throws unless `me` may read this file. Students always get the same 404 whether the file
 * does not exist or is not theirs, so IDs cannot be probed.
 */
export async function authorizeFileRead(store: Store, me: Doc, fileId: string): Promise<FileRef | null> {
  const ref = await findFileRef(store, fileId);
  if (ref) {
    await assertLectureAccess(store, me, ref);
    return ref;
  }
  // Just uploaded and not saved into a lecture yet: only the uploading doctor's team may see it.
  const doctorId = doctorScopeOf(me);
  const rec = doctorId ? await store.get('files', fileId) : undefined;
  if (rec && rec.ownerDoctorId === doctorId) return null;
  throw new HttpError(404, doctorId ? 'الملف غير موجود' : 'هذا المحتوى غير متاح لحسابك');
}

/** Only the owning doctor may write/delete a file id. */
export async function authorizeFileWrite(store: Store, me: Doc, fileId: string) {
  const doctorId = doctorScopeOf(me);
  if (!doctorId) throw new HttpError(403, 'غير مسموح');
  const rec = await store.get('files', fileId);
  if (rec && rec.ownerDoctorId !== doctorId) throw new HttpError(403, 'هذا الملف ليس ملكك');
  if (!rec) {
    const ref = await findFileRef(store, fileId);
    if (ref && ref.course.doctorId !== doctorId) throw new HttpError(403, 'هذا الملف ليس ملكك');
  }
  return doctorId;
}

/* ------------------------------ playback grants ----------------------------- */

// Separate keys so a grant can never be replayed as a login token (and vice versa).
const grantKey = crypto.createHmac('sha256', config.authSecret).update('video-grant/v1').digest();
const bindKey = crypto.createHmac('sha256', config.authSecret).update('video-bind/v1').digest();
const mac = (key: Buffer, s: string) => crypto.createHmac('sha256', key).update(s).digest('base64url');
const safeEq = (a: string, b: string) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

export interface Grant {
  fid: string;
  sub: string;
  exp: number;
}

export function signGrant(fid: string, sub: string, minutes = config.video.grantMinutes) {
  const g: Grant = { fid, sub, exp: Date.now() + minutes * 60_000 };
  const body = Buffer.from(JSON.stringify(g)).toString('base64url');
  return { token: `${body}.${mac(grantKey, body)}`, expiresAt: g.exp };
}

export function verifyGrant(token: string): Grant | null {
  const [body, sig] = token.split('.');
  if (!body || !sig || !safeEq(sig, mac(grantKey, body))) return null;
  try {
    const g = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Grant;
    return typeof g.fid === 'string' && typeof g.sub === 'string' && g.exp > Date.now() ? g : null;
  } catch {
    return null;
  }
}

/** Cookie value that ties a grant to the browser of the account it was issued to. */
export const bindingFor = (sub: string) => mac(bindKey, sub);
export const BIND_COOKIE = 'lms_vb';

export function readCookie(header: string | undefined, name: string): string | undefined {
  for (const part of (header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return undefined;
}

/* ----------------------------------- ranges --------------------------------- */

/** Largest slice served per request; players fetch the next range as they go. */
export const MAX_RANGE_BYTES = 8 * 1024 * 1024;

/** Parses a single `bytes=` range. Returns null when unsatisfiable. */
export function parseRange(header: string | undefined, size: number): ByteRange | null {
  if (size <= 0) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec((header || 'bytes=0-').trim());
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start: number;
  let end: number;
  if (m[1] === '') {
    const suffix = Number(m[2]);
    if (!suffix) return null;
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || end < start) return null;
  return { start, end: Math.min(end, start + MAX_RANGE_BYTES - 1) };
}

/* ------------------------------ upload sessions ----------------------------- */

/** Chunks of one upload live in a folder named after the uploader + upload id, so sessions never collide. */
export function chunkSessionDir(sub: string, uploadId: string) {
  if (!/^up_[\w-]{6,80}$/.test(uploadId)) throw new HttpError(400, 'معرّف رفع غير صالح');
  const name = crypto.createHash('sha256').update(`${sub}:${uploadId}`).digest('hex').slice(0, 40);
  return path.join(TMP_DIR, name);
}

/* --------------------------------- cleanup ---------------------------------- */

const DAY = 24 * 3600 * 1000;

/**
 * Removes (1) abandoned chunk folders and (2) uploaded files that no lecture references any more
 * (failed saves, replaced or deleted lectures) once they are older than a grace period.
 * A file still referenced by a course is never touched.
 */
export async function sweepFiles(store: Store, files: FileBackend, graceMs = DAY) {
  const now = Date.now();
  for (const name of fs.readdirSync(TMP_DIR)) {
    const p = path.join(TMP_DIR, name);
    try {
      if (now - fs.statSync(p).mtimeMs > graceMs) fs.rmSync(p, { recursive: true, force: true });
    } catch {
      /* already gone */
    }
  }

  const refs = await referencedFileIds(store);
  const updates: Doc[] = [];
  const removed: string[] = [];
  for (const rec of await store.getAll('files')) {
    if (refs.has(rec.id)) {
      if (rec.status !== 'attached' || now - (rec.lastSeenAt || 0) > DAY / 2)
        updates.push({ ...rec, status: 'attached', lastSeenAt: now });
      continue;
    }
    const lastUsed = Math.max(rec.createdAt || 0, rec.lastSeenAt || 0);
    if (now - lastUsed < graceMs) continue;
    try {
      if (rec.provider === 'cloudflare') await deleteVideo(rec.id);
      else await files.remove(rec.id);
      removed.push(rec.id);
    } catch (e) {
      console.warn('• File sweep: could not remove', rec.id, e);
    }
  }
  if (updates.length) await store.upsertMany('files', updates);
  if (removed.length) {
    await store.deleteMany('files', removed);
    console.log(`• File sweep: removed ${removed.length} unused upload(s)`);
  }
}
