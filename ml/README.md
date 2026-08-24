# AegisOcean — ML Pipeline

Two-stage deep learning pipeline for detecting oil slicks in Sentinel-1 SAR satellite imagery.

## Architecture Overview

```
Stage 1: SOS Dataset → U-Net Pretraining      (SAR-native encoder)
                ↓  transfer encoder weights
Stage 2: CSIRO Dataset → Classifier Fine-tune  (binary chip classification)
                ↓
         Evaluate → F1, AUC-ROC, confusion matrix, PR curve
```

## Files

| File | Purpose |
|---|---|
| `config.yaml` | All hyperparameters for both stages |
| `stage1_dataset.py` | SOS segmentation dataset loader (image + mask pairs) |
| `stage1_model.py` | U-Net with EfficientNet-B2 encoder + Dice+BCE loss |
| `stage1_train.py` | Stage 1 training loop |
| `stage2_dataset.py` | CSIRO chip dataset loader (stratified split + weighted sampler) |
| `stage2_model.py` | SAR classifier (transfer from Stage 1 encoder) + Focal Loss |
| `stage2_train.py` | Stage 2 fine-tuning loop (warmup → full fine-tune) |
| `ais_dataset.py` | Streams `.zst` AIS data into sliding-window trajectory sequences |
| `ais_model.py` | Bidirectional LSTM Seq2Seq model with Bahdanau attention + Haversine loss |
| `ais_train.py` | Stage 3 trajectory predictor training loop with teacher forcing |
| `ais_suspect.py` | Vessel attribution engine linking slick events (from CSIRO metadata) to suspects |
| `evaluate.py` | Test metrics, ROC/PR curves, confusion matrix, optimal threshold |
| `characterise.py` | Slick geometry + age + look-alike confidence (no ML required) |
| `run_pipeline.py` | End-to-end orchestrator |
| `requirements_ml.txt` | Python dependencies |

## Setup

```bash
# Install dependencies
pip install -r ml/requirements_ml.txt

# Download the SOS dataset from Kaggle
kaggle datasets download bitsandlayers/sar-oil-spill-segmentation-dataset-sos
unzip sar-oil-spill-segmentation-dataset-sos.zip -d data/SOS
```

The CSIRO dataset is already at `data/2022-12-15_Blondeau-Patissier_David_57430v1/data/`.

## Training

```bash
# ── Full pipeline (Stage 1 → Stage 2 → Evaluate) ──────────────
python ml/run_pipeline.py

# ── Stage 2 only (SOS not downloaded yet) ──────────────────────
# Uses ImageNet encoder initialisation as fallback
python ml/run_pipeline.py --skip-stage1

# ── Stage 2 only (Stage 1 already trained) ─────────────────────
python ml/run_pipeline.py --stage2-only

# ── Stage 3 only (Train AIS vessel trajectory predictor) ───────
python ml/ais_train.py
# or
python ml/run_pipeline.py --stage3-only

# ── Vessel Attribution (Run suspect scoring against a spill) ──
python ml/ais_suspect.py \
  --ais ais-2025-01-01.csv.zst \
  --spill-lat 18.5 --spill-lon 72.8 \
  --spill-time "2025-01-01 12:00:00" \
  --bbox 60 5 100 25

# ── Evaluation only ─────────────────────────────────────────────
python ml/run_pipeline.py --eval-only
```

All scripts must be run from the **project root** (`AegisOcean/`):

```bash
cd /path/to/AegisOcean
python ml/run_pipeline.py
```

## Dataset Details

### SOS Dataset (Stage 1 — Pretraining)
- **Source**: [Kaggle: bitsandlayers/sar-oil-spill-segmentation-dataset-sos](https://www.kaggle.com/datasets/bitsandlayers/sar-oil-spill-segmentation-dataset-sos)
- **Task**: Pixel-level binary segmentation (image + mask)
- **Sensors**: ALOS PALSAR (Gulf of Mexico) + Sentinel-1A (Persian Gulf)
- **Size**: ~1.12 GB

### CSIRO Dataset (Stage 2 — Fine-tuning)
- **Source**: `data/2022-12-15_Blondeau-Patissier_David_57430v1/data/`
- **Task**: Binary chip classification (0 = no oil, 1 = oil)
- **Total**: 5,630 chips — Class 0: 3,725 (66%), Class 1: 1,905 (34%)
- **Split**: Stratified 70 / 15 / 15 (train / val / test), seed=42

## Outputs

After training, results are saved to `ml/results/`:

```
ml/results/
├── sos_encoder.pt          ← Stage 1 encoder weights
├── stage1_full.pt          ← Full U-Net checkpoint
├── stage1_history.csv      ← Epoch-level Stage 1 metrics
├── best_classifier.pt      ← Best Stage 2 classifier (by val F1)
├── stage2_history.csv      ← Epoch-level Stage 2 metrics
├── classification_report.txt
└── plots/
    ├── confusion_matrix.png
    ├── roc_curve.png
    ├── pr_curve.png
    └── score_distribution.png
```

## Target Metrics

| Stage | Metric | Target |
|---|---|---|
| Stage 1 | Val IoU | ≥ 0.70 |
| Stage 1 | Val Dice | ≥ 0.75 |
| Stage 2 | Val F1 (oil) | ≥ 0.87 |
| Stage 2 | Val AUC-ROC | ≥ 0.92 |

## Device Support

Training automatically selects the best available device:
- **Apple Silicon**: MPS (`torch.device("mps")`)
- **CUDA GPU**: CUDA with AMP mixed precision
- **CPU**: Falls back gracefully

Override in `config.yaml`: `device: cpu` / `device: cuda` / `device: mps`

## Slick Characterisation

The `characterise.py` module is a standalone utility (no ML, no GPU needed) that computes geometric and physical slick properties from a GeoJSON polygon:

```python
from ml.characterise import characterise_slick

result = characterise_slick(
    polygon_coords=[[72.82, 19.10], [72.85, 19.13], ...],
    wind_speed_ms=4.5,          # from ERA5 / weather forecast
    backscatter_mean=-14.2,     # from SAR product metadata (optional)
)
# Returns: area, perimeter, PAR, centroid, elongation,
#          estimated age, Bonn Agreement code, look-alike confidence
```
