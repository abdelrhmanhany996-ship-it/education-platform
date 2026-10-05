/**
 * Cloudflare Stream: storage, encoding, adaptive (HLS/DASH) delivery and CDN for lecture videos.
 *
 *  - Uploads go straight from the doctor's browser to Cloudflare over TUS (resumable). This server only
 *    asks Cloudflare for a one-time upload URL; the video bytes never pass through it.
 *  - Every video is created with `requireSignedURLs`, so its UID alone plays nothing. Students get a
 *    short-lived signed token (no MP4 download rights) after the enrollment check in server/files.ts.
 *  - The API token and signing key never leave the server.
 */
import crypto from 'node:crypto';
import { cloudflareStreamConfigured, config } from './config';
import { HttpError } from './access';

const cf = config.cloudflareStream;

export const UID_RE = /^[a-f0-9]{32}$/;
export const assertUid = (raw: string) => {
  if (!UID_RE.test(raw)) throw new HttpError(400, 'معرّف فيديو غير صالح');
  return raw;
};

export const streamEnabled = cloudflareStreamConfigured;

/** Where viewers fetch manifests/segments. Each customer has its own subdomain. */
export const deliveryBase = () =>
  cf.deliveryBase || (cf.customerCode ? `https://customer-${cf.customerCode}.cloudflarestream.com` : 'https://videodelivery.net');

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Calls the Stream API with a timeout; retries rate limits and Cloudflare-side errors a couple of times. */
async function api(path: string, init: RequestInit & { raw?: boolean } = {}, attempts = 3): Promise<Response> {
  const url = `${cf.apiBase}/accounts/${cf.accountId}/stream${path}`;
  for (let i = 1; ; i++) {
    let res: Response | undefined;
    try {
      res = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${cf.apiToken}`, ...(init.headers as Record<string, string>) },
        signal: AbortSignal.timeout(20_000)
      });
    } catch (e) {
      if (i >= attempts) throw new HttpError(502, 'تعذر الاتصال بخدمة الفيديو (Cloudflare)، حاول بعد قليل');
    }
    if (res && res.status !== 429 && res.status < 500) return res;
    if (i >= attempts) {
      if (res) console.warn('• Cloudflare Stream error', res.status, await res.text().catch(() => ''));
      throw new HttpError(502, 'خدمة الفيديو غير متاحة مؤقتاً، حاول بعد قليل');
    }
    await sleep(500 * 2 ** i);
  }
}

async function json<T = any>(res: Response): Promise<T> {
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok || body?.success === false) {
    const msg = body?.errors?.[0]?.message || `HTTP ${res.status}`;
    console.warn('• Cloudflare Stream API:', msg);
    throw new HttpError(res.status === 404 ? 404 : 502, res.status === 404 ? 'الفيديو غير موجود على Cloudflare' : 'رفضت خدمة الفيديو الطلب');
  }
  return body.result as T;
}

const b64 = (s: string) => Buffer.from(s).toString('base64');

/**
 * Reserves a video and returns its one-time TUS upload URL (direct creator upload).
 * The browser then PATCHes the file there in chunks and can resume after a drop.
 */
export async function createDirectUpload(opts: { size: number; name: string; creator: string }) {
  const meta = [
    `name ${b64(opts.name.slice(0, 200))}`,
    'requiresignedurls',
    // Reserves encoding minutes; 6 h covers any lecture
    `maxdurationseconds ${b64(String(6 * 3600))}`
  ];
  if (cf.allowedOrigins) meta.push(`allowedorigins ${b64(cf.allowedOrigins)}`);
  const res = await api('?direct_user=true', {
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0',
      'Upload-Length': String(opts.size),
      'Upload-Metadata': meta.join(','),
      'Upload-Creator': opts.creator
    }
  });
  const uploadUrl = res.headers.get('location');
  const uid = res.headers.get('stream-media-id');
  if (res.status !== 201 || !uploadUrl || !uid) {
    console.warn('• Cloudflare Stream: direct upload not created', res.status, await res.text().catch(() => ''));
    throw new HttpError(502, 'تعذر تجهيز رفع الفيديو على Cloudflare');
  }
  return { uid: assertUid(uid), uploadUrl };
}

export type VideoStatus = 'uploading' | 'processing' | 'ready' | 'failed';

export interface VideoInfo {
  uid: string;
  status: VideoStatus;
  duration: number;
  thumbnail: string;
  errorReason?: string;
  requireSignedURLs: boolean;
  pctComplete?: number;
}

const mapState = (state?: string, ready?: boolean): VideoStatus => {
  if (ready || state === 'ready') return 'ready';
  if (state === 'error') return 'failed';
  if (state === 'pendingupload' || !state) return 'uploading';
  return 'processing'; // downloading | queued | inprogress
};

export async function getVideo(uid: string): Promise<VideoInfo> {
  const v = await json(await api(`/${assertUid(uid)}`));
  return {
    uid,
    status: mapState(v?.status?.state, v?.readyToStream),
    duration: Math.max(0, Number(v?.duration) || 0),
    thumbnail: v?.thumbnail || `${deliveryBase()}/${uid}/thumbnails/thumbnail.jpg`,
    errorReason: v?.status?.errorReasonText || v?.status?.errorReasonCode || undefined,
    requireSignedURLs: !!v?.requireSignedURLs,
    pctComplete: Number(v?.status?.pctComplete) || undefined
  };
}

export async function deleteVideo(uid: string) {
  const res = await api(`/${assertUid(uid)}`, { method: 'DELETE' });
  if (!res.ok && res.status !== 404) await json(res);
}

/** Makes sure the video cannot be played with its bare UID (in case it was created another way). */
export async function ensureSigned(uid: string) {
  await json(await api(`/${assertUid(uid)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ uid, requireSignedURLs: true }) }));
}

