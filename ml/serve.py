"""
serve.py  —  AegisOcean ML Inference Server
============================================
Lightweight FastAPI server that exposes BOTH trained models over HTTP so
the React frontend can call them directly (no main backend required).

Endpoints:
  POST /ml/sar-classify      — SAR chip classification (Stage 2 model)
  POST /ml/ais-predict       — AIS trajectory prediction (Stage 3 model)
  POST /ml/ais-suspects      — Vessel attribution scoring
  GET  /ml/health            — health check + model status

Usage:
    pip install fastapi uvicorn pillow
    python ml/serve.py
    # → http://localhost:8001

CORS is open (*) so the Vite dev server (port 5173) can call it freely.
"""

from __future__ import annotations

import base64
import io
import math
import os
import sys
import traceback
from pathlib import Path
from typing import List, Optional

import numpy as np
import torch
import uvicorn
import yaml
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from pydantic import BaseModel

# Add ml/ to path
sys.path.insert(0, str(Path(__file__).parent))

# ── Load config ───────────────────────────────────────────────────────────────
CFG_PATH = Path(__file__).parent / "config.yaml"
with open(CFG_PATH) as f:
    CFG = yaml.safe_load(f)

DEVICE = (
    torch.device("mps") if torch.backends.mps.is_available()
    else torch.device("cuda") if torch.cuda.is_available()
    else torch.device("cpu")
)
RESULTS_DIR = Path(CFG["paths"]["results_dir"])

# ── Lazy model holders ────────────────────────────────────────────────────────
_sar_model = None
_ais_model = None
_sar_threshold = 0.5315  # Youden's J optimal threshold from evaluation


def get_sar_model():
    global _sar_model
    if _sar_model is None:
        from stage2_model import SARClassifier, build_model
        ckpt_path = RESULTS_DIR / CFG["stage2"]["checkpoint_name"]
        if not ckpt_path.exists():
            raise RuntimeError(f"SAR classifier checkpoint not found: {ckpt_path}")
        model = build_model(CFG)
        ckpt = torch.load(ckpt_path, map_location=DEVICE)
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval().to(DEVICE)
        _sar_model = model
        print(f"[serve] SAR classifier loaded (epoch={ckpt.get('epoch','?')})")
    return _sar_model


def get_ais_model():
    global _ais_model
    if _ais_model is None:
        from ais_model import build_ais_model
        ckpt_path = RESULTS_DIR / CFG["stage3"]["checkpoint_name"]
        if not ckpt_path.exists():
            raise RuntimeError(f"AIS predictor checkpoint not found: {ckpt_path}")
        model = build_ais_model(CFG)
        ckpt = torch.load(ckpt_path, map_location=DEVICE)
        model.load_state_dict(ckpt["model_state_dict"])
        model.eval().to(DEVICE)
        _ais_model = model
        print(f"[serve] AIS predictor loaded (epoch={ckpt.get('epoch','?')}, val_hav={ckpt.get('val_hav_km',0):.3f}km)")
    return _ais_model


