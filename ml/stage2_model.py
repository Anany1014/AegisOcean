"""
stage2_model.py
───────────────
Binary classifier for Stage 2 fine-tuning on the CSIRO chip dataset.

Architecture:
  Encoder:  EfficientNet-B2 encoder — weights loaded from Stage 1 `sos_encoder.pt`
            (frozen for warmup_epochs, then unfrozen with low LR)
  Head:     Global Average Pooling → Dropout → Dense(256, ReLU) → Dropout → Dense(1)
  Loss:     Focal Loss (γ=2) with class-balanced pos_weight

Weight transfer:
  Stage 1 saved `model.unet.encoder.state_dict()`.
  Stage 2 loads those weights into the same EfficientNet-B2 encoder via smp or timm.
"""

from __future__ import annotations

from pathlib import Path
from typing import Optional

import torch
import torch.nn as nn
import segmentation_models_pytorch as smp


# ── Focal Loss ────────────────────────────────────────────────────────────────

class FocalLoss(nn.Module):
    """
    Binary Focal Loss (Lin et al., 2017).
    Operates on raw logits.

    Args:
        gamma:      Focusing parameter. Higher γ down-weights easy examples more.
        pos_weight: Scalar weight for positive class (corrects class imbalance).
    """

    def __init__(self, gamma: float = 2.0, pos_weight: Optional[torch.Tensor] = None) -> None:
        super().__init__()
        self.gamma      = gamma
        self.pos_weight = pos_weight
        self.bce = nn.BCEWithLogitsLoss(pos_weight=pos_weight, reduction="none")

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        bce_loss  = self.bce(logits, targets)
        probs     = torch.sigmoid(logits)
        p_t       = probs * targets + (1 - probs) * (1 - targets)
        focal_w   = (1 - p_t) ** self.gamma
        return (focal_w * bce_loss).mean()


# ── Model ─────────────────────────────────────────────────────────────────────

class SARClassifier(nn.Module):
    """
    Binary SAR chip classifier built on an EfficientNet-B2 encoder.

    The encoder is loaded from the Stage 1 pretrained weights, giving the model
    SAR-native feature representations before fine-tuning begins.

    Args:
        encoder_name:   smp-compatible encoder identifier.
        in_channels:    1 for grayscale SAR.
        hidden_dim:     FC hidden layer size.
        dropout1:       Dropout after pooling.
        dropout2:       Dropout after hidden FC.
        stage1_weights: Path to `sos_encoder.pt` (Stage 1 output).
    """

    def __init__(
        self,
        encoder_name: str = "efficientnet-b2",
        in_channels: int = 1,
        hidden_dim: int = 256,
        dropout1: float = 0.3,
        dropout2: float = 0.2,
        stage1_weights: Optional[Path] = None,
    ) -> None:
        super().__init__()

        # Build encoder via smp (ensures same architecture as Stage 1)
        self.encoder = smp.encoders.get_encoder(
            encoder_name,
            in_channels=in_channels,
            depth=5,
            weights="imagenet",     # fallback if no stage1 weights provided
        )

        # Load Stage 1 pretrained weights
        if stage1_weights is not None and Path(stage1_weights).exists():
            state = torch.load(stage1_weights, map_location="cpu")
            missing, unexpected = self.encoder.load_state_dict(state, strict=False)
            print(f"[SARClassifier] Loaded Stage 1 encoder from {stage1_weights}")
            if missing:
                print(f"  Missing keys ({len(missing)}): {missing[:3]}...")
            if unexpected:
                print(f"  Unexpected keys ({len(unexpected)}): {unexpected[:3]}...")
        else:
            print("[SARClassifier] WARNING: Stage 1 weights not found. Using ImageNet init only.")

        # Encoder output channels (EfficientNet-B2 final stage = 1408)
        enc_out_channels = self.encoder.out_channels[-1]

        # Classification head
        self.pool    = nn.AdaptiveAvgPool2d(1)
        self.flatten = nn.Flatten()
        self.head    = nn.Sequential(
            nn.Dropout(p=dropout1),
            nn.Linear(enc_out_channels, hidden_dim),
            nn.ReLU(inplace=True),
            nn.Dropout(p=dropout2),
            nn.Linear(hidden_dim, 1),   # raw logit → sigmoid in loss/inference
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        Args:
            x: [B, 1, H, W] normalised SAR chip tensor.
        Returns:
            logits: [B, 1] — apply sigmoid for P(oil).
        """
        features = self.encoder(x)      # list of feature maps at each scale
        x = features[-1]                # take deepest feature map: [B, C, H', W']
        x = self.pool(x)                # [B, C, 1, 1]
        x = self.flatten(x)             # [B, C]
        return self.head(x)             # [B, 1]

    def freeze_encoder(self) -> None:
        """Freeze all encoder parameters (used during warmup epochs)."""
        for param in self.encoder.parameters():
            param.requires_grad = False
        print("[SARClassifier] Encoder frozen.")

    def unfreeze_encoder(self) -> None:
        """Unfreeze encoder for full fine-tuning (used after warmup)."""
        for param in self.encoder.parameters():
            param.requires_grad = True
        print("[SARClassifier] Encoder unfrozen for full fine-tuning.")

    def get_param_groups(self, head_lr: float, encoder_lr_scale: float = 0.1) -> list[dict]:
        """
        Return parameter groups with differential learning rates:
        - Classifier head: head_lr
        - Encoder: head_lr * encoder_lr_scale  (lower to preserve pretrained features)
        """
        return [
            {"params": self.head.parameters(),    "lr": head_lr},
            {"params": self.encoder.parameters(), "lr": head_lr * encoder_lr_scale},
        ]


# ── Factory ───────────────────────────────────────────────────────────────────

def build_stage2_model(cfg: dict) -> SARClassifier:
    s = cfg["stage2"]
    stage1_path = Path(cfg["paths"]["results_dir"]) / cfg["stage1"]["checkpoint_name"]
    return SARClassifier(
        encoder_name=s["encoder"],
        in_channels=s["in_channels"],
        hidden_dim=s["hidden_dim"],
        dropout1=s["dropout1"],
        dropout2=s["dropout2"],
        stage1_weights=stage1_path,
    )


def build_stage2_loss(cfg: dict, device: torch.device) -> FocalLoss:
    s = cfg["stage2"]
    pw = torch.tensor([s["pos_weight"]], device=device)
    return FocalLoss(gamma=s["focal_gamma"], pos_weight=pw)


# ── Smoke test ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import yaml
    from pathlib import Path

    cfg_path = Path(__file__).parent / "config.yaml"
    with open(cfg_path) as f:
        cfg = yaml.safe_load(f)

    # Patch in_channels into stage2 config (use stage1 value)
    cfg["stage2"]["in_channels"] = cfg["stage1"]["in_channels"]

    device = torch.device("cpu")
    model   = build_stage2_model(cfg).to(device)
    loss_fn = build_stage2_loss(cfg, device)

    x      = torch.randn(4, 1, 224, 224)
    target = torch.tensor([0., 1., 0., 1.]).unsqueeze(1)

    logits = model(x)
    loss   = loss_fn(logits, target)
    probs  = torch.sigmoid(logits)

    print(f"Output shape: {logits.shape}")
    print(f"Probabilities: {probs.squeeze().tolist()}")
    print(f"Focal loss: {loss.item():.4f}")

    # Test freeze/unfreeze
    model.freeze_encoder()
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Trainable params (frozen encoder): {trainable:,}")

    model.unfreeze_encoder()
    trainable = sum(p.numel() for p in model.parameters() if p.requires_grad)
    print(f"Trainable params (full model):     {trainable:,}")
