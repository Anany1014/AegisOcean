"""
stage1_dataset.py
─────────────────
SOS (SAR Oil Spill Segmentation) Dataset loader for Stage 1 pretraining.

Supports two common Kaggle SOS folder layouts:
  Layout A (split folders):
      data/SOS/
      ├── train/images/  + train/masks/
      └── val/images/    + val/masks/

  Layout B (flat + auto-split):
      data/SOS/
      ├── images/
      └── masks/

Images and masks are expected to be grayscale (1-channel) JPEG or PNG.
Masks are binary: 255 = oil, 0 = background  (or 1/0 — both handled).
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, Optional, Tuple

import cv2
import numpy as np
import albumentations as A
from albumentations.pytorch import ToTensorV2
from torch.utils.data import Dataset, random_split
import torch


# ── Helpers ───────────────────────────────────────────────────────────────────

def _collect_pairs(img_dir: Path, mask_dir: Path) -> list[tuple[Path, Path]]:
    """Collect (image_path, mask_path) pairs matching by stem."""
    img_exts = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
    pairs = []
    for img_path in sorted(img_dir.iterdir()):
        if img_path.suffix.lower() not in img_exts:
            continue
        # Try to find mask with same stem, any extension
        for ext in img_exts:
            mask_path = mask_dir / (img_path.stem + ext)
            if mask_path.exists():
                pairs.append((img_path, mask_path))
                break
    return pairs


def build_stage1_transforms(cfg: dict, split: str) -> A.Compose:
    """
    Build albumentations transform pipeline for Stage 1 (segmentation).
    Both image and mask are passed through the same spatial transforms.
    """
    aug = cfg["stage1"]["augment"]
    size = cfg["stage1"]["image_size"]

    if split == "train":
        return A.Compose([
            A.Resize(size, size),
            A.HorizontalFlip(p=aug["hflip_prob"]),
            A.VerticalFlip(p=aug["vflip_prob"]),
            A.Rotate(limit=aug["rotate_limit"], p=0.5,
                     border_mode=cv2.BORDER_REFLECT),
            A.ElasticTransform(
                alpha=aug["elastic_alpha"],
                sigma=aug["elastic_sigma"],
                p=0.3,
            ),
            A.RandomBrightnessContrast(
                brightness_limit=aug["brightness_limit"],
                contrast_limit=aug["contrast_limit"],
                p=0.5,
            ),
            A.GaussNoise(var_limit=(0, aug["gauss_noise_var"] * 255 ** 2), p=0.4),
            A.Normalize(mean=[0.0], std=[1.0]),   # keep in [0,1], normalised per-image below
            ToTensorV2(),
        ])
    else:
        return A.Compose([
            A.Resize(size, size),
            A.Normalize(mean=[0.0], std=[1.0]),
            ToTensorV2(),
        ])


# ── Dataset ───────────────────────────────────────────────────────────────────

class SOSDataset(Dataset):
    """
    Loads SAR image + binary mask pairs for segmentation pretraining.

    Args:
        pairs:      List of (image_path, mask_path) tuples.
        transform:  Albumentations Compose pipeline (spatial + image transforms).
    """

    def __init__(
        self,
        pairs: list[tuple[Path, Path]],
        transform: Optional[A.Compose] = None,
    ) -> None:
        self.pairs = pairs
        self.transform = transform

    # ── length ────────────────────────────────────────────────────────────────

    def __len__(self) -> int:
        return len(self.pairs)

    # ── item ──────────────────────────────────────────────────────────────────

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path, mask_path = self.pairs[idx]

        # Load as grayscale (1-channel)
        image = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        mask  = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)

        if image is None:
            raise FileNotFoundError(f"Could not read image: {img_path}")
        if mask is None:
            raise FileNotFoundError(f"Could not read mask: {mask_path}")

        # Normalise image to [0, 1] float32
        image = image.astype(np.float32) / 255.0

        # Binarise mask: values > 0 → 1, else → 0
        mask = (mask > 0).astype(np.float32)

        if self.transform:
            # Albumentations expects HWC for images; mask is HW
            augmented = self.transform(image=image[..., np.newaxis], mask=mask)
            image = augmented["image"]   # shape: [1, H, W] after ToTensorV2
            mask  = augmented["mask"]    # shape: [H, W]
            mask  = mask.unsqueeze(0)    # → [1, H, W] for BCEWithLogitsLoss
        else:
            image = torch.from_numpy(image).unsqueeze(0)   # [1, H, W]
            mask  = torch.from_numpy(mask).unsqueeze(0)    # [1, H, W]

        return image, mask


# ── Factory ───────────────────────────────────────────────────────────────────

def build_sos_datasets(
    cfg: dict,
) -> tuple[SOSDataset, SOSDataset]:
    """
    Build train and val SOSDataset objects.

    Automatically detects Layout A (pre-split) vs Layout B (flat).
    Returns (train_dataset, val_dataset).
    """
    root = Path(cfg["paths"]["sos_data_root"])

    # ── Layout A: pre-split directories ──
    if (root / "train" / "images").exists():
        train_pairs = _collect_pairs(root / "train" / "images", root / "train" / "masks")
        val_pairs   = _collect_pairs(root / "val"   / "images", root / "val"   / "masks")
        print(f"[SOSDataset] Layout A detected. train={len(train_pairs)}, val={len(val_pairs)}")

    # ── Layout B: flat directories, auto-split ──
    elif (root / "images").exists():
        all_pairs  = _collect_pairs(root / "images", root / "masks")
        val_frac   = cfg["stage1"]["val_split"]
        n_val      = int(len(all_pairs) * val_frac)
        n_train    = len(all_pairs) - n_val
        # Deterministic split using Generator seeded with config seed
        gen = torch.Generator().manual_seed(cfg["seed"])
        train_subset, val_subset = random_split(all_pairs, [n_train, n_val], generator=gen)
        train_pairs = [all_pairs[i] for i in train_subset.indices]
        val_pairs   = [all_pairs[i] for i in val_subset.indices]
        print(f"[SOSDataset] Layout B detected. train={len(train_pairs)}, val={len(val_pairs)}")

    else:
        raise FileNotFoundError(
            f"SOS dataset not found at '{root}'.\n"
            "Expected one of:\n"
            "  Layout A: {root}/train/images/ + {root}/train/masks/\n"
            "  Layout B: {root}/images/ + {root}/masks/"
        )

    train_tf = build_stage1_transforms(cfg, "train")
    val_tf   = build_stage1_transforms(cfg, "val")

    return SOSDataset(train_pairs, train_tf), SOSDataset(val_pairs, val_tf)


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import yaml, sys

    cfg_path = Path(__file__).parent / "config.yaml"
    with open(cfg_path) as f:
        cfg = yaml.safe_load(f)

    train_ds, val_ds = build_sos_datasets(cfg)
    print(f"Train: {len(train_ds)} samples | Val: {len(val_ds)} samples")

    img, mask = train_ds[0]
    print(f"Image shape: {img.shape} | dtype: {img.dtype} | range: [{img.min():.3f}, {img.max():.3f}]")
    print(f"Mask  shape: {mask.shape} | unique values: {mask.unique()}")
