"""Band normalization and 5-channel tensor stacking for Siamese U-Net input."""

from typing import TypedDict
import numpy as np
from numpy.typing import NDArray
from terrashift.features.indices import ndvi, ndbi

class SentinelBands(TypedDict):
    b02: NDArray[np.float32]  # Blue (10m)
    b03: NDArray[np.float32]  # Green (10m)
    b04: NDArray[np.float32]  # Red (10m)
    b08: NDArray[np.float32]  # NIR (10m)
    b11: NDArray[np.float32]  # SWIR (20m -> resampled to 10m)

def normalize_rgb(band: NDArray[np.float32], max_val: float = 3000.0) -> NDArray[np.float32]:
    """Normalize raw Sentinel-2 reflectance (typical surface reflectance <= 0.30 or 3000 DN)
    to [0.0, 1.0].
    """
    clipped = np.clip(band, 0.0, max_val)
    return (clipped / max_val).astype(np.float32)

def normalize_index(index_array: NDArray[np.float32]) -> NDArray[np.float32]:
    """Normalize radiometric index values from [-1.0, 1.0] to [0.0, 1.0]."""
    norm = (index_array + 1.0) / 2.0
    return np.clip(norm, 0.0, 1.0).astype(np.float32)

def build_5channel_stack(bands: SentinelBands) -> NDArray[np.float32]:
    """Build a (5, H, W) float32 tensor stack containing:
    Channel 0: Red (B04)
    Channel 1: Green (B03)
    Channel 2: Blue (B02)
    Channel 3: NDVI = (NIR - Red) / (NIR + Red)
    Channel 4: NDBI = (SWIR - NIR) / (SWIR + NIR)
    All channels normalized strictly to [0.0, 1.0].
    """
    red = normalize_rgb(bands["b04"])
    green = normalize_rgb(bands["b03"])
    blue = normalize_rgb(bands["b02"])
    
    # Calculate radiometric indices from unclipped reflectance
    idx_ndvi = normalize_index(ndvi(bands["b08"], bands["b04"]))
    idx_ndbi = normalize_index(ndbi(bands["b11"], bands["b08"]))
    
    stack = np.stack([red, green, blue, idx_ndvi, idx_ndbi], axis=0)
    return stack.astype(np.float32)
