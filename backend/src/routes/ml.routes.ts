/**
 * ml.routes.ts
 * ─────────────
 * Thin proxy + orchestration layer between the Express backend and the
 * FastAPI ML Inference Server (ml/serve.py, default port 8001).
 *
 * Routes:
 *   GET  /api/ml/health            — Forward health check to ML server
 *   POST /api/ml/sar-classify      — Forward SAR chip classification request
 *   POST /api/ml/ais-predict       — Forward AIS trajectory prediction request
 *   POST /api/ml/ais-suspects      — Forward vessel suspect scoring request
 *   POST /api/ml/analyze-and-anchor — Orchestrate full pipeline:
 *                                     ML classify → ML suspects →
 *                                     IPFS anchor → blockchain record
 */

import { Router, Request, Response as ExpressResponse, NextFunction } from 'express';
import { config } from '../config/env.js';
import { incidentService } from '../services/incident.service.js';
import { logger } from '../utils/logger.js';

const router = Router();
const log = logger.forContext('ML-Routes');

// ── ML server fetch helper ──────────────────────────────────────────────────

async function mlFetch(path: string, init?: RequestInit): Promise<globalThis.Response> {
  const url = `${config.ML_SERVER_URL}${path}`;
  log.debug(`Proxying to ML: ${init?.method ?? 'GET'} ${url}`);
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  return res;
}

// ── GET /api/ml/health ───────────────────────────────────────────────────────

router.get('/health', async (_req: Request, res: ExpressResponse, _next: NextFunction) => {
  try {
    const mlRes = await mlFetch('/ml/health');
    const data = await mlRes.json();
    res.status(mlRes.status).json({
      backend: 'healthy',
      ml_server: data,
    });
  } catch (err) {
    log.warn('ML server unreachable', { error: String(err) });
    res.status(503).json({
      backend: 'healthy',
      ml_server: { status: 'unreachable', error: String(err) },
    });
  }
});

// ── POST /api/ml/sar-classify ────────────────────────────────────────────────

