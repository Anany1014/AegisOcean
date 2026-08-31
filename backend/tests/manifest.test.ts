import { describe, it, expect } from 'vitest';
import { evidenceManifestService } from '../src/services/manifest.service.js';
import { ForensicAnchorPayload } from '../src/types/incident.types.js';

describe('Evidence Manifest Service & Determinism', () => {
  const samplePayload1: ForensicAnchorPayload = {
    incidentId: 'INC-20260831-999',
    sourceSatellite: 'Sentinel-1B SAR',
    sceneId: 'S1B_IW_GRDH_1SDV_20260831T120000',
    detectionTimestamp: 1788200000,
    spillAreaSqKm: 25.5,
    originTimeWindow: { start: 1788190000, end: 1788195000 },
    originCoordinates: { latitude: 19.05, longitude: 72.95 },
    suspectMMSI: 412345678,
    attributionScore: 88.0,
    driftModelVersion: 'OpenDrift-v2.1',
    AISDataRange: '1788190000-1788195000',
    softwareVersions: {
      hydrodynamicEngine: 'OpenDrift-v2.1',
      sarSegmentation: 'AegisOcean-UNet-v1.4',
      aisEngine: 'AegisCorrelator-v1.0'
    },
    files: [
      { name: 'drift_vectors.json', contentBase64: Buffer.from('{"vectors":[1,2,3]}').toString('base64') },
      { name: 'sar_mask.geojson', contentBase64: Buffer.from('{"type":"Polygon"}').toString('base64') }
    ]
  };

  const samplePayloadWithPermutedKeys: ForensicAnchorPayload = {
    attributionScore: 88.0,
    files: [
      { name: 'sar_mask.geojson', contentBase64: Buffer.from('{"type":"Polygon"}').toString('base64') },
      { name: 'drift_vectors.json', contentBase64: Buffer.from('{"vectors":[1,2,3]}').toString('base64') }
    ],
    originCoordinates: { longitude: 72.95, latitude: 19.05 },
    originTimeWindow: { end: 1788195000, start: 1788190000 },
    detectionTimestamp: 1788200000,
    sceneId: 'S1B_IW_GRDH_1SDV_20260831T120000',
    sourceSatellite: 'Sentinel-1B SAR',
    spillAreaSqKm: 25.5,
    suspectMMSI: 412345678,
    driftModelVersion: 'OpenDrift-v2.1',
    incidentId: 'INC-20260831-999',
    AISDataRange: '1788190000-1788195000'
  };

  it('should generate a manifest containing all required forensic attributes', () => {
    const manifest = evidenceManifestService.generateManifest(samplePayload1);

    expect(manifest.incidentId).toBe('INC-20260831-999');
    expect(manifest.sourceSatellite).toBe('Sentinel-1B SAR');
    expect(manifest.sceneId).toBe('S1B_IW_GRDH_1SDV_20260831T120000');
    expect(manifest.detectionTimestamp).toBe(1788200000);
    expect(manifest.spillAreaSqKm).toBe(25.5);
    expect(manifest.originTimeWindow).toEqual({ start: 1788190000, end: 1788195000 });
    expect(manifest.originCoordinates).toEqual({ latitude: 19.05, longitude: 72.95 });
    expect(manifest.driftModelVersion).toBe('OpenDrift-v2.1');
    expect(manifest.aisDataRange).toBe('1788190000-1788195000');
    expect(manifest.suspectMMSI).toBe(412345678);
    expect(manifest.attributionScore).toBe(88.0);
    expect(manifest.softwareVersions).toBeDefined();
    expect(manifest.files.length).toBe(2);
  });

  it('should compute SHA-256 for individual evidence files', () => {
    const manifest = evidenceManifestService.generateManifest(samplePayload1);
    
    for (const file of manifest.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.sizeBytes).toBeGreaterThan(0);
    }
  });

  it('should guarantee strict determinism: identical inputs with permuted keys yield exact same evidenceHash', () => {
    const manifest1 = evidenceManifestService.generateManifest(samplePayload1);
    const manifest2 = evidenceManifestService.generateManifest(samplePayloadWithPermutedKeys);

    const digest1 = evidenceManifestService.computeManifestDigest(manifest1);
    const digest2 = evidenceManifestService.computeManifestDigest(manifest2);

    expect(digest1.canonicalJson).toEqual(digest2.canonicalJson);
    expect(digest1.evidenceHash).toEqual(digest2.evidenceHash);
    expect(digest1.sha256).toEqual(digest2.sha256);
  });

  it('should change evidenceHash if even one byte in an evidence file is altered', () => {
    const tamperedPayload: ForensicAnchorPayload = {
      ...samplePayload1,
      files: [
        { name: 'drift_vectors.json', contentBase64: Buffer.from('{"vectors":[1,2,999]}').toString('base64') },
        { name: 'sar_mask.geojson', contentBase64: Buffer.from('{"type":"Polygon"}').toString('base64') }
      ]
    };

    const manifest1 = evidenceManifestService.generateManifest(samplePayload1);
    const manifestTampered = evidenceManifestService.generateManifest(tamperedPayload);

    const digest1 = evidenceManifestService.computeManifestDigest(manifest1);
    const digestTampered = evidenceManifestService.computeManifestDigest(manifestTampered);

    expect(digest1.evidenceHash).not.toEqual(digestTampered.evidenceHash);
  });
});
