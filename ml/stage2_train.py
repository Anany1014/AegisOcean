"""
stage2_train.py
───────────────
Training loop for Stage 2: binary SAR chip classifier fine-tuning on CSIRO dataset.

Two-phase training:
  Phase A (epochs 1..warmup_epochs):  encoder FROZEN — only head trains
  Phase B (epochs warmup+1..N):       encoder UNFROZEN — differential LR

Usage:
    python ml/stage2_train.py
    python ml/stage2_train.py --config ml/config.yaml

Outputs:
    ml/results/best_classifier.pt    ← best model checkpoint (by val F1)
    ml/results/stage2_history.csv    ← per-epoch metrics log
"""

from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import torch
import torch.nn as nn
import yaml
from sklearn.metrics import f1_score, roc_auc_score, precision_score, recall_score
from torch.optim import AdamW
from torch.optim.lr_scheduler import CosineAnnealingWarmRestarts
from tqdm import tqdm

from stage2_dataset import build_stage2_loaders
from stage2_model import SARClassifier, build_stage2_model, build_stage2_loss


# ── Device ───────────────────────────────────────────────────────────────────

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
    def __init__(self, patience: int = 10, min_delta: float = 1e-4) -> None:
        self.patience  = patience
        self.min_delta = min_delta
        self.best      = float("-inf")
        self.counter   = 0
        self.triggered = False

    def step(self, value: float) -> bool:
        if value > self.best + self.min_delta:
            self.best    = value
            self.counter = 0
            return True
        self.counter += 1
        if self.counter >= self.patience:
            self.triggered = True
        return False


# ── One epoch ────────────────────────────────────────────────────────────────

def run_epoch(
    model: nn.Module,
    loader,
    loss_fn: nn.Module,
    device: torch.device,
    optimizer=None,
    threshold: float = 0.5,
) -> dict[str, float]:
    """
    Run one train or val epoch.
    Returns loss, accuracy, precision, recall, f1, auc_roc.
    """
    is_train = optimizer is not None
    model.train() if is_train else model.eval()

    all_logits: list[float] = []
    all_labels: list[int]   = []
    total_loss = 0.0
    n_batches  = 0

    ctx = torch.enable_grad() if is_train else torch.no_grad()
    with ctx:
        for images, labels in tqdm(loader, desc="train" if is_train else "val  ", leave=False):
            images = images.to(device, non_blocking=True)
            labels = labels.unsqueeze(1).to(device, non_blocking=True)

            logits = model(images)
            loss   = loss_fn(logits, labels)

            if is_train:
                optimizer.zero_grad()
                loss.backward()
                nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
                optimizer.step()

            total_loss   += loss.item()
            n_batches    += 1
            all_logits.extend(logits.detach().cpu().squeeze(1).tolist())
            all_labels.extend(labels.detach().cpu().squeeze(1).int().tolist())

    # ── Metrics ──
    probs = torch.sigmoid(torch.tensor(all_logits)).numpy()
    preds = (probs > threshold).astype(int)

    return {
        "loss":      total_loss / n_batches,
        "accuracy":  float((preds == all_labels).mean()),   # type: ignore[arg-type]
        "precision": float(precision_score(all_labels, preds, zero_division=0)),
        "recall":    float(recall_score(all_labels, preds, zero_division=0)),
        "f1":        float(f1_score(all_labels, preds, zero_division=0)),
        "auc_roc":   float(roc_auc_score(all_labels, probs)),
    }


# ── Main training loop ────────────────────────────────────────────────────────

