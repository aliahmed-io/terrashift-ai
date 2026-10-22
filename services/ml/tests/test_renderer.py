"""Tests for the surgical diagnostic raster renderer and corridor endpoints."""

import numpy as np
import pytest
from fastapi.testclient import TestClient

from terrashift.api.main import CORRIDORS, app
from terrashift.inference.renderer import (
    contour_mask,
    magma_lut,
    render_diagnostic_raster,
)


def test_magma_lut() -> None:
    val = np.array([[0.0, 0.5, 1.0]], dtype=np.float32)
    rgb = magma_lut(val)
    assert rgb.shape == (1, 3, 3)
    assert rgb.dtype == np.uint8
    # 0.0 should be dark obsidian
    assert int(rgb[0, 0, 0]) <= 20
    # 1.0 should be ivory
    assert int(rgb[0, 2, 0]) >= 240


def test_contour_mask() -> None:
    binary = np.zeros((32, 32), dtype=bool)
    binary[8:24, 8:24] = True
    contour = contour_mask(binary, radius=1.3)
    assert contour.shape == (32, 32)
    assert contour.dtype == bool
    # Center should not be contour
    assert not contour[16, 16]
    # Perimeter boundary should have contour pixels
    assert contour.sum() > 0


def test_all_8_effects_render() -> None:
    # Synthetic 64x64 bitemporal RGB images
    rng = np.random.default_rng(42)
    rgb1 = (rng.uniform(0.1, 0.4, size=(64, 64, 3)) * 255).astype(np.uint8)
    rgb2 = (rng.uniform(0.1, 0.4, size=(64, 64, 3)) * 255).astype(np.uint8)
    # Inject change patch
    rgb2[20:44, 20:44] = (220, 210, 200)

    effects = ["split", "nir", "ndbi", "magma", "confusion", "contagion", "carbon", "thermal"]
    for eff in effects:
        jpeg_bytes = render_diagnostic_raster(rgb1, rgb2, effect=eff, split_ratio=0.44, threshold=0.45)
        assert isinstance(jpeg_bytes, bytes)
        assert len(jpeg_bytes) > 200
        # JPEG SOI marker
        assert jpeg_bytes[:2] == b"\xff\xd8"


def test_corridor_render_endpoint() -> None:
    client = TestClient(app)
    # Test rendering roshn split
    res = client.get("/v1/render/roshn/split?year_t1=2018&year_t2=2024&threshold=0.45&split_ratio=0.44")
    assert res.status_code == 200
    assert res.headers["content-type"] == "image/jpeg"
    assert len(res.content) > 1000


def test_corridor_telemetry_endpoint() -> None:
    client = TestClient(app)
    res = client.post(
        "/v1/corridor/telemetry",
        json={"corridor_id": "roshn", "year": 2024, "month": "OCT"},
    )
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == "roshn"
    assert "spectralBands2018" in data
    assert "spectralBands2024" in data
    assert "rasterUrls" in data
    assert len(data["spectralBands2018"]) == 10
