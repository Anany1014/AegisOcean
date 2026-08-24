"""
ais_model.py
────────────
LSTM Sequence-to-Sequence next-position predictor for AIS vessel trajectories.

Architecture:
  Encoder:  2-layer bidirectional LSTM(hidden=128) over T_in past pings
            → context vector via attention pooling
  Decoder:  2-layer LSTM(hidden=256) auto-regressive, teacher-forced during
            training, greedy at inference
  Output:   T_out × 3  [lat_delta, lon_delta, sog_norm]
  Loss:     MSE + Haversine-weighted position error

The decoder is purely predictive — it outputs future positions rather than
reconstructing the past — making it directly useful for:
  1. Hindcasting: where was a vessel BEFORE it went dark?
  2. Attribution: did a vessel's predicted path pass through the slick origin?
"""

from __future__ import annotations

import math
from typing import Optional

import torch
import torch.nn as nn
import torch.nn.functional as F


# ── Attention ─────────────────────────────────────────────────────────────────

class BahdanauAttention(nn.Module):
    """
    Additive (Bahdanau-style) attention over encoder outputs.
    Allows decoder to focus on the most relevant past timesteps.
    """

    def __init__(self, enc_dim: int, dec_dim: int) -> None:
        super().__init__()
        self.W_enc = nn.Linear(enc_dim, dec_dim, bias=False)
        self.W_dec = nn.Linear(dec_dim, dec_dim, bias=False)
        self.v     = nn.Linear(dec_dim, 1, bias=False)

    def forward(
        self,
        enc_outputs: torch.Tensor,   # [B, T_in, enc_dim]
        dec_hidden:  torch.Tensor,   # [B, dec_dim]
    ) -> tuple[torch.Tensor, torch.Tensor]:
        # energy: [B, T_in, 1]
        e = self.v(torch.tanh(
            self.W_enc(enc_outputs) +
            self.W_dec(dec_hidden).unsqueeze(1)
        ))
        attn_w = F.softmax(e, dim=1)                        # [B, T_in, 1]
        context = (attn_w * enc_outputs).sum(dim=1)         # [B, enc_dim]
        return context, attn_w.squeeze(-1)


# ── Encoder ───────────────────────────────────────────────────────────────────

class TrajectoryEncoder(nn.Module):
    """
    Bi-directional LSTM encoder over T_in past AIS pings.
    Input: [B, T_in, 9]
    Output: enc_outputs [B, T_in, 2*hidden], (h_n, c_n) bridged to decoder dim
    """

    def __init__(self, input_dim: int = 9, hidden_dim: int = 128, n_layers: int = 2,
                 dropout: float = 0.2) -> None:
        super().__init__()
        self.hidden_dim = hidden_dim
        self.n_layers   = n_layers

        self.lstm = nn.LSTM(
            input_size   = input_dim,
            hidden_size  = hidden_dim,
            num_layers   = n_layers,
            batch_first  = True,
            bidirectional= True,
            dropout      = dropout if n_layers > 1 else 0.0,
        )
        # Bridge bidir → decoder (unidirectional)
        self.bridge_h = nn.Linear(2 * hidden_dim, hidden_dim)
        self.bridge_c = nn.Linear(2 * hidden_dim, hidden_dim)
        self.drop     = nn.Dropout(dropout)

    def forward(self, src: torch.Tensor) -> tuple:
        """
        Args:
            src: [B, T_in, 9]
        Returns:
            enc_outputs: [B, T_in, 2*H]
            (h, c) each [n_layers, B, H]  — bridged to decoder dims
        """
        outputs, (h_n, c_n) = self.lstm(src)   # outputs: [B, T, 2H]

        # h_n: [n_layers*2, B, H] — merge directions for each layer
        h_n = h_n.view(self.n_layers, 2, src.size(0), self.hidden_dim)
        c_n = c_n.view(self.n_layers, 2, src.size(0), self.hidden_dim)

        # Concat directions → bridge
        h_fwd = h_n[:, 0]; h_bwd = h_n[:, 1]   # each [layers, B, H]
        c_fwd = c_n[:, 0]; c_bwd = c_n[:, 1]

        h_cat = torch.cat([h_fwd, h_bwd], dim=-1)   # [layers, B, 2H]
        c_cat = torch.cat([c_fwd, c_bwd], dim=-1)

        h_bridged = self.drop(torch.tanh(self.bridge_h(h_cat)))   # [layers, B, H]
        c_bridged = self.drop(torch.tanh(self.bridge_c(c_cat)))

        return outputs, (h_bridged, c_bridged)


