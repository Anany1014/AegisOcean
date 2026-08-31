// AegisOcean — Backend Contract Types
// Source: PRD §7. This is the single source of truth for TypeScript types.
// Update here when teammates' endpoints deviate, then fix consuming components.

export type IncidentStatus = 'unreviewed' | 'confirmed' | 'dismissed';

export interface Incident {
    id: string;
    detectedAt: string; // ISO timestamp
    polygon: GeoJSON.Polygon;
    areaKm2: number;
    perimeterToAreaRatio: number;
    windArtifactConfidence: number; // 0-1, higher = more likely false positive
    status: IncidentStatus;
    severity?: string;
    // Derived / display fields (computed in frontend)
    centroid?: [number, number]; // [lng, lat] — computed from polygon on ingest
}

export interface DriftFrame {
    timestampOffsetHours: number; // negative = hindcast, positive = forecast
    originHeatmap: GeoJSON.FeatureCollection;
}

export interface SuspectVessel {
    mmsi: string | null; // null => Dark Vessel (no AIS match)
    vesselName?: string;
    vesselType: string;
    track: GeoJSON.LineString;
    minDistanceKm: number;
    temporalOverlapHours: number;
    vesselRiskWeight: number; // 0-1
    anomalyIndex: number; // 0-1
    suspectScore: number; // 0-1, final ranked score
}

export interface DossierResponse {
    pdfUrl: string;
}

// ── API response wrappers ──────────────────────────────────────────────────
export interface IncidentsResponse {
    incidents: Incident[];
}

export interface DriftResponse {
    frames: DriftFrame[];
}

export interface SuspectsResponse {
    suspects: SuspectVessel[];
}
