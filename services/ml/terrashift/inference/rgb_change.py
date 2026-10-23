"""Deep learning and physics-guided bi-temporal change detection using PyTorch Siamese U-Net."""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Dict, Optional, Tuple

import numpy as np
from numpy.typing import NDArray
from scipy import ndimage

from terrashift.inference.preprocessing import (
    EPS,
    bareness,
    build_5channel_stack,
    greenness,
    match_statistics,
    pad_to_multiple,
)

try:
    import torch
    import torch.nn.functional as F
    from terrashift.models.siamese_unet import SiameseUNet

    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

_MODEL_INSTANCE: Optional[Any] = None
_MODEL_LOAD_ERROR: Optional[str] = None
_MODEL_CHECKPOINT_PATH: Optional[str] = None


def get_siamese_model() -> Optional[Any]:
    """Strict singleton getter for the PyTorch Siamese U-Net model.

    Safety requirements:
    1. Requires an existing, compatible trained checkpoint on disk.
    2. Validates state dictionary keys and verifies trained BatchNorm statistics (num_batches_tracked > 0).
    3. Never swallows checkpoint errors or returns an uninitialized random-weight model.
    4. Returns None on any loading defect, setting _MODEL_LOAD_ERROR for observable reporting.
    """
    global _MODEL_INSTANCE, _MODEL_LOAD_ERROR, _MODEL_CHECKPOINT_PATH
    if not HAS_TORCH:
        _MODEL_LOAD_ERROR = "PyTorch is not available in environment"
        return None
    if _MODEL_INSTANCE is not None:
        return _MODEL_INSTANCE

    ckpt_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..", "models", "siamese_unet_oscd_m1.pt")
    )
    if not os.path.exists(ckpt_path):
        _MODEL_LOAD_ERROR = f"Trained checkpoint not found at {ckpt_path}"
        return None

    try:
        model = SiameseUNet(in_channels=5, base_channels=32)
        ckpt = torch.load(ckpt_path, map_location="cpu")
        state = ckpt["state_dict"] if (isinstance(ckpt, dict) and "state_dict" in ckpt) else ckpt

        if not isinstance(state, dict):
            _MODEL_LOAD_ERROR = f"Checkpoint format invalid: expected dict, got {type(state)}"
            return None

        # Verify weights were genuinely trained by checking BatchNorm statistics
        bn_tracked = [
            v.item()
            for k, v in state.items()
            if "num_batches_tracked" in k and hasattr(v, "item")
        ]
        if bn_tracked and max(bn_tracked) == 0:
            _MODEL_LOAD_ERROR = "Checkpoint contains untrained weights (num_batches_tracked == 0)"
            return None

        model.load_state_dict(state, strict=True)
        model.eval()

        _MODEL_INSTANCE = model
        _MODEL_LOAD_ERROR = None
        _MODEL_CHECKPOINT_PATH = ckpt_path
        return _MODEL_INSTANCE
    except Exception as exc:
        _MODEL_LOAD_ERROR = f"Strict checkpoint loading failed: {exc}"
        _MODEL_INSTANCE = None
        return None


@dataclass
class Detection:
    score: NDArray[np.float32]
    probability: NDArray[np.float32]
    mask: NDArray[np.bool_]
    threshold: float
    model_metadata: Dict[str, Any]


