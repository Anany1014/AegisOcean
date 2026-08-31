import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { EvidenceVerificationService } from '../src/services/verification.service.js';
import { evidenceManifestService } from '../src/services/manifest.service.js';
import { incidentService } from '../src/services/incident.service.js';
import { IpfsService } from '../src/services/ipfs.service.js';
import { BlockchainService } from '../src/services/blockchain.service.js';
import { CanonicalEvidenceManifest, IncidentRecord, IncidentStatus } from '../src/types/incident.types.js';
import { config } from '../src/config/env.js';

describe('Evidence Verification API & Pipeline (GET /api/incidents/:id/verify-evidence)', () => {
  const app = createApp();
  const verificationService = new EvidenceVerificationService();

  const sampleManifest: CanonicalEvidenceManifest = {
    incidentId: 'INC-VERIFY-001',
    sourceSatellite: 'Sentinel-1A SAR',
    sceneId: 'S1A_VERIFY_SCENE',
    detectionTimestamp: 1788200000,
    spillAreaSqKm: 18.25,
    originTimeWindow: { start: 1788190000, end: 1788195000 },
    originCoordinates: { latitude: 18.924, longitude: 72.835 },
    driftModelVersion: 'OpenDrift-v2.1',
    aisDataRange: '1788190000-1788195000',
    suspectMMSI: 413298410,
    attributionScore: 94.0,
    softwareVersions: {
      hydrodynamicEngine: 'OpenDrift-v2.1',
      sarSegmentation: 'AegisOcean-UNet-v1.4',
      aisEngine: 'AegisCorrelator-v1.0'
    },
    files: [
      { name: 'slick.geojson', sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08' }
    ]
  };

  const sampleIncidentPayload = {
    incidentId: 'INC-VERIFY-001',
    sourceSatellite: 'Sentinel-1A SAR',
    sceneId: 'S1A_VERIFY_SCENE',
    detectionTimestamp: 1788200000,
    spillAreaSqKm: 18.25,
    originTimeWindow: { start: 1788190000, end: 1788195000 },
    originCoordinates: { latitude: 18.924, longitude: 72.835 },
    driftModelVersion: 'OpenDrift-v2.1',
    suspectMMSI: 413298410,
    attributionScore: 94.0,
    files: [{ name: 'slick.geojson', contentBase64: Buffer.from('{"type":"FeatureCollection"}').toString('base64') }]
  };

  beforeEach(async () => {
    incidentService.clear();
    await request(app).post('/api/incidents/anchor').set('x-api-key', config.ATTESTOR_API_KEY).send(sampleIncidentPayload);
  });

  // 1. MATCH Scenario
  it('GET /api/incidents/:id/verify-evidence - should return MATCH when local manifest evidenceHash matches on-chain hash', async () => {
    const res = await request(app).get('/api/incidents/INC-VERIFY-001/verify-evidence');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.incidentId).toBe('INC-VERIFY-001');
    expect(res.body.data.result).toBe('MATCH');
    expect(res.body.data.verified).toBe(true);
    expect(res.body.data.calculatedEvidenceHash).toBe(res.body.data.onChainEvidenceHash);
    expect(res.body.data.ipfsCID).toBeDefined();
  });

  // 2. MISMATCH Scenario
  it('should return MISMATCH when evidence has been altered', async () => {
    const { evidenceHash } = evidenceManifestService.computeManifestDigest(sampleManifest);

    const tamperedManifest: CanonicalEvidenceManifest = {
      ...sampleManifest,
      attributionScore: 12.0 // Altered score
    };

    const result = await verificationService.verifyManifestAgainstHash(
      'INC-VERIFY-001',
      evidenceHash,
      tamperedManifest,
      'bafybeictestcid12345'
    );

    expect(result.verified).toBe(false);
    expect(result.result).toBe('MISMATCH');
    expect(result.calculatedEvidenceHash).not.toBe(evidenceHash);
  });

  // 3. Missing Evidence / Missing CID
  it('should handle missing CID and return MISMATCH with explanation', async () => {
    const recordWithoutCid: IncidentRecord = {
      incidentId: 'INC-NO-CID',
      incidentIdBytes32: '0x1234',
      sourceSatellite: 'S1',
      sceneId: 'SC1',
      detectionTimestamp: 1000,
      spillAreaSqKm: 10,
      originTimeWindow: { start: 100, end: 200 },
      originCoordinates: { latitude: 10, longitude: 20 },
      driftModelVersion: 'v1',
      aisDataRange: '100-200',
      suspectMMSI: 123456789,
      attributionScore: 90,
      softwareVersions: { hydrodynamicEngine: 'v1', sarSegmentation: 'v1', aisEngine: 'v1' },
      ipfsCID: '', // Missing CID
      evidenceHash: '0x961effdec003ef3f1d13d350a0c9adc35a080e0cbf961466aeeb9c7b8a99fe07',
      status: IncidentStatus.ANCHORED,
      anchorTxHash: '0x111',
      createdAt: 1000,
      manifest: sampleManifest
    };

    const result = await verificationService.verifyIncidentEvidence(recordWithoutCid);
    expect(result.result).toBe('MISMATCH');
    expect(result.verified).toBe(false);
    expect(result.ipfsCID).toBe('MISSING_CID');
  });

  // 4. Invalid Evidence / Malformed Manifest
  it('should handle malformed manifest generation gracefully and return MISMATCH', async () => {
    const badManifest: any = { incidentId: 'INC-BAD', files: null };
    const result = await verificationService.verifyManifestAgainstHash(
      'INC-BAD',
      '0x961effdec003ef3f1d13d350a0c9adc35a080e0cbf961466aeeb9c7b8a99fe07',
      badManifest,
      'bafybeicbadcid'
    );

    // Still handles gracefully
    expect(result.result).toBe('MISMATCH');
  });

  // 5. IPFS Failure
  it('should handle IPFS resolution failure gracefully and fall back to local manifest verification', async () => {
    const failingIpfs = new IpfsService();
    vi.spyOn(failingIpfs, 'fetchEvidenceManifest').mockRejectedValueOnce(new Error('IPFS Gateway 504 Timeout'));

    const customVerificationService = new EvidenceVerificationService(failingIpfs);
    const incident = await incidentService.getIncident('INC-VERIFY-001');

    const result = await customVerificationService.verifyIncidentEvidence(incident);
    expect(result.result).toBe('MATCH'); // Recovers cleanly using stored manifest
  });

  // 6. Blockchain Failure / Offline RPC
  it('should handle blockchain RPC errors during on-chain hash lookup and return comparison against recorded hash', async () => {
    const failingBlockchain = new BlockchainService();
    vi.spyOn(failingBlockchain, 'getIncident').mockRejectedValueOnce(new Error('RPC provider connection refused'));

    const customVerificationService = new EvidenceVerificationService(undefined, failingBlockchain);
    const incident = await incidentService.getIncident('INC-VERIFY-001');

    const result = await customVerificationService.verifyIncidentEvidence(incident);
    expect(result.result).toBe('MATCH');
    expect(result.calculatedEvidenceHash).toBe(result.onChainEvidenceHash);
  });
});
