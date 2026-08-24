"""
ais_suspect.py
──────────────
Vessel attribution engine: given a trained trajectory predictor and
a SAR-detected oil spill event (from CSIRO chip metadata), ranks
all candidate vessels by their suspect_score [0–1].

Pipeline:
  1. Load spill events from CSIRO chip metadata (lat/lon from scene centroid,
     date from AIS file date, using chip positions as pixel offsets)
  2. For each vessel in the target AIS file (Indian Ocean or any region):
       a. Feed last T_in pings BEFORE the spill time into the predictor
       b. Predict next T_out positions → trajectory extrapolation
       c. Compute proximity: min Haversine distance between the predicted
          path and the slick origin
       d. Check for dark-vessel flag: AIS gap >30 min near the origin window
       e. Score with vessel_type_risk weighting
  3. Output ranked DataFrame of suspects

Usage:
    python ml/ais_suspect.py \
        --ais      ais-2025-01-01.csv.zst \
        --spill-lat  18.5 \
        --spill-lon  72.8 \
        --spill-time "2025-01-01 12:00:00" \
        --config   ml/config.yaml
"""

from __future__ import annotations

import argparse
import io
import math
import sys
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
import zstandard as zstd
import yaml

# ── ensure ml/ on path ──
sys.path.insert(0, str(Path(__file__).parent))
from ais_dataset import build_trajectory_features, VESSEL_TYPE_RISK, MIN_PINGS
from ais_model import VesselTrajectoryPredictor, build_ais_model


# ── CSIRO scene metadata ──────────────────────────────────────────────────────

# Maps 3-letter scene codes in CSIRO chip filenames to approximate
# geographic centroids (lat, lon) of the SAR acquisition area.
CSIRO_SCENE_COORDS = {
    "GBR": (-18.0,  147.0),   # Great Barrier Reef
    "SIN": (  1.25, 103.8),   # Singapore Strait
    "JAV": ( -5.5,  107.5),   # Java Sea
    "GIB": ( 35.9,   -5.4),   # Gibraltar Strait
    "PHI": ( 12.0,  121.0),   # Philippines Sea
    "EGY": ( 28.0,   33.0),   # Red Sea / Egypt
    "BAH": ( 26.0,   50.5),   # Bahrain / Arabian Gulf
    "ADR": ( 43.0,   15.5),   # Adriatic Sea
    "LUC": (  4.5,  112.5),   # Luconia Shoals
    "NOR": ( 62.0,    5.0),   # North Sea / Norway
    "BOR": (  3.0,  115.0),   # Borneo
    "ISR": ( 32.5,   34.5),   # Mediterranean Israel
    "MLA": (  3.5,  101.0),   # Malacca Strait
    "JAP": ( 35.0,  135.0),   # Japan Sea
    "VEN": ( 10.5,  -64.0),   # Venezuela
    "CHS": ( 20.0,  115.0),   # China Sea
    "THA": ( 10.0,  101.0),   # Gulf of Thailand
    "MAU": (-20.0,   57.5),   # Mauritius
    "TRI": ( 10.5,  -61.5),   # Trinidad
    "BLS": ( 43.0,   33.0),   # Black Sea
}

# Indian EEZ bounding box (lon, lat) — for filtering AIS inference target
INDIAN_EEZ_BBOX = (60.0, 5.0, 100.0, 25.0)


def spill_events_from_csiro(
    data_root: str,
    label: int = 1,
    max_events: int = 20,
) -> pd.DataFrame:
    """
    Parse CSIRO chip filenames to extract spill event coordinates.

    Filename format: {chip_i}_{x}_{y}_img_{hash}_{SCENE}_cls_{label}.jpg
      • x, y are pixel offsets within the SAR scene at ~400m/pixel resolution
      • We convert pixel offset to approximate lat/lon displacement from scene centroid

    Args:
        data_root: Path to CSIRO data/1/ folder (oil chips).
        label:     1 for oil chips, 0 for no-oil chips.
        max_events: Number of spill events to return.
    Returns:
        DataFrame with columns: scene, lat, lon, chip_id
    """
    import re
    from pathlib import Path as _Path

    pattern = re.compile(
        r"(\d+)_(\d+)_(\d+)_img_[A-Za-z0-9]+_([A-Z]{2,3})_cls_(\d)\.jpg"
    )
    root = _Path(data_root)
    events = []

    for fpath in root.glob(f"**/*.jpg"):
        m = pattern.match(fpath.name)
        if not m:
            continue
        chip_i, px, py, scene, lbl = m.groups()
        if int(lbl) != label:
            continue
        if scene not in CSIRO_SCENE_COORDS:
            continue

        base_lat, base_lon = CSIRO_SCENE_COORDS[scene]
        # ~400m per pixel → ~0.0036 degrees per pixel
        pixel_res_deg = 0.0036
        lat = base_lat + (int(py) * pixel_res_deg)
        lon = base_lon + (int(px) * pixel_res_deg)
        events.append({"chip_id": int(chip_i), "scene": scene, "lat": lat, "lon": lon})

        if len(events) >= max_events:
            break

    df = pd.DataFrame(events).drop_duplicates("chip_id")
    print(f"[CSIRO] Found {len(df)} spill events (label={label})")
    return df


