import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(message: string, statusCode = 500, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized operation') {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Resource conflict or duplicate') {
    super(message, 409);
  }
}

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void => {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;
  const message = isAppError ? err.message : 'Internal Server Error';
  const details = isAppError ? err.details : undefined;

  // Log stack traces server-side for all environments, but never expose them to clients
  logger.error(`[${req.method}] ${req.originalUrl} - ${message}`, {
    statusCode,
    details,
    stack: err.stack  // Stack only written to server logs, never to response body
  });

  // SEC-LOW-04: Stack traces are NEVER sent in response bodies regardless of NODE_ENV.
  // Debugging info must be read from server logs only.
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      statusCode,
      ...(details ? { details } : {})
    }
  });
};
