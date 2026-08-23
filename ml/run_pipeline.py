"""
run_pipeline.py
───────────────
End-to-end ML pipeline orchestrator for AegisOcean.

Runs Stage 1 → Stage 2 → Evaluation in sequence, or individual stages.

Usage:
    # Full pipeline (Stage 1 + Stage 2 + Eval)
    python ml/run_pipeline.py

    # Skip Stage 1 (SOS dataset not downloaded, use ImageNet init)
    python ml/run_pipeline.py --skip-stage1

    # Stage 2 only (if sos_encoder.pt already exists)
    python ml/run_pipeline.py --stage2-only

    # Evaluation only
    python ml/run_pipeline.py --eval-only

    # Custom config
    python ml/run_pipeline.py --config ml/config.yaml
"""

from __future__ import annotations

import argparse
import sys
import time
from pathlib import Path

import yaml


def print_banner(text: str, width: int = 65) -> None:
    print(f"\n{'█' * width}")
    print(f"  {text}")
    print(f"{'█' * width}\n")


def check_sos_dataset(cfg: dict) -> bool:
    """Check whether the SOS dataset is present in the expected location."""
    root = Path(cfg["paths"]["sos_data_root"])
    has_layout_a = (root / "train" / "images").exists()
    has_layout_b = (root / "images").exists()
    return has_layout_a or has_layout_b


def check_stage1_encoder(cfg: dict) -> bool:
    """Check whether Stage 1 encoder weights are available."""
    ckpt = Path(cfg["paths"]["results_dir"]) / cfg["stage1"]["checkpoint_name"]
    return ckpt.exists()


def run_stage1(cfg: dict) -> None:
    print_banner("STAGE 1 — SOS Segmentation Pretraining")
    from stage1_train import train
    train(cfg)


def run_stage2(cfg: dict) -> None:
    print_banner("STAGE 2 — CSIRO Chip Classification Fine-tuning")
    from stage2_train import train
    train(cfg)


def run_evaluation(cfg: dict) -> None:
    print_banner("EVALUATION — Test Set Metrics & Plots")
    from evaluate import evaluate
    ckpt_path = Path(cfg["paths"]["results_dir"]) / cfg["stage2"]["checkpoint_name"]
    evaluate(cfg, ckpt_path)


def run_characterise_demo(cfg: dict) -> None:
    """Quick demo of the characterisation engine on mock incident data."""
    print_banner("DEMO — Slick Characterisation")
    sys.path.insert(0, str(Path(__file__).parent))
    from characterise import characterise_slick

    polygon = [
        [72.82, 19.10], [72.85, 19.13], [72.88, 19.11],
        [72.86, 19.08], [72.83, 19.07], [72.82, 19.10],
    ]
    result = characterise_slick(polygon_coords=polygon, wind_speed_ms=4.5)
    print("  Slick Characterisation (inc-2026-003 mock geometry):")
    for k, v in result.items():
        print(f"    {k:30s}: {v}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AegisOcean ML Pipeline — Stage 1 → Stage 2 → Evaluate"
    )
    parser.add_argument("--config",       type=str,  default="ml/config.yaml")
    parser.add_argument("--skip-stage1",  action="store_true",
                        help="Skip Stage 1 (use ImageNet encoder init or existing sos_encoder.pt)")
    parser.add_argument("--stage2-only",  action="store_true",
                        help="Run Stage 2 fine-tuning only")
    parser.add_argument("--eval-only",    action="store_true",
                        help="Run evaluation only on existing best_classifier.pt")
    parser.add_argument("--demo-characterise", action="store_true",
                        help="Run slick characterisation demo")
    args = parser.parse_args()

    # ── Load config ──
    with open(args.config) as f:
        cfg = yaml.safe_load(f)

    # Inject in_channels for stage2 from stage1
    cfg["stage2"]["in_channels"] = cfg["stage1"]["in_channels"]

    t_start = time.time()

    # ── Evaluation only ──
    if args.eval_only:
        run_evaluation(cfg)
        return

    # ── Demo only ──
    if args.demo_characterise:
        run_characterise_demo(cfg)
        return

    # ── Stage 2 only ──
    if args.stage2_only:
        if not check_stage1_encoder(cfg):
            print("  ⚠  Stage 1 encoder not found. Running with ImageNet init.\n"
                  "     (Train Stage 1 first: python ml/run_pipeline.py)")
        run_stage2(cfg)
        run_evaluation(cfg)
        return

    # ── Full pipeline ──
    if not args.skip_stage1:
        if not check_sos_dataset(cfg):
            print(
                f"\n  ✗ SOS dataset not found at: {cfg['paths']['sos_data_root']}\n"
                f"\n  Download it first:\n"
                f"    kaggle datasets download bitsandlayers/sar-oil-spill-segmentation-dataset-sos\n"
                f"    unzip sar-oil-spill-segmentation-dataset-sos.zip -d data/SOS\n"
                f"\n  Then re-run, or use --skip-stage1 to go directly to Stage 2.\n"
            )
            sys.exit(1)
        run_stage1(cfg)
    else:
        print("  ↷ Stage 1 skipped (--skip-stage1 flag set).")
        if check_stage1_encoder(cfg):
            print(f"  ✓ Found existing encoder: {cfg['paths']['results_dir']}/{cfg['stage1']['checkpoint_name']}")
        else:
            print("  ⚠  No sos_encoder.pt found — Stage 2 will use ImageNet initialisation.")

    run_stage2(cfg)
    run_evaluation(cfg)

    total = time.time() - t_start
    print(f"\n  Total pipeline time: {total/3600:.1f}h ({total:.0f}s)")


if __name__ == "__main__":
    # Ensure ml/ directory is on path regardless of where script is called from
    sys.path.insert(0, str(Path(__file__).parent))
    main()
