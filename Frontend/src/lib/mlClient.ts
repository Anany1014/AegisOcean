/**
 * mlClient.ts
 * ───────────
 * Typed HTTP client for the AegisOcean ML Inference Server (ml/serve.py).
 * Runs on http://localhost:8001
 * Falls back to rich pre-computed mock data when the server is offline.
 */

import type {
    SARClassifyRequest,
    SARClassifyResponse,
    AISPredictRequest,
    AISPredictResponse,
    SuspectScoreResponse,
    MLHealthResponse,
} from '@/types/ml';

import mockSARResults from '@/mocks/ml_sar_results.json';
import mockAISResults from '@/mocks/ml_ais_results.json';
import mockSuspectScores from '@/mocks/ml_suspect_scores.json';

const ML_BASE = import.meta.env.VITE_ML_API_URL || 'http://localhost:8001';
const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function mlFetch<T>(path: string, init?: RequestInit, timeout = 5000): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(`${ML_BASE}${path}`, {
            ...init,
            signal: controller.signal,
        });
        if (!res.ok) throw new Error(`ML API ${path} → ${res.status}`);
        return res.json() as Promise<T>;
    } finally {
        clearTimeout(timer);
    }
}

export const mlClient = {
    // ── Health check ──────────────────────────────────────────────────────────
    async health(): Promise<MLHealthResponse> {
        return mlFetch<MLHealthResponse>('/ml/health');
    },

    // ── SAR Chip Classification ───────────────────────────────────────────────
    async classifySAR(req: SARClassifyRequest): Promise<SARClassifyResponse> {
        try {
            return await mlFetch<SARClassifyResponse>('/ml/sar-classify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });
        } catch (err) {
            console.warn('[mlClient] SAR server unreachable — using pre-computed mock', err);
            await delay(500);
            // Find matching mock or synthesise from metadata
            const match = (mockSARResults as SARClassifyResponse[]).find(
                r => r.incident_id === req.incident_id
            );
            if (match) return match;
            // Synthesise from physics metadata
            const par = req.perimeter_to_area_ratio ?? 0.5;
            const wind = req.wind_artifact_confidence ?? 0.3;
            const area = req.area_km2 ?? 5.0;
            const parScore = Math.max(0, 1 - par / 0.7);
            const areaScore = Math.min(1, area / 20.0);
            const prob = Math.max(0.05, Math.min(0.98,
                0.5 * parScore + 0.3 * areaScore - 0.2 * wind
            ));
            const is_oil = prob >= 0.5315;
            return {
                incident_id: req.incident_id,
                oil_probability: Math.round(prob * 10000) / 10000,
                is_oil,
                confidence_class: prob > 0.8 || prob < 0.2 ? 'HIGH' : prob > 0.65 || prob < 0.35 ? 'MEDIUM' : 'LOW',
                threshold_used: 0.5315,
                bonn_class: is_oil ? (prob > 0.9 ? 'BA-5 (Heavy Crude)' : prob > 0.75 ? 'BA-4 (True Oil Colors)' : 'BA-3 (Metallic)') : undefined,
                model_epoch: 49,
            };
        }
    },

    // ── AIS Trajectory Prediction ─────────────────────────────────────────────
    async predictTrajectory(req: AISPredictRequest): Promise<AISPredictResponse> {
        try {
            return await mlFetch<AISPredictResponse>('/ml/ais-predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req),
            });
        } catch (err) {
            console.warn('[mlClient] AIS server unreachable — using pre-computed mock', err);
            await delay(400);
            const match = (mockAISResults as AISPredictResponse[]).find(r => r.mmsi === req.mmsi);
            return match ?? (mockAISResults as AISPredictResponse[])[0];
        }
    },

    // ── Vessel Suspect Scoring ────────────────────────────────────────────────
    async scoreSuspects(payload: {
        spill_lat: number;
        spill_lon: number;
        spill_time_iso: string;
        vessels: object[];
        proximity_radius_km?: number;
    }): Promise<SuspectScoreResponse[]> {
        try {
            return await mlFetch<SuspectScoreResponse[]>('/ml/ais-suspects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
        } catch (err) {
            console.warn('[mlClient] Suspects API unreachable — using pre-computed mock', err);
            await delay(600);
            return mockSuspectScores as SuspectScoreResponse[];
        }
    },
};