def train(cfg: dict) -> None:
    torch.manual_seed(cfg["seed"])
    device = get_device(cfg)
    s = cfg["stage2"]

    # Inject in_channels from stage1 config
    s["in_channels"] = cfg["stage1"]["in_channels"]

    print(f"\n{'='*65}")
    print(f"  AegisOcean — Stage 2: CSIRO Chip Classification Fine-tuning")
    print(f"  Device: {device}")
    print(f"{'='*65}\n")

    # ── Data loaders ──
    train_loader, val_loader, test_loader = build_stage2_loaders(cfg)

    # ── Model + loss ──
    model   = build_stage2_model(cfg).to(device)
    loss_fn = build_stage2_loss(cfg, device)

    # ── Phase A: freeze encoder, train head only ──
    model.freeze_encoder()
    head_params = [p for p in model.parameters() if p.requires_grad]
    optimizer   = AdamW(head_params, lr=s["lr"], weight_decay=s["weight_decay"])
    scheduler   = CosineAnnealingWarmRestarts(optimizer, T_0=s["t_0"])

    # ── Paths ──
    results_dir = Path(cfg["paths"]["results_dir"])
    results_dir.mkdir(parents=True, exist_ok=True)
    ckpt_path   = results_dir / s["checkpoint_name"]
    history_csv = results_dir / "stage2_history.csv"

    stopper = EarlyStopping(patience=s["early_stop_patience"])

    fieldnames = ["epoch", "phase",
                  "train_loss", "train_acc", "train_prec", "train_rec", "train_f1", "train_auc",
                  "val_loss",   "val_acc",   "val_prec",   "val_rec",   "val_f1",   "val_auc",
                  "lr_head"]
    csv_file = open(history_csv, "w", newline="")
    writer   = csv.DictWriter(csv_file, fieldnames=fieldnames)
    writer.writeheader()

    best_val_f1 = 0.0

    for epoch in range(1, s["epochs"] + 1):
        t0 = time.time()

        # ── Phase transition: unfreeze encoder after warmup ──
        if epoch == s["warmup_epochs"] + 1:
            model.unfreeze_encoder()
            param_groups = model.get_param_groups(s["lr"], s["encoder_lr_scale"])
            optimizer    = AdamW(param_groups, weight_decay=s["weight_decay"])
            scheduler    = CosineAnnealingWarmRestarts(optimizer, T_0=s["t_0"])
            print(f"\n  → Phase B: encoder unfrozen at epoch {epoch} (encoder LR={s['lr']*s['encoder_lr_scale']:.2e})")

        phase = "A-warmup" if epoch <= s["warmup_epochs"] else "B-finetune"

        train_m = run_epoch(model, train_loader, loss_fn, device, optimizer)
        val_m   = run_epoch(model, val_loader,   loss_fn, device)

        scheduler.step(epoch)
        current_lr = optimizer.param_groups[0]["lr"]
        elapsed    = time.time() - t0

        print(
            f"Epoch {epoch:3d}/{s['epochs']} [{phase}] | "
            f"Train  loss={train_m['loss']:.4f}  f1={train_m['f1']:.4f}  auc={train_m['auc_roc']:.4f} | "
            f"Val    loss={val_m['loss']:.4f}  f1={val_m['f1']:.4f}  auc={val_m['auc_roc']:.4f} | "
            f"LR={current_lr:.2e} | {elapsed:.0f}s"
        )

        writer.writerow({
            "epoch": epoch, "phase": phase,
            "train_loss":  round(train_m["loss"],      6),
            "train_acc":   round(train_m["accuracy"],  6),
            "train_prec":  round(train_m["precision"], 6),
            "train_rec":   round(train_m["recall"],    6),
            "train_f1":    round(train_m["f1"],        6),
            "train_auc":   round(train_m["auc_roc"],   6),
            "val_loss":    round(val_m["loss"],        6),
            "val_acc":     round(val_m["accuracy"],    6),
            "val_prec":    round(val_m["precision"],   6),
            "val_rec":     round(val_m["recall"],      6),
            "val_f1":      round(val_m["f1"],          6),
            "val_auc":     round(val_m["auc_roc"],     6),
            "lr_head":     round(current_lr, 8),
        })
        csv_file.flush()

        # ── Checkpoint on best val F1 ──
        improved = stopper.step(val_m["f1"])
        if improved:
            best_val_f1 = val_m["f1"]
            torch.save({
                "epoch":      epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_f1":     val_m["f1"],
                "val_auc":    val_m["auc_roc"],
                "val_recall": val_m["recall"],
            }, ckpt_path)
            print(f"  ✓ New best val F1: {val_m['f1']:.4f}  (AUC: {val_m['auc_roc']:.4f}) — saved")

        # ── Target check ──
        if val_m["f1"] >= s["target_val_f1"] and val_m["auc_roc"] >= s["target_val_auc"]:
            print(f"\n  ✓ Targets reached (F1≥{s['target_val_f1']}, AUC≥{s['target_val_auc']})")

        if stopper.triggered:
            print(f"\n  Early stopping at epoch {epoch}. Best val F1: {best_val_f1:.4f}")
            break

    csv_file.close()

    # ── Final test evaluation ──
    print(f"\n{'='*65}")
    print("  Running final evaluation on held-out test set...")
    print(f"{'='*65}")

    # Load best checkpoint
    ckpt = torch.load(ckpt_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    test_m = run_epoch(model, test_loader, loss_fn, device)

    print(f"\n  TEST RESULTS")
    print(f"  ─────────────────────────────")
    print(f"  Loss:      {test_m['loss']:.4f}")
    print(f"  Accuracy:  {test_m['accuracy']:.4f}")
    print(f"  Precision: {test_m['precision']:.4f}")
    print(f"  Recall:    {test_m['recall']:.4f}")
    print(f"  F1 (oil):  {test_m['f1']:.4f}")
    print(f"  AUC-ROC:   {test_m['auc_roc']:.4f}")
    print(f"\n  Checkpoint → {ckpt_path}")
    print(f"  History    → {history_csv}")
    print(f"{'='*65}\n")


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stage 2: CSIRO Chip Classifier Fine-tuning")
    parser.add_argument("--config", type=str, default="ml/config.yaml")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    train(cfg)
