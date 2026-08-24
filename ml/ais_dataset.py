"""
ais_dataset.py
──────────────
AIS vessel trajectory dataset loader for Stage 3.

Streams the .zst compressed AIS CSV without decompressing the full file to disk.
Builds fixed-length trajectory sequences per MMSI for LSTM training.

Features per timestep (9 total):
  lat_delta, lon_delta       — displacement from trajectory start (degrees)
  sog_norm                   — speed over ground, normalised 0-1 (max 30 kn)
  cog_sin, cog_cos           — course over ground encoded as unit circle
  time_delta_norm            — seconds since previous ping, normalised
  speed_change               — delta SOG between pings
  vessel_type_risk           — tanker=1.0, cargo=0.7, fishing=0.5, other=0.2
  gap_flag                   — 1 if AIS gap > GAP_THRESHOLD_S, else 0

The model is trained to predict T_out future positions from T_in past pings.
"""

from __future__ import annotations

import io
import math
import random
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
import torch
import zstandard as zstd
from torch.utils.data import Dataset, DataLoader

# ── Constants ─────────────────────────────────────────────────────────────────

VESSEL_TYPE_RISK = {
    # Tanker group (80–89)
    **{t: 1.0 for t in range(80, 90)},
    # Cargo group (70–79)
    **{t: 0.7 for t in range(70, 80)},
    # Fishing (30)
    30: 0.5,
    # Tug, Pilot, SAR (31, 50–53)
    31: 0.3, 50: 0.3, 51: 0.3, 52: 0.3, 53: 0.3,
    # Passenger (60–69)
    **{t: 0.2 for t in range(60, 70)},
}
DEFAULT_RISK = 0.2
MAX_SOG       = 30.0       # knots — cap for normalisation
GAP_THRESHOLD = 1800       # seconds — pings >30 min apart → dark vessel flag
MAX_TIME_DELTA = 7200      # seconds — cap for time-delta normalisation
MIN_PINGS     = 12         # minimum pings per vessel to use for training


# ── Feature engineering helpers ────────────────────────────────────────────────

def _vessel_risk(vtype) -> float:
    try:
        return VESSEL_TYPE_RISK.get(int(vtype), DEFAULT_RISK)
    except (ValueError, TypeError):
        return DEFAULT_RISK


def build_trajectory_features(df: pd.DataFrame) -> np.ndarray:
    """
    Given a per-MMSI sorted DataFrame, return a (N, 9) feature array.

    Columns: lat_delta, lon_delta, sog_norm, cog_sin, cog_cos,
             time_delta_norm, speed_change, vessel_type_risk, gap_flag
    """
    df = df.sort_values("base_date_time").reset_index(drop=True)
    df["base_date_time"] = pd.to_datetime(df["base_date_time"])

    n      = len(df)
    feats  = np.zeros((n, 9), dtype=np.float32)
    risk   = _vessel_risk(df["vessel_type"].iloc[0])

    lat0 = df["latitude"].iloc[0]
    lon0 = df["longitude"].iloc[0]

    prev_sog  = float(df["sog"].iloc[0]) if pd.notna(df["sog"].iloc[0]) else 0.0
    prev_time = df["base_date_time"].iloc[0]

    for i, row in df.iterrows():
        sog = float(row["sog"]) if pd.notna(row["sog"]) else prev_sog
        cog = float(row["cog"]) if pd.notna(row["cog"]) else 0.0

        dt  = (row["base_date_time"] - prev_time).total_seconds()
        if i == 0:
            dt = 0.0

        feats[i, 0] = float(row["latitude"])  - lat0                    # lat_delta
        feats[i, 1] = float(row["longitude"]) - lon0                    # lon_delta
        feats[i, 2] = min(sog, MAX_SOG) / MAX_SOG                       # sog_norm
        feats[i, 3] = math.sin(math.radians(cog))                       # cog_sin
        feats[i, 4] = math.cos(math.radians(cog))                       # cog_cos
        feats[i, 5] = min(dt, MAX_TIME_DELTA) / MAX_TIME_DELTA          # time_delta_norm
        feats[i, 6] = (sog - prev_sog) / MAX_SOG                        # speed_change
        feats[i, 7] = risk                                               # vessel_type_risk
        feats[i, 8] = 1.0 if dt > GAP_THRESHOLD else 0.0               # gap_flag

        prev_sog  = sog
        prev_time = row["base_date_time"]

    return feats


# ── Streaming loader ───────────────────────────────────────────────────────────