# ── Haversine helper ──────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi  = math.radians(lat2 - lat1)
    dlam  = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlam/2)**2
    return 2 * R * math.asin(math.sqrt(a))


# ── Inference per vessel ──────────────────────────────────────────────────────

@torch.no_grad()
def predict_vessel_path(
    model: VesselTrajectoryPredictor,
    feats: np.ndarray,
    t_in: int,
    t_out: int,
    device: torch.device,
) -> tuple[np.ndarray, np.ndarray] | None:
    """
    Given a vessel's feature array, predict T_out future positions.

    Returns:
        (pred_lat_deltas, pred_lon_deltas) or None if insufficient history.
    """
    if len(feats) < t_in:
        return None

    # Use the last T_in pings
    src = torch.from_numpy(feats[-t_in:]).unsqueeze(0).to(device)
    pred = model.predict(src, t_out=t_out)               # [1, T_out, 3]
    pred_np = pred.squeeze(0).cpu().numpy()              # [T_out, 3]
    return pred_np[:, 0], pred_np[:, 1]                  # lat_deltas, lon_deltas


def score_vessel(
    mmsi: int,
    df: pd.DataFrame,
    model: VesselTrajectoryPredictor,
    spill_lat: float,
    spill_lon: float,
    spill_time: pd.Timestamp,
    t_in: int,
    t_out: int,
    device: torch.device,
    window_hours: float = 6.0,
    proximity_km: float = 50.0,
    gap_threshold_s: int = 1800,
) -> Optional[dict]:
    """
    Score a single vessel for suspicion relative to a spill event.
    """
    df = df.sort_values("base_date_time").reset_index(drop=True)
    t_start = spill_time - pd.Timedelta(hours=window_hours)
    t_end   = spill_time + pd.Timedelta(hours=window_hours)

    # Pings within the temporal window
    in_window = df[(df["base_date_time"] >= t_start) & (df["base_date_time"] <= t_end)]

    # Pings before spill time (to feed predictor)
    before_spill = df[df["base_date_time"] <= spill_time]

    if len(before_spill) < 4:   # not enough history for prediction
        return None

    vessel_name = df["vessel_name"].iloc[-1] if "vessel_name" in df.columns else ""
    imo         = df["imo"].iloc[-1] if "imo" in df.columns else ""
    vtype       = df["vessel_type"].iloc[-1] if "vessel_type" in df.columns else 0
    risk        = VESSEL_TYPE_RISK.get(int(vtype) if pd.notna(vtype) else 0, 0.2)

    # ── Feature 1: Minimum observed proximity (km) ──
    obs_prox = min(
        haversine_km(row["latitude"], row["longitude"], spill_lat, spill_lon)
        for _, row in in_window.iterrows()
    ) if len(in_window) > 0 else float("inf")

    # ── Feature 2: Dark vessel flag ──
    times = df["base_date_time"].tolist()
    gaps  = [(times[i+1]-times[i]).total_seconds() for i in range(len(times)-1)]
    # Check for large gaps overlapping with the spill window
    dark_flag = 0
    for i, gap in enumerate(gaps):
        if gap > gap_threshold_s:
            gap_start = times[i]
            gap_end   = times[i+1]
            if gap_start <= t_end and gap_end >= t_start:
                dark_flag = 1
                break

    # ── Feature 3: Speed-drop score ──
    sog_vals = before_spill["sog"].dropna()
    if len(sog_vals) >= 4:
        med_sog  = sog_vals.median()
        min_sog  = sog_vals.tail(4).min()
        speed_drop = max(0.0, (med_sog - min_sog) / (med_sog + 1e-6))
    else:
        speed_drop = 0.0

    # ── Feature 4: Predicted path proximity ──
    feats   = build_trajectory_features(before_spill)
    result  = predict_vessel_path(model, feats, t_in, t_out, device)
    pred_prox = float("inf")
    if result is not None:
        lat0   = before_spill["latitude"].iloc[-1]
        lon0   = before_spill["longitude"].iloc[-1]
        d_lats, d_lons = result
        for dlat, dlon in zip(d_lats, d_lons):
            prox = haversine_km(lat0 + dlat, lon0 + dlon, spill_lat, spill_lon)
            pred_prox = min(pred_prox, prox)

    # ── Composite suspect score ──
    prox_score = max(0.0, 1.0 - min(obs_prox, pred_prox) / proximity_km)
    suspect_score = (
        0.35 * prox_score +
        0.25 * dark_flag +
        0.20 * risk +
        0.10 * speed_drop +
        0.10 * (1.0 if in_window is not None and len(in_window) > 0 else 0.0)
    )

    return {
        "mmsi":            mmsi,
        "vessel_name":     vessel_name,
        "imo":             imo,
        "vessel_type":     vtype,
        "vessel_risk":     round(risk, 2),
        "observed_prox_km": round(obs_prox, 2) if obs_prox != float("inf") else None,
        "predicted_prox_km":round(pred_prox, 2) if pred_prox != float("inf") else None,
        "in_window_pings": len(in_window),
        "dark_vessel_flag":dark_flag,
        "speed_drop_score":round(speed_drop, 3),
        "suspect_score":   round(min(suspect_score, 1.0), 4),
    }


