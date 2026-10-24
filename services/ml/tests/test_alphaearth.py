"""Unit tests for AlphaEarth acquisition and change detection models."""

from __future__ import annotations

import numpy as np
import pytest

from terrashift.acquisition.earth_engine import (
    ALPHAEARTH_BANDS,
    AlphaEarthScene,
    EarthEngineManager,
)
from terrashift.inference.alphaearth_change import (
    compute_cosine_distance,
    detect_alphaearth_classifier,
    detect_alphaearth_cosine,
    detect_alphaearth_dynamic_world,
    detect_alphaearth_hybrid,
    vectorize_alphaearth_changes,
)


class DummyGrid:
    """Mock grid for vectorization coordinate mapping."""

    def to_lonlat(self, x, y):
        # simple linear projection for testing
        lons = 46.70 + np.asarray(x) * 0.0001
        lats = 24.85 + np.asarray(y) * 0.0001
        return lons, lats


def test_earthengine_manager_fallback():
    manager = EarthEngineManager(project_id="test-unauthenticated-project")
    # Even if live EE fails, initialization handles gracefully
    scene = manager.get_annual_alphaearth_embeddings(
        bbox=[46.70, 24.85, 46.74, 24.89],
        year=2021,
        target_shape=(32, 32),
    )
    assert scene.year == 2021
    assert scene.embeddings.shape == (32, 32, 64)
    # Vectors must be unit-normalized
    norms = np.linalg.norm(scene.embeddings, axis=-1)
    np.testing.assert_allclose(norms, 1.0, atol=1e-5)
    assert len(ALPHAEARTH_BANDS) == 64


def test_cosine_distance_computation():
    H, W = 10, 10
    rng = np.random.RandomState(42)

    u = rng.randn(H, W, 64).astype(np.float32)
    u /= np.linalg.norm(u, axis=-1, keepdims=True)

    # Identical vectors -> cosine_sim = 1, distance = 0
    sim_id, dist_id = compute_cosine_distance(u, u)
    np.testing.assert_allclose(sim_id, 1.0, atol=1e-5)
    np.testing.assert_allclose(dist_id, 0.0, atol=1e-5)

    # Orthogonal vectors -> cosine_sim = 0, distance = 1
    v = rng.randn(H, W, 64).astype(np.float32)
    v /= np.linalg.norm(v, axis=-1, keepdims=True)
    sim, dist = compute_cosine_distance(u, v)
    assert np.all(dist >= 0.0)
    assert np.all(dist <= 2.0)


def test_alphaearth_model_a_cosine():
    mgr = EarthEngineManager()
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (32, 32))
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (32, 32))

    det = detect_alphaearth_cosine(s1, s2, threshold=0.12)
    assert det.model_id == "alphaearth_cosine_distance"
    assert det.mask.shape == (32, 32)
    assert det.change_score.shape == (32, 32)
    assert "threshold" in det.metadata


def test_alphaearth_model_b_dynamic_world():
    mgr = EarthEngineManager()
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (32, 32))
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (32, 32))

    det = detect_alphaearth_dynamic_world(s1, s2, threshold=0.10)
    assert det.model_id == "alphaearth_dynamic_world"
    assert det.mask.shape == (32, 32)


def test_alphaearth_model_c_classifier():
    mgr = EarthEngineManager()
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (32, 32))
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (32, 32))

    det = detect_alphaearth_classifier(s1, s2, threshold=0.50)
    assert det.model_id == "alphaearth_supervised_classifier"
    assert det.mask.shape == (32, 32)
    assert np.all(det.change_score >= 0.0)
    assert np.all(det.change_score <= 1.0)


def test_alphaearth_model_d_hybrid():
    mgr = EarthEngineManager()
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (32, 32))
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (32, 32))

    # Multispectral context with positive NDBI delta (built change)
    multi_ctx = {
        "t1_ndvi": np.zeros((32, 32), dtype=np.float32),
        "t2_ndvi": np.zeros((32, 32), dtype=np.float32),
        "t1_ndbi": np.zeros((32, 32), dtype=np.float32),
        "t2_ndbi": np.full((32, 32), 0.08, dtype=np.float32),
    }
    det = detect_alphaearth_hybrid(s1, s2, multispectral_context=multi_ctx, threshold=0.10)
    assert det.model_id == "alphaearth_spectral_hybrid"
    assert det.mask.shape == (32, 32)

    # Vectorize
    grid = DummyGrid()
    geojson = vectorize_alphaearth_changes(det, grid, min_area_m2=100.0, multispectral_context=multi_ctx)
    assert geojson["type"] == "FeatureCollection"
    assert "metadata" in geojson
    assert geojson["metadata"]["model_id"] == "alphaearth_spectral_hybrid"
