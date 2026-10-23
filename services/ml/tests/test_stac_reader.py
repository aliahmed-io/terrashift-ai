"""Unit and integration tests for authentic Sentinel-2 STAC windowed reader."""

import numpy as np
import pytest

from terrashift.acquisition.multispectral import compute_true_ndbi, compute_true_ndvi, parse_scl_valid_mask
from terrashift.acquisition.stac import STACClient
from terrashift.acquisition.stac_reader import (
    AnalysisReadyScene,
    InsufficientDataError,
    read_stac_scene_window,
)


def test_scl_cloud_masking() -> None:
    # SCL values: 0=nodata, 1=defective, 3=shadow, 4=vegetation, 5=bare soil, 8=cloud med, 9=cloud high
    scl = np.array([
        [4, 5, 6],
        [0, 3, 8],
        [9, 10, 11]
    ], dtype=np.uint8)

    valid = parse_scl_valid_mask(scl)
    assert valid[0, 0] is True or valid[0, 0] == 1  # Vegetation
    assert valid[0, 1] is True or valid[0, 1] == 1  # Bare soil
    assert valid[0, 2] is True or valid[0, 2] == 1  # Water
    assert valid[1, 0] is False or valid[1, 0] == 0  # Nodata
    assert valid[1, 1] is False or valid[1, 1] == 0  # Shadow
    assert valid[1, 2] is False or valid[1, 2] == 0  # Cloud med
    assert valid[2, 0] is False or valid[2, 0] == 0  # Cloud high


def test_empty_slice_protection() -> None:
    b08 = np.zeros((10, 10), dtype=np.float32)
    b04 = np.zeros((10, 10), dtype=np.float32)
    ndvi = compute_true_ndvi(b08, b04)
    assert not np.isnan(ndvi).any()
    assert ndvi.shape == (10, 10)


def test_stac_search_for_riyadh() -> None:
    stac = STACClient()
    # Riyadh ROSHN Sedra bounding box
    bbox = [46.70, 24.85, 46.75, 24.90]
    from datetime import date
    scenes = stac.search_scenes(bbox=bbox, target_date=date(2023, 7, 15), window_days=20, max_cloud_cover=10.0)
    assert len(scenes) >= 1
    top = scenes[0]
    assert "38RPN" in top.scene_id or len(top.scene_id) > 5
    assert "red" in top.assets or "b04" in top.assets
    assert top.cloud_cover <= 10.0


def test_windowed_cog_read_shapes_and_reflectance() -> None:
    stac = STACClient()
    bbox = [46.70, 24.85, 46.72, 24.87]
    from datetime import date
    scenes = stac.search_scenes(bbox=bbox, target_date=date(2023, 7, 15), window_days=20, max_cloud_cover=10.0)
    if not scenes:
        pytest.skip("STAC network unavailable in current test environment")

    scene = scenes[0]
    ready = read_stac_scene_window(scene, bbox, bands_to_load=["red", "swir16", "scl"])
    assert ready.shape[0] > 10 and ready.shape[1] > 10
    assert "b04" in ready.bands
    assert "b11" in ready.bands
    assert ready.bands["b04"].shape == ready.shape
    assert ready.bands["b11"].shape == ready.shape
    assert ready.aoi_valid_pct >= 50.0
    assert ready.rgb.shape == (ready.shape[0], ready.shape[1], 3)
    assert ready.provenance["provider"].startswith("Element84")
