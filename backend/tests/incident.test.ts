import { describe, it, expect, beforeEach } from 'vitest';
import { IncidentService } from '../src/services/incident.service.js';
import { ForensicAnchorPayload, IncidentStatus } from '../src/types/incident.types.js';

describe('Incident Service', () => {
  let incidentService: IncidentService;

  const mockPayload: ForensicAnchorPayload = {
    incidentId: 'INC-2026-TEST-001',
    sourceSatellite: 'Sentinel-1A SAR',
    sceneId: 'S1A_TEST_SCENE',
    detectionTimestamp: 1788200000,
    spillAreaSqKm: 12.0,
    originTimeWindow: { start: 1788190000, end: 1788195000 },
    originCoordinates: { latitude: 18.5, longitude: 72.8 },
    suspectMMSI: 412345678,
    attributionScore: 95.0,
    driftModelVersion: 'OpenDrift-v2.1',
    files: [{ name: 'report.json', contentBase64: Buffer.from('{}').toString('base64') }]
  };

  beforeEach(() => {
    incidentService = new IncidentService();
  });

  it('should anchor a forensic incident and calculate fine and digests', async () => {
    const result = await incidentService.anchorForensicIncident(mockPayload);

    expect(result.incidentId).toBe('INC-2026-TEST-001');
    expect(result.status).toBe('Anchored');
    expect(result.evidenceHash).toBeDefined();
    expect(result.ipfsCID).toBeDefined();
    expect(result.fineAmount).toBeGreaterThan(0);

    const record = await incidentService.getIncident('INC-2026-TEST-001');
    expect(record.status).toBe(IncidentStatus.ANCHORED);
  });

  it('should support idempotent re-anchoring for identical payload and reject conflicting payload', async () => {
    const first = await incidentService.anchorForensicIncident(mockPayload);
    const retry = await incidentService.anchorForensicIncident(mockPayload);

    expect(retry.incidentId).toBe(first.incidentId);
    expect(retry.evidenceHash).toBe(first.evidenceHash);
    expect(retry.isIdempotent).toBe(true);

    // Conflicting payload
    const conflicting = { ...mockPayload, attributionScore: 50.0 };
    await expect(incidentService.anchorForensicIncident(conflicting)).rejects.toThrow();
  });

  it('should verify evidence hash chain of custody as MATCH', async () => {
    await incidentService.anchorForensicIncident(mockPayload);
    const verification = await incidentService.verifyIncident('INC-2026-TEST-001');

    expect(verification.verified).toBe(true);
    expect(verification.result).toBe('MATCH');
  });

  it('should transition status through enforcement and settlement', async () => {
    await incidentService.anchorForensicIncident(mockPayload);

    const enforced = await incidentService.enforceFine('INC-2026-TEST-001');
    expect(enforced.status).toBe(IncidentStatus.ENFORCED);

    const settled = await incidentService.settleFine('INC-2026-TEST-001');
    expect(settled.status).toBe(IncidentStatus.SETTLED);

    const released = await incidentService.releasePortClearance('INC-2026-TEST-001');
    expect(released.status).toBe(IncidentStatus.RELEASED);
  });
});
