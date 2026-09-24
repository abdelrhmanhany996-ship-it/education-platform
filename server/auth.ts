import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from './config';

/* ------------------------------ passwords ------------------------------ */

/** scrypt with a per-user salt, stored as "salt:hash". */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored?: string): boolean {
  if (!stored) return false;
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return check.length === expected.length && crypto.timingSafeEqual(check, expected);
}

/* -------------------------------- tokens -------------------------------- */

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export interface TokenPayload {
  sub: string;
  role: 'doctor' | 'student' | 'assistant';
  exp: number;
}

export function signToken(sub: string, role: TokenPayload['role']): string {
  const payload: TokenPayload = { sub, role, exp: Date.now() + config.tokenHours * 3600 * 1000 };
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token?: string): TokenPayload | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as TokenPayload;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

/** One-purpose signed link, e.g. the "قبول الطلب" button in the doctor's email — works without a login session. */
export function signActionToken(action: string, id: string, hours = 24 * 14): string {
  const payload = { action, id, exp: Date.now() + hours * 3600 * 1000 };
  const body = b64(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyActionToken(action: string, token?: string): string | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', config.authSecret).update(body).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    return payload.action === action && payload.exp > Date.now() ? payload.id : null;
  } catch {
    return null;
  }
}

/* ------------------------------ middleware ------------------------------ */

declare module 'express-serve-static-core' {
  interface Request {
    auth?: TokenPayload;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : (req.query.token as string | undefined);
  const payload = verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'انتهت الجلسة، سجّل الدخول من جديد' });
  req.auth = payload;
  next();
}

export function requireDoctor(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'doctor') return res.status(403).json({ error: 'هذه العملية للدكتور فقط' });
  next();
}

export function requireDoctorOrAssistant(req: Request, res: Response, next: NextFunction) {
  if (req.auth?.role !== 'doctor' && req.auth?.role !== 'assistant') {
    return res.status(403).json({ error: 'هذه العملية للدكتور أو المساعد فقط' });
  }
  next();
}

/* Tiny in-memory login throttle: 8 failures per 10 minutes per IP + username. */
const failures = new Map<string, { n: number; first: number }>();
export function loginAllowed(key: string): boolean {
  const f = failures.get(key);
  if (!f) return true;
  if (Date.now() - f.first > 10 * 60 * 1000) {
    failures.delete(key);
    return true;
  }
  return f.n < 8;
}
export function loginFailed(key: string) {
  const f = failures.get(key);
  if (!f || Date.now() - f.first > 10 * 60 * 1000) failures.set(key, { n: 1, first: Date.now() });
  else f.n++;
}
export function loginSucceeded(key: string) {
  failures.delete(key);
}
