import { describe, it, expect } from 'vitest';
import { IpfsService } from '../src/services/ipfs.service.js';
import { CanonicalEvidenceManifest } from '../src/types/incident.types.js';

describe('IPFS Service', () => {
  const mockManifest: CanonicalEvidenceManifest = {
    incidentId: 'INC-IPFS-TEST-001',
    sourceSatellite: 'Sentinel-1A',
    sceneId: 'SCENE-001',
    detectionTimestamp: 1788200000,
    spillAreaSqKm: 15.0,
    originTimeWindow: { start: 1788190000, end: 1788195000 },
    originCoordinates: { latitude: 18.9, longitude: 72.8 },
    driftModelVersion: 'OpenDrift-v2.1',
    aisDataRange: '1788190000-1788195000',
    suspectMMSI: 412345678,
    attributionScore: 91.5,
    softwareVersions: {
      hydrodynamicEngine: 'OpenDrift-v2.1',
      sarSegmentation: 'AegisOcean-UNet-v1.4',
      aisEngine: 'AegisCorrelator-v1.0'
    },
    files: [
      { name: 'manifest.json', sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' }
    ]
  };

  it('should pin evidence package and return valid IPFS CID without real credentials', async () => {
    const ipfs = new IpfsService();
    const result = await ipfs.pinEvidenceBundle(mockManifest);

    expect(result.ipfsCID).toBeDefined();
    expect(result.ipfsCID.startsWith('bafybeic')).toBe(true);
    expect(result.pinSize).toBeGreaterThan(0);
    expect(result.gatewayUrl).toContain(result.ipfsCID);
    expect(result.isMock).toBe(true);
  });

  it('should generate consistent deterministic IPFS CID for identical manifest', async () => {
    const ipfs = new IpfsService();
    const result1 = await ipfs.pinEvidenceBundle(mockManifest);
    const result2 = await ipfs.pinEvidenceBundle(mockManifest);

    expect(result1.ipfsCID).toEqual(result2.ipfsCID);
  });
});
