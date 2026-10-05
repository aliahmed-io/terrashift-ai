"""Unit tests for TerraShift ML microservice and geospatial pipeline."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from terrashift.features.indices import ndvi, ndbi, ndwi
from terrashift.features.stack import build_5channel_stack, SentinelBands
from terrashift.acquisition.cloud import build_cloud_mask, calculate_cloud_fraction
from terrashift.acquisition.composite import create_synthetic_composite
from terrashift.models.siamese_unet import run_physics_guided_inference
from terrashift.geo.vectorize import mask_to_geojson_polygons
from terrashift.report.pdf import generate_pdf_report
from terrashift.api.main import app

def test_radiometric_indices():
    # NDVI = (NIR - Red) / (NIR + Red)
    nir = np.array([[4000.0, 1000.0]], dtype=np.float32)
    red = np.array([[1000.0, 4000.0]], dtype=np.float32)
    val = ndvi(nir, red)
    assert val[0, 0] > 0.5  # High vegetation
    assert val[0, 1] < -0.5  # Negative index (water/shadow/soil)

    # NDBI = (SWIR - NIR) / (SWIR + NIR)
    swir = np.array([[3000.0]], dtype=np.float32)
    nir_b = np.array([[1000.0]], dtype=np.float32)
    val_ndbi = ndbi(swir, nir_b)
    assert val_ndbi[0, 0] > 0.4  # Concrete / built-up

    # Zero-division safety
    zero = np.zeros((2, 2), dtype=np.float32)
    safe = ndvi(zero, zero)
    assert not np.isnan(safe).any()

def test_cloud_masking():
    # SCL: 9 = high cloud, 4 = vegetation
    scl = np.array([[4, 4], [9, 9]], dtype=np.uint8)
    mask = build_cloud_mask(scl)
    assert mask[0, 0] == False
    assert mask[1, 0] == True

    frac = calculate_cloud_fraction(mask)
    assert frac == 50.0

def test_5channel_stack():
    bands: SentinelBands = {
        "b02": np.full((32, 32), 1000.0, dtype=np.float32),
        "b03": np.full((32, 32), 1200.0, dtype=np.float32),
        "b04": np.full((32, 32), 800.0, dtype=np.float32),
        "b08": np.full((32, 32), 4000.0, dtype=np.float32),
        "b11": np.full((32, 32), 2000.0, dtype=np.float32),
    }
    stack = build_5channel_stack(bands)
    assert stack.shape == (5, 32, 32)
    assert 0.0 <= stack.min() <= stack.max() <= 1.0

def test_vectorize_and_area():
    mask = np.zeros((64, 64), dtype=np.uint8)
    mask[20:30, 20:30] = 1  # 10x10 square
    prob = np.full((64, 64), 0.9, dtype=np.float32)
    bbox = [-63.2, -9.9, -63.12, -9.84]

    idx = {"ndvi": np.full((64, 64), 0.5, dtype=np.float32), "ndbi": np.zeros((64, 64), dtype=np.float32)}
    idx_t2 = {"ndvi": np.full((64, 64), 0.1, dtype=np.float32), "ndbi": np.zeros((64, 64), dtype=np.float32)}

    fc = mask_to_geojson_polygons(mask, prob, bbox, idx, idx_t2, min_pixels=4)
    assert fc["type"] == "FeatureCollection"
    assert len(fc["features"]) >= 1
    assert fc["metadata"]["total_changed_m2"] > 0.0
    assert fc["features"][0]["properties"]["area_m2"] > 0.0

def test_pdf_report_generation():
    meta = {
        "bbox": [-63.2, -9.9, -63.12, -9.84],
        "date_t1": "2024-06-14",
        "date_t2": "2025-01-22",
        "total_changed_km2": 1.45,
        "total_changed_m2": 1450000.0,
        "polygon_count": 4,
    }
    features = [
        {"properties": {"id": 1, "label": "Vegetation Loss", "area_m2": 450000.0, "confidence": 0.92, "ndvi_delta": -0.35}}
    ]
    pdf_bytes = generate_pdf_report(meta, features)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b"%PDF")

def test_api_client():
    client = TestClient(app)
    # Health check
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"

    # Search location
    res_loc = client.get("/v1/search-location?q=Dubai")
    assert res_loc.status_code == 200
    assert len(res_loc.json()) >= 1

    # Analyze endpoint
    payload = {
        "bbox": [-63.2, -9.9, -63.12, -9.84],
        "date_t1": "2024-06-14",
        "date_t2": "2025-01-22",
        "use_real_stac": False,
    }
    res_an = client.post("/v1/analyze", json=payload)
    assert res_an.status_code == 200
    data = res_an.json()
    assert data["type"] == "FeatureCollection"
    assert "metadata" in data
    assert "features" in data
