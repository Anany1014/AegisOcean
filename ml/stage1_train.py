"""
stage1_train.py
───────────────
Training loop for Stage 1: U-Net segmentation pretraining on the SOS dataset.

Usage:
    python ml/stage1_train.py
    python ml/stage1_train.py --config ml/config.yaml

Outputs:
    ml/results/sos_encoder.pt       ← encoder weights (used by Stage 2)
    ml/results/stage1_full.pt       ← full U-Net checkpoint (for inspection)
    ml/results/stage1_history.csv   ← per-epoch metrics log
"""

from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import torch
import torch.nn as nn
import yaml
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingLR
from torch.utils.data import DataLoader
from tqdm import tqdm

from stage1_dataset import build_sos_datasets
from stage1_model import (
    SARSegmentationModel,
    DiceBCELoss,
    build_stage1_model,
    build_stage1_loss,
    compute_iou,
    compute_dice,
)


# ── Device selection ─────────────────────────────────────────────────────────

def get_device(cfg: dict) -> torch.device:
    pref = cfg.get("device", "auto")
    if pref == "auto":
        if torch.backends.mps.is_available():
            return torch.device("mps")
        if torch.cuda.is_available():
            return torch.device("cuda")
        return torch.device("cpu")
    return torch.device(pref)


# ── Early stopping ────────────────────────────────────────────────────────────

class EarlyStopping:
    """Stop training when monitored metric stops improving."""

    def __init__(self, patience: int = 8, mode: str = "max", min_delta: float = 1e-4) -> None:
        self.patience  = patience
        self.mode      = mode
        self.min_delta = min_delta
        self.best      = float("-inf") if mode == "max" else float("inf")
        self.counter   = 0
        self.triggered = False

    def step(self, value: float) -> bool:
        improved = (
            value > self.best + self.min_delta if self.mode == "max"
            else value < self.best - self.min_delta
        )
        if improved:
            self.best    = value
            self.counter = 0
        else:
            self.counter += 1
            if self.counter >= self.patience:
                self.triggered = True
        return improved


# ── One epoch ────────────────────────────────────────────────────────────────

def run_epoch(
    model: nn.Module,
    loader: DataLoader,
    loss_fn: nn.Module,
    device: torch.device,
    optimizer: torch.optim.Optimizer | None = None,
    scaler: torch.cuda.amp.GradScaler | None = None,
) -> dict[str, float]:
    """
    Run one train or validation epoch.
    Pass optimizer=None for validation (eval mode).
    """
    is_train = optimizer is not None
    model.train() if is_train else model.eval()

    total_loss = 0.0
    total_iou  = 0.0
    total_dice = 0.0
    n_batches  = 0

    ctx = torch.enable_grad() if is_train else torch.no_grad()
    use_amp = (scaler is not None) and (device.type == "cuda")

    with ctx:
        for images, masks in tqdm(loader, desc="train" if is_train else "val ", leave=False):
            images = images.to(device, non_blocking=True)
            masks  = masks.to(device, non_blocking=True)

            if use_amp:
                with torch.cuda.amp.autocast():
                    logits = model(images)
                    loss   = loss_fn(logits, masks)
            else:
                logits = model(images)
                loss   = loss_fn(logits, masks)

            if is_train:
                optimizer.zero_grad()
                if use_amp:
                    scaler.scale(loss).backward()
                    scaler.step(optimizer)
                    scaler.update()
                else:
                    loss.backward()
                    optimizer.step()

            total_loss += loss.item()
            total_iou  += compute_iou(logits.detach(), masks).item()
            total_dice += compute_dice(logits.detach(), masks).item()
            n_batches  += 1

    return {
        "loss": total_loss / n_batches,
        "iou":  total_iou  / n_batches,
        "dice": total_dice / n_batches,
    }


# ── Main training loop ────────────────────────────────────────────────────────

