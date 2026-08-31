import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { incidentService } from '../src/services/incident.service.js';
import { config } from '../src/config/env.js';

describe('Authorized Enforcement Workflows & APIs', () => {
  const app = createApp();
  const ENFORCEMENT_KEY = config.ENFORCEMENT_API_KEY;
  const ATTESTOR_KEY = config.ATTESTOR_API_KEY;

  const sampleIncidentPayload = {
    incidentId: 'INC-ENFORCE-001',
    sourceSatellite: 'Sentinel-1A SAR',
    sceneId: 'S1A_SCENE_ENFORCE',
    detectionTimestamp: 1788200000,
    spillAreaSqKm: 20.0,
    originTimeWindow: { start: 1788190000, end: 1788195000 },
    originCoordinates: { latitude: 18.9, longitude: 72.8 },
    driftModelVersion: 'OpenDrift-v2.1',
    suspectMMSI: 412345678,
    attributionScore: 94.0,
    files: [{ name: 'slick.geojson', contentBase64: Buffer.from('{}').toString('base64') }]
  };

  beforeEach(async () => {
    incidentService.clear();
    // Anchor incident into initial ANCHORED state using EVIDENCE_ATTESTOR role
    await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send(sampleIncidentPayload);
  });

  // 1. Unauthorized Request (Missing / Invalid Token / Wrong Role)
  it('POST /api/incidents/:id/enforce - should reject unauthenticated request with 401', async () => {
    const res = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Authentication required');
  });

  it('POST /api/incidents/:id/enforce - should reject unauthorized role with 403', async () => {
    // Calling with ATTESTOR key instead of ENFORCEMENT key
    const res = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce')
      .set('x-api-key', ATTESTOR_KEY);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Forbidden');
  });

  // 2. Nonexistent Incident
  it('POST /api/incidents/:id/enforce - should return 404 for nonexistent incident', async () => {
    const res = await request(app)
      .post('/api/incidents/INC-NONEXISTENT-999/enforce')
      .set('x-api-key', ENFORCEMENT_KEY);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('not found');
  });

  // 3. Successful Enforcement (ANCHORED -> ENFORCED)
  it('POST /api/incidents/:id/enforce - should successfully enforce fine and revoke port clearance', async () => {
    const res = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce')
      .set('x-api-key', ENFORCEMENT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ENFORCED');
    expect(res.body.data.clearanceStatus).toBe('REVOKED');
    expect(res.body.data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(res.body.data.fineAmount).toBe(11000); // 1000 + 20 * 500
  });

  // 4. Invalid State Transition: Double Enforcement
  it('POST /api/incidents/:id/enforce - should reject double enforcement with 409 Conflict', async () => {
    // First enforcement
    await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce')
      .set('x-api-key', ENFORCEMENT_KEY);

    // Second enforcement attempt
    const res2 = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce')
      .set('x-api-key', ENFORCEMENT_KEY);

    expect(res2.status).toBe(409);
    expect(res2.body.success).toBe(false);
    expect(res2.body.error.message).toContain('Invalid state transition');
  });

  // 5. Invalid State Transition: Settle Before Enforce
  it('POST /api/incidents/:id/settle - should reject settlement before enforcement with 409 Conflict', async () => {
    // Incident is in ANCHORED state
    const res = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/settle')
      .set('x-api-key', ENFORCEMENT_KEY);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Invalid state transition');
  });

  // 6. Successful Settlement (ENFORCED -> SETTLED)
  it('POST /api/incidents/:id/settle - should record settlement for enforced incident', async () => {
    // Enforce first
    await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce')
      .set('x-api-key', ENFORCEMENT_KEY);

    // Settle fine
    const res = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/settle')
      .set('x-api-key', ENFORCEMENT_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('SETTLED');
    expect(res.body.data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
  });

  // 7. Invalid State Transition: Release Before Settlement
  it('POST /api/incidents/:id/release - should reject port release before settlement with 409 Conflict', async () => {
    // Enforce first (status is ENFORCED, not SETTLED)
    await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce')
      .set('x-api-key', ENFORCEMENT_KEY);

    const res = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/release')
      .set('x-api-key', ENFORCEMENT_KEY);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('Cannot release port clearance before fine is settled');
  });

  // 8. Successful Complete Lifecycle: ANCHORED -> ENFORCED -> SETTLED -> RELEASED
  it('POST /api/incidents/:id/release - should successfully release port clearance after settlement', async () => {
    // 1. Enforce
    await request(app)
      .post('/api/incidents/INC-ENFORCE-001/enforce')
      .set('Authorization', `Bearer ${ENFORCEMENT_KEY}`);

    // 2. Settle
    await request(app)
      .post('/api/incidents/INC-ENFORCE-001/settle')
      .set('Authorization', `Bearer ${ENFORCEMENT_KEY}`);

    // 3. Release Port Clearance
    const res = await request(app)
      .post('/api/incidents/INC-ENFORCE-001/release')
      .set('Authorization', `Bearer ${ENFORCEMENT_KEY}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('RELEASED');
    expect(res.body.data.clearanceStatus).toBe('RELEASED');
    expect(res.body.data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);

    // Verify GET reflects final state
    const getRes = await request(app).get('/api/incidents/INC-ENFORCE-001');
    expect(getRes.body.data.status).toBe('RELEASED');
  });
});
