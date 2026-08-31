import { describe, it, expect } from 'vitest';
import {
  forensicAnchorSchema,
  coordinatesSchema,
  timeWindowSchema
} from '../src/services/validation.service.js';

describe('Validation Service', () => {
  it('should validate valid coordinates', () => {
    const valid = { latitude: 18.924, longitude: 72.835 };
    expect(coordinatesSchema.safeParse(valid).success).toBe(true);

    const invalid = { latitude: 95.0, longitude: 72.835 };
    expect(coordinatesSchema.safeParse(invalid).success).toBe(false);
  });

  it('should validate time windows where end >= start', () => {
    const valid = { start: 1700000000, end: 1700003600 };
    expect(timeWindowSchema.safeParse(valid).success).toBe(true);

    const invalid = { start: 1700003600, end: 1700000000 };
    expect(timeWindowSchema.safeParse(invalid).success).toBe(false);
  });

  it('should validate complete forensic anchor payload', () => {
    const payload = {
      incidentId: 'INC-20260831-001',
      sourceSatellite: 'Sentinel-1A SAR',
      sceneId: 'S1A_IW_GRDH_1SDV_20260831T181204',
      detectionTimestamp: 1788201124,
      spillAreaSqKm: 14.85,
      originTimeWindow: { start: 1788190000, end: 1788198000 },
      originCoordinates: { latitude: 18.924, longitude: 72.835 },
      suspectMMSI: 413298410,
      attributionScore: 92.5,
      driftModelVersion: 'OpenDrift-v2.1',
      files: [
        { name: 'sar_slick.geojson', contentBase64: 'eyJ0eXBlIjoiRmVhdHVyZUNvbGxlY3Rpb24ifQ==' }
      ]
    };

    const result = forensicAnchorSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should reject invalid MMSI or empty files list', () => {
    const invalid = {
      incidentId: 'INC-001',
      sourceSatellite: 'Sentinel-1',
      sceneId: 'SCENE-01',
      detectionTimestamp: 1788201124,
      spillAreaSqKm: 10,
      originTimeWindow: { start: 100, end: 200 },
      originCoordinates: { latitude: 10, longitude: 20 },
      suspectMMSI: 1234, // Too short for standard 9-digit MMSI
      attributionScore: 90,
      driftModelVersion: 'OpenDrift',
      files: []
    };

    const result = forensicAnchorSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
