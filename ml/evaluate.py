"""
evaluate.py
───────────
Post-training evaluation for the Stage 2 SAR chip classifier.

Generates:
  - Classification report (precision, recall, F1 per class)
  - Confusion matrix plot
  - ROC curve + AUC
  - Precision-Recall curve + AUC-PR
  - Optimal threshold via Youden's J statistic (maximises sensitivity + specificity)
  - Per-chip probability distribution plot

Usage:
    python ml/evaluate.py
    python ml/evaluate.py --config ml/config.yaml --checkpoint ml/results/best_classifier.pt
"""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")   # headless backend for saving figures
import matplotlib.pyplot as plt
import numpy as np
import torch
import yaml
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    roc_curve, auc,
    precision_recall_curve, average_precision_score,
)
from tqdm import tqdm
import seaborn as sns

from stage2_dataset import build_stage2_loaders
from stage2_model import build_stage2_model


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


# ── Inference ────────────────────────────────────────────────────────────────

@torch.no_grad()
def collect_predictions(
    model: torch.nn.Module,
    loader,
    device: torch.device,
) -> tuple[np.ndarray, np.ndarray]:
    """Run model on loader, return (probabilities, true_labels)."""
    model.eval()
    all_probs  = []
    all_labels = []

    for images, labels in tqdm(loader, desc="Inference"):
        images = images.to(device, non_blocking=True)
        logits = model(images)
        probs  = torch.sigmoid(logits).cpu().squeeze(1).numpy()
        all_probs.extend(probs.tolist())
        all_labels.extend(labels.int().tolist())

    return np.array(all_probs), np.array(all_labels)


# ── Optimal threshold ─────────────────────────────────────────────────────────

def youden_threshold(y_true: np.ndarray, y_prob: np.ndarray) -> float:
    """Find threshold that maximises Youden's J = Sensitivity + Specificity - 1."""
    fpr, tpr, thresholds = roc_curve(y_true, y_prob)
    j_scores = tpr - fpr
    best_idx = int(np.argmax(j_scores))
    return float(thresholds[best_idx])


# ── Plot helpers ──────────────────────────────────────────────────────────────

def plot_confusion_matrix(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    out_path: Path,
    threshold: float,
) -> None:
    cm = confusion_matrix(y_true, y_pred)
    fig, ax = plt.subplots(figsize=(6, 5))
    sns.heatmap(
        cm, annot=True, fmt="d", cmap="Blues",
        xticklabels=["No Oil (0)", "Oil (1)"],
        yticklabels=["No Oil (0)", "Oil (1)"],
        ax=ax,
    )
    ax.set_xlabel("Predicted", fontsize=12)
    ax.set_ylabel("True", fontsize=12)
    ax.set_title(f"Confusion Matrix (threshold={threshold:.3f})", fontsize=13)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"  Saved: {out_path}")


def plot_roc_curve(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    out_path: Path,
) -> float:
    fpr, tpr, _ = roc_curve(y_true, y_prob)
    roc_auc = auc(fpr, tpr)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, color="#00b4d8", lw=2, label=f"AUC = {roc_auc:.4f}")
    ax.plot([0, 1], [0, 1], color="gray", linestyle="--", lw=1)
    ax.set_xlabel("False Positive Rate", fontsize=12)
    ax.set_ylabel("True Positive Rate",  fontsize=12)
    ax.set_title("ROC Curve — SAR Oil Spill Classifier", fontsize=13)
    ax.legend(loc="lower right", fontsize=11)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"  Saved: {out_path}")
    return roc_auc


def plot_pr_curve(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    out_path: Path,
) -> float:
    precision, recall, _ = precision_recall_curve(y_true, y_prob)
    ap = average_precision_score(y_true, y_prob)
    baseline = y_true.mean()
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(recall, precision, color="#e76f51", lw=2, label=f"AP = {ap:.4f}")
    ax.axhline(baseline, color="gray", linestyle="--", lw=1, label=f"Baseline = {baseline:.3f}")
    ax.set_xlabel("Recall",    fontsize=12)
    ax.set_ylabel("Precision", fontsize=12)
    ax.set_title("Precision-Recall Curve — Oil Class", fontsize=13)
    ax.legend(fontsize=11)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"  Saved: {out_path}")
    return ap