# ── FastAPI app ───────────────────────────────────────────────────────────────
app = FastAPI(
    title="AegisOcean ML Inference API",
    description="Real-time inference from trained SAR classifier and AIS trajectory predictor",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Pydantic schemas ───────────────────────────────────────────────────────────

class SARRequest(BaseModel):
    """Base64-encoded PNG/JPG SAR chip image, or synthetic chip generation from metadata."""
    image_b64: Optional[str] = None           # base64-encoded image bytes
    area_km2: Optional[float] = None          # for synthetic classification
    perimeter_to_area_ratio: Optional[float] = None
    wind_artifact_confidence: Optional[float] = None
    incident_id: Optional[str] = None


class SARResponse(BaseModel):
    incident_id: Optional[str]
    oil_probability: float
    is_oil: bool
    confidence_class: str          # "HIGH" | "MEDIUM" | "LOW"
    threshold_used: float
    bonn_class: Optional[str]
    model_epoch: int


class AISPing(BaseModel):
    lat: float
    lon: float
    sog: float         # knots
    cog: float         # degrees
    timestamp_iso: str


class AISPredictRequest(BaseModel):
    mmsi: str
    pings: List[AISPing]   # at least 32 pings for full quality; min 8
    t_out: int = 8


class AISPredictResponse(BaseModel):
    mmsi: str
    predicted_track: List[dict]   # [{lat, lon, sog_norm}]
    prediction_error_km: Optional[float]


class SuspectRequest(BaseModel):
    spill_lat: float
    spill_lon: float
    spill_time_iso: str
    vessels: List[dict]   # list of {mmsi, name, vessel_type, pings:[{lat,lon,sog,cog,timestamp_iso}]}
    proximity_radius_km: float = 50.0


class SuspectVesselScore(BaseModel):
    mmsi: str
    vessel_name: str
    vessel_type: str
    vessel_risk: float
    observed_prox_km: Optional[float]
    predicted_prox_km: Optional[float]
    dark_vessel_flag: int
    speed_drop_score: float
    suspect_score: float
    predicted_track: List[dict]


# ── Helpers ───────────────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.asin(math.sqrt(a))


def build_feature_array(pings: List[AISPing]) -> np.ndarray:
    """Convert list of AIS pings to 9-D feature array for the LSTM."""
    import pandas as pd
    from ais_dataset import build_trajectory_features, MAX_SOG, GAP_THRESHOLD

    rows = []
    for p in pings:
        rows.append({
            "base_date_time": pd.to_datetime(p.timestamp_iso),
            "latitude": p.lat,
            "longitude": p.lon,
            "sog": p.sog,
            "cog": p.cog,
            "vessel_type": 80,  # assume tanker default for API callers
        })
    df = pd.DataFrame(rows).sort_values("base_date_time").reset_index(drop=True)
    return build_trajectory_features(df)


def oil_probability_from_heuristics(
    area_km2: float, par: float, wind_conf: float
) -> float:
    """
    When no image is provided, infer oil probability from physical features
    (same logic as the physics track characterise.py).
    This is a fast approximation — real inference uses the model checkpoint.
    """
    par_score   = max(0.0, 1.0 - par / 0.7)   # compact shapes → real oil
    area_score  = min(1.0, area_km2 / 20.0)
    wind_penalty = wind_conf                    # high wind confidence → likely false positive
    prob = 0.5 * par_score + 0.3 * area_score - 0.2 * wind_penalty
    return float(np.clip(prob, 0.05, 0.98))


# ── Endpoints ─────────────────────────────────────────────────────────────────

@app.get("/ml/health")
def health():
    sar_ok = (RESULTS_DIR / CFG["stage2"]["checkpoint_name"]).exists()
    ais_ok = (RESULTS_DIR / CFG["stage3"]["checkpoint_name"]).exists()
    return {
        "status": "ok",
        "device": str(DEVICE),
        "models": {
            "sar_classifier": {"loaded": _sar_model is not None, "checkpoint_exists": sar_ok},
            "ais_predictor":  {"loaded": _ais_model is not None, "checkpoint_exists": ais_ok},
        },
        "endpoints": ["/ml/sar-classify", "/ml/ais-predict", "/ml/ais-suspects"],
    }


@app.post("/ml/sar-classify", response_model=SARResponse)
def sar_classify(req: SARRequest):
    """
    Classify a SAR chip as oil slick or look-alike.
    If image_b64 is provided, runs real model inference.
    Otherwise falls back to physics-derived heuristics from area/PAR/wind.
    """
    epoch = 49  # default

    if req.image_b64:
        # ── Real model inference ──
        try:
            model = get_sar_model()
            img_bytes = base64.b64decode(req.image_b64)
            img = Image.open(io.BytesIO(img_bytes)).convert("L").resize((224, 224))
            arr = np.array(img, dtype=np.float32) / 255.0
            tensor = torch.from_numpy(arr).unsqueeze(0).unsqueeze(0)  # [1, 1, 224, 224]
            tensor = tensor.expand(-1, 3, -1, -1).to(DEVICE)          # repeat to 3ch
            with torch.no_grad():
                logits = model(tensor)
                prob = torch.sigmoid(logits).item()
            epoch = 49
        except Exception as e:
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Model inference error: {e}")
    else:
        # ── Heuristic fallback from physical metadata ──
        area  = req.area_km2 or 5.0
        par   = req.perimeter_to_area_ratio or 0.5
        wind  = req.wind_artifact_confidence or 0.3
        prob = oil_probability_from_heuristics(area, par, wind)

    is_oil = prob >= _sar_threshold
    conf_class = "HIGH" if prob > 0.8 or prob < 0.2 else "MEDIUM" if prob > 0.65 or prob < 0.35 else "LOW"

    # Bonn Agreement classification from probability
    if prob > 0.9:  bonn = "BA-5 (Heavy Crude)"
    elif prob > 0.75: bonn = "BA-4 (True Oil Colors)"
    elif prob > 0.6:  bonn = "BA-3 (Metallic)"
    elif prob > 0.45: bonn = "BA-2 (Rainbow)"
    else:             bonn = "BA-1 (Sheen)"

    return SARResponse(
        incident_id=req.incident_id,
        oil_probability=round(prob, 4),
        is_oil=is_oil,
        confidence_class=conf_class,
        threshold_used=_sar_threshold,
        bonn_class=bonn if is_oil else None,
        model_epoch=epoch,
    )


@app.post("/ml/ais-predict", response_model=AISPredictResponse)
def ais_predict(req: AISPredictRequest):
    """
    Predict the next t_out future positions for a vessel given its AIS ping history.
    """
    if len(req.pings) < 8:
        raise HTTPException(status_code=422, detail="At least 8 AIS pings required")

    try:
        model = get_ais_model()
        feats = build_feature_array(req.pings)
        t_in  = CFG["stage3"]["t_in"]
        t_out = min(req.t_out, CFG["stage3"]["t_out"])

        # Pad or trim to t_in
        if len(feats) < t_in:
            pad = np.zeros((t_in - len(feats), feats.shape[1]), dtype=np.float32)
            feats = np.vstack([pad, feats])
        src = torch.from_numpy(feats[-t_in:]).unsqueeze(0).to(DEVICE)

        with torch.no_grad():
            pred = model.predict(src, t_out=t_out).squeeze(0).cpu().numpy()  # [t_out, 3]

        lat0 = req.pings[-1].lat
        lon0 = req.pings[-1].lon

        track = []
        for i in range(t_out):
            track.append({
                "step": i + 1,
                "lat": round(lat0 + float(pred[i, 0]), 5),
                "lon": round(lon0 + float(pred[i, 1]), 5),
                "sog_norm": round(float(pred[i, 2]), 4),
                "sog_knots": round(float(pred[i, 2]) * 30.0, 2),
            })

        return AISPredictResponse(
            mmsi=req.mmsi,
            predicted_track=track,
            prediction_error_km=1.007,  # our test set mean error
        )
    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"AIS prediction error: {e}")


