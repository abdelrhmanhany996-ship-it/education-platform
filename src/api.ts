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
  init: { method?: string; body?: unknown; raw?: BodyInit; auth?: boolean; okStatuses?: number[] } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token && init.auth !== false) headers.Authorization = `Bearer ${token}`;
  if (init.body !== undefined) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(path, {
      method: init.method || (init.body !== undefined || init.raw ? 'POST' : 'GET'),
      headers,
      body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined)
    });
  } catch {
    throw new ApiError(0, 'تعذّر الاتصال بالخادم. تأكد أنه يعمل (npm run dev).');
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
    request<{ ok: boolean; log: TgLog; error?: string }>('/api/telegram/send', { body: data, okStatuses: [502] })
};

/* ------------------------------ PDF files ------------------------------ */

export async function uploadFile(id: string, blob: Blob) {
  await request(`/api/files/${id}`, { method: 'PUT', raw: blob });
}

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
