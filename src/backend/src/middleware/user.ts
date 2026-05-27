import type { Request, Response, NextFunction } from 'express';
import { getProfile } from '../services/auth.ts';
import { normalizeOwner } from '../services/draftStore.ts';

declare module 'express-serve-static-core' {
  interface Request {
    userEmail: string;
  }
}

// Resolve the signed-in user for this session and expose their normalized email
// as req.userEmail. Used to scope per-user resources (drafts, chats, mockups).
export function requireUser(req: Request, res: Response, next: NextFunction): void {
  const profile = getProfile(req.sessionId);
  if (!profile?.email) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  req.userEmail = normalizeOwner(profile.email);
  next();
}
