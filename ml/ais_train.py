"""
ais_train.py
────────────
Training loop for Stage 3: LSTM Seq2Seq vessel trajectory predictor.

Usage:
    python ml/ais_train.py
    python ml/ais_train.py --config ml/config.yaml

Outputs (all in ml/results/):
    trajectory_predictor.pt    ← best checkpoint (by val Haversine distance)
    ais_training_history.csv   ← per-epoch metrics
"""

from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import torch
import torch.nn as nn
import yaml
from tqdm import tqdm

from ais_dataset import build_ais_loaders
from ais_model import VesselTrajectoryPredictor, build_ais_model, build_ais_loss


# ── Device ────────────────────────────────────────────────────────────────────

def get_device(cfg: dict) -> torch.device:
    pref = cfg.get("device", "auto")
    if pref == "auto":
        if torch.backends.mps.is_available():
            return torch.device("mps")
        if torch.cuda.is_available():
            return torch.device("cuda")
        return torch.device("cpu")
    return torch.device(pref)


# ── Haversine metric (km) ─────────────────────────────────────────────────────

def haversine_km_batch(
    pred_lat: torch.Tensor, pred_lon: torch.Tensor,
    tgt_lat:  torch.Tensor, tgt_lon:  torch.Tensor,
    start_lat: float = 0.0, start_lon: float = 0.0,
) -> float:
    """
    Approximate mean Haversine distance (km) between predicted and target
    absolute positions, averaged over all timesteps in batch.
    """
    R = 6371.0
    dlat = torch.deg2rad(pred_lat - tgt_lat)
    dlon = torch.deg2rad(pred_lon - tgt_lon)
    lat_m = torch.deg2rad((pred_lat + tgt_lat) / 2.0)
    a = dlat**2 + (torch.cos(lat_m) * dlon)**2
    dist = R * torch.sqrt(a.clamp(min=0))
    return dist.mean().item()


# ── Early stopping ────────────────────────────────────────────────────────────

class EarlyStopping:
    def __init__(self, patience: int = 8, min_delta: float = 1e-5) -> None:
        self.patience  = patience
        self.min_delta = min_delta
        self.best      = float("inf")
        self.counter   = 0
        self.triggered = False

    def step(self, value: float) -> bool:
        improved = value < self.best - self.min_delta
        if improved:
            self.best    = value
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.triggered = True
        return improved


# ── One epoch ─────────────────────────────────────────────────────────────────

def run_epoch(
    model: VesselTrajectoryPredictor,
    loader,
    loss_fn: nn.Module,
    device: torch.device,
    t_out: int,
    optimizer=None,
    teacher_ratio: float = 0.0,
) -> dict[str, float]:
    is_train = optimizer is not None
    model.train() if is_train else model.eval()

    total_loss = 0.0
    total_hav  = 0.0
    n_batches  = 0

    ctx = torch.enable_grad() if is_train else torch.no_grad()
    with ctx:
        for src, tgt in tqdm(loader, desc="train" if is_train else "val  ", leave=False):
            src = src.to(device, non_blocking=True)
            tgt = tgt.to(device, non_blocking=True)

            if is_train:
                pred = model(src, t_out=t_out, teacher_input=tgt, teacher_ratio=teacher_ratio)
                loss = loss_fn(pred, tgt)
                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()
            else:
                pred = model.predict(src, t_out=t_out)
                loss = loss_fn(pred, tgt)

            hav = haversine_km_batch(pred[..., 0], pred[..., 1],
                                     tgt[...,  0], tgt[...,  1])
            total_loss += loss.item()
            total_hav  += hav
            n_batches  += 1

    return {
        "loss": total_loss / n_batches,
        "hav_km": total_hav / n_batches,
    }


# ── Main training loop ────────────────────────────────────────────────────────

