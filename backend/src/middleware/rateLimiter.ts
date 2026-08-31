import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for public read-only endpoints.
 * Allows up to 100 requests per minute per IP.
 * Applied to: GET /api/incidents/:id, GET /api/incidents/:id/verify-evidence
 */
export const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many requests. Please slow down.',
      statusCode: 429
    }
  }
});

/**
 * Rate limiter for write endpoints (anchoring).
 * Allows up to 30 requests per minute per IP.
 * Applied to: POST /api/incidents/anchor
 */
export const anchorLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many anchoring requests. Please slow down.',
      statusCode: 429
    }
  }
});

/**
 * Rate limiter for privileged enforcement operations.
 * Allows up to 15 requests per minute per IP.
 * Applied to: POST /api/incidents/:id/enforce|settle|release
 */
export const enforcementLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      message: 'Too many enforcement requests. Please slow down.',
      statusCode: 429
    }
  }
});