def train(cfg: dict) -> None:
    torch.manual_seed(cfg["seed"])
    device = get_device(cfg)
    print(f"\n{'='*60}")
    print(f"  AegisOcean — Stage 1: SOS Segmentation Pretraining")
    print(f"  Device: {device}")
    print(f"{'='*60}\n")

    # ── Datasets & loaders ──
    train_ds, val_ds = build_sos_datasets(cfg)
    s = cfg["stage1"]

    train_loader = DataLoader(
        train_ds,
        batch_size=s["batch_size"],
        shuffle=True,
        num_workers=s["num_workers"],
        pin_memory=(device.type != "mps"),
        drop_last=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=s["batch_size"],
        shuffle=False,
        num_workers=s["num_workers"],
        pin_memory=(device.type != "mps"),
    )

    print(f"Train batches: {len(train_loader)} | Val batches: {len(val_loader)}")

    # ── Model, loss, optimiser, scheduler ──
    model   = build_stage1_model(cfg).to(device)
    loss_fn = build_stage1_loss(cfg)

    optimizer = AdamW(model.parameters(), lr=s["lr"], weight_decay=s["weight_decay"])
    scheduler = CosineAnnealingLR(optimizer, T_max=s["t_max"], eta_min=1e-6)

    # AMP only on CUDA
    scaler = torch.cuda.amp.GradScaler() if device.type == "cuda" else None

    # ── Paths ──
    results_dir = Path(cfg["paths"]["results_dir"])
    results_dir.mkdir(parents=True, exist_ok=True)
    ckpt_encoder = results_dir / cfg["stage1"]["checkpoint_name"]
    ckpt_full    = results_dir / "stage1_full.pt"
    history_csv  = results_dir / "stage1_history.csv"

    # ── Early stopping ──
    stopper = EarlyStopping(patience=s["early_stop_patience"], mode="max")

    # ── CSV logger ──
    csv_file = open(history_csv, "w", newline="")
    writer   = csv.DictWriter(csv_file, fieldnames=["epoch", "train_loss", "train_iou", "train_dice",
                                                     "val_loss", "val_iou", "val_dice", "lr"])
    writer.writeheader()

    best_val_iou = 0.0

    for epoch in range(1, s["epochs"] + 1):
        t0 = time.time()

        train_metrics = run_epoch(model, train_loader, loss_fn, device, optimizer, scaler)
        val_metrics   = run_epoch(model, val_loader,   loss_fn, device)

        scheduler.step()
        current_lr = scheduler.get_last_lr()[0]

        elapsed = time.time() - t0
        print(
            f"Epoch {epoch:3d}/{s['epochs']} | "
            f"Train  loss={train_metrics['loss']:.4f}  iou={train_metrics['iou']:.4f}  dice={train_metrics['dice']:.4f} | "
            f"Val    loss={val_metrics['loss']:.4f}  iou={val_metrics['iou']:.4f}  dice={val_metrics['dice']:.4f} | "
            f"LR={current_lr:.2e} | {elapsed:.0f}s"
        )

        # ── Log ──
        writer.writerow({
            "epoch": epoch,
            "train_loss": round(train_metrics["loss"], 6),
            "train_iou":  round(train_metrics["iou"],  6),
            "train_dice": round(train_metrics["dice"], 6),
            "val_loss":   round(val_metrics["loss"],   6),
            "val_iou":    round(val_metrics["iou"],    6),
            "val_dice":   round(val_metrics["dice"],   6),
            "lr":         round(current_lr, 8),
        })
        csv_file.flush()

        # ── Checkpoint best ──
        val_iou = val_metrics["iou"]
        improved = stopper.step(val_iou)
        if improved:
            best_val_iou = val_iou
            # Save encoder weights only → used by Stage 2
            torch.save(model.encoder_state_dict(), ckpt_encoder)
            # Save full model for inspection / continued training
            torch.save({
                "epoch":     epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_iou":   val_iou,
                "val_dice":  val_metrics["dice"],
            }, ckpt_full)
            print(f"  ✓ New best val IoU: {val_iou:.4f} — encoder saved to {ckpt_encoder}")

        # ── Target check ──
        if val_iou >= s["target_val_iou"] and val_metrics["dice"] >= s["target_val_dice"]:
            print(f"\n  ✓ Targets reached (IoU≥{s['target_val_iou']}, Dice≥{s['target_val_dice']})")

        # ── Early stopping ──
        if stopper.triggered:
            print(f"\n  Early stopping triggered at epoch {epoch}. Best val IoU: {best_val_iou:.4f}")
            break

    csv_file.close()
    print(f"\n{'='*60}")
    print(f"  Training complete. Best val IoU: {best_val_iou:.4f}")
    print(f"  Encoder saved → {ckpt_encoder}")
    print(f"  History  saved → {history_csv}")
    print(f"{'='*60}\n")


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stage 1: SOS Segmentation Pretraining")
    parser.add_argument("--config", type=str, default="ml/config.yaml", help="Path to config.yaml")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    train(cfg)
