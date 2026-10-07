/**
 * Background lecture-video uploads.
 *
 * Uploads live outside React components, so the doctor can keep using the app (or close the lecture panel)
 * while a large video uploads and Cloudflare encodes it. Progress is shown in the upload tray.
 *
 *   pending → uploading → processing (Cloudflare encoding) → ready
 *                       ↘ failed / canceled
 */
import { useSyncExternalStore } from 'react';
import { ApiError, uploadFile, videoApi, VideoConfig } from '../api';
import type { Lecture } from '../types';
import { UploadCanceled, forgetUpload, tusUpload } from '../utils/tusUpload';
import { deleteFile } from '../utils/fileStore';

export type UploadPhase = 'pending' | 'uploading' | 'processing' | 'ready' | 'failed' | 'canceled';

export interface UploadJob {
  lectureId: string;
  lectureTitle: string;
  fileName: string;
  size: number;
  sentBytes: number;
  /** 0–100 for the current phase. */
  progress: number;
  /** Bytes per second, smoothed. */
  speed: number;
  phase: UploadPhase;
  provider: 'cloudflare' | 'internal';
  error?: string;
  /** True when choosing the same file again continues where it stopped. */
  resumable?: boolean;
}

export type LecturePatch = Partial<
  Pick<Lecture, 'videoUid' | 'videoStatus' | 'videoDuration' | 'videoThumbnail' | 'videoUpdatedAt' | 'videoFileId'>
>;

interface StartOptions {
  lectureId: string;
  courseId: string;
  lectureTitle: string;
  file: File;
  /** Writes the result into the lecture (saved to Firestore by the normal sync). */
  apply: (patch: LecturePatch) => void;
  previous?: { videoUid?: string; videoFileId?: string };
}

const VIDEO_EXT = /\.(mp4|m4v|mov|webm|mkv|avi|mpe?g|3gp)$/i;
const ACTIVE: UploadPhase[] = ['pending', 'uploading', 'processing'];

/* --------------------------------- store --------------------------------- */

const jobs = new Map<string, UploadJob>();
const controllers = new Map<string, AbortController>();
const listeners = new Set<() => void>();
let snapshot: UploadJob[] = [];

const emit = () => {
  snapshot = [...jobs.values()];
  listeners.forEach(l => l());
  syncUnloadGuard();
};
const patchJob = (id: string, p: Partial<UploadJob>) => {
  const j = jobs.get(id);
  if (!j) return;
  jobs.set(id, { ...j, ...p });
  emit();
};

export function useVideoUploads(): UploadJob[] {
  return useSyncExternalStore(
    l => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => snapshot
  );
}

export const isUploadActive = (lectureId: string) => {
  const j = jobs.get(lectureId);
  return !!j && ACTIVE.includes(j.phase);
};

export function dismissUpload(lectureId: string) {
  if (isUploadActive(lectureId)) return;
  jobs.delete(lectureId);
  emit();
}

export function cancelUpload(lectureId: string) {
  controllers.get(lectureId)?.abort();
}

/* ------------------------- leaving the page mid-upload ------------------------ */

const unloadGuard = (e: BeforeUnloadEvent) => {
  e.preventDefault();
  e.returnValue = '';
};
let guarded = false;
function syncUnloadGuard() {
  const uploading = [...jobs.values()].some(j => j.phase === 'uploading' || j.phase === 'pending');
  if (uploading && !guarded) window.addEventListener('beforeunload', unloadGuard);
  if (!uploading && guarded) window.removeEventListener('beforeunload', unloadGuard);
  guarded = uploading;
}

/* --------------------------------- helpers -------------------------------- */

let configCache: Promise<VideoConfig> | null = null;
export const videoConfig = () => {
  configCache ||= videoApi.config().catch(e => {
    configCache = null;
    throw e;
  });
  return configCache;
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(t);
      reject(new UploadCanceled());
    }, { once: true });
  });

const friendly = (e: unknown) => {
  if (e instanceof ApiError && e.status === 0) return 'تعذر الاتصال بالخادم. تحقق من الإنترنت ثم أعد المحاولة.';
  return e instanceof Error && e.message ? e.message : 'تعذر رفع الفيديو';
};

