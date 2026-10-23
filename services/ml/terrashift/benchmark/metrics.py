"""Standardized evaluation metrics for change detection and probability calibration.

Includes:
- Precision, Recall, F1, IoU, False Positive Rate (FPR)
- Confusion counts: TP, FP, FN, TN
- Probability calibration: Expected Calibration Error (ECE) and Brier Score
"""

from __future__ import annotations

from typing import Any, Dict, List, Tuple
import numpy as np
from numpy.typing import NDArray

EPS = 1e-7


def compute_binary_metrics(
    pred_mask: NDArray[np.bool_],
    gt_mask: NDArray[np.bool_],
    valid_mask: Optional[NDArray[np.bool_]] = None,
) -> Dict[str, Any]:
    """Compute exact pixel-level confusion matrix and derived binary change detection metrics."""
    if valid_mask is not None:
        p = pred_mask & valid_mask
        g = gt_mask & valid_mask
        total = int(np.sum(valid_mask))
    else:
        p = pred_mask
        g = gt_mask
        total = pred_mask.size

    tp = int(np.sum(p & g))
    fp = int(np.sum(p & ~g))
    fn = int(np.sum(~p & g))
    tn = int(np.sum(~p & ~g))

    precision = float(tp / (tp + fp + EPS))
    recall = float(tp / (tp + fn + EPS))
    f1 = float(2.0 * precision * recall / (precision + recall + EPS))
    iou = float(tp / (tp + fp + fn + EPS))
    fpr = float(fp / (fp + tn + EPS))  # False Alarm Rate
    accuracy = float((tp + tn) / (total + EPS))

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
        "total_pixels": total,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "iou": round(iou, 4),
        "false_positive_rate": round(fpr, 4),
        "accuracy": round(accuracy, 4),
    }


def compute_calibration_metrics(
    probabilities: NDArray[np.float32],
    gt_mask: NDArray[np.bool_],
    n_bins: int = 10,
    valid_mask: Optional[NDArray[np.bool_]] = None,
) -> Dict[str, Any]:
    """Compute Expected Calibration Error (ECE) and Brier Score across binned probabilities.

    Reference:
    - Guo et al., 'On Calibration of Modern Neural Networks', ICML 2017.
    """
    if valid_mask is not None:
        probs = probabilities[valid_mask].flatten()
        labels = gt_mask[valid_mask].flatten().astype(np.float32)
    else:
        probs = probabilities.flatten()
        labels = gt_mask.flatten().astype(np.float32)

    total_samples = len(probs)
    if total_samples == 0:
        return {"ece": 0.0, "brier_score": 0.0, "bins": []}

    # Brier Score: Mean Squared Error of probability vs true binary label
    brier_score = float(np.mean((probs - labels) ** 2))

    # ECE computation
    bin_boundaries = np.linspace(0.0, 1.0, n_bins + 1)
    ece = 0.0
    bin_details: List[Dict[str, Any]] = []

    for i in range(n_bins):
        b_low = bin_boundaries[i]
        b_high = bin_boundaries[i + 1]

        if i == n_bins - 1:
            in_bin = (probs >= b_low) & (probs <= b_high)
        else:
            in_bin = (probs >= b_low) & (probs < b_high)

        count = int(np.sum(in_bin))
        if count > 0:
            avg_prob = float(np.mean(probs[in_bin]))
            acc = float(np.mean(labels[in_bin]))
            bin_err = abs(acc - avg_prob)
            ece += (count / total_samples) * bin_err

            bin_details.append(
                {
                    "bin_low": round(float(b_low), 2),
                    "bin_high": round(float(b_high), 2),
                    "count": count,
                    "avg_confidence": round(avg_prob, 4),
                    "empirical_accuracy": round(acc, 4),
                    "calibration_gap": round(bin_err, 4),
                }
            )

    return {
        "ece": round(float(ece), 4),
        "brier_score": round(brier_score, 4),
        "n_bins": n_bins,
        "bins": bin_details,
    }