# ── Main scoring function ──────────────────────────────────────────────────────

def score_suspects(
    ais_file: str,
    spill_lat: float,
    spill_lon: float,
    spill_time: str,
    cfg: dict,
    top_k: int = 20,
    bbox: Optional[tuple] = None,
) -> pd.DataFrame:
    """
    Full attribution pipeline: load AIS, predict paths, rank suspects.

    Returns top_k vessels sorted by suspect_score descending.
    """
    device = torch.device("mps" if torch.backends.mps.is_available()
                          else "cuda" if torch.cuda.is_available()
                          else "cpu")
    s = cfg["stage3"]
    t_in, t_out = s["t_in"], s["t_out"]

    # Load model
    model = build_ais_model(cfg).to(device)
    ckpt  = torch.load(
        Path(cfg["paths"]["results_dir"]) / s["checkpoint_name"],
        map_location=device
    )
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    print(f"[Suspect] Loaded predictor (epoch={ckpt.get('epoch','?')}, "
          f"val_hav={ckpt.get('val_hav_km',0):.2f} km)")

    spill_ts = pd.Timestamp(spill_time)

    # Stream AIS for the target region
    print(f"[Suspect] Streaming AIS file: {Path(ais_file).name}")
    accum: dict = {}
    with open(ais_file, "rb") as fh:
        dctx   = zstd.ZstdDecompressor()
        reader = dctx.stream_reader(fh)
        text   = io.TextIOWrapper(reader, "utf-8")
        for chunk in pd.read_csv(text, chunksize=100_000, low_memory=False):
            chunk["base_date_time"] = pd.to_datetime(chunk["base_date_time"], errors="coerce")
            chunk = chunk.dropna(subset=["latitude", "longitude", "mmsi"])
            if bbox:
                chunk = chunk[
                    (chunk["longitude"] >= bbox[0]) & (chunk["longitude"] <= bbox[2]) &
                    (chunk["latitude"]  >= bbox[1]) & (chunk["latitude"]  <= bbox[3])
                ]
            for mmsi, grp in chunk.groupby("mmsi"):
                accum.setdefault(mmsi, []).append(grp)

    print(f"[Suspect] {len(accum):,} vessels loaded")

    results = []
    for mmsi, parts in accum.items():
        df = pd.concat(parts).sort_values("base_date_time").reset_index(drop=True)
        if len(df) < MIN_PINGS:
            continue
        rec = score_vessel(
            mmsi, df, model, spill_lat, spill_lon, spill_ts,
            t_in, t_out, device,
            window_hours   = s.get("attribution_window_hours", 6.0),
            proximity_km   = s.get("attribution_radius_km", 50.0),
            gap_threshold_s= s.get("gap_threshold_s", 1800),
        )
        if rec:
            results.append(rec)

    df_out = pd.DataFrame(results).sort_values("suspect_score", ascending=False)
    return df_out.head(top_k).reset_index(drop=True)


# ── CLI entrypoint ────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="AIS Vessel Attribution")
    parser.add_argument("--ais",        type=str, required=True)
    parser.add_argument("--spill-lat",  type=float, required=True)
    parser.add_argument("--spill-lon",  type=float, required=True)
    parser.add_argument("--spill-time", type=str,   required=True)
    parser.add_argument("--config",     type=str,   default="ml/config.yaml")
    parser.add_argument("--top-k",      type=int,   default=20)
    parser.add_argument("--bbox",       type=float, nargs=4,
                        metavar=("LON_MIN","LAT_MIN","LON_MAX","LAT_MAX"),
                        default=None)
    parser.add_argument("--out",        type=str,   default="ml/results/suspect_report.csv")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    bbox = tuple(args.bbox) if args.bbox else None
    df   = score_suspects(
        ais_file   = args.ais,
        spill_lat  = args.spill_lat,
        spill_lon  = args.spill_lon,
        spill_time = args.spill_time,
        cfg        = cfg,
        top_k      = args.top_k,
        bbox       = bbox,
    )

    print(f"\n{'─'*80}")
    print(f"  TOP {len(df)} SUSPECT VESSELS")
    print(f"{'─'*80}")
    print(df.to_string(index=False))
    df.to_csv(args.out, index=False)
    print(f"\n  Saved → {args.out}")
