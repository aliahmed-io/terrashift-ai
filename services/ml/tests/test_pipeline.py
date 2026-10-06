"""Unit tests for the TerraShift ML microservice."""

from typing import Any, Dict

import numpy as np
import pytest
from fastapi.testclient import TestClient
from numpy.typing import NDArray

from terrashift.acquisition.cloud import build_cloud_mask, calculate_cloud_fraction
from terrashift.acquisition.tiles import AoiError, clamp_year, plan_grid
from terrashift.api import main as api_main
from terrashift.api.main import app
from terrashift.api.schemas import AnalyzeRequest
from terrashift.features.indices import ndbi, ndvi
from terrashift.features.stack import SentinelBands, build_5channel_stack
from terrashift.pipeline import run_analysis
from terrashift.report.pdf import generate_pdf_report

RING = [[10.0, 45.0], [10.02, 45.0], [10.02, 45.015], [10.0, 45.015]]


def make_fetcher(with_change: bool):
    def fetch(year: int, z: int, x: int, y: int) -> NDArray[np.uint8]:
        rng = np.random.default_rng(z * 100003 + x * 1009 + y)
        base = np.zeros((256, 256, 3), dtype=np.float32)
        base[...] = (60, 110, 55)
        base += rng.normal(0, 3, size=base.shape).astype(np.float32)
        if with_change and year >= 2024:
            base[120:170, 170:220] = (190, 185, 180)
        return np.clip(base, 0, 255).astype(np.uint8)

    return fetch


def test_radiometric_indices() -> None:
    nir = np.array([[4000.0, 1000.0]], dtype=np.float32)
    red = np.array([[1000.0, 4000.0]], dtype=np.float32)
    val = ndvi(nir, red)
    assert val[0, 0] > 0.5
    assert val[0, 1] < -0.5
    assert ndbi(np.array([[3000.0]], dtype=np.float32), np.array([[1000.0]], dtype=np.float32))[0, 0] > 0.4
    zero = np.zeros((2, 2), dtype=np.float32)
    assert not np.isnan(ndvi(zero, zero)).any()


def test_cloud_masking() -> None:
    mask = build_cloud_mask(np.array([[4, 4], [9, 9]], dtype=np.uint8))
    assert bool(mask[1, 0]) and not bool(mask[0, 0])
    assert calculate_cloud_fraction(mask) == 50.0


def test_5channel_stack() -> None:
    bands: SentinelBands = {
        "b02": np.full((8, 8), 1000.0, dtype=np.float32),
        "b03": np.full((8, 8), 1200.0, dtype=np.float32),
        "b04": np.full((8, 8), 800.0, dtype=np.float32),
        "b08": np.full((8, 8), 4000.0, dtype=np.float32),
        "b11": np.full((8, 8), 2000.0, dtype=np.float32),
    }
    stack = build_5channel_stack(bands)
    assert stack.shape == (5, 8, 8)
    assert 0.0 <= float(stack.min()) <= float(stack.max()) <= 1.0


def test_year_clamp_and_grid() -> None:
    assert clamp_year(2010) == 2017
    assert clamp_year(2040) == 2025
    grid = plan_grid([10.0, 45.0, 10.02, 45.015])
    assert grid.zoom == 13
    assert 24 <= grid.width <= 1400
    with pytest.raises(AoiError):
        plan_grid([10.0, 45.0, 10.0001, 45.0001])


def test_pipeline_detects_change_with_geodesic_area() -> None:
    req = AnalyzeRequest(polygon=RING, year_t1=2018, year_t2=2024)
    events = list(run_analysis(req, make_fetcher(True)))
    result: Dict[str, Any] = events[-1]["result"]
    assert [e["progress"] for e in events[:-1]] == sorted(e["progress"] for e in events[:-1])
    assert result["metadata"]["polygon_count"] >= 1
    assert result["metadata"]["total_changed_m2"] > 10_000
    assert result["metadata"]["total_changed_km2"] <= result["metadata"]["aoi_km2"]
    first = result["features"][0]
    assert first["geometry"]["type"] == "Polygon"
    assert first["properties"]["area_m2"] > 0


