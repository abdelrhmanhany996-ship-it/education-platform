import type { User } from './types';

/** Thin client for the local server (server/index.ts). The login token is the only thing kept in the browser. */

const TOKEN_KEY = 'lms_token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};
export const setToken = (t: string) => localStorage.setItem(TOKEN_KEY, t);
export const clearToken = () => localStorage.removeItem(TOKEN_KEY);

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init: { method?: string; body?: unknown; raw?: BodyInit; auth?: boolean; okStatuses?: number[]; timeoutMs?: number } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token && init.auth !== false) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  const controller = init.timeoutMs ? new AbortController() : undefined;
  const timer = controller ? window.setTimeout(() => controller.abort(), init.timeoutMs) : undefined;
  try {
    res = await fetch(path, {
      method: init.method || (init.body !== undefined || init.raw ? 'POST' : 'GET'),
      headers,
      body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined),
      signal: controller?.signal
    });
  } catch {
    if (controller?.signal.aborted) throw new ApiError(408, 'انتهت مهلة الانتظار');
    throw new ApiError(0, 'تعذّر الاتصال بالخادم. تأكد أنه يعمل (npm run dev).');
  } finally {
    window.clearTimeout(timer);
  }

  if (res.status === 401 && init.auth !== false && token) {
    clearToken();
    window.dispatchEvent(new Event('lms:unauthorized'));
  }
  if (!res.ok && !init.okStatuses?.includes(res.status)) {
    const j = await res.json().catch(() => ({}));
    throw new ApiError(res.status, j.error || `خطأ ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export interface AiQuestion {
  prompt: string;
  type?: string;
  options?: string[];
  correctOptionIndex?: number;
  correctOptionIndexes?: number[];
  explanation?: string;
}

export interface Session {
  token: string;
  user: User;
}

export interface WaLog {
  id: string;
  studentId: string;
  studentName: string;
  phone: string;
  messageType: 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award' | 'enrollment_contact';
  messageText: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'opened' | 'simulated';
  waMessageId?: string;
  via?: 'text' | 'template';
  error?: string;
  auto?: boolean;
}

export interface TgLog {
  id: string;
  studentId: string;
  studentName: string;
  chatId: string;
  messageType: 'consecutive_absence' | 'performance_drop' | 'quiz_reminder' | 'certificate_award' | 'enrollment_contact';
  messageText: string;
  sentAt: string;
  status: 'sent' | 'failed';
  telegramMessageId?: number;
  error?: string;
  auto?: boolean;
}

export type SyncDoc = { id: string; [k: string]: any };

export interface CatalogCourse {
  courseId: string;
  title: string;
  code: string;
  department: string;
  description: string;
  doctorId: string;
  doctorName: string;
  price?: number;
}

export interface BootstrapData {
  me: User;
  users: User[];
  courses: SyncDoc[];
  groups: SyncDoc[];
  studentStates: SyncDoc[];
  certificates: SyncDoc[];
  activityLogs: SyncDoc[];
  whatsappLogs: SyncDoc[];
  telegramLogs: SyncDoc[];
  enrollments: SyncDoc[];
  chatMessages: SyncDoc[];
  settings: { id: string; value: any }[];
}

export interface SignupResult {
  pending: true;
  message: string;
  telegramLink?: string;
}

export const api = {
  health: () =>
    request<{
      ok: boolean;
      storage: 'firestore' | 'file';
      whatsapp: { configured: boolean; template: boolean };
      telegram: { configured: boolean };
      email: { configured: boolean };
      demoLogin: boolean;
    }>('/api/health', { auth: false }),
  catalog: () => request<CatalogCourse[]>('/api/catalog', { auth: false }),

  login: (username: string, password: string) =>
    request<Session>('/api/auth/login', { body: { username, password }, auth: false }),
  demoLogin: (username: string) => request<Session>('/api/auth/demo', { body: { username }, auth: false }),
  signup: (data: Record<string, unknown>) => request<SignupResult>('/api/auth/signup', { body: data, auth: false }),

  bootstrap: () => request<BootstrapData>('/api/bootstrap'),
  sync: (collection: string, upserts: SyncDoc[], deletes: string[]) =>
    request<{ ok: true }>('/api/sync', { body: { collection, upserts, deletes } }),

  createUser: (data: Record<string, unknown>) => request<{ user: User }>('/api/users', { body: data }),
  setPassword: (id: string, password: string) => request<{ ok: true }>(`/api/users/${id}/password`, { body: { password } }),
  reset: () => request<{ ok: true }>('/api/admin/reset', { method: 'POST', body: {} }),

  contactEnrollment: (id: string, note?: string) =>
    request<{ ok: true }>(`/api/enrollments/${id}/contact`, { body: { note } }),
  approveEnrollment: (id: string) => request<{ ok: true }>(`/api/enrollments/${id}/approve`, { method: 'POST', body: {} }),
  rejectEnrollment: (id: string) => request<{ ok: true }>(`/api/enrollments/${id}/reject`, { method: 'POST', body: {} }),

  whatsappStatus: () => request<{ configured: boolean; template: boolean }>('/api/whatsapp/status'),
  whatsappSend: (data: { studentId: string; type: string; message: string }) =>
    request<{ ok: boolean; log: WaLog; error?: string }>('/api/whatsapp/send', { body: data, okStatuses: [502] }),

  telegramStatus: () =>
    request<{ configured: boolean; bot: boolean; userConnected: boolean }>('/api/telegram/status'),
  telegramAccount: () => request<{ configured: boolean; connected: boolean; name?: string }>('/api/telegram/account'),
  telegramAccountCode: (phone: string) => request<{ ok: true }>('/api/telegram/account/code', { body: { phone } }),
  telegramAccountVerify: (code: string, password?: string) =>
    request<{ ok?: true; needsPassword?: true; connected?: boolean; name?: string }>('/api/telegram/account/verify', {
      body: { code, password }
    }),
  telegramAccountLogout: () => request<{ ok: true }>('/api/telegram/account/logout', { body: {} }),
  telegramLinkCode: () =>
    request<{ linked: boolean; deepLink?: string }>('/api/telegram/link-code', { method: 'POST', body: {} }),
  telegramSend: (data: { studentId: string; type: string; message: string }) =>
    request<{ ok: boolean; log: TgLog; error?: string }>('/api/telegram/send', { body: data, okStatuses: [502] }),

  /** Reads a PDF / image / text with Gemini and returns the questions it contains (MCQ, MSQ, T/F, essay). */
  parseQuestionsAI: (data: { text?: string; fileBase64?: string; mimeType?: string }) =>
    request<{ ai: boolean; questions?: AiQuestion[]; error?: string; message?: string }>('/api/ai/parse-questions', {
      body: { text: data.text, pdfBase64: data.fileBase64, pdfMimeType: data.mimeType },
      // The server gives up after ~70 s; never leave the upload spinner running forever
      timeoutMs: 90_000
    }),

  generateMcq: (data: { text?: string; numQuestions?: number; pdfBase64?: string; pdfMimeType?: string }) =>
    request<{ questions: Array<{ prompt: string; options: string[]; correctOptionIndex: number; explanation?: string }> }>(
      '/api/gemini/generate-mcq',
      { body: data }
    )
};

/* ------------------------------ Files & Chunked Upload ------------------------------ */

const sleep = (ms: number) => new Promise(r => window.setTimeout(r, ms));

/** Network errors, timeouts, a write still in progress (409), rate limits and server hiccups are worth another try; validation errors are not. */
const retryable = (e: unknown) =>
  e instanceof ApiError && (e.status === 0 || e.status === 408 || e.status === 409 || e.status === 429 || e.status >= 500);

/** Runs `fn` up to `attempts` times with exponential backoff (1s, 2s, 4s…), waiting for the connection to come back. */
async function withRetry<T>(fn: () => Promise<T>, attempts = 5, signal?: AbortSignal): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (signal?.aborted || i >= attempts || !retryable(e)) throw e;
      await sleep(Math.min(1000 * 2 ** (i - 1), 15_000));
      if (!navigator.onLine) {
        await new Promise(r => {
          window.addEventListener('online', r, { once: true });
          signal?.addEventListener('abort', r, { once: true });
        });
      }
      if (signal?.aborted) throw new ApiError(499, 'تم إلغاء الرفع');
    }
  }
}

/** fetch with a hard timeout, mapped onto ApiError like `request`. */
async function send(path: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel);
  let res: Response;
  try {
    res = await fetch(path, { ...init, signal: controller.signal });
  } catch {
    if (signal?.aborted) throw new ApiError(499, 'تم إلغاء الرفع');
    throw controller.signal.aborted ? new ApiError(408, 'انتهت مهلة الرفع، جارٍ إعادة المحاولة') : new ApiError(0, 'انقطع الاتصال أثناء الرفع');
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
  if (res.status === 401) {
    clearToken();
    window.dispatchEvent(new Event('lms:unauthorized'));
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new ApiError(res.status, err.error || `خطأ ${res.status}`);
  }
  return res.json();
}

/**
 * Uploads a lecture file. Large files go in 5 MB chunks; every chunk and the final assemble are
 * retried on network failures, so a flaky connection slows the upload down instead of failing it.
 */
export async function uploadFile(id: string, blob: Blob, onProgress?: (percent: number) => void, signal?: AbortSignal) {
  const CHUNK_SIZE = 5 * 1024 * 1024;
  const auth = (): Record<string, string> => {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  if (blob.size <= CHUNK_SIZE) {
    onProgress?.(20);
    await withRetry(() => send(`/api/files/${id}`, { method: 'PUT', headers: auth(), body: blob }, 120_000, signal), 5, signal);
    onProgress?.(100);
    return;
  }

  const totalChunks = Math.ceil(blob.size / CHUNK_SIZE);
  const uploadId = `up_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  for (let i = 0; i < totalChunks; i++) {
    const part = blob.slice(i * CHUNK_SIZE, Math.min(blob.size, (i + 1) * CHUNK_SIZE));
    await withRetry(() => {
      // A FormData body can only be sent once, so it is rebuilt for every attempt
      const form = new FormData();
      form.append('uploadId', uploadId);
      form.append('chunkIndex', String(i));
      form.append('totalChunks', String(totalChunks));
      form.append('chunk', part, `part_${i}`);
      return send('/api/upload/chunk', { method: 'POST', headers: auth(), body: form }, 120_000, signal);
    }, 5, signal);
    onProgress?.(Math.round(((i + 1) / totalChunks) * 90));
  }

  // Joining a large file on the server (and copying it to Cloud Storage) can take a while
  await withRetry(
    () =>
      send(
        '/api/upload/assemble',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...auth() },
          body: JSON.stringify({ uploadId, fileId: id, totalChunks })
        },
        10 * 60_000,
        signal
      ),
    3,
    signal
  );
  onProgress?.(100);
}

