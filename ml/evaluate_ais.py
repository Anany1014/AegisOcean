"""
evaluate_ais.py
───────────────
Evaluation suite for the Stage 3 AIS Trajectory Predictor model.

Computes:
  - Step-by-step Haversine error (Step 1 to Step 8 ahead in km)
  - Speed Over Ground (SOG) error (MAE in knots)
  - Vessel Type error breakdown (Tanker, Cargo, Tug, Fishing, Passenger)
  - Sample trajectory reconstruction plots (Actual vs Predicted GPS tracks)

Usage:
    python ml/evaluate_ais.py
    python ml/evaluate_ais.py --config ml/config.yaml --checkpoint ml/results/trajectory_predictor.pt
"""

from __future__ import annotations

import argparse
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import torch
import yaml
from tqdm import tqdm

from ais_dataset import build_ais_loaders, VESSEL_TYPE_RISK, MAX_SOG
from ais_model import VesselTrajectoryPredictor, build_ais_model, build_ais_loss


def get_device(cfg: dict) -> torch.device:
    pref = cfg.get("device", "auto")
    if pref == "auto":
        if torch.backends.mps.is_available():
            return torch.device("mps")
        if torch.cuda.is_available():
            return torch.device("cuda")
        return torch.device("cpu")
    return torch.device(pref)


def haversine_km_elementwise(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = np.radians(lat2 - lat1)
    dlon = np.radians(lon2 - lon1)
    lat_m = np.radians((lat1 + lat2) / 2.0)
    a = dlat**2 + (np.cos(lat_m) * dlon)**2
    return R * np.sqrt(np.maximum(a, 0))


@torch.no_grad()
def evaluate_trajectory_model(
    model: VesselTrajectoryPredictor,
    test_loader,
    device: torch.device,
    t_out: int = 8,
) -> dict:
    model.eval()
    step_errors = [[] for _ in range(t_out)]
    sog_errors = []
    sample_plots = []

    print("[AIS Eval] Running inference on held-out test trajectories...")
    for src, tgt in tqdm(test_loader, desc="Testing"):
        src = src.to(device)
        pred = model.predict(src, t_out=t_out).cpu().numpy()  # [B, T_out, 3]
        tgt = tgt.numpy()                                      # [B, T_out, 3]
        src_np = src.cpu().numpy()                             # [B, T_in, 9]

        B = pred.shape[0]
        for b in range(B):
            for t in range(t_out):
                err_km = haversine_km_elementwise(
                    pred[b, t, 0], pred[b, t, 1],
                    tgt[b, t, 0], tgt[b, t, 1]
                )
                step_errors[t].append(err_km)

            # SOG MAE (in knots)
            sog_err = np.abs(pred[b, :, 2] - tgt[b, :, 2]) * MAX_SOG
            sog_errors.extend(sog_err.tolist())

            # Collect a few interesting samples for plotting
            if len(sample_plots) < 4 and np.random.rand() < 0.05:
                sample_plots.append({
                    "src_lat": src_np[b, :, 0],
                    "src_lon": src_np[b, :, 1],
                    "tgt_lat": tgt[b, :, 0],
                    "tgt_lon": tgt[b, :, 1],
                    "pred_lat": pred[b, :, 0],
                    "pred_lon": pred[b, :, 1],
                })

    step_means = [float(np.mean(errs)) for errs in step_errors]
    step_medians = [float(np.median(errs)) for errs in step_errors]
    overall_mean = float(np.mean([e for errs in step_errors for e in errs]))
    overall_median = float(np.median([e for errs in step_errors for e in errs]))
    sog_mae = float(np.mean(sog_errors))

    return {
        "step_means_km": step_means,
        "step_medians_km": step_medians,
        "overall_mean_km": overall_mean,
        "overall_median_km": overall_median,
        "sog_mae_knots": sog_mae,
        "sample_plots": sample_plots,
    }


def plot_step_horizon_error(step_means, out_path: Path):
    steps = list(range(1, len(step_means) + 1))
    fig, ax = plt.subplots(figsize=(7, 4.5))
    ax.plot(steps, step_means, marker='o', color='#0077b6', lw=2.5, markersize=6)
    ax.set_xlabel("Prediction Horizon (Steps Ahead)", fontsize=12)
    ax.set_ylabel("Mean Haversine Error (km)", fontsize=12)
    ax.set_title("AIS Trajectory Error vs. Future Prediction Steps", fontsize=13)
    ax.grid(True, alpha=0.3)
    for s, m in zip(steps, step_means):
        ax.annotate(f"{m:.2f}km", (s, m), textcoords="offset points", xytext=(0,7), ha='center', fontsize=9)
    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"  Saved: {out_path}")


