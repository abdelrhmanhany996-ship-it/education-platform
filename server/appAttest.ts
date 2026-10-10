/**
 * Proof that a request really comes from the protected Android / desktop app, not from a browser that
 * merely copied the app's user agent.
 *
 * Each app build carries a random signing key. The build job registers that key here with a GitHub
 * Actions OIDC token (signed by GitHub, so only this repository's apps workflow on main can register).
 * The app signs `<time>.<userId>` with the key through a native bridge the web page cannot reach in a
 * browser; the page sends the result in the `X-App-Proof` header.
 */
import crypto from 'node:crypto';
import type { Request } from 'express';
import type { Doc, Store } from './store';

const GITHUB_ISSUER = 'https://token.actions.githubusercontent.com';
export const APP_KEY_AUDIENCE = 'academic-platform-apps';
const PLATFORMS = ['android', 'windows', 'mac'] as const;
type Platform = (typeof PLATFORMS)[number];
const KEYS_PER_PLATFORM = 4; // older installed versions keep working for a few releases
const PROOF_MAX_AGE_MS = 5 * 60_000;

const repository = () =>
  process.env.APPS_REPOSITORY ||
  (process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG
    ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}`
    : 'abdelrhmanhany996-ship-it/education-platform');

const b64url = (s: string) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

let jwks: { at: number; keys: any[] } | null = null;
async function githubKey(kid: string) {
  if (!jwks || Date.now() - jwks.at > 3600_000 || !jwks.keys.some(k => k.kid === kid)) {
    const r = await fetch(`${GITHUB_ISSUER}/.well-known/jwks`, { signal: AbortSignal.timeout(10_000) });
    if (!r.ok) throw new Error(`GitHub JWKS ${r.status}`);
    jwks = { at: Date.now(), keys: ((await r.json()) as any).keys || [] };
  }
  const jwk = jwks.keys.find(k => k.kid === kid);
  return jwk ? crypto.createPublicKey({ key: jwk, format: 'jwk' }) : null;
}

/** Verifies a GitHub Actions OIDC token from this repository's apps workflow on main. */
export async function verifyWorkflowToken(token: string): Promise<boolean> {
  const [h, p, sig] = token.split('.');
  if (!h || !p || !sig) return false;
  let header: any, claims: any;
  try {
    header = JSON.parse(b64url(h).toString());
    claims = JSON.parse(b64url(p).toString());
  } catch {
    return false;
  }
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') return false;
  const key = await githubKey(header.kid);
  if (!key || !crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), key, b64url(sig))) return false;
  const now = Date.now() / 1000;
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  return (
    claims.iss === GITHUB_ISSUER &&
    aud.includes(APP_KEY_AUDIENCE) &&
    claims.exp > now &&
    claims.nbf <= now + 60 &&
    claims.repository === repository() &&
    claims.ref === 'refs/heads/main' &&
    String(claims.workflow_ref || '').startsWith(`${repository()}/.github/workflows/apps.yml@`)
  );
}

export async function registerAppKey(store: Store, platform: string, key: string) {
  if (!PLATFORMS.includes(platform as Platform)) throw new Error('unknown platform');
  if (!/^[0-9a-f]{64}$/.test(key)) throw new Error('bad key');
  const rec = (await store.get('appKeys', platform)) || { id: platform, keys: [] };
  const keys: { k: string; at: number }[] = (rec.keys || []).filter((x: any) => x.k !== key);
  keys.unshift({ k: key, at: Date.now() });
  await store.upsertMany('appKeys', [{ id: platform, keys: keys.slice(0, KEYS_PER_PLATFORM) }]);
  cache = null;
}

let cache: { at: number; keys: string[] } | null = null;
async function allKeys(store: Store) {
  if (!cache || Date.now() - cache.at > 60_000) {
    const docs: Doc[] = await store.getAll('appKeys');
    // APP_SIGN_KEYS: extra keys (comma separated) for apps built outside the CI workflow
    const extra = (process.env.APP_SIGN_KEYS || '').split(',').map(k => k.trim()).filter(k => /^[0-9a-f]{64}$/.test(k));
    cache = { at: Date.now(), keys: [...extra, ...docs.flatMap(d => (d.keys || []).map((x: any) => String(x.k)))] };
  }
  return cache.keys;
}

/**
 * True when the request carries a valid app signature for this user. Until the first app build has
 * registered a key, the app's user-agent marker is accepted so existing installs keep working.
 */
export async function verifyAppProof(store: Store, req: Request, userId: string): Promise<boolean> {
  const keys = await allKeys(store);
  const ua = /AcademicPlatformApp\//.test(String(req.headers['user-agent'] || ''));
  if (!keys.length) return ua;
  const [ts, sig] = String(req.headers['x-app-proof'] || '').split('.');
  const t = Number(ts);
  if (!ua || !sig || !Number.isFinite(t) || Math.abs(Date.now() - t) > PROOF_MAX_AGE_MS) return false;
  const msg = `${ts}.${userId}`;
  return keys.some(k => {
    const want = crypto.createHmac('sha256', Buffer.from(k, 'hex')).update(msg).digest('hex');
    return want.length === sig.length && crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig));
  });
}
