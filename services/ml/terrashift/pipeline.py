"""End-to-end analysis pipeline emitting progress events (consumed by SSE and sync endpoints)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterator, List, Optional

import numpy as np
from numpy.typing import NDArray
from pyproj import Geod

from terrashift.acquisition import tiles
from terrashift.acquisition.tiles import AoiError, TileError
from terrashift.api.schemas import AnalyzeRequest
from terrashift.geo.components import vectorize_changes
from terrashift.inference.rgb_change import detect_change

MAX_AOI_KM2 = 100.0
PROVENANCE = "sentinel2-cloudless-rgb / statistical-change"
_geod = Geod(ellps="WGS84")

Fetcher = Callable[[int, int, int, int], NDArray[np.uint8]]


def _ring_area_km2(ring: List[List[float]]) -> float:
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return abs(float(_geod.polygon_area_perimeter(lons, lats)[0])) / 1e6


def _event(step: int, label: str, progress: int) -> Dict[str, Any]:
    return {"step": step, "label": label, "progress": progress}


def run_analysis(req: AnalyzeRequest, fetcher: Optional[Fetcher] = None) -> Iterator[Dict[str, Any]]:
    """Yield progress events, then a final `{"done": True, "result": {...}}` event.

    Raises AoiError / TileError for client-facing failures.
    """
    ring = [list(p) for p in req.polygon]
    if ring[0] != ring[-1]:
        ring.append(ring[0])

    area_km2 = _ring_area_km2(ring)
    if area_km2 > MAX_AOI_KM2:
        raise AoiError("AOI_TOO_LARGE", f"Selected area is {area_km2:.0f} km2; the limit is {MAX_AOI_KM2:.0f} km2.")

    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    bbox = [min(lons), min(lats), max(lons), max(lats)]
    grid = tiles.plan_grid(bbox)
    yield _event(1, "Planning imagery window", 8)

    def fetch(year: int) -> NDArray[np.uint8]:
        if fetcher is None:
            return tiles.fetch_mosaic(year, grid)
        return tiles.fetch_mosaic(year, grid, lambda z, x, y: fetcher(year, z, x, y))

    rgb1 = fetch(req.year_t1)
    yield _event(2, f"Downloaded {req.year_t1} composite", 32)
    rgb2 = fetch(req.year_t2)
    yield _event(3, f"Downloaded {req.year_t2} composite", 56)

    valid = tiles.polygon_mask(ring, grid)
    if valid.sum() < 64:
        raise AoiError("AOI_TOO_SMALL", "The selected area is too small to analyse.")

    detection, matched = detect_change(rgb1, rgb2, valid)
    yield _event(4, "Aligning radiometry and detecting change", 80)

    collection = vectorize_changes(detection.mask, detection.probability, rgb1, matched, grid)
    center_lat = float(np.mean(lats))
    changed_km2 = collection["metadata"]["total_changed_km2"]
    collection["metadata"].update(
        {
            "bbox": [round(v, 6) for v in bbox],
            "year_t1": req.year_t1,
            "year_t2": req.year_t2,
            "date_t1": str(req.year_t1),
            "date_t2": str(req.year_t2),
            "aoi_km2": round(area_km2, 3),
            "changed_pct": round(changed_km2 / area_km2 * 100.0, 2) if area_km2 else 0.0,
            "resolution_m": round(grid.meters_per_pixel(center_lat), 1),
            "threshold": round(detection.threshold, 4),
            "model": detection.model_metadata,
            "provenance": PROVENANCE,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    collection["provenance"] = PROVENANCE
    yield _event(5, "Vectorising polygons", 96)
    yield {"done": True, "result": collection}


__all__ = ["run_analysis", "AoiError", "TileError", "PROVENANCE"]