def train(cfg: dict) -> None:
    torch.manual_seed(cfg["seed"])
    device = get_device(cfg)
    s      = cfg["stage3"]

    print(f"\n{'='*65}")
    print(f"  AegisOcean — Stage 3: AIS Trajectory Predictor")
    print(f"  Device: {device}")
    print(f"{'='*65}\n")

    train_loader, val_loader, test_loader = build_ais_loaders(cfg)

    model   = build_ais_model(cfg).to(device)
    loss_fn = build_ais_loss(cfg)

    optimizer = torch.optim.AdamW(
        model.parameters(), lr=s["lr"], weight_decay=s["weight_decay"]
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(
        optimizer, T_max=s["epochs"]
    )

    results_dir = Path(cfg["paths"]["results_dir"])
    results_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path   = results_dir / s["checkpoint_name"]
    history_csv = results_dir / "ais_training_history.csv"

    stopper = EarlyStopping(patience=s["early_stop_patience"])
    fieldnames = ["epoch", "train_loss", "train_hav_km",
                  "val_loss", "val_hav_km", "teacher_ratio", "lr"]
    csv_file = open(history_csv, "w", newline="")
    writer   = csv.DictWriter(csv_file, fieldnames=fieldnames)
    writer.writeheader()

    t_out = s["t_out"]
    best_hav = float("inf")

    for epoch in range(1, s["epochs"] + 1):
        t0 = time.time()
        # Teacher ratio: start high (0.7), decay to 0 over first half of training
        teacher_ratio = max(0.0, s["teacher_ratio_start"] * (1.0 - epoch / (s["epochs"] / 2)))

        train_m = run_epoch(model, train_loader, loss_fn, device, t_out,
                            optimizer, teacher_ratio=teacher_ratio)
        val_m   = run_epoch(model, val_loader, loss_fn, device, t_out)
        scheduler.step()

        lr      = optimizer.param_groups[0]["lr"]
        elapsed = time.time() - t0

        print(
            f"Epoch {epoch:3d}/{s['epochs']} | "
            f"Train loss={train_m['loss']:.4f}  hav={train_m['hav_km']:.3f}km | "
            f"Val   loss={val_m['loss']:.4f}  hav={val_m['hav_km']:.3f}km | "
            f"TR={teacher_ratio:.2f}  LR={lr:.2e} | {elapsed:.0f}s"
        )

        writer.writerow({
            "epoch":         epoch,
            "train_loss":    round(train_m["loss"],    6),
            "train_hav_km":  round(train_m["hav_km"],  4),
            "val_loss":      round(val_m["loss"],      6),
            "val_hav_km":    round(val_m["hav_km"],    4),
            "teacher_ratio": round(teacher_ratio,      4),
            "lr":            round(lr,                 8),
        })
        csv_file.flush()

        improved = stopper.step(val_m["hav_km"])
        if improved:
            best_hav = val_m["hav_km"]
            torch.save({
                "epoch":              epoch,
                "model_state_dict":   model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_hav_km":         val_m["hav_km"],
                "val_loss":           val_m["loss"],
                "cfg_stage3":         s,
            }, ckpt_path)
            print(f"  ✓ New best val Haversine: {val_m['hav_km']:.3f} km — saved")

        if stopper.triggered:
            print(f"\n  Early stopping at epoch {epoch}. Best val Hav: {best_hav:.3f} km")
            break

    csv_file.close()

    # ── Final test evaluation ──
    print(f"\n{'='*65}")
    print("  Running final evaluation on held-out test set...")
    ckpt = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    test_m = run_epoch(model, test_loader, loss_fn, device, t_out)

    print(f"\n  TEST RESULTS")
    print(f"  ─────────────────────────────")
    print(f"  Loss (Hav+MSE):  {test_m['loss']:.4f}")
    print(f"  Haversine dist:  {test_m['hav_km']:.3f} km")
    print(f"\n  Checkpoint → {ckpt_path}")
    print(f"  History    → {history_csv}")
    print(f"{'='*65}\n")


# ── Entrypoint ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys
    sys.path.insert(0, str(Path(__file__).parent))

    parser = argparse.ArgumentParser(description="Stage 3: AIS Trajectory Predictor")
    parser.add_argument("--config", type=str, default="ml/config.yaml")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    train(cfg)
