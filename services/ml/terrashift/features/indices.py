"""Radiometric index computations for Sentinel-2 multispectral bands.

Sentinel-2 Level-2A surface reflectance values are scaled integers [0, 10000]
representing reflectance [0.0, 1.0].
"""

import numpy as np
from numpy.typing import NDArray

EPSILON = 1e-6

def ndvi(nir: NDArray[np.float32], red: NDArray[np.float32]) -> NDArray[np.float32]:
    """Normalized Difference Vegetation Index (NDVI) = (NIR - Red) / (NIR + Red).
    Sensitive to live green plant canopy density and chlorophyll absorption.
    Sentinel-2: NIR = Band 8 (842 nm), Red = Band 4 (665 nm).
    """
    numerator = nir - red
    denominator = nir + red + EPSILON
    result = numerator / denominator
    return np.clip(result, -1.0, 1.0).astype(np.float32)

def ndbi(swir: NDArray[np.float32], nir: NDArray[np.float32]) -> NDArray[np.float32]:
    """Normalized Difference Built-up Index (NDBI) = (SWIR - NIR) / (SWIR + NIR).
    Sensitive to urban structures, concrete, asphalt, and bare compacted soils.
    Sentinel-2: SWIR = Band 11 (1610 nm), NIR = Band 8 (842 nm).
    """
    numerator = swir - nir
    denominator = swir + nir + EPSILON
    result = numerator / denominator
    return np.clip(result, -1.0, 1.0).astype(np.float32)

def ndwi(green: NDArray[np.float32], nir: NDArray[np.float32]) -> NDArray[np.float32]:
    """Normalized Difference Water Index (NDWI) = (Green - NIR) / (Green + NIR).
    Sensitive to open water bodies, rivers, and high soil moisture.
    Sentinel-2: Green = Band 3 (560 nm), NIR = Band 8 (842 nm).
    """
    numerator = green - nir
    denominator = green + nir + EPSILON
    result = numerator / denominator
    return np.clip(result, -1.0, 1.0).astype(np.float32)
