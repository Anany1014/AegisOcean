// AegisOcean — ML Inference Types
// These types match the FastAPI serve.py response schemas exactly.

export interface SARClassifyRequest {
    incident_id?: string;
    image_b64?: string;           // base64-encoded image (optional)
    area_km2?: number;            // fallback physics metadata
    perimeter_to_area_ratio?: number;
    wind_artifact_confidence?: number;
}

export interface SARClassifyResponse {
    incident_id?: string;
    oil_probability: number;      // 0–1
    is_oil: boolean;
    confidence_class: 'HIGH' | 'MEDIUM' | 'LOW';
    threshold_used: number;       // Youden's J = 0.5315
    bonn_class?: string;          // e.g. "BA-4 (True Oil Colors)"
    model_epoch: number;
}

export interface AISPing {
    lat: number;
    lon: number;
    sog: number;                  // knots
    cog: number;                  // degrees
    timestamp_iso: string;
}

export interface AISPredictRequest {
    mmsi: string;
    pings: AISPing[];
    t_out?: number;               // steps to predict, default 8
}

export interface PredictedStep {
    step: number;
    lat: number;
    lon: number;
    sog_norm: number;
    sog_knots: number;
}

export interface AISPredictResponse {
    mmsi: string;
    predicted_track: PredictedStep[];
    prediction_error_km?: number;
}

export interface SuspectScoreResponse {
    mmsi: string;
    vessel_name: string;
    vessel_type: string;
    vessel_risk: number;
    observed_prox_km?: number;
    predicted_prox_km?: number;
    dark_vessel_flag: 0 | 1;
    speed_drop_score: number;
    suspect_score: number;
    predicted_track: { lat: number; lon: number }[];
}

export interface MLHealthResponse {
    status: 'ok' | 'error';
    device: string;
    models: {
        sar_classifier: { loaded: boolean; checkpoint_exists: boolean };
        ais_predictor:  { loaded: boolean; checkpoint_exists: boolean };
    };
}