# ── Decoder ───────────────────────────────────────────────────────────────────

class TrajectoryDecoder(nn.Module):
    """
    Auto-regressive LSTM decoder with Bahdanau attention.
    Predicts T_out future positions [lat_delta, lon_delta, sog_norm].
    """

    def __init__(self, output_dim: int = 3, hidden_dim: int = 128,
                 enc_output_dim: int = 256, n_layers: int = 2,
                 dropout: float = 0.2) -> None:
        super().__init__()
        self.hidden_dim = hidden_dim
        self.n_layers   = n_layers
        self.output_dim = output_dim

        self.attention = BahdanauAttention(enc_output_dim, hidden_dim)

        # Input at each step: previous prediction (3) + context (enc_output_dim)
        self.lstm = nn.LSTM(
            input_size  = output_dim + enc_output_dim,
            hidden_size = hidden_dim,
            num_layers  = n_layers,
            batch_first = True,
            dropout     = dropout if n_layers > 1 else 0.0,
        )
        self.fc   = nn.Linear(hidden_dim + enc_output_dim, output_dim)
        self.drop = nn.Dropout(dropout)

    def forward_step(
        self,
        dec_input: torch.Tensor,    # [B, 3]
        hidden: tuple,              # (h, c) each [layers, B, H]
        enc_outputs: torch.Tensor,  # [B, T_in, 2H]
    ) -> tuple[torch.Tensor, tuple]:
        h = hidden[0][-1]                            # top layer hidden: [B, H]
        context, _ = self.attention(enc_outputs, h)  # [B, 2H]

        rnn_in = torch.cat([dec_input, context], dim=-1).unsqueeze(1)  # [B, 1, 3+2H]
        output, hidden = self.lstm(rnn_in, hidden)                      # [B, 1, H]

        pred = self.fc(self.drop(
            torch.cat([output.squeeze(1), context], dim=-1)            # [B, H+2H]
        ))                                                              # [B, 3]
        return pred, hidden

    def forward(
        self,
        t_out: int,
        hidden: tuple,
        enc_outputs: torch.Tensor,
        teacher_input: Optional[torch.Tensor] = None,   # [B, T_out, 3] training targets
        teacher_ratio: float = 0.5,
    ) -> torch.Tensor:
        """
        Auto-regressive decoding, T_out steps.
        Returns predictions: [B, T_out, 3]
        """
        B = enc_outputs.size(0)
        # Seed decoder with last encoder output's lat/lon/sog (cols 0,1,2)
        dec_in = enc_outputs[:, -1, :3].detach()

        preds = []
        for t in range(t_out):
            pred, hidden = self.forward_step(dec_in, hidden, enc_outputs)
            preds.append(pred)

            # Teacher forcing during training
            if teacher_input is not None and torch.rand(1).item() < teacher_ratio:
                dec_in = teacher_input[:, t, :]
            else:
                dec_in = pred.detach()

        return torch.stack(preds, dim=1)   # [B, T_out, 3]


# ── Full Seq2Seq Model ────────────────────────────────────────────────────────

