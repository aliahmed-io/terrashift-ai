"""Supervised training script for Siamese U-Net on the OSCD Sentinel-2 dataset.

Trains SiameseUNet-5Ch with controlled loss ablations:
1. bce_dice: Combined BCE + Soft Dice (0.5/0.5)
2. weighted_bce_dice: Weighted BCE (pos_weight=2.0) + Soft Dice (0.5/0.5)
3. focal_dice: Focal Loss (alpha=0.35, gamma=2.0) + Soft Dice (0.5/0.5)

Features:
- Balanced positive change + hard negative background sampling
- 4-way data augmentation (H-flip, V-flip, 90-deg rotations, symmetric T1/T2 swap)
- CosineAnnealingLR learning rate schedule
- Real-time unbuffered logging (flush=True)
- Validation-based best checkpoint selection across detection thresholds tau and fusion weights
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Literal, Tuple

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services" / "ml"))

import numpy as np
from scipy import ndimage
import torch
import torch.nn as nn
import torch.nn.functional as F
from torch.utils.data import DataLoader

from terrashift.benchmark.metrics import compute_binary_metrics
from terrashift.benchmark.oscd import OSCDDataset, OSCDScene, load_oscd_split
from terrashift.inference.preprocessing import EPS, build_5channel_stack, pad_to_multiple
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


class BinaryFocalLoss(nn.Module):
    """Focal Loss to down-weight easy background negatives in high-imbalance binary change detection."""

    def __init__(self, alpha: float = 0.35, gamma: float = 2.0, eps: float = 1e-6) -> None:
        super().__init__()
        self.alpha = alpha
        self.gamma = gamma
        self.eps = eps

    def forward(self, logits: torch.Tensor, targets: torch.Tensor) -> torch.Tensor:
        probs = torch.sigmoid(logits)
        probs = torch.clamp(probs, self.eps, 1.0 - self.eps)
        targets = targets.float()

        bce = -targets * torch.log(probs) - (1.0 - targets) * torch.log(1.0 - probs)
        p_t = targets * probs + (1.0 - targets) * (1.0 - probs)
        alpha_factor = targets * self.alpha + (1.0 - targets) * (1.0 - self.alpha)
        modulating_factor = torch.pow(1.0 - p_t, self.gamma)
        return torch.mean(alpha_factor * modulating_factor * bce)


class PrecomputedValScene:
    """Precomputed validation scene stack to accelerate epoch validation."""

    def __init__(self, scene: OSCDScene, device: str = "cpu") -> None:
        self.scene = scene
        t1_stack, t2_stack, b_matched = build_5channel_stack(scene.t1_rgb, scene.t2_rgb, apply_matching=True)
        self.h, self.w = t1_stack.shape[1], t1_stack.shape[2]
        t1_t = torch.from_numpy(t1_stack).unsqueeze(0).float()
        t2_t = torch.from_numpy(t2_stack).unsqueeze(0).float()
        self.t1_pad, self.t2_pad, self.pad_h, self.pad_w = pad_to_multiple(t1_t, t2_t, multiple=16)
        self.t1_pad = self.t1_pad.to(device)
        self.t2_pad = self.t2_pad.to(device)

        # Precompute statistical baseline probability for validation fusion tuning
        a = scene.t1_rgb.astype(np.float32) / 255.0
        dist = np.sqrt(np.sum((b_matched - a) ** 2, axis=-1))
        score = ndimage.uniform_filter(dist, size=3).astype(np.float32)
        valid = np.ones((self.h, self.w), dtype=bool)
        vals = score[valid]
        med = float(np.median(vals))
        mad = float(1.4826 * np.median(np.abs(vals - med)))
        baseline = max(med + 3.6 * mad, 0.08)
        self.stat_prob = (1.0 / (1.0 + np.exp(-(score - baseline) / (0.22 * baseline + EPS)))).astype(np.float32)


def evaluate_val_scenes(
    model: nn.Module,
    precomputed_val: List[PrecomputedValScene],
    thresholds: List[float] | None = None,
) -> Dict[str, Any]:
    """Fast validation evaluation across thresholds on uncropped held-out validation scenes."""
    model.eval()
    if thresholds is None:
        thresholds = [0.35, 0.40, 0.45, 0.50, 0.55]

    scene_probs: List[Tuple[np.ndarray, np.ndarray, np.ndarray]] = []
    with torch.no_grad():
        for pv in precomputed_val:
            logits = model(pv.t1_pad, pv.t2_pad)
            probs = torch.sigmoid(logits)
            if pv.pad_h > 0 or pv.pad_w > 0:
                probs = probs[:, :, : pv.h, : pv.w]
            deep_prob = probs.squeeze().cpu().numpy().astype(np.float32)
            scene_probs.append((deep_prob, pv.stat_prob, pv.scene.gt_mask))

    # Sweep thresholds for standalone deep model
    best_tau = 0.45
    best_f1 = -1.0
    best_metrics: Dict[str, Any] = {}

    for tau in thresholds:
        tp, fp, fn, tn = 0, 0, 0, 0
        for deep_p, _, gt in scene_probs:
            m = compute_binary_metrics(deep_p >= tau, gt)
            tp += m["tp"]
            fp += m["fp"]
            fn += m["fn"]
            tn += m["tn"]

        prec = tp / (tp + fp + EPS)
        rec = tp / (tp + fn + EPS)
        f1 = 2.0 * prec * rec / (prec + rec + EPS)
        iou = tp / (tp + fp + fn + EPS)

        if f1 > best_f1:
            best_f1 = f1
            best_tau = tau
            best_metrics = {
                "threshold": round(float(tau), 2),
                "f1": round(float(f1), 4),
                "iou": round(float(iou), 4),
                "precision": round(float(prec), 4),
                "recall": round(float(rec), 4),
                "confusion": {"tp": tp, "fp": fp, "fn": fn, "tn": tn},
            }

    # Evaluate validation fusion search (w_deep in [0.4..0.8])
    best_fusion_w = 0.60
    best_fusion_tau = 0.45
    best_fusion_f1 = -1.0
    best_fusion_metrics: Dict[str, Any] = {}

    for w_deep in [0.40, 0.50, 0.60, 0.70, 0.80]:
        w_stat = 1.0 - w_deep
        for tau in thresholds:
            tp, fp, fn, tn = 0, 0, 0, 0
            for deep_p, stat_p, gt in scene_probs:
                fused_p = (w_deep * deep_p + w_stat * stat_p).astype(np.float32)
                m = compute_binary_metrics(fused_p >= tau, gt)
                tp += m["tp"]
                fp += m["fp"]
                fn += m["fn"]
                tn += m["tn"]

            prec = tp / (tp + fp + EPS)
            rec = tp / (tp + fn + EPS)
            f1 = 2.0 * prec * rec / (prec + rec + EPS)
            iou = tp / (tp + fp + fn + EPS)

            if f1 > best_fusion_f1:
                best_fusion_f1 = f1
                best_fusion_w = w_deep
                best_fusion_tau = tau
                best_fusion_metrics = {
                    "w_deep": round(float(w_deep), 2),
                    "w_stat": round(float(w_stat), 2),
                    "threshold": round(float(tau), 2),
                    "f1": round(float(f1), 4),
                    "iou": round(float(iou), 4),
                    "precision": round(float(prec), 4),
                    "recall": round(float(rec), 4),
                }

    return {
        "neural_best": best_metrics,
        "fusion_best": best_fusion_metrics,
    }


def get_loss_function(loss_type: str, pos_weight: float = 2.0) -> Any:
    """Return configured loss function."""
    dice = SoftDiceLoss()
    if loss_type == "bce_dice":
        bce = nn.BCEWithLogitsLoss()
        return lambda l, t: 0.5 * bce(l, t) + 0.5 * dice(l, t)
    elif loss_type == "weighted_bce_dice":
        return lambda l, t: 0.5 * F.binary_cross_entropy_with_logits(
            l, t, pos_weight=torch.tensor([pos_weight], device=l.device)
        ) + 0.5 * dice(l, t)
    elif loss_type == "focal_dice":
        focal = BinaryFocalLoss(alpha=0.35, gamma=2.0)
        return lambda l, t: 0.5 * focal(l, t) + 0.5 * dice(l, t)
    else:
        raise ValueError(f"Unknown loss_type: {loss_type}")


def train_model(
    epochs: int = 8,
    batch_size: int = 8,
    patches_per_scene: int = 16,
    lr: float = 1e-3,
    loss_type: Literal["bce_dice", "weighted_bce_dice", "focal_dice"] = "bce_dice",
    pos_weight: float = 2.0,
    seed: int = 42,
    save_path: str | None = None,
) -> Dict[str, Any]:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cpu":
        torch.set_num_threads(4)

    torch.manual_seed(seed)
    np.random.seed(seed)

    print(
        f"=== Supervised Training: SiameseUNet-5Ch (Seed {seed}, Loss: {loss_type}, Device: {device}, Threads: {torch.get_num_threads()}) ===",
        flush=True,
    )

    train_dataset = OSCDDataset(split="train", patch_size=256, patches_per_scene=patches_per_scene, seed=seed)
    val_scenes = load_oscd_split("val")
    precomputed_val = [PrecomputedValScene(s, device=device) for s in val_scenes]

    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True)

    model = SiameseUNet(in_channels=5, base_channels=32).to(device)
    criterion = get_loss_function(loss_type, pos_weight=pos_weight)

    optimizer = torch.optim.AdamW(model.parameters(), lr=lr, weight_decay=1e-4)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=epochs, eta_min=1e-5)

    best_val_f1 = -1.0
    best_state: Dict[str, Any] | None = None
    history: List[Dict[str, Any]] = []

    out_file = save_path or str(
        ROOT / "services" / "ml" / "terrashift" / "models" / f"siamese_unet_{loss_type}_s{seed}.pt"
    )
    os.makedirs(os.path.dirname(out_file), exist_ok=True)

    t_start = time.time()
    print(
        f"Starting training for {epochs} epochs ({len(train_dataset)} patches/epoch, {len(train_loader)} batches/epoch)...",
        flush=True,
    )

    for epoch in range(1, epochs + 1):
        t_epoch_start = time.time()
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

        scheduler.step()
        epoch_loss = running_loss / len(train_dataset)

        # Validation evaluation on held-out validation partition
        val_eval = evaluate_val_scenes(model, precomputed_val)
        val_m = val_eval["neural_best"]
        fus_m = val_eval["fusion_best"]
        epoch_sec = round(time.time() - t_epoch_start, 1)

        history.append({
            "epoch": epoch,
            "epoch_time_sec": epoch_sec,
            "lr": round(float(scheduler.get_last_lr()[0]), 6),
            "train_loss": round(float(epoch_loss), 4),
            "val_f1": val_m["f1"],
            "val_iou": val_m["iou"],
            "val_prec": val_m["precision"],
            "val_rec": val_m["recall"],
            "best_tau": val_m["threshold"],
            "val_fusion_f1": fus_m["f1"],
            "val_fusion_w_deep": fus_m["w_deep"],
            "val_fusion_tau": fus_m["threshold"],
        })

        print(
            f"Epoch {epoch:02d}/{epochs:02d} ({epoch_sec}s, lr={scheduler.get_last_lr()[0]:.1e}) | Loss: {epoch_loss:.4f} | "
            f"Val F1: {val_m['f1']:.4f} (tau={val_m['threshold']}) | Val IoU: {val_m['iou']:.4f} | "
            f"Fusion Val F1: {fus_m['f1']:.4f} (w={fus_m['w_deep']}, tau={fus_m['threshold']})",
            flush=True,
        )

        if val_m["f1"] > best_val_f1:
            best_val_f1 = val_m["f1"]
            best_state = {
                "architecture": "SiameseUNet-5Ch",
                "parameters": sum(p.numel() for p in model.parameters()),
                "in_channels": 5,
                "base_channels": 32,
                "channels": ["R", "G", "B", "ExG", "R/G"],
                "loss": f"{loss_type}(pos_weight={pos_weight})",
                "trained_epochs": epoch,
                "training_dataset": "OSCD (12 train scenes)",
                "validation_dataset": "OSCD (2 val scenes: val_12, val_13)",
                "seed": seed,
                "val_f1": val_m["f1"],
                "val_iou": val_m["iou"],
                "optimal_val_threshold": val_m["threshold"],
                "optimal_val_fusion": fus_m,
                "preprocessing_version": "v2.0-unified",
                "state_dict": model.state_dict(),
            }
            torch.save(best_state, out_file)

    total_time = round(time.time() - t_start, 1)
    print(f"\nTraining completed in {total_time}s! Best Validation F1: {best_val_f1:.4f}", flush=True)
    print(f"Optimal Checkpoint saved to: {out_file}", flush=True)

    return {
        "best_val_f1": best_val_f1,
        "checkpoint_path": out_file,
        "total_time_seconds": total_time,
        "history": history,
        "best_state_meta": {k: v for k, v in (best_state or {}).items() if k != "state_dict"},
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=8)
    parser.add_argument("--patches", type=int, default=16)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument(
        "--loss", choices=["bce_dice", "weighted_bce_dice", "focal_dice"], default="bce_dice"
    )
    parser.add_argument("--pos-weight", type=float, default=2.0)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--save-path", type=str, default=None)
    args = parser.parse_args()

    train_model(
        epochs=args.epochs,
        batch_size=args.batch_size,
        patches_per_scene=args.patches,
        lr=args.lr,
        loss_type=args.loss,
        pos_weight=args.pos_weight,
        seed=args.seed,
        save_path=args.save_path,
    )
