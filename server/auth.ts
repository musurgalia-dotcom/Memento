import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { db, getUserPreferences, type DbUserRow } from './db.ts';

const SESSION_COOKIE = 'memento_session';
const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 14; // 14 days

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  bio: string;
  createdAt: string;
  preferences: ReturnType<typeof getUserPreferences>;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function createPersistedSession(userId: string): string {
  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_MAX_AGE_SEC * 1000).toISOString();

  db.prepare('DELETE FROM sessions WHERE user_id = ? AND expires_at < ?').run(userId, now.toISOString());
  db.prepare(
    'INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
  ).run(crypto.randomUUID(), userId, tokenHash, expiresAt, now.toISOString());

  return rawToken;
}

export function revokeSession(req: Request) {
  const token = extractTokenFromRequest(req);
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashSessionToken(token));
}

function isHttpsRequest(req: Request): boolean {
  const proto = String(req.headers['x-forwarded-proto'] || '');
  const origin = String(req.headers.origin || '');
  const referer = String(req.headers.referer || '');
  return (
    req.secure ||
    proto.includes('https') ||
    origin.startsWith('https://') ||
    referer.startsWith('https://')
  );
}

export function setSessionCookie(req: Request, res: Response, token: string) {
  if (isHttpsRequest(req)) {
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${SESSION_MAX_AGE_SEC}; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  } else {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SEC * 1000,
    });
  }
}

export function clearSessionCookie(req: Request, res: Response) {
  if (isHttpsRequest(req)) {
    res.setHeader(
      'Set-Cookie',
      `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=None; Partitioned`
    );
  } else {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }
}

export function extractTokenFromRequest(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const val = authHeader.slice(7).trim();
    if (val) return val;
  }
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';');
  for (const part of parts) {
    const [k, ...rest] = part.trim().split('=');
    if (k === SESSION_COOKIE) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return null;
}

export async function getSessionUser(req: Request): Promise<AuthenticatedUser | null> {
  const token = extractTokenFromRequest(req);
  if (!token) return null;

  try {
    const tokenHash = hashSessionToken(token);
    const sessionRow = db
      .prepare('SELECT user_id, expires_at FROM sessions WHERE token_hash = ?')
      .get(tokenHash) as { user_id: string; expires_at: string } | undefined;

    if (!sessionRow) return null;
    if (new Date(sessionRow.expires_at).getTime() < Date.now()) {
      db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
      return null;
    }

    const row = db
      .prepare('SELECT id, email, name, bio, created_at FROM users WHERE id = ?')
      .get(sessionRow.user_id) as Pick<DbUserRow, 'id' | 'email' | 'name' | 'bio' | 'created_at'> | undefined;

    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      bio: row.bio || '',
      createdAt: row.created_at,
      preferences: getUserPreferences(row.id),
    };
  } catch {
    return null;
  }
}

export function verifyCsrfOrigin(req: Request): boolean {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return true;
  const hasCustomHeader = req.headers['x-requested-with'] === 'memento-client';
  const origin = req.headers.origin;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  let originMatchesHost = false;
  if (origin && host) {
    try {
      originMatchesHost = new URL(origin).host === host;
    } catch {
      originMatchesHost = false;
    }
  }
  return hasCustomHeader || originMatchesHost;
}

export async function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!verifyCsrfOrigin(req)) {
    res.status(403).json({ error: 'Invalid request origin.' });
    return;
  }

  const user = await getSessionUser(req);
  if (!user) {
    res.status(401).json({ error: 'Your session is not signed in. Please sign in or switch to Demo Mode.' });
    return;
  }
  req.user = user;
  next();
}

export function createResetToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

export function hashResetToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