class VesselTrajectoryPredictor(nn.Module):
    """
    Full Seq2Seq predictor: Encoder + Decoder.

    Input:  src [B, T_in, 9]  (past trajectory features)
    Output: pred [B, T_out, 3]  (lat_delta, lon_delta, sog_norm)
    """

    def __init__(
        self,
        input_dim:   int   = 9,
        output_dim:  int   = 3,
        hidden_dim:  int   = 128,
        n_layers:    int   = 2,
        dropout:     float = 0.2,
    ) -> None:
        super().__init__()
        enc_out_dim = 2 * hidden_dim   # bidirectional

        self.encoder = TrajectoryEncoder(input_dim, hidden_dim, n_layers, dropout)
        self.decoder = TrajectoryDecoder(output_dim, hidden_dim, enc_out_dim, n_layers, dropout)

    def forward(
        self,
        src: torch.Tensor,
        t_out: int = 8,
        teacher_input: Optional[torch.Tensor] = None,
        teacher_ratio: float = 0.5,
    ) -> torch.Tensor:
        enc_outputs, hidden = self.encoder(src)
        pred = self.decoder(t_out, hidden, enc_outputs, teacher_input, teacher_ratio)
        return pred   # [B, T_out, 3]

    @torch.no_grad()
    def predict(self, src: torch.Tensor, t_out: int = 8) -> torch.Tensor:
        """Greedy inference — no teacher forcing."""
        self.eval()
        enc_outputs, hidden = self.encoder(src)
        return self.decoder(t_out, hidden, enc_outputs, teacher_input=None, teacher_ratio=0.0)


# ── Loss ──────────────────────────────────────────────────────────────────────

class HaversineMSELoss(nn.Module):
    """
    Combined loss:
      - MSE on lat_delta, lon_delta, sog
      - Haversine distance penalty on lat/lon predictions (weighted)
    """

    def __init__(self, haversine_weight: float = 0.5) -> None:
        super().__init__()
        self.hw = haversine_weight

    def forward(self, pred: torch.Tensor, tgt: torch.Tensor) -> torch.Tensor:
        """
        pred, tgt: [B, T_out, 3]  (lat_delta, lon_delta, sog_norm)
        """
        mse_loss = F.mse_loss(pred, tgt)

        # Approximate Haversine via equirectangular projection (fast on GPU)
        dlat = torch.deg2rad(pred[..., 0] - tgt[..., 0])
        dlon = torch.deg2rad(pred[..., 1] - tgt[..., 1])
        lat_m = torch.deg2rad((pred[..., 0] + tgt[..., 0]) / 2.0)
        dist_sq = dlat ** 2 + (torch.cos(lat_m) * dlon) ** 2
        hav_loss = dist_sq.mean()

        return mse_loss + self.hw * hav_loss


# ── Factory ───────────────────────────────────────────────────────────────────

def build_ais_model(cfg: dict) -> VesselTrajectoryPredictor:
    s = cfg["stage3"]
    return VesselTrajectoryPredictor(
        input_dim  = s["input_dim"],
        output_dim = s["output_dim"],
        hidden_dim = s["hidden_dim"],
        n_layers   = s["n_layers"],
        dropout    = s["dropout"],
    )

def build_ais_loss(cfg: dict) -> HaversineMSELoss:
    return HaversineMSELoss(haversine_weight=cfg["stage3"]["haversine_weight"])


# ── Smoke test ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import yaml
    with open("ml/config.yaml") as f:
        cfg = yaml.safe_load(f)

    model   = build_ais_model(cfg)
    loss_fn = build_ais_loss(cfg)

    B, T_in, T_out = 8, 32, 8
    src = torch.randn(B, T_in, 9)
    tgt = torch.randn(B, T_out, 3)

    pred  = model(src, t_out=T_out, teacher_input=tgt, teacher_ratio=0.5)
    loss  = loss_fn(pred, tgt)
    inf   = model.predict(src, t_out=T_out)

    total = sum(p.numel() for p in model.parameters())
    print(f"Model params:     {total:,}")
    print(f"Train pred shape: {pred.shape}")
    print(f"Infer pred shape: {inf.shape}")
    print(f"Loss:             {loss.item():.4f}")