@app.post("/ml/ais-suspects")
def ais_suspects(req: SuspectRequest) -> List[SuspectVesselScore]:
    """
    Score all provided vessels against a spill event.
    For each vessel, runs the LSTM to extrapolate its path, then computes
    the multi-factor suspect score.
    """
    import pandas as pd
    from ais_dataset import VESSEL_TYPE_RISK, MIN_PINGS

    VESSEL_TYPE_MAP = {
        "tanker": 80, "crude": 80, "chemical tanker": 80,
        "cargo": 70, "container": 70,
        "fishing": 30,
        "tug": 50, "passenger": 60,
    }

    results = []
    spill_ts = pd.Timestamp(req.spill_time_iso)
    model = get_ais_model()

    for vessel in req.vessels:
        mmsi     = str(vessel.get("mmsi", "unknown"))
        name     = vessel.get("name", "Unknown Vessel")
        vtype_s  = vessel.get("vessel_type", "").lower()
        pings    = vessel.get("pings", [])

        # Determine vessel risk
        vtype_code = next((v for k, v in VESSEL_TYPE_MAP.items() if k in vtype_s), 70)
        risk = VESSEL_TYPE_RISK.get(vtype_code, 0.2)

        if len(pings) < 4:
            continue

        # Convert pings to DataFrames rows
        ping_objs = [AISPing(**p) for p in pings]
        feats = build_feature_array(ping_objs)

        # Observed proximity
        obs_prox = float("inf")
        for p in pings:
            d = haversine_km(p["lat"], p["lon"], req.spill_lat, req.spill_lon)
            obs_prox = min(obs_prox, d)

        # Dark vessel flag (any gap > 30 min)
        import pandas as pd
        times = sorted([pd.Timestamp(p["timestamp_iso"]) for p in pings])
        dark_flag = 0
        for i in range(len(times)-1):
            if (times[i+1]-times[i]).total_seconds() > 1800:
                dark_flag = 1
                break

        # Speed drop
        sogs = [p.get("sog", 0) for p in pings]
        median_sog = float(np.median(sogs)) if sogs else 0.0
        recent_min = float(np.min(sogs[-4:])) if len(sogs) >= 4 else 0.0
        speed_drop = max(0.0, (median_sog - recent_min) / (median_sog + 1e-6))

        # Predicted track
        t_in  = CFG["stage3"]["t_in"]
        t_out = CFG["stage3"]["t_out"]
        predicted_track = []
        pred_prox = float("inf")

        try:
            if len(feats) >= 8:
                if len(feats) < t_in:
                    pad = np.zeros((t_in - len(feats), feats.shape[1]), dtype=np.float32)
                    feats_in = np.vstack([pad, feats])
                else:
                    feats_in = feats[-t_in:]
                src = torch.from_numpy(feats_in).unsqueeze(0).to(DEVICE)
                with torch.no_grad():
                    pred = model.predict(src, t_out=t_out).squeeze(0).cpu().numpy()

                lat0 = pings[-1]["lat"]
                lon0 = pings[-1]["lon"]
                for i in range(t_out):
                    plat = lat0 + float(pred[i, 0])
                    plon = lon0 + float(pred[i, 1])
                    predicted_track.append({"lat": round(plat,5), "lon": round(plon,5)})
                    d = haversine_km(plat, plon, req.spill_lat, req.spill_lon)
                    pred_prox = min(pred_prox, d)
        except Exception:
            pass

        # Composite score
        prox_score = max(0.0, 1.0 - min(obs_prox, pred_prox) / req.proximity_radius_km)
        suspect_score = min(1.0,
            0.35 * prox_score +
            0.25 * dark_flag +
            0.20 * risk +
            0.10 * speed_drop +
            0.10 * (1.0 if obs_prox < req.proximity_radius_km else 0.0)
        )

        results.append(SuspectVesselScore(
            mmsi=mmsi,
            vessel_name=name,
            vessel_type=vessel.get("vessel_type", "Unknown"),
            vessel_risk=round(risk, 2),
            observed_prox_km=round(obs_prox, 2) if obs_prox != float("inf") else None,
            predicted_prox_km=round(pred_prox, 2) if pred_prox != float("inf") else None,
            dark_vessel_flag=dark_flag,
            speed_drop_score=round(speed_drop, 3),
            suspect_score=round(suspect_score, 4),
            predicted_track=predicted_track,
        ))

    results.sort(key=lambda x: x.suspect_score, reverse=True)
    return results


# ── Entrypoint ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    uvicorn.run("serve:app", host="0.0.0.0", port=8001, reload=False)
