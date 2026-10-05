/**
 * Minimal resumable upload client (TUS 1.0) for Cloudflare Stream direct creator uploads.
 *
 *  - The file is sent straight to Cloudflare in 16 MB chunks; `Blob.slice` is lazy, so even multi-GB files
 *    are never read into memory and the page stays responsive.
 *  - Each chunk is retried with backoff (and waits for the connection to come back).
 *  - The upload URL is remembered per file, so choosing the same file again after a crash, a closed tab or
 *    a lost connection continues from the last byte Cloudflare confirmed.
 */

/** Cloudflare requires chunks in multiples of 256 KiB and at least 5 MiB (except the last one). */
const CHUNK = 64 * 256 * 1024; // 16 MiB
/** A chunk that makes no progress for this long is treated as a dropped connection. */
const STALL_MS = 60_000;
const MAX_ATTEMPTS = 8;
const KEY = 'lms_tus:';
/** Cloudflare discards unfinished direct uploads after a while; do not try to resume very old ones. */
const RESUME_WINDOW_MS = 20 * 3600 * 1000;

export class UploadCanceled extends Error {
  constructor() {
    super('تم إلغاء الرفع');
  }
}

class TusError extends Error {
  constructor(public status: number, message = '') {
    super(message || `TUS ${status}`);
  }
}

interface Saved {
  uid: string;
  uploadUrl: string;
  at: number;
}

const load = (fp: string): Saved | null => {
  try {
    const s = JSON.parse(localStorage.getItem(KEY + fp) || 'null');
    return s && Date.now() - s.at < RESUME_WINDOW_MS ? s : null;
  } catch {
    return null;
  }
};
const save = (fp: string, s: Saved) => {
  try {
    localStorage.setItem(KEY + fp, JSON.stringify(s));
  } catch {
    /* private mode: the upload still works, it just cannot be resumed after a reload */
  }
};
export const forgetUpload = (fp: string) => {
  try {
    localStorage.removeItem(KEY + fp);
  } catch {
    /* ignore */
  }
};

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = window.setTimeout(resolve, ms);
    signal.addEventListener('abort', () => {
      window.clearTimeout(t);
      reject(new UploadCanceled());
    }, { once: true });
  });

const waitOnline = (signal: AbortSignal) =>
  navigator.onLine
    ? Promise.resolve()
    : new Promise<void>((resolve, reject) => {
        window.addEventListener('online', () => resolve(), { once: true });
        signal.addEventListener('abort', () => reject(new UploadCanceled()), { once: true });
      });

function xhr(method: string, url: string, headers: Record<string, string>, body: Blob | null, signal: AbortSignal, onSent?: (loaded: number) => void) {
  return new Promise<XMLHttpRequest>((resolve, reject) => {
    if (signal.aborted) return reject(new UploadCanceled());
    const x = new XMLHttpRequest();
    x.open(method, url);
    for (const [k, v] of Object.entries(headers)) x.setRequestHeader(k, v);
    let last = Date.now();
    const watchdog = window.setInterval(() => {
      if (Date.now() - last > STALL_MS) x.abort();
    }, 5_000);
    const done = () => {
      window.clearInterval(watchdog);
      signal.removeEventListener('abort', cancel);
    };
    const cancel = () => x.abort();
    signal.addEventListener('abort', cancel);
    x.upload.onprogress = e => {
      last = Date.now();
      onSent?.(e.loaded);
    };
    x.onprogress = () => (last = Date.now());
    x.onload = () => {
      done();
      resolve(x);
    };
    x.onerror = () => {
      done();
      reject(new TusError(0, 'انقطع الاتصال أثناء الرفع'));
    };
    x.onabort = () => {
      done();
      reject(signal.aborted ? new UploadCanceled() : new TusError(0, 'توقف الرفع بسبب بطء الاتصال'));
    };
    x.send(body);
  });
}

const TUS = { 'Tus-Resumable': '1.0.0' };

/** Bytes Cloudflare already has. Throws TusError(404/410) when the upload no longer exists. */
async function serverOffset(url: string, signal: AbortSignal) {
  const x = await xhr('HEAD', url, TUS, null, signal);
  if (x.status === 404 || x.status === 410 || x.status === 403) throw new TusError(410, 'انتهت صلاحية جلسة الرفع');
  if (x.status < 200 || x.status >= 300) throw new TusError(x.status);
  const o = Number(x.getResponseHeader('Upload-Offset'));
  if (!Number.isFinite(o) || o < 0) throw new TusError(500, 'رد غير متوقع من خدمة الفيديو');
  return o;
}

export interface TusUploadOptions {
  file: Blob;
  /** Identifies "the same upload" across reloads, e.g. lecture + file name + size + lastModified. */
  fingerprint: string;
  /** Asks our server for a one-time Cloudflare upload URL. */
  create: () => Promise<{ uid: string; uploadUrl: string }>;
  onProgress: (sentBytes: number, totalBytes: number) => void;
  /** Called once the video has a UID (before any byte is sent), so a cancel can clean it up. */
  onCreated?: (uid: string) => void;
  signal: AbortSignal;
}

export async function tusUpload(o: TusUploadOptions): Promise<string> {
  const total = o.file.size;
  let session = load(o.fingerprint);
  let offset = 0;

  if (session) {
    try {
      await waitOnline(o.signal);
      offset = await serverOffset(session.uploadUrl, o.signal);
    } catch (e) {
      if (e instanceof UploadCanceled) throw e;
      // Expired or unknown: start a fresh upload (the old reservation is cleaned up by the server's sweep)
      forgetUpload(o.fingerprint);
      session = null;
      offset = 0;
    }
  }
  if (!session) {
    const created = await o.create();
    session = { ...created, at: Date.now() };
    save(o.fingerprint, session);
  }
  o.onCreated?.(session.uid);
  o.onProgress(offset, total);

  let failures = 0;
  while (offset < total) {
    const end = Math.min(total, offset + CHUNK);
    try {
      await waitOnline(o.signal);
      const x = await xhr(
        'PATCH',
        session.uploadUrl,
        { ...TUS, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' },
        o.file.slice(offset, end),
        o.signal,
        loaded => o.onProgress(offset + loaded, total)
      );
      if (x.status === 409 || x.status === 412) {
        offset = await serverOffset(session.uploadUrl, o.signal); // out of step: ask where to continue
        continue;
      }
      if (x.status === 404 || x.status === 410) throw new TusError(410, 'انتهت صلاحية جلسة الرفع، اختر الملف مرة أخرى لبدء رفع جديد');
      if (x.status < 200 || x.status >= 300) throw new TusError(x.status, `رفضت خدمة الفيديو الجزء المرفوع (${x.status})`);
      const confirmed = Number(x.getResponseHeader('Upload-Offset'));
      offset = Number.isFinite(confirmed) && confirmed > offset ? confirmed : end;
      failures = 0;
      o.onProgress(offset, total);
    } catch (e) {
      if (e instanceof UploadCanceled) throw e;
      const status = e instanceof TusError ? e.status : 0;
      const temporary = status === 0 || status === 408 || status === 429 || status >= 500;
      if (status === 410) forgetUpload(o.fingerprint);
      if (!temporary || ++failures >= MAX_ATTEMPTS) throw e;
      await sleep(Math.min(1000 * 2 ** (failures - 1), 30_000), o.signal);
      // Part of the chunk may have arrived before the drop
      try {
        offset = await serverOffset(session.uploadUrl, o.signal);
      } catch (err) {
        if (err instanceof UploadCanceled) throw err;
      }
    }
  }

  forgetUpload(o.fingerprint);
  return session.uid;
}
