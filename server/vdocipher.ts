/**
 * VdoCipher: DRM-encrypted video (Widevine / FairPlay). Screen recorders and screenshots capture a black
 * frame on most browsers and phones, and the viewer's name/ID is drawn into the player by VdoCipher itself.
 *
 * Enabled by VDOCIPHER_API_SECRET (VdoCipher dashboard → Config → API keys). Takes priority over
 * Cloudflare Stream and over storing videos on this server.
 */

const API = () => (process.env.VDOCIPHER_API_BASE || 'https://dev.vdocipher.com/api').replace(/\/$/, '');
const PLAYER = () => (process.env.VDOCIPHER_PLAYER_URL || 'https://player.vdocipher.com/v2/').replace(/\/?$/, '/');
const secret = () => (process.env.VDOCIPHER_API_SECRET || '').trim();

export const vdocipherEnabled = () => !!secret();

/** VdoCipher allows large files; the platform caps uploads at 10 GB. */
export const VDO_MAX_BYTES = 10 * 1024 ** 3;

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API()}${path}`, {
    method,
    headers: {
      Authorization: `Apisecret ${secret()}`,
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20_000)
  });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    /* not JSON */
  }
  if (!res.ok) {
    const err: any = new Error(`VdoCipher ${res.status}: ${data?.message || text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export interface VdoUpload {
  videoId: string;
  /** The browser posts the file straight to this storage URL with these form fields. */
  uploadUrl: string;
  fields: Record<string, string>;
}

/** A new video slot plus a one-time upload form; the video never passes through this server. */
export async function createVdoUpload(title: string): Promise<VdoUpload> {
  const r = await call<{ videoId: string; clientPayload: Record<string, string> }>(
    'PUT',
    `/videos?title=${encodeURIComponent(title.slice(0, 200))}`
  );
  const { uploadLink, ...rest } = r.clientPayload || ({} as Record<string, string>);
  if (!r.videoId || !uploadLink) throw new Error('VdoCipher did not return an upload link');
  return {
    videoId: r.videoId,
    uploadUrl: uploadLink,
    fields: { ...rest, success_action_status: '201', success_action_redirect: '' }
  };
}

export type VdoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export async function getVdoVideo(id: string): Promise<{ status: VdoStatus; duration: number; thumbnail: string }> {
  const v = await call<{ status?: string; length?: number; poster?: string }>('GET', `/videos/${encodeURIComponent(id)}`);
  const s = String(v.status || '').toLowerCase();
  const status: VdoStatus = s === 'ready' ? 'ready' : /fail|error/.test(s) ? 'failed' : /pre-?upload/.test(s) ? 'uploading' : 'processing';
  return { status, duration: Number(v.length) || 0, thumbnail: String(v.poster || '') };
}

export async function deleteVdoVideo(id: string) {
  await call('DELETE', `/videos?videos=${encodeURIComponent(id)}`);
}

/**
 * A short-lived playback ticket for one viewer. The watermark is rendered by VdoCipher inside the protected
 * player: the moving name/ID and a faint fixed line with the phone number.
 */
export async function vdoPlayback(id: string, viewer: { name?: string; academicId?: string; phone?: string }) {
  const who = [viewer.name, viewer.academicId].filter(Boolean).join(' • ') || 'student';
  const annotate = [
    { type: 'rtext', text: who, alpha: '0.65', color: '0xFFFFFF', size: '16', interval: '5000' },
    ...(viewer.phone ? [{ type: 'text', text: viewer.phone, alpha: '0.30', x: '10', y: '10', color: '0xFFFFFF', size: '12' }] : [])
  ];
  const ttl = 300;
  const r = await call<{ otp: string; playbackInfo: string }>('POST', `/videos/${encodeURIComponent(id)}/otp`, {
    ttl,
    annotate: JSON.stringify(annotate)
  });
  return {
    playerUrl: `${PLAYER()}?otp=${encodeURIComponent(r.otp)}&playbackInfo=${encodeURIComponent(r.playbackInfo)}`,
    expiresAt: Date.now() + ttl * 1000
  };
}
