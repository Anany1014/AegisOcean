"""
stage2_dataset.py
─────────────────
CSIRO SAR Oil Spill Dataset loader for Stage 2 classification fine-tuning.

Dataset layout (already present in the project):
    data/2022-12-15_.../data/
    ├── 0/   ← 3,725 chips (no oil: clean sea + look-alikes)
    └── 1/   ← 1,905 chips (oil features confirmed)

All chips are 400×400 px grayscale JPEG.
Filename format encodes region code, augmentation type, and class label.
Pre-augmented chips (slant/rotate/crop suffix) are treated as independent samples.

Split strategy:
  Stratified 70/15/15 train/val/test split (by class label).
  Uses sklearn.model_selection.train_test_split for reproducibility.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional, Tuple

import cv2
import math
import numpy as np
import torch
from torch.utils.data import Dataset, DataLoader, WeightedRandomSampler
import albumentations as A
from albumentations.pytorch import ToTensorV2
from sklearn.model_selection import train_test_split


# ── Transforms ───────────────────────────────────────────────────────────────

def build_stage2_transforms(cfg: dict, split: str) -> A.Compose:
    """
    Build augmentation pipeline for Stage 2 classification.
    SAR-appropriate: no colour jitter, light spatial augmentation only.
    """
    s   = cfg["stage2"]
    aug = s["augment"]
    sz  = s["image_size"]
    mean, std = s["mean"], s["std"]

    if split == "train":
        return A.Compose([
            A.Resize(sz, sz),
            A.HorizontalFlip(p=aug["hflip_prob"]),
            A.VerticalFlip(p=aug["vflip_prob"]),
            A.Rotate(limit=aug["rotate_limit"], p=0.5,
                     border_mode=cv2.BORDER_REFLECT),
            A.GaussNoise(std_range=(0, math.sqrt(aug["gauss_noise_var"])), p=0.4),
            A.Normalize(mean=mean, std=std),
            ToTensorV2(),
        ])
    else:
        return A.Compose([
            A.Resize(sz, sz),
            A.Normalize(mean=mean, std=std),
            ToTensorV2(),
        ])


# ── Dataset ───────────────────────────────────────────────────────────────────

class CSIRODataset(Dataset):
    """
    Binary chip classification dataset.

    Args:
        file_paths: List of absolute paths to chip JPEG files.
        labels:     Corresponding list of int labels (0 or 1).
        transform:  Albumentations Compose pipeline.
    """

    def __init__(
        self,
        file_paths: list[Path],
        labels: list[int],
        transform: Optional[A.Compose] = None,
    ) -> None:
        assert len(file_paths) == len(labels)
        self.file_paths = file_paths
        self.labels     = labels
        self.transform  = transform

    def __len__(self) -> int:
        return len(self.file_paths)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        img_path = self.file_paths[idx]
        label    = self.labels[idx]

        image = cv2.imread(str(img_path), cv2.IMREAD_GRAYSCALE)
        if image is None:
            raise FileNotFoundError(f"Could not read chip: {img_path}")

        image = image.astype(np.float32) / 255.0

        if self.transform:
            augmented = self.transform(image=image[..., np.newaxis])
            image = augmented["image"]     # [1, H, W] after ToTensorV2
        else:
            image = torch.from_numpy(image).unsqueeze(0)

        return image, torch.tensor(label, dtype=torch.float32)


# ── Weighted sampler ──────────────────────────────────────────────────────────

def build_weighted_sampler(labels: list[int]) -> WeightedRandomSampler:
    """
    Build a WeightedRandomSampler that up-samples the minority class (class 1).
    This corrects the 66/34 class imbalance during training.
    """
    class_counts = [labels.count(0), labels.count(1)]
    weights_per_class = [1.0 / c for c in class_counts]
    sample_weights = [weights_per_class[l] for l in labels]
    return WeightedRandomSampler(
        weights=torch.DoubleTensor(sample_weights),
        num_samples=len(sample_weights),
        replacement=True,
    )


# ── Factory ───────────────────────────────────────────────────────────────────

def build_csiro_datasets(
    cfg: dict,
) -> tuple[CSIRODataset, CSIRODataset, CSIRODataset]:
    """
    Collect all chips from class 0/ and class 1/ directories.
    Apply stratified 70/15/15 split.
    Returns (train_dataset, val_dataset, test_dataset).
    """
    root = Path(cfg["paths"]["csiro_data_root"])
    s    = cfg["stage2"]

    all_paths: list[Path] = []
    all_labels: list[int] = []

    for cls in [0, 1]:
        cls_dir = root / str(cls)
        if not cls_dir.exists():
            raise FileNotFoundError(f"Class directory not found: {cls_dir}")
        chips = sorted([p for p in cls_dir.iterdir() if p.suffix.lower() in {".jpg", ".jpeg"}])
        all_paths.extend(chips)
        all_labels.extend([cls] * len(chips))

    print(f"[CSIRODataset] Total chips: {len(all_paths)} "
          f"(class 0: {all_labels.count(0)}, class 1: {all_labels.count(1)})")

    seed = cfg["seed"]
    test_frac = s["test_split"]
    val_frac  = s["val_split"] / (1.0 - test_frac)    # val fraction of train+val

    # First split: train+val vs test
    paths_tv, paths_test, labels_tv, labels_test = train_test_split(
        all_paths, all_labels,
        test_size=test_frac,
        stratify=all_labels,
        random_state=seed,
    )
    # Second split: train vs val
    paths_train, paths_val, labels_train, labels_val = train_test_split(
        paths_tv, labels_tv,
        test_size=val_frac,
        stratify=labels_tv,
        random_state=seed,
    )

    print(f"  Train: {len(paths_train)} | Val: {len(paths_val)} | Test: {len(paths_test)}")
    print(f"  Train class distribution: 0={labels_train.count(0)}, 1={labels_train.count(1)}")

    train_tf = build_stage2_transforms(cfg, "train")
    val_tf   = build_stage2_transforms(cfg, "val")

    return (
        CSIRODataset(paths_train, labels_train, train_tf),
        CSIRODataset(paths_val,   labels_val,   val_tf),
        CSIRODataset(paths_test,  labels_test,  val_tf),
    )


def build_stage2_loaders(cfg: dict) -> tuple[DataLoader, DataLoader, DataLoader]:
    """Build train/val/test DataLoaders with WeightedRandomSampler on train."""
    train_ds, val_ds, test_ds = build_csiro_datasets(cfg)
    s = cfg["stage2"]

    sampler = build_weighted_sampler(train_ds.labels) if s["use_weighted_sampler"] else None

    # pin_memory is not supported on MPS; only enable for CUDA
    pin = torch.cuda.is_available()

    train_loader = DataLoader(
        train_ds,
        batch_size=s["batch_size"],
        sampler=sampler,
        shuffle=(sampler is None),
        num_workers=s["num_workers"],
        pin_memory=pin,
        drop_last=True,
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=s["batch_size"],
        shuffle=False,
        num_workers=s["num_workers"],
        pin_memory=pin,
    )
    test_loader = DataLoader(
        test_ds,
        batch_size=s["batch_size"],
        shuffle=False,
        num_workers=s["num_workers"],
        pin_memory=pin,
    )
    return train_loader, val_loader, test_loader


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import yaml
    from pathlib import Path

    cfg_path = Path(__file__).parent / "config.yaml"
    with open(cfg_path) as f:
        cfg = yaml.safe_load(f)

    train_loader, val_loader, test_loader = build_stage2_loaders(cfg)
    imgs, labels = next(iter(train_loader))
    print(f"Batch image shape: {imgs.shape} | dtype: {imgs.dtype}")
    print(f"Batch labels: {labels}")
    print(f"  range: [{imgs.min():.3f}, {imgs.max():.3f}]")
