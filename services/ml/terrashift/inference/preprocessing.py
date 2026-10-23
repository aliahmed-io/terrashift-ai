"""Unified Remote Sensing Preprocessing Contract for TerraShift AI.

Ensures identical input transformations across:
1. Training (patch sampling)
2. Validation (uncropped scenes)
3. Held-out benchmark evaluation
4. Production live inference
"""

from __future__ import annotations

from typing import Optional, Tuple
import numpy as np
from numpy.typing import NDArray

try:
    import torch
    import torch.nn.functional as F
    HAS_TORCH = True
except ImportError:
    HAS_TORCH = False

EPS = 1e-6


def greenness(rgb: NDArray[np.float32]) -> NDArray[np.float32]:
    """Excess-green index scaled to roughly [-1, 1], from float RGB in [0, 1].

    Formula: ExG = (2*G - R - B) / (R + G + B + eps)
    Scaled by 2.5 and clipped to [-1.0, 1.0].
    """
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    exg = (2.0 * g - r - b) / (r + g + b + EPS)
    return np.clip(exg * 2.5, -1.0, 1.0).astype(np.float32)


def bareness(rgb: NDArray[np.float32]) -> NDArray[np.float32]:
    """Red/green ratio bareness index: high for exposed soil, graded ground, and built fabric.

    Formula: Bareness = (R - G) / (R + G + eps)
    Scaled by 4.0 and clipped to [-1.0, 1.0].
    """
    r, g = rgb[..., 0], rgb[..., 1]
    return np.clip((r - g) / (r + g + EPS) * 4.0, -1.0, 1.0).astype(np.float32)


def match_statistics(
    source: NDArray[np.float32],
    reference: NDArray[np.float32],
    valid: Optional[NDArray[np.bool_]] = None,
) -> NDArray[np.float32]:
    """Match per-channel median and MAD of `source` to `reference`.

    Removes global illumination and composite tone differences between acquisition years.
    Median and MAD have a 50% breakdown point, so genuine change pixels do not distort the fit.
    """
    if valid is None:
        valid = np.ones(source.shape[:2], dtype=bool)

    if not np.any(valid):
        return source.copy()

    out = np.empty_like(source)
    for c in range(3):
        s = source[..., c][valid]
        r = reference[..., c][valid]
        s_med = float(np.median(s)) if len(s) > 0 else 0.0
        r_med = float(np.median(r)) if len(r) > 0 else 0.0
        s_mad = float(np.median(np.abs(s - s_med))) if len(s) > 0 else 0.01
        r_mad = float(np.median(np.abs(r - r_med))) if len(r) > 0 else 0.01
        gain = float(np.clip((r_mad + EPS) / (s_mad + EPS), 0.5, 2.0))
        out[..., c] = (source[..., c] - s_med) * gain + r_med
    return np.clip(out, 0.0, 1.0).astype(np.float32)


def build_5channel_stack(
    t1: NDArray[np.uint8 | np.float32],
    t2: NDArray[np.uint8 | np.float32],
    valid: Optional[NDArray[np.bool_]] = None,
    apply_matching: bool = True,
) -> Tuple[NDArray[np.float32], NDArray[np.float32], NDArray[np.float32]]:
    """Convert bitemporal RGB pair into standardized 5-channel feature stacks.

    Returns:
        t1_stack: (5, H, W) float32 stack [R, G, B, ExG, Bareness] in [0, 1] / [-1, 1]
        t2_stack: (5, H, W) float32 stack [R, G, B, ExG, Bareness]
        t2_matched: (H, W, 3) float32 radiometrically harmonized RGB image
    """
    a = (t1.astype(np.float32) / 255.0) if t1.dtype == np.uint8 else t1.astype(np.float32)
    b = (t2.astype(np.float32) / 255.0) if t2.dtype == np.uint8 else t2.astype(np.float32)

    if valid is None:
        valid = np.ones(a.shape[:2], dtype=bool)

    matched = match_statistics(b, a, valid) if apply_matching else b

    ndvi1 = greenness(a)
    ndvi2 = greenness(matched)
    ndbi1 = bareness(a)
    ndbi2 = bareness(matched)

    t1_stack = np.stack([a[..., 0], a[..., 1], a[..., 2], ndvi1, ndbi1], axis=0).astype(np.float32)
    t2_stack = np.stack([matched[..., 0], matched[..., 1], matched[..., 2], ndvi2, ndbi2], axis=0).astype(np.float32)

    return t1_stack, t2_stack, matched


def pad_to_multiple(
    t1_t: torch.Tensor,
    t2_t: torch.Tensor,
    multiple: int = 16,
) -> Tuple[torch.Tensor, torch.Tensor, int, int]:
    """Reflect-pad spatial dimensions to nearest multiple for U-Net down/up-sampling."""
    h, w = t1_t.shape[-2], t1_t.shape[-1]
    pad_h = (multiple - h % multiple) % multiple
    pad_w = (multiple - w % multiple) % multiple

    if pad_h > 0 or pad_w > 0:
        t1_padded = F.pad(t1_t, (0, pad_w, 0, pad_h), mode="reflect")
        t2_padded = F.pad(t2_t, (0, pad_w, 0, pad_h), mode="reflect")
        return t1_padded, t2_padded, pad_h, pad_w
    return t1_t, t2_t, 0, 0