def plot_score_distribution(
    y_true: np.ndarray,
    y_prob: np.ndarray,
    out_path: Path,
    threshold: float,
) -> None:
    fig, ax = plt.subplots(figsize=(8, 4))
    ax.hist(y_prob[y_true == 0], bins=50, alpha=0.6, color="#264653", label="Class 0 (No Oil)")
    ax.hist(y_prob[y_true == 1], bins=50, alpha=0.6, color="#e63946", label="Class 1 (Oil)")
    ax.axvline(threshold, color="gold", linestyle="--", lw=2, label=f"Threshold={threshold:.3f}")
    ax.set_xlabel("P(Oil | chip)", fontsize=12)
    ax.set_ylabel("Count", fontsize=12)
    ax.set_title("Model Score Distribution by Class", fontsize=13)
    ax.legend(fontsize=11)
    ax.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"  Saved: {out_path}")


# ── Main ─────────────────────────────────────────────────────────────────────

def evaluate(cfg: dict, checkpoint_path: Path) -> None:
    torch.manual_seed(cfg["seed"])
    device = get_device(cfg)
    s = cfg["stage2"]
    s["in_channels"] = cfg["stage1"]["in_channels"]

    results_dir = Path(cfg["paths"]["results_dir"])
    plots_dir   = results_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"  AegisOcean — Model Evaluation")
    print(f"  Checkpoint: {checkpoint_path}")
    print(f"  Device:     {device}")
    print(f"{'='*60}\n")

    # ── Load model ──
    model = build_stage2_model(cfg).to(device)
    ckpt  = torch.load(checkpoint_path, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    print(f"  Loaded checkpoint (epoch {ckpt.get('epoch', '?')}, "
          f"val F1={ckpt.get('val_f1', 0):.4f})\n")

    # ── Loaders ──
    _, val_loader, test_loader = build_stage2_loaders(cfg)

    # ── Collect val predictions for threshold optimisation ──
    print("  Computing optimal threshold on validation set...")
    val_probs, val_labels = collect_predictions(model, val_loader, device)
    best_threshold = youden_threshold(val_labels, val_probs)
    print(f"  Optimal threshold (Youden J): {best_threshold:.4f}\n")

    # ── Test set predictions ──
    print("  Running inference on test set...")
    test_probs, test_labels = collect_predictions(model, test_loader, device)
    test_preds = (test_probs > best_threshold).astype(int)

    # ── Classification report ──
    report = classification_report(
        test_labels, test_preds,
        target_names=["No Oil (0)", "Oil (1)"],
        digits=4,
    )
    print("\n  Classification Report (test set):\n")
    print(report)

    report_path = results_dir / "classification_report.txt"
    with open(report_path, "w") as f:
        f.write(f"Optimal threshold (Youden J): {best_threshold:.4f}\n\n")
        f.write(report)
    print(f"  Saved: {report_path}")

    # ── Plots ──
    plot_confusion_matrix(test_labels, test_preds, plots_dir / "confusion_matrix.png", best_threshold)
    roc_auc = plot_roc_curve(test_labels, test_probs, plots_dir / "roc_curve.png")
    ap      = plot_pr_curve(test_labels, test_probs, plots_dir / "pr_curve.png")
    plot_score_distribution(test_labels, test_probs, plots_dir / "score_distribution.png", best_threshold)

    print(f"\n  ─── Summary ───────────────────────────────")
    print(f"  Threshold (Youden J):  {best_threshold:.4f}")
    print(f"  AUC-ROC:               {roc_auc:.4f}")
    print(f"  Average Precision:     {ap:.4f}")
    print(f"  {'─'*43}\n")


# ── Entrypoint ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Stage 2 SAR classifier")
    parser.add_argument("--config",     type=str, default="ml/config.yaml")
    parser.add_argument("--checkpoint", type=str, default=None,
                        help="Path to checkpoint .pt file (default: from config)")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    ckpt_path = Path(args.checkpoint) if args.checkpoint else (
        Path(cfg["paths"]["results_dir"]) / cfg["stage2"]["checkpoint_name"]
    )

    evaluate(cfg, ckpt_path)