def detect_change(
    rgb1: NDArray[np.uint8],
    rgb2: NDArray[np.uint8],
    valid: NDArray[np.bool_],
    threshold: float = 0.50,
) -> Tuple[Detection, NDArray[np.float32]]:
    """Return Siamese detection and radiometrically matched T2 image (float RGB in [0, 1])."""
    # 1. Standardized 5-Channel Preprocessing via shared contract
    t1_stack, t2_stack, matched = build_5channel_stack(
        rgb1, rgb2, valid=valid, apply_matching=True
    )
    a = (rgb1.astype(np.float32) / 255.0)

    # 2. Spectral Euclidean Distance & Statistical Outlier score
    dist = np.sqrt(np.sum((matched - a) ** 2, axis=-1))
    score = ndimage.uniform_filter(dist, size=3).astype(np.float32)

    values = score[valid]
    median = float(np.median(values)) if len(values) > 0 else 0.0
    mad = float(1.4826 * np.median(np.abs(values - median))) if len(values) > 0 else 0.01
    stat_baseline = max(median + 3.6 * mad, 0.08)

    physics_prob = (
        1.0 / (1.0 + np.exp(-(score - stat_baseline) / (0.22 * stat_baseline + EPS)))
    ).astype(np.float32)

    # 3. Deep Neural Network Forward Pass via PyTorch Siamese U-Net
    deep_prob: Optional[NDArray[np.float32]] = None
    neural_error: Optional[str] = None
    model = get_siamese_model()

    if model is not None and HAS_TORCH:
        try:
            h, w = t1_stack.shape[1], t1_stack.shape[2]
            t1_t = torch.from_numpy(t1_stack).unsqueeze(0).float()
            t2_t = torch.from_numpy(t2_stack).unsqueeze(0).float()
            t1_pad, t2_pad, pad_h, pad_w = pad_to_multiple(t1_t, t2_t, multiple=16)

            with torch.no_grad():
                logits = model(t1_pad, t2_pad)
                probs = torch.sigmoid(logits)
                if pad_h > 0 or pad_w > 0:
                    probs = probs[:, :, :h, :w]
                deep_prob = probs.squeeze().cpu().numpy().astype(np.float32)
        except Exception as exc:
            deep_prob = None
            neural_error = f"Forward pass error: {exc}"

    # 4. Explicit Inference Mode & Ensemble Scoring
    if deep_prob is not None:
        inference_mode = "neural_plus_heuristic"
        # Weighted ensemble of deep structural posterior and physical outlier score
        probability = (0.60 * deep_prob + 0.40 * physics_prob).astype(np.float32)
    else:
        inference_mode = "statistical_fallback"
        probability = physics_prob

    # 5. Binary mask grounded directly in decision threshold tau
    clamped_tau = float(np.clip(threshold, 0.10, 0.90))
    mask = (probability >= clamped_tau) & valid
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3), dtype=bool))
    mask = ndimage.binary_opening(mask, structure=np.ones((3, 3), dtype=bool)) & valid

    valid_count = max(int(np.sum(valid)), 1)
    changed_count = int(np.sum(mask))

    model_metadata = {
        "architecture": "Siamese U-Net (PyTorch 2.1)",
        "parameter_count": 2102145,
        "inference_mode": inference_mode,
        "checkpoint_status": {
            "loaded": bool(deep_prob is not None),
            "path": _MODEL_CHECKPOINT_PATH if deep_prob is not None else None,
            "error": neural_error or _MODEL_LOAD_ERROR,
        },
        "input_channels": [
            "Red (EOX R)",
            "Green (EOX G)",
            "Blue (EOX B)",
            "Excess-Green Index (NDVI optical proxy)",
            "Red/Green Bareness Index (NDBI optical proxy)",
        ],
        "preprocessing": "Shared contract: Median/MAD robust channel harmonization + 5-ch tensor stack",
        "ensemble_weights": {"neural": 0.60, "heuristic": 0.40} if deep_prob is not None else {"heuristic": 1.0},
        "threshold_tau": clamped_tau,
        "live_scene_statistics": {
            "changed_pixels": changed_count,
            "changed_pct": round((changed_count / float(valid_count)) * 100.0, 2),
            "mean_ensemble_score": round(float(np.mean(probability[valid])), 4),
            "ground_truth_available": False,
            "note": "Current scene does not have ground truth labels. Evaluated scores are available on held-out OSCD benchmark (/benchmarks).",
        },
    }

    return (
        Detection(
            score=score,
            probability=probability,
            mask=mask,
            threshold=clamped_tau,
            model_metadata=model_metadata,
        ),
        matched,
    )
