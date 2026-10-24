"""End-to-end analysis pipeline emitting progress events (consumed by SSE and sync endpoints)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterator, List, Optional

import numpy as np
from numpy.typing import NDArray
from pyproj import Geod

logger = logging.getLogger(__name__)

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

    stac_metadata: Dict[str, Any] = {}
    data_mode = "eox_wmts_mosaic"
    active_provenance = PROVENANCE
    analysis_grid: Any = grid
    rgb1: NDArray[np.uint8]
    rgb2: NDArray[np.uint8]
    valid: NDArray[np.bool_]

    # 1. Primary Path: Attempt genuine Sentinel-2 Level-2A STAC acquisition
    stac_success = False
    if fetcher is None:
        try:
            yield _event(2, "Searching authentic Sentinel-2 Level-2A STAC acquisitions", 18)
            from terrashift.acquisition.stac_reader import fetch_bitemporal_stac_pair
            stac_t1, stac_t2 = fetch_bitemporal_stac_pair(
                bbox=bbox,
                year_t1=req.year_t1,
                year_t2=req.year_t2,
                target_month=getattr(req, "target_month", 6),
            )
            rgb1 = stac_t1.rgb
            rgb2 = stac_t2.rgb
            analysis_grid = stac_t1.grid
            valid = (stac_t1.valid_mask & stac_t2.valid_mask)
            data_mode = "authentic_stac_l2a"
            active_provenance = "sentinel2-l2a-cogs / aws-earth-search"
            stac_metadata = {
                "mode": data_mode,
                "scene_t1_id": stac_t1.scene_id,
                "scene_t1_datetime": stac_t1.datetime,
                "scene_t1_cloud_pct": stac_t1.cloud_cover_pct,
                "scene_t1_aoi_valid_pct": stac_t1.aoi_valid_pct,
                "scene_t2_id": stac_t2.scene_id,
                "scene_t2_datetime": stac_t2.datetime,
                "scene_t2_cloud_pct": stac_t2.cloud_cover_pct,
                "scene_t2_aoi_valid_pct": stac_t2.aoi_valid_pct,
                "surface_reflectance_calibrated": True,
                "spectral_bands": list(stac_t1.bands.keys()),
                "asset_urls": stac_t1.provenance.get("asset_urls", {}),
            }
            yield _event(3, f"Acquired genuine L2A COGs ({stac_t1.scene_id[:16]} & {stac_t2.scene_id[:16]})", 58)
            stac_success = True
        except Exception as exc:
            data_mode = "eox_wmts_mosaic_fallback"
            stac_metadata = {
                "mode": data_mode,
                "fallback_reason": str(exc),
            }

    # 2. Secondary / Offline / Mock Fallback Path: EOX WMTS Mosaic Tiles
    if not stac_success:
        def fetch(year: int) -> NDArray[np.uint8]:
            if fetcher is None:
                return tiles.fetch_mosaic(year, grid)
            return tiles.fetch_mosaic(year, grid, lambda z, x, y: fetcher(year, z, x, y))

        rgb1 = fetch(req.year_t1)
        yield _event(2, f"Downloaded {req.year_t1} composite", 32)
        rgb2 = fetch(req.year_t2)
        yield _event(3, f"Downloaded {req.year_t2} composite", 56)
        valid = tiles.polygon_mask(ring, grid)
        analysis_grid = grid

    if valid.sum() < 64:
        raise AoiError("AOI_TOO_SMALL", "The selected area is too small to analyse.")

    threshold = getattr(req, "threshold", 0.50)
    min_area_m2 = getattr(req, "min_area_m2", 3500.0)
    model_type = getattr(req, "model_type", "siamese_tuned")

    multi_ctx = None
    if stac_success:
        multi_ctx = {
            "t1_ndvi": stac_t1.true_ndvi,
            "t2_ndvi": stac_t2.true_ndvi,
            "t1_ndbi": stac_t1.true_ndbi,
            "t2_ndbi": stac_t2.true_ndbi,
        }

    if model_type.startswith("alphaearth") or model_type == "dynamic_world_lulc":
        from terrashift.acquisition.earth_engine import EarthEngineManager
        from terrashift.inference.alphaearth_change import (
            detect_alphaearth_classifier,
            detect_alphaearth_cosine,
            detect_alphaearth_dynamic_world,
            detect_alphaearth_hybrid,
            detect_dynamic_world_lulc,
            vectorize_alphaearth_changes,
        )
        yield _event(4, "Fetching AlphaEarth 64-D & Dynamic World V1 tensors via GEE", 75)
        eem = EarthEngineManager()
        t1_alpha = eem.get_annual_alphaearth_embeddings(bbox, req.year_t1, target_shape=analysis_grid.shape)
        t2_alpha = eem.get_annual_alphaearth_embeddings(bbox, req.year_t2, target_shape=analysis_grid.shape)

        if model_type == "alphaearth_cosine":
            det_res = detect_alphaearth_cosine(t1_alpha, t2_alpha, threshold=threshold if threshold != 0.5 else 0.12)
            collection = vectorize_alphaearth_changes(det_res, analysis_grid, min_area_m2=min_area_m2)
        elif model_type in ("alphaearth_dw", "alphaearth_dynamic_world"):
            det_res = detect_alphaearth_dynamic_world(t1_alpha, t2_alpha, threshold=threshold if threshold != 0.5 else 0.10)
            collection = vectorize_alphaearth_changes(det_res, analysis_grid, min_area_m2=min_area_m2)
        elif model_type == "dynamic_world_lulc":
            det_res = detect_dynamic_world_lulc(t1_alpha, t2_alpha, prob_threshold=threshold if threshold != 0.5 else 0.45)
            collection = vectorize_alphaearth_changes(det_res, analysis_grid, min_area_m2=min_area_m2)
        elif model_type == "alphaearth_supervised":
            det_res = detect_alphaearth_classifier(t1_alpha, t2_alpha, threshold=threshold)
            collection = vectorize_alphaearth_changes(det_res, analysis_grid, min_area_m2=min_area_m2)
        else:  # alphaearth_hybrid
            siam_det, _ = detect_change(rgb1, rgb2, valid, threshold=0.38)
            det_res = detect_alphaearth_hybrid(
                t1_alpha,
                t2_alpha,
                multispectral_context=multi_ctx,
                siamese_mask=siam_det.mask,
                siamese_prob=siam_det.probability,
                threshold=threshold if threshold != 0.5 else 0.12,
            )
            collection = vectorize_alphaearth_changes(det_res, analysis_grid, min_area_m2=min_area_m2, multispectral_context=multi_ctx)

        model_meta = {"name": det_res.model_name, "id": det_res.model_id, "family": "foundation_model"}
        used_threshold = threshold
    elif model_type == "multispectral_physical" and multi_ctx is not None:
        yield _event(4, "Computing multispectral physical delta indices (NDBI/NDVI)", 80)
        d_ndvi = multi_ctx["t2_ndvi"] - multi_ctx["t1_ndvi"]
        d_ndbi = multi_ctx["t2_ndbi"] - multi_ctx["t1_ndbi"]
        phys_mask = ((d_ndbi >= 0.06) | (np.abs(d_ndvi) >= 0.15)) & valid
        phys_score = np.clip(np.maximum(d_ndbi / 0.20, np.abs(d_ndvi) / 0.30), 0.0, 1.0).astype(np.float32)
        collection = vectorize_changes(phys_mask, phys_score, rgb1, rgb2, analysis_grid, min_area_m2=min_area_m2, multispectral_context=multi_ctx)
        model_meta = {"name": "Multispectral Physical Index Delta", "id": "multispectral_physical", "family": "conventional_remote_sensing"}
        used_threshold = 0.06
    else:
        # Default Siamese CNN
        active_multi_ctx = None if model_type == "siamese_untuned" else multi_ctx
        detection, matched = detect_change(rgb1, rgb2, valid, threshold=threshold)
        yield _event(4, "Aligning radiometry and detecting change via Siamese U-Net", 80)
        collection = vectorize_changes(
            detection.mask,
            detection.probability,
            rgb1,
            matched,
            analysis_grid,
            min_area_m2=min_area_m2,
            multispectral_context=active_multi_ctx,
        )
        model_meta = detection.model_metadata
        used_threshold = detection.threshold
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
            "resolution_m": round(analysis_grid.meters_per_pixel(center_lat), 1),
            "threshold": round(float(used_threshold), 4),
            "min_area_m2": min_area_m2,
            "data_source": data_mode,
            "model": model_meta,
            "stac_provenance": stac_metadata,
            "provenance": active_provenance,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }
    )
    collection["provenance"] = PROVENANCE
    yield _event(5, "Vectorising polygons", 96)
    yield {"done": True, "result": collection}


__all__ = ["run_analysis", "AoiError", "TileError", "PROVENANCE"]
