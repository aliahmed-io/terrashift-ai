"""Change classification for detected polygons."""

from typing import Dict, Literal

ChangeClass = Literal[
    "vegetation_loss_to_bare",
    "vegetation_to_built",
    "bare_to_built",
    "water_change",
    "unclassified_physical_change",
]

CLASS_LABELS: Dict[ChangeClass, str] = {
    "vegetation_loss_to_bare": "Vegetation loss to bare soil",
    "vegetation_to_built": "Greenfield to built structure",
    "bare_to_built": "Bare ground to construction",
    "water_change": "Water boundary shift",
    "unclassified_physical_change": "Ground surface change",
}


def classify_change(
    mean_ndvi_t1: float,
    mean_ndvi_t2: float,
    mean_ndbi_t1: float,
    mean_ndbi_t2: float,
    mean_ndwi_t1: float,
    mean_ndwi_t2: float,
) -> ChangeClass:
    """Classify physical ground change using deltas of multispectral indices (L2A pipeline)."""
    d_ndvi = mean_ndvi_t2 - mean_ndvi_t1
    d_ndbi = mean_ndbi_t2 - mean_ndbi_t1
    d_ndwi = mean_ndwi_t2 - mean_ndwi_t1

    if abs(d_ndwi) > 0.25:
        return "water_change"
    if d_ndvi < -0.15 and d_ndbi > 0.08:
        return "vegetation_to_built"
    if d_ndvi < -0.20 and d_ndbi <= 0.05:
        return "vegetation_loss_to_bare"
    if d_ndbi > 0.12:
        return "bare_to_built"
    return "unclassified_physical_change"


RGB_LABELS: Dict[str, str] = {
    "vegetation_loss": "Vegetation loss",
    "vegetation_gain": "Vegetation gain",
    "new_built_or_bare": "New built-up or bare surface",
    "surface_change": "Surface change",
}


def classify_rgb_change(d_green: float, d_bare: float, d_brightness: float) -> str:
    """Classify a change polygon from mean RGB-proxy index deltas (T2 matched minus T1)."""
    if d_green < -0.12:
        return "vegetation_loss"
    if d_green > 0.12:
        return "vegetation_gain"
    if d_bare > 0.08 or d_brightness > 0.06:
        return "new_built_or_bare"
    return "surface_change"
