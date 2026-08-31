export enum IncidentStatus {
  ANCHORED = 'ANCHORED',
  ENFORCED = 'ENFORCED',
  SETTLED = 'SETTLED',
  RELEASED = 'RELEASED'
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface TimeWindow {
  start: number;
  end: number;
}

export interface EvidenceFilePayload {
  name: string;
  contentBase64?: string;
  sizeBytes?: number;
  mimeType?: string;
  sha256?: string;
}

export interface SoftwareVersions {
  hydrodynamicEngine?: string;
  sarSegmentation?: string;
  aisEngine?: string;
  [key: string]: string | undefined;
}

export interface ForensicAnchorPayload {
  incidentId: string;
  sourceSatellite: string;
  sceneId: string;
  detectionTimestamp: number;
  spillAreaSqKm: number;
  originTimeWindow: TimeWindow;
  originCoordinates: Coordinates;
  driftModelVersion: string;
  AISDataRange?: string;
  aisDataRange?: string;
  suspectMMSI: number;
  attributionScore: number;
  softwareVersions?: SoftwareVersions;
  files: EvidenceFilePayload[];
}

/**
 * Simplified payload emitted by the /api/ml/analyze-and-anchor pipeline.
 * The backend auto-fills missing fields with sensible defaults.
 */
export interface MLForensicPayload {
  suspectMMSI: number;
  spillPolygon: number[][];
  spillAreaSqKm: number;
  attributionScore: number;
  oilProbability: number;
  windSpeedMs: number;
  estimatedAgeHours: number;
  windArtifactConfidence: number;
  sarClassification: Record<string, unknown>;
  characterisation: Record<string, unknown>;
  suspectScores: unknown[];
}


export interface ManifestFileEntry {
  name: string;
  sha256: string;
  sizeBytes?: number;
}

export interface CanonicalEvidenceManifest {
  incidentId: string;
  sourceSatellite: string;
  sceneId: string;
  detectionTimestamp: number;
  spillAreaSqKm: number;
  originTimeWindow: TimeWindow;
  originCoordinates: Coordinates;
  driftModelVersion: string;
  aisDataRange: string;
  suspectMMSI: number;
  attributionScore: number;
  softwareVersions: {
    hydrodynamicEngine: string;
    sarSegmentation: string;
    aisEngine: string;
  };
  files: ManifestFileEntry[];
}

export interface IncidentRecord {
  incidentId: string;
  incidentIdBytes32: string;
  sourceSatellite: string;
  sceneId: string;
  detectionTimestamp: number;
  spillAreaSqKm: number;
  originTimeWindow: TimeWindow;
  originCoordinates: Coordinates;
  driftModelVersion: string;
  aisDataRange: string;
  suspectMMSI: number;
  attributionScore: number;
  softwareVersions: {
    hydrodynamicEngine: string;
    sarSegmentation: string;
    aisEngine: string;
  };
  ipfsCID: string;
  evidenceHash: string;
  fineAmount?: number;
  status: IncidentStatus;
  anchorTxHash: string;
  enforceTxHash?: string;
  settleTxHash?: string;
  createdAt: number;
  enforcedAt?: number;
  manifest: CanonicalEvidenceManifest;
}