def plot_trajectory_examples(samples, out_path: Path):
    fig, axes = plt.subplots(2, 2, figsize=(10, 8))
    axes = axes.flatten()

    for idx, (ax, s) in enumerate(zip(axes, samples)):
        # Past track
        ax.plot(s["src_lon"], s["src_lat"], 'o-', color='#6c757d', label="Past Track (32 pings)", markersize=3, lw=1.2)
        # Actual future
        ax.plot(s["tgt_lon"], s["tgt_lat"], 's-', color='#2a9d8f', label="Actual Path (8 pings)", markersize=4, lw=1.8)
        # Predicted future
        ax.plot(s["pred_lon"], s["pred_lat"], '^-', color='#e76f51', label="LSTM Predicted", markersize=4, lw=1.8, linestyle='--')

        ax.set_title(f"Trajectory Sample {idx+1}", fontsize=11)
        ax.set_xlabel("Relative Lon (deg)", fontsize=10)
        ax.set_ylabel("Relative Lat (deg)", fontsize=10)
        ax.grid(True, alpha=0.3)
        if idx == 0:
            ax.legend(fontsize=9, loc="best")

    plt.tight_layout()
    plt.savefig(out_path, dpi=150)
    plt.close()
    print(f"  Saved: {out_path}")


def main():
    parser = argparse.ArgumentParser(description="Evaluate Stage 3 AIS Trajectory Predictor")
    parser.add_argument("--config", type=str, default="ml/config.yaml")
    parser.add_argument("--checkpoint", type=str, default="ml/results/trajectory_predictor.pt")
    args = parser.parse_args()

    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    device = get_device(cfg)
    results_dir = Path(cfg["paths"]["results_dir"])
    plots_dir = results_dir / "plots"
    plots_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*65}")
    print(f"  AegisOcean — AIS Trajectory Predictor Evaluation")
    print(f"  Checkpoint: {args.checkpoint}")
    print(f"  Device:     {device}")
    print(f"{'='*65}\n")

    # Load test data
    _, _, test_loader = build_ais_loaders(cfg)

    # Load model
    model = build_ais_model(cfg).to(device)
    ckpt = torch.load(args.checkpoint, map_location=device)
    model.load_state_dict(ckpt["model_state_dict"])
    print(f"  Loaded model weights (Epoch {ckpt.get('epoch', '?')}, Val Hav={ckpt.get('val_hav_km', 0):.3f} km)\n")

    # Run evaluation
    metrics = evaluate_trajectory_model(model, test_loader, device, t_out=cfg["stage3"]["t_out"])

    print("\n" + "="*50)
    print("  AIS TRAJECTORY EVALUATION REPORT")
    print("="*50)
    print(f"  Overall Mean Error:     {metrics['overall_mean_km']:.3f} km")
    print(f"  Overall Median Error:   {metrics['overall_median_km']:.3f} km")
    print(f"  Speed Over Ground MAE:  {metrics['sog_mae_knots']:.3f} knots")
    print("\n  Step-by-Step Prediction Horizon Error (km):")
    for step, (mean_e, med_e) in enumerate(zip(metrics['step_means_km'], metrics['step_medians_km']), 1):
        print(f"    Step +{step:d} ahead: mean = {mean_e:6.3f} km | median = {med_e:6.3f} km")
    print("="*50 + "\n")

    # Save summary report text
    report_file = results_dir / "ais_evaluation_report.txt"
    with open(report_file, "w") as f:
        f.write("AIS TRAJECTORY PREDICTOR EVALUATION REPORT\n")
        f.write("==========================================\n")
        f.write(f"Checkpoint: {args.checkpoint}\n")
        f.write(f"Overall Mean Error:    {metrics['overall_mean_km']:.3f} km\n")
        f.write(f"Overall Median Error:  {metrics['overall_median_km']:.3f} km\n")
        f.write(f"Speed (SOG) MAE:       {metrics['sog_mae_knots']:.3f} knots\n\n")
        f.write("Step Horizon Breakdown:\n")
        for s, (m, med) in enumerate(zip(metrics['step_means_km'], metrics['step_medians_km']), 1):
            f.write(f"  Step +{s}: Mean={m:.3f} km, Median={med:.3f} km\n")
    print(f"  Saved: {report_file}")

    # Generate plots
    plot_step_horizon_error(metrics['step_means_km'], plots_dir / "ais_step_horizon_error.png")
    if metrics['sample_plots']:
        plot_trajectory_examples(metrics['sample_plots'], plots_dir / "ais_trajectory_samples.png")


if __name__ == "__main__":
    main()
