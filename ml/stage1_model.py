"""
stage1_model.py
───────────────
U-Net segmentation model for Stage 1 pretraining on the SOS dataset.

Architecture:
  Encoder:  EfficientNet-B2 (pretrained ImageNet weights)
            → first conv layer adapted from 3-channel to 1-channel (grayscale SAR)
  Decoder:  U-Net decoder with skip connections (via segmentation-models-pytorch)
  Head:     1×1 conv → single logit per pixel (binary segmentation)

Loss during training:
  0.5 × DiceLoss + 0.5 × BCEWithLogitsLoss
"""

from __future__ import annotations

import torch
import torch.nn as nn
import segmentation_models_pytorch as smp


# ── Combined Loss ─────────────────────────────────────────────────────────────

class DiceBCELoss(nn.Module):
    """
    Weighted combination of Dice loss and BCE loss.
    Both losses operate on raw logits.
    """

    def __init__(self, dice_weight: float = 0.5, bce_weight: float = 0.5) -> None:
        super().__init__()
        self.dice_weight = dice_weight
        self.bce_weight  = bce_weight

        self.dice_loss = smp.losses.DiceLoss(mode="binary", from_logits=True)
        self.bce_loss  = nn.BCEWithLogitsLoss()

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        dice = self.dice_loss(logits, targets)
        bce  = self.bce_loss(logits, targets)
        return self.dice_weight * dice + self.bce_weight * bce


# ── Model ─────────────────────────────────────────────────────────────────────

class SARSegmentationModel(nn.Module):
    """
    U-Net with EfficientNet-B2 encoder, adapted for single-channel SAR input.

    Args:
        encoder_name:    timm/smp encoder identifier (default: 'efficientnet-b2').
        encoder_weights: pretrained weights source (default: 'imagenet').
        in_channels:     input channels (1 for grayscale SAR).
        decoder_channels: feature map sizes in U-Net decoder.
    """

    def __init__(
        self,
        encoder_name: str = "efficientnet-b2",
        encoder_weights: str = "imagenet",
        in_channels: int = 1,
        decoder_channels: tuple[int, ...] = (256, 128, 64, 32, 16),
    ) -> None:
        super().__init__()

        self.unet = smp.Unet(
            encoder_name=encoder_name,
            encoder_weights=encoder_weights,
            in_channels=in_channels,
            classes=1,
            activation=None,              # raw logits; sigmoid applied in loss/metrics
            decoder_channels=decoder_channels,
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: [B, 1, H, W] float32 SAR image tensor.
        Returns:
            logits: [B, 1, H, W] — apply sigmoid for probability map.
        """
        return self.unet(x)

    def encoder_state_dict(self) -> dict:
        """Extract only the encoder weights for transfer to Stage 2."""
        return self.unet.encoder.state_dict()


# ── Metrics ───────────────────────────────────────────────────────────────────

def compute_iou(logits: torch.Tensor, targets: torch.Tensor, threshold: float = 0.5) -> torch.Tensor:
    """Intersection-over-Union for binary segmentation. Inputs are logits."""
    preds = (torch.sigmoid(logits) > threshold).float()
    intersection = (preds * targets).sum(dim=(1, 2, 3))
    union        = (preds + targets).clamp(0, 1).sum(dim=(1, 2, 3))
    iou = (intersection + 1e-6) / (union + 1e-6)
    return iou.mean()


def compute_dice(logits: torch.Tensor, targets: torch.Tensor, threshold: float = 0.5) -> torch.Tensor:
    """Dice coefficient for binary segmentation. Inputs are logits."""
    preds = (torch.sigmoid(logits) > threshold).float()
    intersection = (preds * targets).sum(dim=(1, 2, 3))
    dice = (2 * intersection + 1e-6) / (preds.sum(dim=(1, 2, 3)) + targets.sum(dim=(1, 2, 3)) + 1e-6)
    return dice.mean()


# ── Factory ───────────────────────────────────────────────────────────────────

def build_stage1_model(cfg: dict) -> SARSegmentationModel:
    s = cfg["stage1"]
    return SARSegmentationModel(
        encoder_name=s["encoder"],
        encoder_weights=s["encoder_weights"],
        in_channels=s["in_channels"],
        decoder_channels=tuple(s["decoder_channels"]),
    )


def build_stage1_loss(cfg: dict) -> DiceBCELoss:
    s = cfg["stage1"]
    return DiceBCELoss(dice_weight=s["dice_weight"], bce_weight=s["bce_weight"])


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import yaml
    from pathlib import Path

    cfg_path = Path(__file__).parent / "config.yaml"
    with open(cfg_path) as f:
        cfg = yaml.safe_load(f)

    model = build_stage1_model(cfg)
    loss_fn = build_stage1_loss(cfg)

    # Dummy forward pass
    x      = torch.randn(2, 1, 512, 512)
    target = torch.randint(0, 2, (2, 1, 512, 512)).float()

    logits = model(x)
    loss   = loss_fn(logits, target)
    iou    = compute_iou(logits, target)
    dice   = compute_dice(logits, target)

    print(f"Output shape: {logits.shape}")
    print(f"Loss:  {loss.item():.4f}")
    print(f"IoU:   {iou.item():.4f}")
    print(f"Dice:  {dice.item():.4f}")
    print(f"Encoder keys (first 3): {list(model.encoder_state_dict().keys())[:3]}")
