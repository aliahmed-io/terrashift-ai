"""Scene Classification Layer (SCL) and QA60 cloud/shadow detection and rejection."""

from typing import Set
import numpy as np
from numpy.typing import NDArray

# Sentinel-2 L2A SCL invalid codes:
# 1 = Saturated/Defective, 3 = Cloud Shadows, 8 = Medium Cloud, 9 = High Cloud, 10 = Thin Cirrus
INVALID_SCL_CLASSES: Set[int] = {1, 3, 8, 9, 10}

def build_cloud_mask(scl_band: NDArray[np.uint8]) -> NDArray[np.bool_]:
    """Generate boolean mask where True indicates cloud, shadow, or sensor defect.
    Input: scl_band (H, W) uint8 array of SCL classes.
    Output: boolean mask (H, W) where True = cloudy/invalid pixel.
    """
    mask = np.isin(scl_band, list(INVALID_SCL_CLASSES))
    return mask

def calculate_cloud_fraction(cloud_mask: NDArray[np.bool_]) -> float:
    """Calculate percentage of pixels in the AOI obscured by clouds or shadows [0.0, 100.0]."""
    total_pixels = cloud_mask.size
    if total_pixels == 0:
        return 0.0
    cloudy_pixels = np.count_nonzero(cloud_mask)
    return float((cloudy_pixels / total_pixels) * 100.0)

def qa60_cloud_mask(qa60: NDArray[np.uint16]) -> NDArray[np.bool_]:
    """Fallback cloud detection using Level-1C QA60 quality band.
    Bit 10: Opaque clouds (1024)
    Bit 11: Cirrus clouds (2048)
    """
    opaque = (qa60 & (1 << 10)) > 0
    cirrus = (qa60 & (1 << 11)) > 0
    return opaque | cirrus
