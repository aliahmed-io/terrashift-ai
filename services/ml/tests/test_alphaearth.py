"""Unit tests for AlphaEarth acquisition and change detection models."""

from __future__ import annotations

import numpy as np
import pytest

from terrashift.acquisition.earth_engine import (
    ALPHAEARTH_BANDS,
    EarthEngineManager,
)
from terrashift.inference.alphaearth_change import (
    LightweightAlphaEarthClassifier,
    compute_cosine_distance,
    detect_alphaearth_classifier,
    detect_alphaearth_cosine,
    detect_alphaearth_dynamic_world,
    detect_alphaearth_hybrid,
    detect_dynamic_world_lulc,
    vectorize_alphaearth_changes,
)


class DummyGrid:
    """Mock grid for vectorization coordinate mapping."""
    bbox = (46.70, 24.85, 46.74, 24.89)

    def to_lonlat(self, x, y):
        lons = 46.70 + np.asarray(x) * 0.0005
        lats = 24.85 + np.asarray(y) * 0.0005
        return lons, lats


def test_earthengine_strict_prohibition_when_unauthenticated():
    """Verify that allow_synthetic=False (the default) raises RuntimeError when GEE is unauthenticated."""
    manager = EarthEngineManager(project_id="test-unauthenticated-project")
    with pytest.raises(RuntimeError, match="Genuine Google Earth Engine data is required"):
        manager.get_annual_alphaearth_embeddings(
            bbox=[46.70, 24.85, 46.74, 24.89],
            year=2021,
            target_shape=(32, 32),
            allow_synthetic=False,
        )


def test_earthengine_unit_test_fixture_when_explicitly_requested():
    """Verify unit test fixture mode only works when allow_synthetic=True is explicitly passed."""
    manager = EarthEngineManager(project_id="test-unauthenticated-project")
    scene = manager.get_annual_alphaearth_embeddings(
        bbox=[46.70, 24.85, 46.74, 24.89],
        year=2021,
        target_shape=(32, 32),
        allow_synthetic=True,
    )
    assert scene.year == 2021
    assert scene.source == "unit_test_synthetic_only"
    assert scene.embeddings.shape == (32, 32, 64)
    norms = np.linalg.norm(scene.embeddings, axis=-1)
    np.testing.assert_allclose(norms, 1.0, atol=1e-5)
    assert len(ALPHAEARTH_BANDS) == 64


def test_cosine_distance_computation():
    H, W = 10, 10
    rng = np.random.RandomState(42)

    u = rng.randn(H, W, 64).astype(np.float32)
    u /= np.linalg.norm(u, axis=-1, keepdims=True)

    sim_id, dist_id = compute_cosine_distance(u, u)
    np.testing.assert_allclose(sim_id, 1.0, atol=1e-5)
    np.testing.assert_allclose(dist_id, 0.0, atol=1e-5)

    v = rng.randn(H, W, 64).astype(np.float32)
    v /= np.linalg.norm(v, axis=-1, keepdims=True)
    sim, dist = compute_cosine_distance(u, v)
    assert np.all(dist >= 0.0)
    assert np.all(dist <= 2.0)


def test_alphaearth_model_a_cosine():
    mgr = EarthEngineManager(project_id="test-unauthenticated-project")
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (32, 32), allow_synthetic=True)
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (32, 32), allow_synthetic=True)

    det = detect_alphaearth_cosine(s1, s2, threshold=0.12)
    assert det.model_id == "alphaearth_cosine_distance"
    assert det.mask.shape == (32, 32)
    assert det.change_score.shape == (32, 32)
    assert "threshold" in det.metadata


def test_alphaearth_model_b_dynamic_world():
    mgr = EarthEngineManager(project_id="test-unauthenticated-project")
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (32, 32), allow_synthetic=True)
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (32, 32), allow_synthetic=True)

    det = detect_alphaearth_dynamic_world(s1, s2, threshold=0.10)
    assert det.model_id == "alphaearth_dynamic_world"
    assert det.mask.shape == (32, 32)

    det_dw = detect_dynamic_world_lulc(s1, s2)
    assert det_dw.model_id == "dynamic_world_lulc"
    assert det_dw.mask.shape == (32, 32)


def test_alphaearth_classifier_requires_explicit_fit():
    mgr = EarthEngineManager(project_id="test-unauthenticated-project")
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (16, 16), allow_synthetic=True)
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (16, 16), allow_synthetic=True)

    clf = LightweightAlphaEarthClassifier()
    with pytest.raises(RuntimeError, match="unfitted"):
        detect_alphaearth_classifier(s1, s2, classifier=clf, threshold=0.50)

    # Fit on explicit labeled array
    rng = np.random.RandomState(0)
    u_tr = rng.randn(60, 64).astype(np.float32)
    u_tr /= np.linalg.norm(u_tr, axis=-1, keepdims=True)
    v_tr = rng.randn(60, 64).astype(np.float32)
    v_tr /= np.linalg.norm(v_tr, axis=-1, keepdims=True)
    y_tr = np.array([0] * 30 + [1] * 30, dtype=int)
    clf.fit(u_tr, v_tr, y_tr)

    det = detect_alphaearth_classifier(s1, s2, classifier=clf, threshold=0.50)
    assert det.model_id == "alphaearth_supervised_classifier"
    assert det.mask.shape == (16, 16)


def test_alphaearth_model_d_hybrid():
    mgr = EarthEngineManager(project_id="test-unauthenticated-project")
    s1 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2021, (32, 32), allow_synthetic=True)
    s2 = mgr.get_annual_alphaearth_embeddings([46.70, 24.85, 46.74, 24.89], 2024, (32, 32), allow_synthetic=True)

    multi_ctx = {
        "t1_ndvi": np.zeros((32, 32), dtype=np.float32),
        "t2_ndvi": np.zeros((32, 32), dtype=np.float32),
        "t1_ndbi": np.zeros((32, 32), dtype=np.float32),
        "t2_ndbi": np.full((32, 32), 0.08, dtype=np.float32),
    }
    siamese_prob = np.full((32, 32), 0.65, dtype=np.float32)
    det = detect_alphaearth_hybrid(
        s1, s2, multispectral_context=multi_ctx, siamese_probability=siamese_prob, threshold=0.10
    )
    assert det.model_id == "alphaearth_spectral_hybrid"
    assert det.mask.shape == (32, 32)

    grid = DummyGrid()
    geojson = vectorize_alphaearth_changes(det, grid, min_area_m2=100.0, multispectral_context=multi_ctx)
    assert geojson["type"] == "FeatureCollection"
    assert "metadata" in geojson
    assert geojson["metadata"]["model_id"] == "alphaearth_spectral_hybrid"