router.post('/sar-classify', async (req: Request, res: ExpressResponse, _next: NextFunction) => {
  try {
    const mlRes = await mlFetch('/ml/sar-classify', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const data = await mlRes.json();
    res.status(mlRes.status).json(data);
  } catch (_err) {
    // ML server offline — synthesise heuristic response from metadata
    log.warn('SAR classify: ML server offline, using heuristic fallback');
    const { area_km2, perimeter_to_area_ratio, wind_artifact_confidence, incident_id } = req.body;
    const par = perimeter_to_area_ratio ?? 0.5;
    const wind = wind_artifact_confidence ?? 0.3;
    const area = area_km2 ?? 5.0;
    const parScore = Math.max(0, 1 - par / 0.7);
    const areaScore = Math.min(1, area / 20.0);
    const prob = Math.max(0.05, Math.min(0.98, 0.5 * parScore + 0.3 * areaScore - 0.2 * wind));
    const isOil = prob >= 0.5315;
    res.json({
      incident_id,
      oil_probability: Math.round(prob * 10000) / 10000,
      is_oil: isOil,
      confidence_class: prob > 0.8 || prob < 0.2 ? 'HIGH' : prob > 0.65 || prob < 0.35 ? 'MEDIUM' : 'LOW',
      threshold_used: 0.5315,
      bonn_class: isOil ? (prob > 0.9 ? 'BA-5 (Heavy Crude)' : prob > 0.75 ? 'BA-4 (True Oil Colors)' : 'BA-3 (Metallic)') : null,
      model_epoch: null,
      source: 'heuristic_fallback',
    });
  }
});

// ── POST /api/ml/ais-predict ─────────────────────────────────────────────────

router.post('/ais-predict', async (req: Request, res: ExpressResponse, next: NextFunction) => {
  try {
    const mlRes = await mlFetch('/ml/ais-predict', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const data = await mlRes.json();
    res.status(mlRes.status).json(data);
  } catch (err) {
    log.warn('AIS predict: ML server offline');
    next(err);
  }
});

// ── POST /api/ml/ais-suspects ────────────────────────────────────────────────

router.post('/ais-suspects', async (req: Request, res: ExpressResponse, next: NextFunction) => {
  try {
    const mlRes = await mlFetch('/ml/ais-suspects', {
      method: 'POST',
      body: JSON.stringify(req.body),
    });
    const data = await mlRes.json();
    res.status(mlRes.status).json(data);
  } catch (err) {
    log.warn('AIS suspects: ML server offline');
    next(err);
  }
});

// ── POST /api/ml/analyze-and-anchor ─────────────────────────────────────────
router.post('/analyze-and-anchor', async (req: Request, res: ExpressResponse, next: NextFunction) => {
  try {
    const { suspectMMSI, polygon, windSpeedMs, backscatterMean, aisPings, spillTimestamp } = req.body as {
      suspectMMSI: number;
      polygon: number[][];
      windSpeedMs: number;
      backscatterMean?: number;
      aisPings?: object[];
      spillTimestamp?: string;
    };

    if (!polygon || polygon.length < 3) {
      res.status(422).json({ error: 'polygon must have at least 3 points' });
      return;
    }

    // ── Step 1: Slick characterisation (inline geometry) ──────────────────
    const area = computePolygonAreaKm2(polygon);
    const perimeter = computePolygonPerimeterKm(polygon);
    const par = perimeter / (area || 1);
    const centroid = computeCentroid(polygon);
    const elongation = computeElongation(polygon);
    const spreadRate = 0.8 * windSpeedMs;
    const estimatedAgeH = spreadRate > 0 ? area / spreadRate : 0;
    const windArtifactConf = Math.min(1, (par / 1.5) * 0.4 + ((elongation - 1) / 9) * 0.3 + (windSpeedMs / 15) * 0.3);

    const characterisation = {
      areaKm2: Math.round(area * 10000) / 10000,
      perimeterKm: Math.round(perimeter * 10000) / 10000,
      perimeterToAreaRatio: Math.round(par * 10000) / 10000,
      centroid,
      elongation: Math.round(elongation * 1000) / 1000,
      estimatedAgeHours: Math.round(estimatedAgeH * 100) / 100,
      ageUncertaintyHours: Math.round(estimatedAgeH * 0.3 * 100) / 100,
      windSpeedMs,
      windArtifactConfidence: Math.round(windArtifactConf * 1000) / 1000,
    };

    // ── Step 2: SAR classification ────────────────────────────────────────
    let sarResult: Record<string, unknown>;
    try {
      const mlRes = await mlFetch('/ml/sar-classify', {
        method: 'POST',
        body: JSON.stringify({
          area_km2: area,
          perimeter_to_area_ratio: par,
          wind_artifact_confidence: windArtifactConf,
          backscatter_mean: backscatterMean,
        }),
      });
      sarResult = (await mlRes.json()) as Record<string, unknown>;
    } catch {
      // Heuristic fallback
      const parScore = Math.max(0, 1 - par / 0.7);
      const areaScore = Math.min(1, area / 20);
      const prob = Math.max(0.05, Math.min(0.98, 0.5 * parScore + 0.3 * areaScore - 0.2 * windArtifactConf));
      sarResult = {
        oil_probability: Math.round(prob * 10000) / 10000,
        is_oil: prob >= 0.5315,
        confidence_class: prob > 0.8 ? 'HIGH' : prob > 0.65 ? 'MEDIUM' : 'LOW',
        threshold_used: 0.5315,
        source: 'heuristic_fallback',
      };
    }

    // ── Step 3: AIS suspect scoring (optional) ────────────────────────────
    let suspectScores: unknown[] = [];
    if (aisPings && spillTimestamp && centroid) {
      try {
        const mlRes = await mlFetch('/ml/ais-suspects', {
          method: 'POST',
          body: JSON.stringify({
            spill_lat: centroid.lat,
            spill_lon: centroid.lon,
            spill_time_iso: spillTimestamp,
            vessels: [{ mmsi: String(suspectMMSI), pings: aisPings }],
            proximity_radius_km: 50,
          }),
        });
        suspectScores = (await mlRes.json()) as unknown[];
      } catch {
        log.warn('Suspect scoring unavailable — ML server offline');
      }
    }

    // ── Step 4: Attribution score from suspect scores or default ──────────
    const topSuspect = suspectScores[0] as Record<string, unknown> | undefined;
    const attributionScore = topSuspect
      ? Math.round(((topSuspect.suspect_score as number) ?? 0.5) * 100)
      : 50;

    // ── Step 5: Forensic anchor ───────────────────────────────────────────
    const anchorResult = await incidentService.anchorForensicIncident({
      suspectMMSI,
      spillPolygon: polygon,
      spillAreaSqKm: area,
      attributionScore,
      oilProbability: (sarResult.oil_probability as number) ?? 0.5,
      windSpeedMs,
      estimatedAgeHours: estimatedAgeH,
      windArtifactConfidence: windArtifactConf,
      sarClassification: sarResult,
      characterisation,
      suspectScores,
    });

    res.status(201).json({
      success: true,
      pipeline: {
        characterisation,
        sarClassification: sarResult,
        suspectScores,
        anchor: anchorResult,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ── Geometry helpers (mirror of ml/characterise.py) ─────────────────────────

const R = 6371.0; // km

function toRad(d: number) { return d * Math.PI / 180; }

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function computePolygonAreaKm2(coords: number[][]): number {
  const ring = coords[0] !== coords[coords.length - 1] ? [...coords, coords[0]] : coords;
  let area = 0;
  const n = ring.length - 1;
  for (let i = 0; i < n; i++) {
    const dLon = toRad(ring[i + 1][0] - ring[i][0]);
    area += dLon * (2 + Math.sin(toRad(ring[i][1])) + Math.sin(toRad(ring[i + 1][1])));
  }
  return Math.abs(area) * R ** 2 / 2;
}

function computePolygonPerimeterKm(coords: number[][]): number {
  const ring = coords[0] !== coords[coords.length - 1] ? [...coords, coords[0]] : coords;
  let total = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    total += haversineKm(ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1]);
  }
  return total;
}

function computeCentroid(coords: number[][]): { lon: number; lat: number } {
  const lon = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return { lon: Math.round(lon * 1e6) / 1e6, lat: Math.round(lat * 1e6) / 1e6 };
}

function computeElongation(coords: number[][]): number {
  const lons = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const lonSpan = haversineKm(Math.min(...lons), 0, Math.max(...lons), 0);
  const latSpan = haversineKm(0, Math.min(...lats), 0, Math.max(...lats));
  const mn = Math.min(lonSpan, latSpan);
  return mn < 1e-6 ? 1 : Math.max(lonSpan, latSpan) / mn;
}

export default router;
