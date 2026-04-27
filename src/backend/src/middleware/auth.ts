import type { Request, Response, NextFunction } from 'express';

/**
 * Azure AD token validation middleware.
 * For now, this is a pass-through — the user is assumed to be authenticated.
 * In production, validate the Bearer token against Azure AD.
 */
export function requireAuth(_req: Request, _res: Response, next: NextFunction) {
  // TODO: Validate Azure AD JWT token from Authorization header
  next();
}
