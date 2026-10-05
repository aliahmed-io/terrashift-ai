"""Raster compositing, band resampling, and AOI window extraction."""

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import numpy as np
from numpy.typing import NDArray
from terrashift.acquisition.cloud import build_cloud_mask, calculate_cloud_fraction
from terrashift.acquisition.stac import SceneRef
from terrashift.features.stack import SentinelBands

@dataclass
class CompositeResult:
    bands: SentinelBands
    cloud_fraction: float
    is_valid: bool
    dimensions: Tuple[int, int]  # (H, W)
    rejection_reason: Optional[str] = None

def resample_band(band: NDArray[np.float32], target_shape: Tuple[int, int]) -> NDArray[np.float32]:
    """Resample band (e.g. 20m SWIR Band 11 to 10m target grid) using bilinear interpolation."""
    from PIL import Image
    im = Image.fromarray(band)
    resampled = im.resize((target_shape[1], target_shape[0]), resample=Image.BILINEAR)
    return np.array(resampled, dtype=np.float32)

def create_synthetic_composite(
    bbox: List[float],
    seed: int,
    target_shape: Tuple[int, int] = (256, 256),
    cloud_pct: float = 5.0,
) -> CompositeResult:
    """Deterministic synthetic composite generator used for unit tests, offline CI,
    and fast local testing without network requests.
    """
    H, W = target_shape
    rng = np.random.default_rng(seed)

    # Base ground reflectances (scaled DN in [0, 10000])
    # Vegetation: low red (600), high NIR (4500)
    # Soil/Built: moderate red (2000), moderate NIR (2500)
    base_terrain = rng.uniform(0.2, 0.8, size=(H, W)).astype(np.float32)
    
    red = (base_terrain * 1200.0 + rng.normal(0, 50, size=(H, W))).clip(200, 4000).astype(np.float32)
    green = (base_terrain * 1400.0 + rng.normal(0, 50, size=(H, W))).clip(200, 4000).astype(np.float32)
    blue = (base_terrain * 1000.0 + rng.normal(0, 50, size=(H, W))).clip(200, 4000).astype(np.float32)
    nir = (base_terrain * 4200.0 + rng.normal(0, 100, size=(H, W))).clip(500, 8000).astype(np.float32)
    swir = (base_terrain * 2100.0 + rng.normal(0, 80, size=(H, W))).clip(300, 5000).astype(np.float32)

    # SCL band: 4=Vegetation, 5=Bare soil
    scl = np.full((H, W), 4, dtype=np.uint8)
    
    # Introduce controlled clouds if requested
    if cloud_pct > 0:
        cloud_pixels = int((cloud_pct / 100.0) * H * W)
        cloud_idx = rng.choice(H * W, size=cloud_pixels, replace=False)
        scl.ravel()[cloud_idx] = 9  # High probability cloud

    c_mask = build_cloud_mask(scl)
    c_fraction = calculate_cloud_fraction(c_mask)

    bands: SentinelBands = {
        "b02": blue,
        "b03": green,
        "b04": red,
        "b08": nir,
        "b11": swir,
    }

    return CompositeResult(
        bands=bands,
        cloud_fraction=c_fraction,
        is_valid=c_fraction <= 20.0,
        dimensions=(H, W),
        rejection_reason="Cloud cover exceeds 20% limit" if c_fraction > 20.0 else None,
    )
