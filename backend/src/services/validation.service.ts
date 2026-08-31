import { z } from 'zod';

/**
 * Normalizes floating point numbers to fixed decimal precision
 */
export function roundToPrecision(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export const coordinatesSchema = z.object({
  latitude: z
    .number({ required_error: 'latitude is required', invalid_type_error: 'latitude must be a number' })
    .min(-90, 'latitude must be >= -90')
    .max(90, 'latitude must be <= 90')
    .transform((val) => roundToPrecision(val, 6)),
  longitude: z
    .number({ required_error: 'longitude is required', invalid_type_error: 'longitude must be a number' })
    .min(-180, 'longitude must be >= -180')
    .max(180, 'longitude must be <= 180')
    .transform((val) => roundToPrecision(val, 6))
});

export const timeWindowSchema = z
  .object({
    start: z
      .number({ required_error: 'start timestamp is required', invalid_type_error: 'start must be a number' })
      .positive('start timestamp must be positive'),
    end: z
      .number({ required_error: 'end timestamp is required', invalid_type_error: 'end must be a number' })
      .positive('end timestamp must be positive')
  })
  .refine((data) => data.end >= data.start, {
    message: 'End timestamp must be greater than or equal to start timestamp',
    path: ['end']
  });

// SEC-LOW-01: Maximum base64 content size per file limited to 10MB encoded string
// (base64 expands by ~33%, so 13.4MB base64 = ~10MB raw)
const MAX_BASE64_CHARS = 13_421_773; // 10 * 1024 * 1024 * 4/3

export const evidenceFilePayloadSchema = z.object({
  name: z
    .string()
    .min(1, 'File name cannot be empty')
    .max(255, 'File name must not exceed 255 characters')
    .regex(/^[^/\\<>:"|?*\x00-\x1f]+$/, 'File name contains invalid characters'),
  contentBase64: z
    .string()
    .max(MAX_BASE64_CHARS, 'Individual file may not exceed 10MB before encoding')
    .optional(),
  sizeBytes: z.number().nonnegative().optional(),
  mimeType: z.string().optional(),
  sha256: z.string().regex(/^[a-fA-F0-9]{64}$/, 'sha256 must be a 64-character hex string').optional()
});

export const softwareVersionsSchema = z
  .object({
    hydrodynamicEngine: z.string().default('OpenDrift-v2.1'),
    sarSegmentation: z.string().default('AegisOcean-UNet-v1.4'),
    aisEngine: z.string().default('AegisCorrelator-v1.0')
  })
  .passthrough()
  .default({});

export const incidentIdRegex = /^[a-zA-Z0-9_-]{3,64}$/;

export const forensicAnchorSchema = z
  .object({
    incidentId: z
      .string({ required_error: 'incidentId is required' })
      .regex(incidentIdRegex, 'incidentId must be 3-64 characters alphanumeric, underscores or hyphens only'),
    sourceSatellite: z.string().min(1, 'sourceSatellite is required'),
    sceneId: z.string().min(1, 'sceneId is required'),
    detectionTimestamp: z
      .number({ required_error: 'detectionTimestamp is required' })
      .positive('detectionTimestamp must be a positive unix timestamp'),
    spillAreaSqKm: z
      .number({ required_error: 'spillAreaSqKm is required' })
      .positive('spillAreaSqKm must be greater than zero')
      .transform((val) => roundToPrecision(val, 4)),
    originTimeWindow: timeWindowSchema,
    originCoordinates: coordinatesSchema,
    driftModelVersion: z.string().min(1, 'driftModelVersion is required'),
    AISDataRange: z.string().optional(),
    aisDataRange: z.string().optional(),
    suspectMMSI: z
      .number({ required_error: 'suspectMMSI is required' })
      .int('suspectMMSI must be an integer')
      .min(100000000, 'suspectMMSI must be a valid 9-digit maritime MMSI (>= 100000000)')
      .max(999999999, 'suspectMMSI must be a valid 9-digit maritime MMSI (<= 999999999)'),
    attributionScore: z
      .number({ required_error: 'attributionScore is required' })
      .min(0, 'attributionScore must be >= 0')
      .max(100, 'attributionScore must be <= 100')
      .transform((val) => roundToPrecision(val, 2)),
    softwareVersions: softwareVersionsSchema.optional(),
    // SEC-LOW-01: Cap total file count to prevent resource exhaustion
    files: z
      .array(evidenceFilePayloadSchema)
      .min(1, 'At least one evidence file or payload is required')
      .max(20, 'Evidence bundle may not contain more than 20 files per incident')
  })
  .transform((data) => {
    const range = data.AISDataRange || data.aisDataRange || `${data.originTimeWindow.start}-${data.originTimeWindow.end}`;
    return {
      ...data,
      aisDataRange: range,
      softwareVersions: {
        hydrodynamicEngine: data.softwareVersions?.hydrodynamicEngine || 'OpenDrift-v2.1',
        sarSegmentation: data.softwareVersions?.sarSegmentation || 'AegisOcean-UNet-v1.4',
        aisEngine: data.softwareVersions?.aisEngine || 'AegisCorrelator-v1.0'
      }
    };
  });

export const incidentIdParamSchema = z.object({
  id: z
    .string()
    .regex(incidentIdRegex, 'incident ID in URL must be 3-64 characters alphanumeric, underscores or hyphens only')
});

export type ForensicAnchorInput = z.infer<typeof forensicAnchorSchema>;