export type VideoAccess =
  | { provider: 'internal'; status: 'ready'; url: string; expiresAt: number }
  | { provider: 'cloudflare'; status: 'ready'; hlsUrl: string; poster: string; expiresAt: number }
  | { provider: 'cloudflare'; status: 'uploading' | 'processing' | 'failed'; retryAfterMs?: number };

export interface StreamVideoStatus {
  uid: string;
  status: 'uploading' | 'processing' | 'ready' | 'failed';
  duration: number;
  thumbnail: string;
  errorReason?: string;
  pctComplete?: number;
}

export const quizApi = {
  start: (lectureId: string) =>
    request<{ resumed: boolean }>(`/api/quiz/${encodeURIComponent(lectureId)}/start`, { method: 'POST', body: {}, timeoutMs: 20_000 }),
  submit: (lectureId: string, answers: unknown) =>
    request<{ score: number; totalPoints: number; essayPending: number; late: boolean }>(
      `/api/quiz/${encodeURIComponent(lectureId)}/submit`,
      { method: 'POST', body: { answers }, timeoutMs: 30_000 }
    )
};

export const videoApi = {
  /** After the lesson permission check: a short-lived playback link (signed Cloudflare HLS or an internal stream). */
  access: (lectureId: string) =>
    request<VideoAccess>(`/api/lectures/${encodeURIComponent(lectureId)}/video-access`, { method: 'POST', body: {}, timeoutMs: 20_000 }),
  config: () => request<{ provider: 'cloudflare' | 'internal'; maxBytes: number }>('/api/video/config', { timeoutMs: 15_000 }),
  /** One-time Cloudflare direct-upload (TUS) URL for a new video in `courseId`. */
  createUpload: (data: { courseId: string; size: number; name: string }) =>
    request<{ uid: string; uploadUrl: string }>('/api/stream-videos/uploads', { body: data, timeoutMs: 30_000 }),
  status: (uid: string) => request<StreamVideoStatus>(`/api/stream-videos/${uid}`, { timeoutMs: 20_000 }),
  remove: (uid: string) => request<{ ok: boolean; deferred?: boolean }>(`/api/stream-videos/${uid}`, { method: 'DELETE', timeoutMs: 20_000 })
};

export async function downloadFile(id: string): Promise<Blob | undefined> {
  const token = getToken();
  const res = await fetch(`/api/files/${id}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (res.status === 404) return undefined;
  if (!res.ok) throw new ApiError(res.status, 'تعذر تحميل الملف');
  return res.blob();
}

export async function removeFile(id: string) {
  await request(`/api/files/${id}`, { method: 'DELETE' });
}
