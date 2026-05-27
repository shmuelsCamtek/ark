import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

const COOKIE_NAME = 'ark_sid';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

declare module 'express-serve-static-core' {
  interface Request {
    sessionId: string;
  }
}

function readCookie(header: string | undefined, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return undefined;
}

// Identify each browser with an `ark_sid` cookie so auth state can be stored
// per session instead of globally. secure:false is deliberate — the VM serves
// plain HTTP on the Camtek VPN, so a Secure cookie would never be sent.
export function sessionMiddleware(req: Request, res: Response, next: NextFunction): void {
  let sid = readCookie(req.headers.cookie, COOKIE_NAME);
  if (!sid) {
    sid = crypto.randomUUID();
    res.cookie(COOKIE_NAME, sid, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: false,
      maxAge: MAX_AGE_MS,
    });
  }
  req.sessionId = sid;
  next();
}