def test_pipeline_reports_no_change_for_identical_years() -> None:
    req = AnalyzeRequest(polygon=RING, year_t1=2018, year_t2=2019)
    events = list(run_analysis(req, make_fetcher(False)))
    assert events[-1]["result"]["metadata"]["polygon_count"] == 0


def test_pipeline_rejects_oversized_area() -> None:
    big = [[10.0, 45.0], [11.0, 45.0], [11.0, 46.0], [10.0, 46.0]]
    with pytest.raises(AoiError):
        list(run_analysis(AnalyzeRequest(polygon=big, year_t1=2018, year_t2=2024), make_fetcher(True)))


def test_schema_rejects_bad_years() -> None:
    with pytest.raises(ValueError):
        AnalyzeRequest(polygon=RING, year_t1=2024, year_t2=2018)


def test_pdf_report_generation() -> None:
    meta = {"aoi_km2": 3.2, "date_t1": "2018", "date_t2": "2024", "total_changed_km2": 0.45, "total_changed_m2": 450000.0, "polygon_count": 1, "changed_pct": 14.0}
    features = [{"properties": {"id": 1, "label": "Vegetation loss", "area_m2": 450000.0, "confidence": 0.92}}]
    assert generate_pdf_report(meta, features).startswith(b"%PDF")


def test_stream_endpoint_emits_progress_then_result(monkeypatch: pytest.MonkeyPatch) -> None:
    fetcher = make_fetcher(True)
    original = api_main.run_analysis
    monkeypatch.setattr(api_main, "run_analysis", lambda req: original(req, fetcher))
    client = TestClient(app)
    res = client.post("/v1/analyze/stream", json={"polygon": RING, "year_t1": 2018, "year_t2": 2024})
    assert res.status_code == 200
    assert res.headers["content-type"].startswith("text/event-stream")
    chunks = [c for c in res.text.split("\n\n") if c.startswith("data: ")]
    assert len(chunks) == 6
    assert '"done": true' in chunks[-1]


def test_health() -> None:
    assert TestClient(app).get("/healthz").json()["status"] == "healthy"


def test_ablation_study_returns_4_models_and_xai_stages() -> None:
    from terrashift.inference.ablation import run_ablation_study

    f = make_fetcher(True)
    rgb1 = f(2018, 12, 100, 100)
    rgb2 = f(2024, 12, 100, 100)
    valid = np.ones(rgb1.shape[:2], dtype=bool)
    res = run_ablation_study(rgb1, rgb2, valid, 2018, 2024)
    assert len(res["methods"]) == 4
    assert len(res["xai_stages"]) == 4
    assert res["methods"][-1]["id"] == "fc_siam_diff"


def test_pair_lab_endpoint_evaluates_ground_truth() -> None:
    client = TestClient(app)
    res = client.post("/v1/lab/analyze", json={"sample_id": "levir_urban_1"})
    assert res.status_code == 200
    data = res.json()
    assert data["blob_count"] >= 1
    assert data["ground_truth_eval"]["has_ground_truth"] is True
    assert data["ground_truth_eval"]["f1_score"] > 0.85


def test_carbon_flux_endpoint_computes_pools_and_uhi(monkeypatch: pytest.MonkeyPatch) -> None:
    from terrashift.acquisition import tiles

    f = make_fetcher(True)
    rgb1 = f(2018, 12, 100, 100)
    rgb2 = f(2024, 12, 100, 100)
    monkeypatch.setattr(tiles, "fetch_mosaic", lambda year, grid: rgb1 if year == 2018 else rgb2)
    monkeypatch.setattr(tiles, "polygon_mask", lambda ring, grid: np.ones((256, 256), dtype=bool))
    client = TestClient(app)
    res = client.post(
        "/v1/carbon",
        json={
            "polygon": RING,
            "year_t1": 2018,
            "year_t2": 2024,
            "biome_id": "tropical_rainforest",
            "pool_mode": "biomass_soil",
            "carbon_price_usd": 40.0,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert len(data["pools"]) == 4
    assert data["gross_emissions_tco2e"] >= 0
    assert "uhi" in data