const formatSize = (bytes: number) => (bytes >= 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`);

/* --------------------------- processing (Cloudflare) -------------------------- */

const watching = new Set<string>();

/**
 * Polls Cloudflare until the video is encoded, then marks the lecture ready.
 * Also used after a page reload for lectures that were still processing.
 */
export async function watchProcessing(lectureId: string, uid: string, apply: (p: LecturePatch) => void, signal?: AbortSignal) {
  if (watching.has(uid)) return;
  watching.add(uid);
  const ctrl = new AbortController();
  signal?.addEventListener('abort', () => ctrl.abort());
  const started = Date.now();
  let delay = 4_000;
  try {
    while (Date.now() - started < 6 * 3600 * 1000) {
      let s;
      try {
        s = await videoApi.status(uid);
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          apply({ videoStatus: 'failed' });
          patchJob(lectureId, { phase: 'failed', error: 'الفيديو لم يعد موجوداً على Cloudflare' });
          return;
        }
        s = null; // temporary: keep polling
      }
      if (s?.status === 'ready') {
        apply({ videoStatus: 'ready', videoDuration: Math.round(s.duration), videoThumbnail: s.thumbnail, videoUpdatedAt: new Date().toISOString() });
        patchJob(lectureId, { phase: 'ready', progress: 100 });
        return;
      }
      if (s?.status === 'failed') {
        apply({ videoStatus: 'failed', videoUpdatedAt: new Date().toISOString() });
        patchJob(lectureId, { phase: 'failed', error: `فشلت معالجة الفيديو على Cloudflare${s.errorReason ? ` (${s.errorReason})` : ''}. جرّب رفعه بصيغة MP4.` });
        return;
      }
      if (s?.pctComplete) patchJob(lectureId, { progress: Math.round(s.pctComplete) });
      await sleep(delay, ctrl.signal);
      delay = Math.min(delay * 1.5, 30_000);
    }
  } catch (e) {
    if (!(e instanceof UploadCanceled)) throw e;
  } finally {
    watching.delete(uid);
  }
}

/* ---------------------------------- upload --------------------------------- */

export async function startVideoUpload(o: StartOptions): Promise<void> {
  if (isUploadActive(o.lectureId)) throw new Error('يوجد رفع جارٍ بالفعل لهذه المحاضرة');
  const { file } = o;
  if (!file.type.startsWith('video/') && !VIDEO_EXT.test(file.name)) throw new Error('الملف يجب أن يكون فيديو (MP4, MOV, WebM, MKV)');

  const ctrl = new AbortController();
  controllers.set(o.lectureId, ctrl);
  jobs.set(o.lectureId, {
    lectureId: o.lectureId,
    lectureTitle: o.lectureTitle,
    fileName: file.name,
    size: file.size,
    sentBytes: 0,
    progress: 0,
    speed: 0,
    phase: 'pending',
    provider: 'cloudflare'
  });
  emit();

  let createdUid: string | undefined;
  const fingerprint = `${o.lectureId}|${file.name}|${file.size}|${file.lastModified}`;

  // Smoothed speed for the "x MB/s, y min left" hint
  let lastAt = Date.now();
  let lastSent = 0;
  let speed = 0;
  let lastEmit = 0;
  const onProgress = (sent: number, total: number) => {
    const now = Date.now();
    if (now - lastAt >= 1000) {
      const inst = ((sent - lastSent) * 1000) / (now - lastAt);
      speed = speed ? speed * 0.7 + inst * 0.3 : inst;
      lastAt = now;
      lastSent = sent;
    }
    // At most ~5 renders a second, however fast the bytes go
    if (now - lastEmit > 200 || sent === total) {
      lastEmit = now;
      patchJob(o.lectureId, { sentBytes: sent, progress: total ? Math.floor((sent / total) * 100) : 0, speed: Math.max(0, speed) });
    }
  };

  try {
    const cfg = await videoConfig();
    if (cfg.available === false) throw new Error(cfg.reason || 'رفع الفيديو غير متاح على هذا الخادم');
    if (file.size > cfg.maxBytes) throw new Error(`حجم الفيديو (${formatSize(file.size)}) أكبر من المسموح (${formatSize(cfg.maxBytes)})`);
    patchJob(o.lectureId, { phase: 'uploading', provider: cfg.provider });

    if (cfg.provider === 'cloudflare') {
      const uid = await tusUpload({
        file,
        fingerprint,
        signal: ctrl.signal,
        create: () => videoApi.createUpload({ courseId: o.courseId, size: file.size, name: file.name }),
        onCreated: id => (createdUid = id),
        onProgress
      });
      o.apply({ videoUid: uid, videoStatus: 'processing', videoFileId: undefined, videoDuration: undefined, videoThumbnail: undefined, videoUpdatedAt: new Date().toISOString() });
      createdUid = undefined; // now owned by the lecture
      patchJob(o.lectureId, { phase: 'processing', progress: 0, speed: 0 });
      cleanupPrevious(o.previous, uid);
      await watchProcessing(o.lectureId, uid, o.apply, ctrl.signal);
      if (ctrl.signal.aborted) patchJob(o.lectureId, { phase: 'canceled', error: 'توقفت متابعة المعالجة. ستكتمل على Cloudflare وتظهر عند فتح المحاضرة.' });
    } else {
      const id = `vid_${crypto.randomUUID().slice(0, 12)}`;
      await uploadFile(id, file, pct => patchJob(o.lectureId, { progress: pct, sentBytes: Math.round((pct / 100) * file.size) }), ctrl.signal);
      o.apply({ videoFileId: id, videoUid: undefined, videoStatus: 'ready', videoUpdatedAt: new Date().toISOString() });
      patchJob(o.lectureId, { phase: 'ready', progress: 100 });
      cleanupPrevious(o.previous, id);
    }
  } catch (e) {
    const canceled = e instanceof UploadCanceled || ctrl.signal.aborted;
    if (canceled) {
      forgetUpload(fingerprint);
      // Nothing points at the half-uploaded video: remove it from Cloudflare right away
      if (createdUid) videoApi.remove(createdUid).catch(() => undefined);
      patchJob(o.lectureId, { phase: 'canceled', error: undefined });
    } else {
      patchJob(o.lectureId, { phase: 'failed', error: friendly(e), resumable: !!createdUid });
    }
  } finally {
    controllers.delete(o.lectureId);
    syncUnloadGuard();
  }
}

/** The replaced video is deleted once the lecture no longer points at it (the server defers otherwise). */
function cleanupPrevious(prev: StartOptions['previous'], current: string) {
  if (!prev) return;
  // Give the lecture change a moment to reach the server first
  window.setTimeout(() => {
    if (prev.videoUid && prev.videoUid !== current) videoApi.remove(prev.videoUid).catch(() => undefined);
    if (prev.videoFileId && prev.videoFileId !== current) deleteFile(prev.videoFileId).catch(() => undefined);
  }, 20_000);
}
