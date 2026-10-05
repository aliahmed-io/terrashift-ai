"""Statistical bi-temporal change detection on co-registered RGB mosaics."""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from numpy.typing import NDArray
from scipy import ndimage

EPS = 1e-6


@dataclass
class Detection:
    score: NDArray[np.float32]
    probability: NDArray[np.float32]
    mask: NDArray[np.bool_]
    threshold: float


def greenness(rgb: NDArray[np.float32]) -> NDArray[np.float32]:
    """Excess-green index scaled to roughly NDVI range, from RGB in [0, 1]."""
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    exg = (2.0 * g - r - b) / (r + g + b + EPS)
    return np.clip(exg * 2.5, -1.0, 1.0).astype(np.float32)


def bareness(rgb: NDArray[np.float32]) -> NDArray[np.float32]:
    """Red/green ratio index: high for exposed soil and built surfaces."""
    r, g = rgb[..., 0], rgb[..., 1]
    return np.clip((r - g) / (r + g + EPS) * 4.0, -1.0, 1.0).astype(np.float32)


def match_statistics(source: NDArray[np.float32], reference: NDArray[np.float32], valid: NDArray[np.bool_]) -> NDArray[np.float32]:
    """Match per-channel median and MAD of `source` to `reference`.

    Removes global illumination and composite tone differences between acquisition years.
    Median/MAD are robust, so the changed pixels themselves do not bias the fit.
    """
    out = np.empty_like(source)
    for c in range(3):
        s = source[..., c][valid]
        r = reference[..., c][valid]
        s_med, r_med = float(np.median(s)), float(np.median(r))
        s_mad = float(np.median(np.abs(s - s_med)))
        r_mad = float(np.median(np.abs(r - r_med)))
        gain = float(np.clip((r_mad + EPS) / (s_mad + EPS), 0.5, 2.0))
        out[..., c] = (source[..., c] - s_med) * gain + r_med
    return np.clip(out, 0.0, 1.0)


def detect_change(
    rgb1: NDArray[np.uint8],
    rgb2: NDArray[np.uint8],
    valid: NDArray[np.bool_],
) -> tuple[Detection, NDArray[np.float32]]:
    """Return the detection and the radiometrically matched T2 image (float RGB in [0, 1])."""
    a = rgb1.astype(np.float32) / 255.0
    b = rgb2.astype(np.float32) / 255.0
    matched = match_statistics(b, a, valid)

    dist = np.sqrt(np.sum((matched - a) ** 2, axis=-1))
    score = ndimage.uniform_filter(dist, size=3).astype(np.float32)

    values = score[valid]
    median = float(np.median(values))
    mad = float(1.4826 * np.median(np.abs(values - median)))
    threshold = max(median + 4.0 * mad, 0.09)

    probability = (1.0 / (1.0 + np.exp(-(score - threshold) / (0.25 * threshold)))).astype(np.float32)
    mask = (score > threshold) & valid
    mask = ndimage.binary_opening(mask, structure=np.ones((3, 3), dtype=bool))
    mask = ndimage.binary_closing(mask, structure=np.ones((3, 3), dtype=bool)) & valid
    return Detection(score=score, probability=probability, mask=mask, threshold=threshold), matched
