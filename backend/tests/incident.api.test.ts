import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { incidentService, IncidentService } from '../src/services/incident.service.js';
import { IpfsService } from '../src/services/ipfs.service.js';
import { BlockchainService } from '../src/services/blockchain.service.js';
import { config } from '../src/config/env.js';

describe('AegisOcean Complete Incident Anchoring Workflow & API', () => {
  const app = createApp();
  const ATTESTOR_KEY = config.ATTESTOR_API_KEY;

  const validIncidentPayload = {
    incidentId: 'INC-20260831-777',
    sourceSatellite: 'Sentinel-1A SAR',
    sceneId: 'S1A_IW_GRDH_1SDV_20260831T181204',
    detectionTimestamp: 1788201124,
    spillAreaSqKm: 14.854321,
    originTimeWindow: {
      start: 1788190000,
      end: 1788198000
    },
    originCoordinates: {
      latitude: 18.9241567,
      longitude: 72.8354921
    },
    driftModelVersion: 'OpenDrift-v2.1',
    AISDataRange: '1788190000-1788198000',
    suspectMMSI: 413298410,
    attributionScore: 92.548,
    softwareVersions: {
      hydrodynamicEngine: 'OpenDrift-v2.1',
      sarSegmentation: 'AegisOcean-UNet-v1.4',
      aisEngine: 'AegisCorrelator-v1.0'
    },
    files: [
      {
        name: 'sar_slick_segmentation.geojson',
        contentBase64: Buffer.from('{"type":"FeatureCollection","features":[]}').toString('base64'),
        mimeType: 'application/geo+json'
      },
      {
        name: 'ais_telemetry_slice.csv',
        contentBase64: Buffer.from('timestamp,mmsi,lat,lon,speed\n').toString('base64'),
        mimeType: 'text/csv'
      }
    ]
  };

  beforeEach(() => {
    incidentService.clear();
  });

  // 0. Authentication Guard on Anchor Endpoint
  it('POST /api/incidents/anchor - should reject unauthenticated requests with 401', async () => {
    const res = await request(app)
      .post('/api/incidents/anchor')
      .send(validIncidentPayload);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('POST /api/incidents/anchor - should reject wrong-role callers (enforcement key) with 403', async () => {
    const res = await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', config.ENFORCEMENT_API_KEY)
      .send(validIncidentPayload);

    expect(res.status).toBe(403);
  });

  // 1. Complete Anchoring Flow & Returned Response Fields
  it('POST /api/incidents/anchor - should execute complete flow and return required response structure', async () => {
    const res = await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send(validIncidentPayload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data.incidentId).toBe('INC-20260831-777');
    expect(data.ipfsCID).toBeDefined();
    expect(data.ipfsCID.startsWith('bafybeic')).toBe(true);
    expect(data.evidenceHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(data.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/);
    expect(data.confirmationStatus).toBe('Confirmed');
    expect(data.status).toBe('Anchored');

    // Saved database record verification
    expect(data.incident).toBeDefined();
    expect(data.incident.suspectMMSI).toBe(413298410);
    expect(data.incident.spillAreaSqKm).toBe(14.8543);
    expect(data.incident.attributionScore).toBe(92.55);
    expect(data.incident.manifest.files.length).toBe(2);
  });

  // 2. Idempotency Check
  it('POST /api/incidents/anchor - should be idempotent when receiving exact duplicate payload', async () => {
    const res1 = await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send(validIncidentPayload);
    expect(res1.status).toBe(201);

    // Exact duplicate request
    const res2 = await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send(validIncidentPayload);

    expect(res2.status).toBe(201);
    expect(res2.body.data.incidentId).toBe(validIncidentPayload.incidentId);
    expect(res2.body.data.evidenceHash).toBe(res1.body.data.evidenceHash);
    expect(res2.body.data.txHash).toBe(res1.body.data.txHash);
  });

  // 3. Conflict on Altered Payload with Duplicate ID
  it('POST /api/incidents/anchor - should reject duplicate ID with modified forensic payload', async () => {
    await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send(validIncidentPayload);

    const alteredPayload = {
      ...validIncidentPayload,
      attributionScore: 50.0 // Altered score
    };

    const res = await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send(alteredPayload);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.message).toContain('already registered');
  });

  // 4. IPFS Failure Isolation (Blockchain transaction must NOT be triggered)
  it('should not call blockchain if IPFS upload fails', async () => {
    const failingIpfs = new IpfsService();
    vi.spyOn(failingIpfs, 'pinEvidenceBundle').mockRejectedValueOnce(new Error('Pinata Network 504 Gateway Timeout'));

    const mockBlockchain = new BlockchainService();
    const blockchainSpy = vi.spyOn(mockBlockchain, 'createIncident');

    const customService = new IncidentService(failingIpfs, mockBlockchain);

    await expect(customService.anchorForensicIncident(validIncidentPayload)).rejects.toThrow(
      'Evidence IPFS upload failed'
    );

    // Ensure blockchain transaction was NOT submitted
    expect(blockchainSpy).not.toHaveBeenCalled();
  });

  // 5. Blockchain Failure Handling
  it('should handle blockchain failures gracefully and preserve diagnostic details', async () => {
    const normalIpfs = new IpfsService();
    const failingBlockchain = new BlockchainService();
    vi.spyOn(failingBlockchain, 'createIncident').mockRejectedValueOnce(new Error('RPC gas estimation failed: execution reverted'));

    const customService = new IncidentService(normalIpfs, failingBlockchain);

    await expect(customService.anchorForensicIncident(validIncidentPayload)).rejects.toThrow(
      'Blockchain transaction error'
    );
  });

  // 6. Validation Error Checks
  it('POST /api/incidents/anchor - should reject invalid coordinates', async () => {
    const res = await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send({
        ...validIncidentPayload,
        incidentId: 'INC-BAD-COORD',
        originCoordinates: { latitude: 100, longitude: 200 }
      });

    expect(res.status).toBe(400);
  });

  // 7. GET /api/incidents/:id & Verification
  it('GET /api/incidents/:id - should return persisted record', async () => {
    await request(app)
      .post('/api/incidents/anchor')
      .set('x-api-key', ATTESTOR_KEY)
      .send(validIncidentPayload);

    const res = await request(app)
      .get('/api/incidents/INC-20260831-777');

    expect(res.status).toBe(200);
    expect(res.body.data.incidentId).toBe('INC-20260831-777');
  });
});