def stream_ais_to_trajectories(
    zst_path: str,
    chunk_size: int = 100_000,
    bbox: Optional[tuple] = None,            # (lon_min, lat_min, lon_max, lat_max)
    min_pings: int = MIN_PINGS,
    max_vessels: Optional[int] = None,
    seed: int = 42,
) -> dict[int, np.ndarray]:
    """
    Stream the .zst AIS CSV and return a dict {mmsi: feature_array}.

    Args:
        zst_path:    Path to .csv.zst file.
        chunk_size:  Rows per streaming chunk.
        bbox:        Bounding box (lon_min, lat_min, lon_max, lat_max) to filter.
        min_pings:   Minimum pings per MMSI to keep.
        max_vessels: Cap on number of vessels (for fast dev iterations).
        seed:        Random seed for vessel sampling.
    """
    print(f"[AIS] Streaming {Path(zst_path).name} ...")
    accum: dict[int, list[pd.DataFrame]] = {}

    with open(zst_path, "rb") as fh:
        dctx   = zstd.ZstdDecompressor()
        reader = dctx.stream_reader(fh)
        text   = io.TextIOWrapper(reader, encoding="utf-8")

        for chunk in pd.read_csv(text, chunksize=chunk_size, low_memory=False):
            chunk["base_date_time"] = pd.to_datetime(
                chunk["base_date_time"], errors="coerce"
            )
            chunk = chunk.dropna(subset=["latitude", "longitude", "mmsi"])

            if bbox is not None:
                lon_min, lat_min, lon_max, lat_max = bbox
                chunk = chunk[
                    (chunk["longitude"] >= lon_min) & (chunk["longitude"] <= lon_max) &
                    (chunk["latitude"]  >= lat_min) & (chunk["latitude"]  <= lat_max)
                ]

            for mmsi, grp in chunk.groupby("mmsi"):
                accum.setdefault(mmsi, []).append(grp)

    trajectories: dict[int, np.ndarray] = {}
    for mmsi, parts in accum.items():
        df = pd.concat(parts).sort_values("base_date_time")
        if len(df) < min_pings:
            continue
        trajectories[mmsi] = build_trajectory_features(df)

    print(f"[AIS] Loaded {len(trajectories):,} vessels with ≥{min_pings} pings")

    if max_vessels and len(trajectories) > max_vessels:
        rng  = random.Random(seed)
        keys = rng.sample(list(trajectories.keys()), max_vessels)
        trajectories = {k: trajectories[k] for k in keys}
        print(f"[AIS] Sampled down to {max_vessels} vessels")

    return trajectories


# ── PyTorch Dataset ───────────────────────────────────────────────────────────

class TrajectoryDataset(Dataset):
    """
    Sliding-window dataset over vessel trajectories.

    Each sample: (src [T_in × 9], tgt [T_out × 3])
      where tgt = next T_out lat_delta, lon_delta, sog_norm values.
    """

    def __init__(
        self,
        trajectories: dict[int, np.ndarray],
        t_in: int  = 32,
        t_out: int = 8,
        stride: int = 4,
    ) -> None:
        self.t_in   = t_in
        self.t_out  = t_out
        self.stride = stride
        self.windows: list[tuple[np.ndarray, np.ndarray]] = []

        win_len = t_in + t_out
        for feats in trajectories.values():
            if len(feats) < win_len:
                continue
            for start in range(0, len(feats) - win_len + 1, stride):
                src = feats[start          : start + t_in]
                tgt = feats[start + t_in   : start + win_len, :3]  # lat, lon, sog
                self.windows.append((src, tgt))

        print(f"[TrajectoryDataset] {len(self.windows):,} windows "
              f"(T_in={t_in}, T_out={t_out}, stride={stride})")

    def __len__(self) -> int:
        return len(self.windows)

    def __getitem__(self, idx: int):
        src, tgt = self.windows[idx]
        return torch.from_numpy(src.copy()), torch.from_numpy(tgt.copy())


# ── Dataset splits + loaders ───────────────────────────────────────────────────

def build_ais_loaders(cfg: dict) -> tuple[DataLoader, DataLoader, DataLoader]:
    s = cfg["stage3"]

    trajectories = stream_ais_to_trajectories(
        zst_path   = cfg["paths"]["ais_file"],
        bbox       = tuple(s["train_bbox"]) if s.get("train_bbox") else None,
        min_pings  = s["min_pings"],
        max_vessels= s.get("max_vessels_train"),
        seed       = cfg["seed"],
    )

    # Split by MMSI 80/10/10
    mmsis = list(trajectories.keys())
    rng   = random.Random(cfg["seed"])
    rng.shuffle(mmsis)

    n = len(mmsis)
    n_train = int(n * 0.80)
    n_val   = int(n * 0.10)

    train_t = {m: trajectories[m] for m in mmsis[:n_train]}
    val_t   = {m: trajectories[m] for m in mmsis[n_train: n_train + n_val]}
    test_t  = {m: trajectories[m] for m in mmsis[n_train + n_val:]}

    t_in  = s["t_in"]
    t_out = s["t_out"]

    train_ds = TrajectoryDataset(train_t, t_in, t_out, stride=s["stride"])
    val_ds   = TrajectoryDataset(val_t,   t_in, t_out, stride=t_in)
    test_ds  = TrajectoryDataset(test_t,  t_in, t_out, stride=t_in)

    pin = torch.cuda.is_available()
    kw  = dict(pin_memory=pin, num_workers=s["num_workers"])

    return (
        DataLoader(train_ds, batch_size=s["batch_size"], shuffle=True,  **kw),
        DataLoader(val_ds,   batch_size=s["batch_size"], shuffle=False, **kw),
        DataLoader(test_ds,  batch_size=s["batch_size"], shuffle=False, **kw),
    )


# ── Smoke test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import yaml
    with open("ml/config.yaml") as f:
        cfg = yaml.safe_load(f)

    train_dl, val_dl, test_dl = build_ais_loaders(cfg)
    src, tgt = next(iter(train_dl))
    print(f"Batch src shape: {src.shape}  (B, T_in, 9)")
    print(f"Batch tgt shape: {tgt.shape}  (B, T_out, 3)")
