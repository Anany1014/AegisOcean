import { Request, Response, NextFunction } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config/env.js';
import { AppError } from './errorHandler.js';

export enum UserRole {
  ADMIN = 'ADMIN',
  ENFORCEMENT_AUTHORITY = 'ENFORCEMENT_AUTHORITY',
  EVIDENCE_ATTESTOR = 'EVIDENCE_ATTESTOR',
  PUBLIC_VIEWER = 'PUBLIC_VIEWER'
}

export interface AuthContext {
  role: UserRole;
  clientId: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Constant-time string comparison using crypto.timingSafeEqual.
 * Prevents timing side-channel attacks when comparing API keys.
 */
function safeCompare(received: string, expected: string): boolean {
  if (!received || !expected) return false;
  // Pad to the same length using a constant-length buffer comparison
  // to avoid length-based timing leaks
  const a = Buffer.allocUnsafe(64).fill(0);
  const b = Buffer.allocUnsafe(64).fill(0);
  a.write(received.slice(0, 64));
  b.write(expected.slice(0, 64));
  return timingSafeEqual(a, b) && received.length === expected.length;
}

/**
 * Middleware that authenticates incoming requests using API keys or Bearer tokens.
 * Uses constant-time comparison to prevent timing-based side-channel attacks.
 */
export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  let token = apiKeyHeader;
  if (!token && authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
    } else {
      token = authHeader.trim();
    }
  }

  if (!token) {
    return next(new AppError('Authentication required. Missing x-api-key or Authorization header', 401));
  }

  if (safeCompare(token, config.ADMIN_API_KEY)) {
    req.auth = { role: UserRole.ADMIN, clientId: 'admin-service' };
    return next();
  }

  if (safeCompare(token, config.ENFORCEMENT_API_KEY)) {
    req.auth = { role: UserRole.ENFORCEMENT_AUTHORITY, clientId: 'port-enforcement-authority' };
    return next();
  }

  if (safeCompare(token, config.ATTESTOR_API_KEY)) {
    req.auth = { role: UserRole.EVIDENCE_ATTESTOR, clientId: 'ai-forensics-pipeline' };
    return next();
  }

  return next(new AppError('Invalid authentication credentials or unrecognized API key', 401));
}

/**
 * Middleware that restricts access to specific authorized roles
 */
export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new AppError('Authentication required', 401));
    }

    // ADMIN always has permission
    if (req.auth.role === UserRole.ADMIN || allowedRoles.includes(req.auth.role)) {
      return next();
    }

    return next(
      new AppError(
        `Forbidden: Caller lacks required permission for this operation`,
        403
      )
    );
  };
}
