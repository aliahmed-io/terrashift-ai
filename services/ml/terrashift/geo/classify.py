"""Radiometric change classification engine for identified change polygons."""

from dataclasses import dataclass
from typing import Dict, Literal

ChangeClass = Literal[
    "vegetation_loss_to_bare",
    "vegetation_to_built",
    "bare_to_built",
    "water_change",
    "unclassified_physical_change",
]

CLASS_LABELS: Dict[ChangeClass, str] = {
    "vegetation_loss_to_bare": "Vegetation Loss → Bare Soil",
    "vegetation_to_built": "Greenfield / Canopy → Built Structure",
    "bare_to_built": "Bare Ground → Urban Construction",
    "water_change": "Hydrological Boundary Shift",
    "unclassified_physical_change": "Ground Surface Transformation",
}

def classify_change(
    mean_ndvi_t1: float,
    mean_ndvi_t2: float,
    mean_ndbi_t1: float,
    mean_ndbi_t2: float,
    mean_ndwi_t1: float,
    mean_ndwi_t2: float,
) -> ChangeClass:
    """Classify physical ground change using delta of radiometric indices."""
    d_ndvi = mean_ndvi_t2 - mean_ndvi_t1
    d_ndbi = mean_ndbi_t2 - mean_ndbi_t1
    d_ndwi = mean_ndwi_t2 - mean_ndwi_t1

    # Water boundary shifts
    if abs(d_ndwi) > 0.25:
        return "water_change"

    # Vegetation conversion to built-up infrastructure
    if d_ndvi < -0.15 and d_ndbi > 0.08:
        return "vegetation_to_built"

    # Tree canopy or agricultural loss returning to bare ground
    if d_ndvi < -0.20 and d_ndbi <= 0.05:
        return "vegetation_loss_to_bare"

    # Bare land undergoing urban development / concrete pouring
    if d_ndbi > 0.12:
        return "bare_to_built"

    return "unclassified_physical_change"
