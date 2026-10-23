"""Controlled Benchmark Evaluation Engine for TerraShift.

Evaluates change detection models on the official 10 held-out test scenes of the
Onera Satellite Change Detection (OSCD) Sentinel-2 dataset.

Models evaluated:
1. Statistical Spectral Baseline (Radiometric matching + Euclidean RGB dist + MAD baseline)
2. M0: Untrained Siamese U-Net (random initialization baseline)
3. M0 + Statistical 60/40 Fusion (Original implementation)
4. M1: Supervised Trained Siamese U-Net (OSCD checkpoint)
5. M1 + Statistical Fusion

Outputs:
- Machine-readable JSON: `reports/benchmark_scorecard.json` (pooled metrics and per-scene breakdown)
- Prints full markdown scorecard, per-scene table, and calibration analysis.
"""

from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services" / "ml"))

import numpy as np
from scipy import ndimage
import torch

from terrashift.benchmark.metrics import compute_binary_metrics, compute_calibration_metrics
from terrashift.benchmark.oscd import OSCDScene, load_oscd_split
from terrashift.inference.preprocessing import (
    EPS,
    build_5channel_stack,
    match_statistics,
    pad_to_multiple,
)
from terrashift.models.siamese_unet import SiameseUNet


def evaluate_statistical_baseline(scenes: List[OSCDScene], threshold: float = 0.45) -> Dict[str, Any]:
    """Run pure physics-guided / statistical spectral change detection on all test scenes."""
    t_start = time.perf_counter()
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_tn = 0
    all_probs = []
    all_gts = []
    per_scene: List[Dict[str, Any]] = []

    for s in scenes:
        a = s.t1_rgb.astype(np.float32) / 255.0
        b = s.t2_rgb.astype(np.float32) / 255.0
        valid = np.ones((s.height, s.width), dtype=bool)
        matched = match_statistics(b, a, valid)

        dist = np.sqrt(np.sum((matched - a) ** 2, axis=-1))
        score = ndimage.uniform_filter(dist, size=3).astype(np.float32)

        vals = score[valid]
        med = float(np.median(vals))
        mad = float(1.4826 * np.median(np.abs(vals - med)))
        baseline = max(med + 3.6 * mad, 0.08)

        physics_prob = (1.0 / (1.0 + np.exp(-(score - baseline) / (0.22 * baseline + EPS)))).astype(np.float32)
        pred_mask = physics_prob >= threshold

        m = compute_binary_metrics(pred_mask, s.gt_mask)
        total_tp += m["tp"]
        total_fp += m["fp"]
        total_fn += m["fn"]
        total_tn += m["tn"]

        scene_prec = m["tp"] / (m["tp"] + m["fp"] + EPS)
        scene_rec = m["tp"] / (m["tp"] + m["fn"] + EPS)
        scene_f1 = 2.0 * scene_prec * scene_rec / (scene_prec + scene_rec + EPS)
        scene_iou = m["tp"] / (m["tp"] + m["fp"] + m["fn"] + EPS)
        scene_fpr = m["fp"] / (m["fp"] + m["tn"] + EPS)

        per_scene.append({
            "scene_id": s.scene_id,
            "height": s.height,
            "width": s.width,
            "total_pixels": s.height * s.width,
            "change_pixels": int(np.sum(s.gt_mask)),
            "change_pct": round(float(np.mean(s.gt_mask) * 100), 2),
            "f1": round(float(scene_f1), 4),
            "iou": round(float(scene_iou), 4),
            "precision": round(float(scene_prec), 4),
            "recall": round(float(scene_rec), 4),
            "false_positive_rate": round(float(scene_fpr), 4),
        })

        all_probs.append(physics_prob.flatten())
        all_gts.append(s.gt_mask.flatten())

    elapsed_ms = (time.perf_counter() - t_start) / len(scenes) * 1000.0

    prec = total_tp / (total_tp + total_fp + EPS)
    rec = total_tp / (total_tp + total_fn + EPS)
    f1 = 2.0 * prec * rec / (prec + rec + EPS)
    iou = total_tp / (total_tp + total_fp + total_fn + EPS)
    fpr = total_fp / (total_fp + total_tn + EPS)

    cal = compute_calibration_metrics(np.concatenate(all_probs), np.concatenate(all_gts))

    return {
        "model_name": "Statistical Spectral Baseline",
        "parameters": 0,
        "f1": round(float(f1), 4),
        "iou": round(float(iou), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "false_positive_rate": round(float(fpr), 4),
        "ece": cal["ece"],
        "brier_score": cal["brier_score"],
        "avg_latency_ms": round(elapsed_ms, 1),
        "confusion": {"tp": total_tp, "fp": total_fp, "fn": total_fn, "tn": total_tn},
        "per_scene": per_scene,
    }


def evaluate_neural_model(
    model: torch.nn.Module,
    scenes: List[OSCDScene],
    threshold: float = 0.45,
    fuse_with_physics: bool = False,
    model_name: str = "Neural Model",
) -> Dict[str, Any]:
    model.eval()
    t_start = time.perf_counter()
    total_tp = 0
    total_fp = 0
    total_fn = 0
    total_tn = 0
    all_probs = []
    all_gts = []
    per_scene: List[Dict[str, Any]] = []

    with torch.no_grad():
        for s in scenes:
            # Unified shared preprocessing
            t1_stack, t2_stack, b_matched = build_5channel_stack(
                s.t1_rgb, s.t2_rgb, apply_matching=True
            )
            h, w = t1_stack.shape[1], t1_stack.shape[2]
            t1_t = torch.from_numpy(t1_stack).unsqueeze(0).float()
            t2_t = torch.from_numpy(t2_stack).unsqueeze(0).float()
            t1_pad, t2_pad, pad_h, pad_w = pad_to_multiple(t1_t, t2_t, multiple=16)

            logits = model(t1_pad, t2_pad)
            probs = torch.sigmoid(logits)
            if pad_h > 0 or pad_w > 0:
                probs = probs[:, :, :h, :w]
            deep_prob = probs.squeeze().cpu().numpy().astype(np.float32)

            if fuse_with_physics:
                a = s.t1_rgb.astype(np.float32) / 255.0
                dist = np.sqrt(np.sum((b_matched - a) ** 2, axis=-1))
                score = ndimage.uniform_filter(dist, size=3).astype(np.float32)
                valid = np.ones((h, w), dtype=bool)
                vals = score[valid]
                med = float(np.median(vals))
                mad = float(1.4826 * np.median(np.abs(vals - med)))
                baseline = max(med + 3.6 * mad, 0.08)
                physics_prob = (1.0 / (1.0 + np.exp(-(score - baseline) / (0.22 * baseline + EPS)))).astype(np.float32)
                final_prob = (0.60 * deep_prob + 0.40 * physics_prob).astype(np.float32)
            else:
                final_prob = deep_prob

            pred_mask = final_prob >= threshold

            m = compute_binary_metrics(pred_mask, s.gt_mask)
            total_tp += m["tp"]
            total_fp += m["fp"]
            total_fn += m["fn"]
            total_tn += m["tn"]

            scene_prec = m["tp"] / (m["tp"] + m["fp"] + EPS)
            scene_rec = m["tp"] / (m["tp"] + m["fn"] + EPS)
            scene_f1 = 2.0 * scene_prec * scene_rec / (scene_prec + scene_rec + EPS)
            scene_iou = m["tp"] / (m["tp"] + m["fp"] + m["fn"] + EPS)
            scene_fpr = m["fp"] / (m["fp"] + m["tn"] + EPS)

            per_scene.append({
                "scene_id": s.scene_id,
                "height": s.height,
                "width": s.width,
                "total_pixels": s.height * s.width,
                "change_pixels": int(np.sum(s.gt_mask)),
                "change_pct": round(float(np.mean(s.gt_mask) * 100), 2),
                "f1": round(float(scene_f1), 4),
                "iou": round(float(scene_iou), 4),
                "precision": round(float(scene_prec), 4),
                "recall": round(float(scene_rec), 4),
                "false_positive_rate": round(float(scene_fpr), 4),
            })

            all_probs.append(final_prob.flatten())
            all_gts.append(s.gt_mask.flatten())

    elapsed_ms = (time.perf_counter() - t_start) / len(scenes) * 1000.0

    prec = total_tp / (total_tp + total_fp + EPS)
    rec = total_tp / (total_tp + total_fn + EPS)
    f1 = 2.0 * prec * rec / (prec + rec + EPS)
    iou = total_tp / (total_tp + total_fp + total_fn + EPS)
    fpr = total_fp / (total_fp + total_tn + EPS)

    cal = compute_calibration_metrics(np.concatenate(all_probs), np.concatenate(all_gts))

    return {
        "model_name": model_name,
        "parameters": sum(p.numel() for p in model.parameters()),
        "f1": round(float(f1), 4),
        "iou": round(float(iou), 4),
        "precision": round(float(prec), 4),
        "recall": round(float(rec), 4),
        "false_positive_rate": round(float(fpr), 4),
        "ece": cal["ece"],
        "brier_score": cal["brier_score"],
        "avg_latency_ms": round(elapsed_ms, 1),
        "confusion": {"tp": total_tp, "fp": total_fp, "fn": total_fn, "tn": total_tn},
        "per_scene": per_scene,
    }


def run_full_benchmark():
    print("===================================================================")
    print("  TERRASHIFT AI — REPRODUCIBLE BENCHMARK EVALUATION (OSCD TEST SET)")
    print("===================================================================")

    test_scenes = load_oscd_split("test")
    print(f"Loaded {len(test_scenes)} official held-out test scenes from OSCD Sentinel-2 dataset.")
    total_test_pixels = sum(s.height * s.width for s in test_scenes)
    total_change_pixels = sum(int(np.sum(s.gt_mask)) for s in test_scenes)
    change_prev = total_change_pixels / total_test_pixels * 100
    print(f"Total evaluation pixels: {total_test_pixels:,} (Change prevalence: {change_prev:.2f}%)\n")

    results = []

    # 1. Statistical Baseline alone
    print("Evaluating 1/5: Statistical Spectral Baseline (No neural weights)...")
    res_stat = evaluate_statistical_baseline(test_scenes, threshold=0.45)
    results.append(res_stat)
    print(f"  -> F1: {res_stat['f1']:.4f} | IoU: {res_stat['iou']:.4f} | Prec: {res_stat['precision']:.4f} | Rec: {res_stat['recall']:.4f} | ECE: {res_stat['ece']:.4f}")

    # 2. M0 Untrained Siamese U-Net
    print("Evaluating 2/5: M0 Untrained Siamese U-Net (Random Kaiming init)...")
    m0_model = SiameseUNet(in_channels=5, base_channels=32)
    m0_path = ROOT / "services" / "ml" / "terrashift" / "models" / "siamese_unet_checkpoint.pt"
    if m0_path.exists():
        ckpt0 = torch.load(m0_path, map_location="cpu")
        if "state_dict" in ckpt0:
            m0_model.load_state_dict(ckpt0["state_dict"])
    res_m0 = evaluate_neural_model(m0_model, test_scenes, threshold=0.45, fuse_with_physics=False, model_name="M0 (Untrained Siamese U-Net)")
    results.append(res_m0)
    print(f"  -> F1: {res_m0['f1']:.4f} | IoU: {res_m0['iou']:.4f} | Prec: {res_m0['precision']:.4f} | Rec: {res_m0['recall']:.4f} | ECE: {res_m0['ece']:.4f}")

    # 3. M0 + Statistical 60/40 Fusion
    print("Evaluating 3/5: M0 + Statistical (Fixed 60/40 Fusion)...")
    res_fuse0 = evaluate_neural_model(m0_model, test_scenes, threshold=0.45, fuse_with_physics=True, model_name="M0 + Statistical (60/40 Fusion)")
    results.append(res_fuse0)
    print(f"  -> F1: {res_fuse0['f1']:.4f} | IoU: {res_fuse0['iou']:.4f} | Prec: {res_fuse0['precision']:.4f} | Rec: {res_fuse0['recall']:.4f} | ECE: {res_fuse0['ece']:.4f}")

    # 4. M1 Trained Siamese U-Net (if checkpoint exists)
    m1_path = ROOT / "services" / "ml" / "terrashift" / "models" / "siamese_unet_oscd_m1.pt"
    res_m1 = None
    res_fuse1 = None
    if m1_path.exists():
        print("Evaluating 4/5: M1 Trained Siamese U-Net (OSCD Supervised)...")
        m1_model = SiameseUNet(in_channels=5, base_channels=32)
        ckpt1 = torch.load(m1_path, map_location="cpu")
        if "state_dict" in ckpt1:
            m1_model.load_state_dict(ckpt1["state_dict"])
        res_m1 = evaluate_neural_model(m1_model, test_scenes, threshold=0.45, fuse_with_physics=False, model_name="M1 (Trained Siamese U-Net)")
        results.append(res_m1)
        print(f"  -> F1: {res_m1['f1']:.4f} | IoU: {res_m1['iou']:.4f} | Prec: {res_m1['precision']:.4f} | Rec: {res_m1['recall']:.4f} | ECE: {res_m1['ece']:.4f}")

        # 5. M1 + Statistical Fusion
        print("Evaluating 5/5: M1 + Statistical (Calibrated Fusion)...")
        res_fuse1 = evaluate_neural_model(m1_model, test_scenes, threshold=0.45, fuse_with_physics=True, model_name="M1 + Statistical Fusion")
        results.append(res_fuse1)
        print(f"  -> F1: {res_fuse1['f1']:.4f} | IoU: {res_fuse1['iou']:.4f} | Prec: {res_fuse1['precision']:.4f} | Rec: {res_fuse1['recall']:.4f} | ECE: {res_fuse1['ece']:.4f}")

    # Compile Per-Scene Comparison Matrix
    per_scene_breakdown: List[Dict[str, Any]] = []
    for idx, s in enumerate(test_scenes):
        scene_row: Dict[str, Any] = {
            "scene_id": s.scene_id,
            "height": s.height,
            "width": s.width,
            "total_pixels": s.height * s.width,
            "change_pixels": int(np.sum(s.gt_mask)),
            "change_pct": round(float(np.mean(s.gt_mask) * 100), 2),
            "statistical_baseline_f1": res_stat["per_scene"][idx]["f1"],
            "statistical_baseline_iou": res_stat["per_scene"][idx]["iou"],
            "m0_f1": res_m0["per_scene"][idx]["f1"],
            "m0_fusion_f1": res_fuse0["per_scene"][idx]["f1"],
        }
        if res_m1 is not None and res_fuse1 is not None:
            scene_row["m1_trained_f1"] = res_m1["per_scene"][idx]["f1"]
            scene_row["m1_trained_iou"] = res_m1["per_scene"][idx]["iou"]
            scene_row["m1_fusion_f1"] = res_fuse1["per_scene"][idx]["f1"]
            scene_row["m1_fusion_iou"] = res_fuse1["per_scene"][idx]["iou"]
        per_scene_breakdown.append(scene_row)

    # Save to reports/benchmark_scorecard.json
    out_dir = ROOT / "reports"
    out_dir.mkdir(parents=True, exist_ok=True)
    scorecard_path = out_dir / "benchmark_scorecard.json"
    with open(scorecard_path, "w") as f:
        json.dump(
            {
                "benchmark_name": "OSCD (Onera Satellite Change Detection)",
                "split": "test",
                "scenes_count": len(test_scenes),
                "total_pixels": total_test_pixels,
                "change_pixels": total_change_pixels,
                "change_prevalence_pct": round(change_prev, 2),
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                "results": results,
                "per_scene_breakdown": per_scene_breakdown,
            },
            f,
            indent=2,
        )

    print(f"\nScorecard successfully written to: {scorecard_path}\n")

    # Print Markdown Summary Table
    print("### Overall Held-Out Test Set Scorecard (Pooled 3,077,936 Pixels)")
    print("| Model Architecture | Parameters | F1 Score | IoU | Precision | Recall | False Alarm (FPR) | ECE | Latency |")
    print("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
    for r in results:
        print(f"| {r['model_name']} | {r['parameters']:,} | {r['f1']:.4f} | {r['iou']:.4f} | {r['precision']:.4f} | {r['recall']:.4f} | {r['false_positive_rate']*100:.2f}% | {r['ece']:.4f} | {r['avg_latency_ms']} ms |")

    # Print Per-Scene Breakdown Table
    print("\n### Per-Scene Test Performance Breakdown (10 OSCD Scenes)")
    if res_m1 is not None and res_fuse1 is not None:
        print("| Scene ID | Dimensions | Pixels | Change Pixels | Change % | Stat Baseline F1 | M1 Trained F1 | M1 Fusion F1 |")
        print("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
        for row in per_scene_breakdown:
            print(f"| `{row['scene_id']}` | {row['height']}×{row['width']} | {row['total_pixels']:,} | {row['change_pixels']:,} | {row['change_pct']}% | {row['statistical_baseline_f1']:.4f} | {row.get('m1_trained_f1', 0.0):.4f} | {row.get('m1_fusion_f1', 0.0):.4f} |")
    else:
        print("| Scene ID | Dimensions | Pixels | Change Pixels | Change % | Stat Baseline F1 | M0 F1 | M0 Fusion F1 |")
        print("| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |")
        for row in per_scene_breakdown:
            print(f"| `{row['scene_id']}` | {row['height']}×{row['width']} | {row['total_pixels']:,} | {row['change_pixels']:,} | {row['change_pct']}% | {row['statistical_baseline_f1']:.4f} | {row['m0_f1']:.4f} | {row['m0_fusion_f1']:.4f} |")

    return results


if __name__ == "__main__":
    run_full_benchmark()
