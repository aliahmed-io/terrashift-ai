"""Supervised training script for Siamese U-Net on the OSCD Sentinel-2 dataset.

Trains M1 (SiameseUNet-5Ch) using Combined BCE + Soft Dice Loss on OSCD train split,
with checkpoint selection based on validation F1 on held-out validation scenes.
"""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services" / "ml"))

import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

from terrashift.benchmark.metrics import compute_binary_metrics
from terrashift.benchmark.oscd import OSCDDataset, load_oscd_split
from terrashift.models.siamese_unet import SiameseUNet


class SoftDiceLoss(nn.Module):
    def __init__(self, eps: float = 1e-6) -> None:
        super().__init__()
        self.eps = eps

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        intersection = torch.sum(probs * targets, dim=(2, 3))
        union = torch.sum(probs, dim=(2, 3)) + torch.sum(targets, dim=(2, 3))
        dice = (2.0 * intersection + self.eps) / (union + self.eps)
        return 1.0 - torch.mean(dice)


class CombinedLoss(nn.Module):
    def __init__(self, bce_weight: float = 0.5) -> None:
        super().__init__()
        self.bce = nn.BCEWithLogitsLoss()
        self.dice = SoftDiceLoss()
        self.bce_weight = bce_weight

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        return self.bce_weight * self.bce(logits, targets) + (1.0 - self.bce_weight) * self.dice(logits, targets)


def evaluate_scenes(model: nn.Module, scenes, threshold: float = 0.50, device: str = "cpu") -> dict:
    """Evaluate full uncropped scenes using reflection padding to multiple of 16."""
    model.eval()
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_tn = 0

    with torch.no_grad():
        for s in scenes:
            f1 = s.t1_rgb.astype(np.float32) / 255.0
            f2 = s.t2_rgb.astype(np.float32) / 255.0
            eps = 1e-6
            exg1 = np.clip((2.0 * f1[..., 1] - f1[..., 0] - f1[..., 2]) / (f1.sum(axis=-1) + eps) * 2.5, -1.0, 1.0)
            exg2 = np.clip((2.0 * f2[..., 1] - f2[..., 0] - f2[..., 2]) / (f2.sum(axis=-1) + eps) * 2.5, -1.0, 1.0)
            bare1 = np.clip((f1[..., 0] - f1[..., 1]) / (f1[..., 0] + f1[..., 1] + eps) * 4.0, -1.0, 1.0)
            bare2 = np.clip((f2[..., 0] - f2[..., 1]) / (f2[..., 0] + f2[..., 1] + eps) * 4.0, -1.0, 1.0)

            t1_stack = np.stack([f1[..., 0], f1[..., 1], f1[..., 2], exg1, bare1], axis=0)
            t2_stack = np.stack([f2[..., 0], f2[..., 1], f2[..., 2], exg2, bare2], axis=0)

            h, w = t1_stack.shape[1], t1_stack.shape[2]
            pad_h = (16 - h % 16) % 16
            pad_w = (16 - w % 16) % 16

            t1_t = torch.from_numpy(t1_stack).unsqueeze(0).float().to(device)
            t2_t = torch.from_numpy(t2_stack).unsqueeze(0).float().to(device)

            if pad_h > 0 or pad_w > 0:
                t1_t = F.pad(t1_t, (0, pad_w, 0, pad_h), mode="reflect")
                t2_t = F.pad(t2_t, (0, pad_w, 0, pad_h), mode="reflect")

            logits = model(t1_t, t2_t)
            probs = torch.sigmoid(logits)
            if pad_h > 0 or pad_w > 0:
                probs = probs[:, :, :h, :w]
            prob_map = probs.squeeze().cpu().numpy()

            pred_mask = prob_map >= threshold
            m = compute_binary_metrics(pred_mask, s.gt_mask)
            total_tp += m["tp"]
            total_fp += m["fp"]
            total_fn += m["fn"]
            total_tn += m["tn"]

    prec = total_tp / (total_tp + total_fp + 1e-7)
    rec = total_tp / (total_tp + total_fn + 1e-7)
    f1 = 2.0 * prec * rec / (prec + rec + 1e-7)
    iou = total_tp / (total_tp + total_fp + total_fn + 1e-7)

    return {
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "f1": round(float(f1), 4),
        "iou": round(float(iou), 4),
        "tp": total_tp,
        "fp": total_fp,
        "fn": total_fn,
        "tn": total_tn,
    }


def train_model(
    epochs: int = 6,
    batch_size: int = 8,
    lr: float = 1e-3,
    save_path: Optional[str] = None,
) -> dict:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Training on device: {device}")

    # 12 scenes for training, 16 patches per scene = 192 patches/epoch
    train_dataset = OSCDDataset(split="train", patch_size=256, patches_per_scene=16, seed=42)
    val_scenes = load_oscd_split("val")

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    model = SiameseUNet(in_channels=5, base_channels=32).to(device)
    criterion = CombinedLoss(bce_weight=0.5)
    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)

    best_val_f1 = -1.0
    best_state = None
    history = []

    out_file = save_path or str(
        ROOT / "services" / "ml" / "terrashift" / "models" / "siamese_unet_oscd_m1.pt"
    )
    os.makedirs(os.path.dirname(out_file), exist_ok=True)

    print(f"Starting training for {epochs} epochs ({len(train_dataset)} patches/epoch)...")
    t_start = time.time()

    for epoch in range(1, epochs + 1):
        model.train()
        running_loss = 0.0

        for t1, t2, target in train_loader:
            t1, t2, target = t1.to(device), t2.to(device), target.to(device)
            optimizer.zero_grad()
            logits = model(t1, t2)
            loss = criterion(logits, target)
            loss.backward()
            optimizer.step()
            running_loss += loss.item() * t1.size(0)

        epoch_loss = running_loss / len(train_dataset)

        # Validation on held-out validation scenes
        val_res = evaluate_scenes(model, val_scenes, threshold=0.45, device=device)
        history.append({
            "epoch": epoch,
            "train_loss": round(epoch_loss, 4),
            "val_f1": val_res["f1"],
            "val_iou": val_res["iou"],
            "val_prec": val_res["precision"],
            "val_rec": val_res["recall"],
        })

        print(
            f"Epoch {epoch}/{epochs} | Loss: {epoch_loss:.4f} | "
            f"Val F1: {val_res['f1']:.4f} | Val IoU: {val_res['iou']:.4f} | "
            f"Val Prec: {val_res['precision']:.4f} | Val Rec: {val_res['recall']:.4f}"
        )

        if val_res["f1"] > best_val_f1:
            best_val_f1 = val_res["f1"]
            best_state = {
                "architecture": "SiameseUNet-5Ch",
                "parameters": sum(p.numel() for p in model.parameters()),
                "in_channels": 5,
                "base_channels": 32,
                "channels": ["R", "G", "B", "ExG", "R/G"],
                "loss": "Combined_BCE_Dice_Loss(lambda=0.5)",
                "trained_epochs": epoch,
                "training_dataset": "OSCD (12 train scenes)",
                "val_f1": val_res["f1"],
                "val_iou": val_res["iou"],
                "state_dict": model.state_dict(),
            }
            torch.save(best_state, out_file)

    total_time = round(time.time() - t_start, 1)
    print(f"\nTraining completed in {total_time}s! Best Val F1: {best_val_f1:.4f}")
    print(f"Checkpoint saved to: {out_file}")

    return {
        "best_val_f1": best_val_f1,
        "checkpoint_path": out_file,
        "total_time_seconds": total_time,
        "history": history,
    }


if __name__ == "__main__":
    train_model(epochs=6, batch_size=8, lr=1e-3)
