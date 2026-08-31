import { Router } from 'express';
import { incidentController } from '../controllers/incident.controller.js';
import { validateBody, validateParams } from '../middleware/validateRequest.js';
import { authenticate, requireRole, UserRole } from '../middleware/auth.js';
import { forensicAnchorSchema, incidentIdParamSchema } from '../services/validation.service.js';
import { publicReadLimiter, anchorLimiter, enforcementLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// SEC-HIGH-01: POST /anchor is now protected by EVIDENCE_ATTESTOR authentication.
// Previously open, this endpoint triggers Pinata IPFS uploads and blockchain gas expenditure —
// any unauthenticated caller could exhaust gas and fill the on-chain ledger with spam.
router.post(
  '/anchor',
  anchorLimiter,                                                        // SEC-MED-02: Rate limit
  authenticate,                                                          // SEC-HIGH-01: Authentication
  requireRole(UserRole.EVIDENCE_ATTESTOR, UserRole.ADMIN),              // SEC-HIGH-01: Authorization
  validateBody(forensicAnchorSchema),
  incidentController.anchorIncident.bind(incidentController)
);

// List all incidents (Public Dashboard)
router.get(
  '/',
  publicReadLimiter,
  incidentController.listIncidents.bind(incidentController)
);

// Get specific incident details (Public Dashboard)
router.get(
  '/:id',
  publicReadLimiter,
  validateParams(incidentIdParamSchema),
  incidentController.getIncident.bind(incidentController)
);

// Verify incident cryptographic evidence chain of custody (Public Auditor)
router.get(
  '/:id/verify-evidence',
  publicReadLimiter,
  validateParams(incidentIdParamSchema),
  incidentController.verifyIncident.bind(incidentController)
);

// Backward-compatible POST alias for verify (also rate limited)
router.post(
  '/:id/verify',
  publicReadLimiter,
  validateParams(incidentIdParamSchema),
  incidentController.verifyIncident.bind(incidentController)
);

// Privileged Enforcement Authority Endpoints (Role + Rate Limited)
router.post(
  '/:id/enforce',
  enforcementLimiter,
  authenticate,
  requireRole(UserRole.ENFORCEMENT_AUTHORITY, UserRole.ADMIN),
  validateParams(incidentIdParamSchema),
  incidentController.enforceFine.bind(incidentController)
);

router.post(
  '/:id/settle',
  enforcementLimiter,
  authenticate,
  requireRole(UserRole.ENFORCEMENT_AUTHORITY, UserRole.ADMIN),
  validateParams(incidentIdParamSchema),
  incidentController.settleFine.bind(incidentController)
);

router.post(
  '/:id/release',
  enforcementLimiter,
  authenticate,
  requireRole(UserRole.ENFORCEMENT_AUTHORITY, UserRole.ADMIN),
  validateParams(incidentIdParamSchema),
  incidentController.releasePortClearance.bind(incidentController)
);

// Backward-compatible alias
router.post(
  '/:id/release-clearance',
  enforcementLimiter,
  authenticate,
  requireRole(UserRole.ENFORCEMENT_AUTHORITY, UserRole.ADMIN),
  validateParams(incidentIdParamSchema),
  incidentController.releasePortClearance.bind(incidentController)
);

export default router;