/* ---------------------------------- tokens --------------------------------- */

let signingKey: crypto.KeyObject | null | undefined;
function localKey() {
  if (signingKey !== undefined) return signingKey;
  signingKey = null;
  if (cf.signingKeyId && cf.signingKeyPem) {
    try {
      // Cloudflare returns the PEM base64-encoded; accept it either way
      const pem = cf.signingKeyPem.includes('BEGIN') ? cf.signingKeyPem.replace(/\\n/g, '\n') : Buffer.from(cf.signingKeyPem, 'base64').toString('utf8');
      signingKey = crypto.createPrivateKey(pem);
    } catch (e: any) {
      console.warn('⚠️ CLOUDFLARE_STREAM_SIGNING_KEY_PEM is not a valid key; using the token API instead.', e?.message);
    }
  }
  return signingKey;
}

const b64url = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');

/** Lifetime of one playback token: long enough for one sitting, renewed by the player when it runs out. */
export function tokenSeconds(durationSeconds: number) {
  if (cf.tokenMinutes > 0) return Math.round(cf.tokenMinutes * 60);
  return Math.min(4 * 3600, Math.max(30 * 60, Math.round(durationSeconds) + 15 * 60));
}

/**
 * Signed playback token for one video. Never grants MP4 downloads.
 * Minted locally with the signing key when configured (no API round trip), otherwise via the token endpoint.
 */
export async function playbackToken(uid: string, seconds: number): Promise<{ token: string; expiresAt: number }> {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + seconds;
  const key = localKey();
  if (key) {
    const head = b64url({ alg: 'RS256', kid: cf.signingKeyId });
    const body = b64url({ sub: uid, kid: cf.signingKeyId, exp, nbf: now - 60, downloadable: false });
    const sig = crypto.sign('RSA-SHA256', Buffer.from(`${head}.${body}`), key).toString('base64url');
    return { token: `${head}.${body}.${sig}`, expiresAt: exp * 1000 };
  }
  const r = await json<{ token: string }>(
    await api(`/${assertUid(uid)}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ exp, nbf: now - 60, downloadable: false })
    })
  );
  return { token: r.token, expiresAt: exp * 1000 };
}

export const manifestUrl = (token: string) => `${deliveryBase()}/${token}/manifest/video.m3u8`;
export const posterUrl = (token: string) => `${deliveryBase()}/${token}/thumbnails/thumbnail.jpg`;
