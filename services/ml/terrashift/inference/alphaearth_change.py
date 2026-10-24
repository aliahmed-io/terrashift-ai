"""AlphaEarth Foundation Model & Dynamic World Change Detection Engine.

Implements multi-model change detection using genuine Google AlphaEarth 64-D annual embeddings
('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL') and Google Dynamic World V1 ('GOOGLE/DYNAMICWORLD/V1'):
- Model A (`detect_alphaearth_cosine`): Unsupervised 64-D Cosine-Distance Detector (tau=0.12).
- Model B (`detect_alphaearth_dynamic_world`): AlphaEarth + Dynamic World LULC Transition Analysis.
- Model C (`detect_dynamic_world_lulc`): Standalone Dynamic World V1 LULC Probability Transition Baseline.
- Model D (`detect_alphaearth_hybrid`): Frontier Hybrid fusing AlphaEarth 64-D semantic divergence,
  bi-temporal Siamese U-Net structural probability, and directional Sentinel-2 L2A physical spectral guards.

Methodological Integrity:
- Synthetic calibration (`fit_synthetic_calibration`) is strictly prohibited and removed.
- Any supervised classifier requires explicit fitting on verified ground-truth pixel arrays via `.fit()`.
- All vectorized polygons are geometrically clipped to the exact AOI bounding box before geodesic area integration.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import shapely
from numpy.typing import NDArray
from pyproj import Geod
from scipy import ndimage
from shapely.geometry import Polygon, mapping

from terrashift.acquisition.earth_engine import AlphaEarthScene

logger = logging.getLogger(__name__)
_geod = Geod(ellps="WGS84")

MAX_FEATURES: int = 150
EPS: float = 1e-7


@dataclass
class AlphaEarthDetectionResult:
    """Detection output from an AlphaEarth or Dynamic World change model."""
    mask: NDArray[np.bool_]              # Binary change mask (H, W)
    change_score: NDArray[np.float32]     # Continuous change score [0, 1] (H, W)
    cosine_distance: NDArray[np.float32]  # Pure 1 - cosine_sim (H, W)
    model_id: str
    model_name: str
    metadata: Dict[str, Any]


def compute_cosine_distance(
    u: NDArray[np.float32],
    v: NDArray[np.float32],
) -> Tuple[NDArray[np.float32], NDArray[np.float32]]:
    """Compute exact pixel-wise cosine similarity and cosine distance for 64-D embeddings.

    Because AlphaEarth embeddings are unit-normalized (||u|| = 1.0, ||v|| = 1.0),
    the cosine similarity equals the inner product:
        cos(u, v) = sum_{k=0}^{63} u_k * v_k
        dist = 1 - cos(u, v)
    """
    dot_product = np.sum(u * v, axis=-1, dtype=np.float32)
    cosine_sim = np.clip(dot_product, -1.0, 1.0)
    cosine_dist = np.clip(1.0 - cosine_sim, 0.0, 2.0).astype(np.float32)
    return cosine_sim, cosine_dist


# ---------------------------------------------------------------------------
# Model A: Cosine-Distance Detector (Unsupervised Foundation Metric)
# ---------------------------------------------------------------------------
def detect_alphaearth_cosine(
    t1_scene: AlphaEarthScene,
    t2_scene: AlphaEarthScene,
    threshold: float = 0.12,
) -> AlphaEarthDetectionResult:
    """Model A: Thresholded cosine distance on 64-D annual embeddings.

    A threshold of 0.12 corresponds to cosine similarity < 0.88 (Manikandan et al., 2026).
    """
    valid = t1_scene.valid_mask & t2_scene.valid_mask
    _, cos_dist = compute_cosine_distance(t1_scene.embeddings, t2_scene.embeddings)

    change_score = np.clip(cos_dist / 0.50, 0.0, 1.0).astype(np.float32)
    mask = (cos_dist >= threshold) & valid

    return AlphaEarthDetectionResult(
        mask=mask,
        change_score=change_score,
        cosine_distance=cos_dist,
        model_id="alphaearth_cosine_distance",
        model_name="AlphaEarth 64-D Cosine Dissimilarity (Model A)",
        metadata={
            "threshold": threshold,
            "equivalent_cosine_similarity": round(1.0 - threshold, 3),
            "valid_pixels": int(valid.sum()),
            "changed_pixels": int(mask.sum()),
            "mean_cosine_dist": float(cos_dist[valid].mean()) if valid.any() else 0.0,
            "data_source": t1_scene.source,
        },
    )


# ---------------------------------------------------------------------------
# Model B: AlphaEarth + Dynamic World Transition Detector
# ---------------------------------------------------------------------------
def detect_alphaearth_dynamic_world(
    t1_scene: AlphaEarthScene,
    t2_scene: AlphaEarthScene,
    threshold: float = 0.10,
    built_prob_delta_min: float = 0.12,
    crop_prob_delta_min: float = 0.15,
) -> AlphaEarthDetectionResult:
    """Model B: Joint AlphaEarth embedding divergence + Dynamic World LULC probability shifts.

    Verifies that annual embedding movement coincides with a Dynamic World class transition:
    - Built expansion: delta P(built) >= +built_prob_delta_min
    - Agriculture shift: |delta P(crops)| >= crop_prob_delta_min
    """
    valid = t1_scene.valid_mask & t2_scene.valid_mask
    _, cos_dist = compute_cosine_distance(t1_scene.embeddings, t2_scene.embeddings)

    dw1 = t1_scene.dw_probabilities
    dw2 = t2_scene.dw_probabilities

    if dw1 is not None and dw2 is not None:
        # Classes: water(0), trees(1), grass(2), flooded(3), crops(4), shrub(5), built(6), bare(7), snow(8)
        p_built_delta = dw2[:, :, 6] - dw1[:, :, 6]
        p_crop_delta = np.abs(dw2[:, :, 4] - dw1[:, :, 4])

        semantic_shift = (p_built_delta >= built_prob_delta_min) | (p_crop_delta >= crop_prob_delta_min)
        mask = (cos_dist >= threshold) & semantic_shift & valid
        combined_score = np.clip(
            (cos_dist / 0.40) * 0.6 + (np.maximum(np.clip(p_built_delta, 0.0, 1.0), p_crop_delta)) * 0.4,
            0.0,
            1.0,
        )
    else:
        raise RuntimeError("Dynamic World probabilities are required for Model B (`detect_alphaearth_dynamic_world`).")

    return AlphaEarthDetectionResult(
        mask=mask,
        change_score=combined_score.astype(np.float32),
        cosine_distance=cos_dist,
        model_id="alphaearth_dynamic_world",
        model_name="AlphaEarth + Dynamic World LULC Transition (Model B)",
        metadata={
            "threshold": threshold,
            "built_prob_delta_min": built_prob_delta_min,
            "crop_prob_delta_min": crop_prob_delta_min,
            "has_dynamic_world_data": True,
            "changed_pixels": int(mask.sum()),
            "data_source": t1_scene.source,
        },
    )


# ---------------------------------------------------------------------------
# Model C (Global LULC Baseline): Standalone Google Dynamic World V1 Transition
# ---------------------------------------------------------------------------
def detect_dynamic_world_lulc(
    t1_scene: AlphaEarthScene,
    t2_scene: AlphaEarthScene,
    built_prob_delta_min: float = 0.15,
    crop_prob_delta_min: float = 0.18,
) -> AlphaEarthDetectionResult:
    """Standalone Google Dynamic World V1 LULC probability transition baseline.

    Evaluates Dynamic World built-area and crop probability shifts directly without
    AlphaEarth embeddings or Sentinel-2 physical spectral indices.
    """
    valid = t1_scene.valid_mask & t2_scene.valid_mask
    _, cos_dist = compute_cosine_distance(t1_scene.embeddings, t2_scene.embeddings)

    dw1 = t1_scene.dw_probabilities
    dw2 = t2_scene.dw_probabilities
    if dw1 is None or dw2 is None:
        raise RuntimeError("Dynamic World probabilities are required for `detect_dynamic_world_lulc`.")

    p_built_delta = dw2[:, :, 6] - dw1[:, :, 6]
    p_crop_delta = np.abs(dw2[:, :, 4] - dw1[:, :, 4])
    p_bare_drop = dw1[:, :, 7] - dw2[:, :, 7]

    mask = ((p_built_delta >= built_prob_delta_min) | (p_crop_delta >= crop_prob_delta_min)) & valid
    score = np.clip(np.maximum(np.clip(p_built_delta, 0.0, 1.0), np.maximum(p_crop_delta, np.clip(p_bare_drop, 0.0, 1.0))), 0.0, 1.0)

    return AlphaEarthDetectionResult(
        mask=mask,
        change_score=score.astype(np.float32),
        cosine_distance=cos_dist,
        model_id="dynamic_world_lulc",
        model_name="Google Dynamic World V1 LULC Transition Baseline",
        metadata={
            "built_prob_delta_min": built_prob_delta_min,
            "crop_prob_delta_min": crop_prob_delta_min,
            "changed_pixels": int(mask.sum()),
            "data_source": t1_scene.source,
        },
    )


# ---------------------------------------------------------------------------
# Supervised AlphaEarth Classifier (Requires Explicit Verified Pixel Labels)
# ---------------------------------------------------------------------------
class LightweightAlphaEarthClassifier:
    """Compact CPU-friendly classifier for 257-D AlphaEarth embedding transitions.

    NOTE: Synthetic calibration is strictly prohibited. Call `.fit(u_train, v_train, y_train)`
    with verified dense ground-truth pixel labels prior to inference.
    """

    def __init__(self) -> None:
        from sklearn.ensemble import HistGradientBoostingClassifier
        self.model = HistGradientBoostingClassifier(
            max_iter=35,
            max_depth=5,
            min_samples_leaf=10,
            learning_rate=0.1,
            random_state=42,
        )
        self._is_fitted = False

    def fit(
        self,
        u_train: NDArray[np.float32],
        v_train: NDArray[np.float32],
        y_train: NDArray[np.int_],
    ) -> None:
        """Fit classifier on verified (N, 64) bi-temporal embedding pairs and binary labels (N,)."""
        diff = v_train - u_train
        abs_diff = np.abs(diff)
        cos_dist = (1.0 - np.clip(np.sum(u_train * v_train, axis=-1), -1.0, 1.0))[:, None]
        X = np.hstack([u_train, v_train, diff, abs_diff, cos_dist])
        self.model.fit(X, y_train)
        self._is_fitted = True

    def predict_proba_map(
        self,
        u_map: NDArray[np.float32],
        v_map: NDArray[np.float32],
        cos_dist: NDArray[np.float32],
    ) -> NDArray[np.float32]:
        """Generate change probability map for an AOI on CPU using a fitted classifier."""
        if not self._is_fitted:
            raise RuntimeError(
                "LightweightAlphaEarthClassifier is unfitted. Synthetic calibration is prohibited; "
                "call `.fit(u_train, v_train, y_train)` with verified dense ground-truth pixel labels."
            )

        H, W, D = u_map.shape
        u_flat = u_map.reshape(-1, D)
        v_flat = v_map.reshape(-1, D)
        diff_flat = v_flat - u_flat
        abs_diff_flat = np.abs(diff_flat)
        cos_dist_flat = cos_dist.reshape(-1, 1)

        X = np.hstack([u_flat, v_flat, diff_flat, abs_diff_flat, cos_dist_flat])
        probs = self.model.predict_proba(X)[:, 1]
        return probs.reshape(H, W).astype(np.float32)


def detect_alphaearth_classifier(
    t1_scene: AlphaEarthScene,
    t2_scene: AlphaEarthScene,
    classifier: LightweightAlphaEarthClassifier,
    threshold: float = 0.50,
) -> AlphaEarthDetectionResult:
    """Supervised change classification on 64-D embedding transitions using an explicitly fitted classifier."""
    valid = t1_scene.valid_mask & t2_scene.valid_mask
    _, cos_dist = compute_cosine_distance(t1_scene.embeddings, t2_scene.embeddings)

    prob_map = classifier.predict_proba_map(
        t1_scene.embeddings,
        t2_scene.embeddings,
        cos_dist,
    )
    mask = (prob_map >= threshold) & valid

    return AlphaEarthDetectionResult(
        mask=mask,
        change_score=prob_map,
        cosine_distance=cos_dist,
        model_id="alphaearth_supervised_classifier",
        model_name="AlphaEarth Supervised Classifier",
        metadata={
            "threshold": threshold,
            "classifier": "HistGradientBoosting(max_iter=35, max_depth=5)",
            "changed_pixels": int(mask.sum()),
            "mean_probability": float(prob_map[valid].mean()) if valid.any() else 0.0,
        },
    )


# ---------------------------------------------------------------------------
# Model D: AlphaEarth + TerraShift Frontier Hybrid Detector
# ---------------------------------------------------------------------------
def detect_alphaearth_hybrid(
    t1_scene: AlphaEarthScene,
    t2_scene: AlphaEarthScene,
    multispectral_context: Optional[Dict[str, Any]] = None,
    siamese_probability: Optional[NDArray[np.float32]] = None,
    siamese_mask: Optional[NDArray[np.bool_]] = None,
    threshold: float = 0.08,
    ndbi_delta_min: float = 0.04,
    ndvi_delta_min: float = 0.10,
) -> AlphaEarthDetectionResult:
    """Model D: Frontier Hybrid fusing AlphaEarth 64-D embeddings, Siamese U-Net, and L2A Spectral Guards.

    When bi-temporal Siamese mask/probabilities and Sentinel-2 L2A spectral indices are available:
    1. Preserves crisp 10m morphologically cleaned Siamese U-Net parcel candidates (`siamese_mask`),
       avoiding pixel-wise raster fragmentation across disparate coordinate projections.
    2. Evaluates AlphaEarth 64-D annual cosine distance (`cos_dist`) and Sentinel-2 L2A physical
       spectral deltas (`d_ndbi`, `d_ndvi`) across each candidate parcel during vectorization.
    """
    valid = t1_scene.valid_mask & t2_scene.valid_mask
    _, cos_dist = compute_cosine_distance(t1_scene.embeddings, t2_scene.embeddings)

    has_multi = multispectral_context is not None
    t1_ndvi = multispectral_context.get("t1_ndvi") if has_multi and multispectral_context else None
    t2_ndvi = multispectral_context.get("t2_ndvi") if has_multi and multispectral_context else None
    t1_ndbi = multispectral_context.get("t1_ndbi") if has_multi and multispectral_context else None
    t2_ndbi = multispectral_context.get("t2_ndbi") if has_multi and multispectral_context else None

    if siamese_mask is not None and siamese_probability is not None:
        filtered_mask = siamese_mask & valid
        change_score = siamese_probability.astype(np.float32)
        base_mask = filtered_mask
    elif siamese_probability is not None:
        base_mask = (siamese_probability >= 0.48) & (cos_dist >= threshold) & valid
        filtered_mask = base_mask
        change_score = siamese_probability.astype(np.float32)
    else:
        base_mask = (cos_dist >= max(threshold, 0.12)) & valid
        if t1_ndvi is not None and t2_ndvi is not None and t1_ndbi is not None and t2_ndbi is not None:
            d_ndvi = t2_ndvi - t1_ndvi
            d_ndbi = t2_ndbi - t1_ndbi
            filtered_mask = base_mask & ((d_ndbi >= ndbi_delta_min) | (np.abs(d_ndvi) >= ndvi_delta_min) | (cos_dist >= 0.25))
        else:
            filtered_mask = base_mask
        change_score = np.clip(cos_dist / 0.45, 0.0, 1.0).astype(np.float32)

    return AlphaEarthDetectionResult(
        mask=filtered_mask,
        change_score=change_score,
        cosine_distance=cos_dist,
        model_id="alphaearth_spectral_hybrid",
        model_name="TerraShift v6.0 Frontier Hybrid (Model D)",
        metadata={
            "threshold": threshold,
            "ndbi_delta_min": ndbi_delta_min,
            "ndvi_delta_min": ndvi_delta_min,
            "has_multispectral_context": has_multi,
            "has_siamese_fusion": siamese_probability is not None,
            "raw_candidate_hits": int(base_mask.sum()),
            "filtered_hits": int(filtered_mask.sum()),
            "suppressed_pixels": int(base_mask.sum() - filtered_mask.sum()),
            "data_source": t1_scene.source,
        },
    )


# ---------------------------------------------------------------------------
# Vectorization & GeoJSON Formatting with Exact Geometric AOI Clipping
# ---------------------------------------------------------------------------
def vectorize_alphaearth_changes(
    detection: AlphaEarthDetectionResult,
    grid: Any,
    min_area_m2: float = 3500.0,
    multispectral_context: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Convert binary change detection mask into georeferenced, AOI-clipped GeoJSON polygons."""
    from terrashift.geo.components import _component_polygon

    labeled_array, _ = ndimage.label(detection.mask, structure=np.ones((3, 3), dtype=int))
    slices = ndimage.find_objects(labeled_array)

    has_multi = multispectral_context is not None
    t1_ndvi = multispectral_context.get("t1_ndvi") if has_multi and multispectral_context else None
    t2_ndvi = multispectral_context.get("t2_ndvi") if has_multi and multispectral_context else None
    t1_ndbi = multispectral_context.get("t1_ndbi") if has_multi and multispectral_context else None
    t2_ndbi = multispectral_context.get("t2_ndbi") if has_multi and multispectral_context else None

    aoi_bbox = getattr(grid, "bbox", None)
    aoi_clip_box = shapely.box(*aoi_bbox) if aoi_bbox is not None else None
    bg_median_dist = float(np.median(detection.cosine_distance)) if detection.cosine_distance.size > 0 else 0.05
    is_hybrid_siamese = (
        detection.model_id == "alphaearth_spectral_hybrid"
        and bool(detection.metadata.get("has_siamese_fusion", False))
    )

    candidates: List[Dict[str, Any]] = []

    for idx, sl in enumerate(slices, start=1):
        if sl is None:
            continue
        sub = labeled_array[sl] == idx
        poly = _component_polygon(sub, sl[1].start, sl[0].start)
        if poly is None or poly.is_empty:
            continue

        lon, lat = grid.to_lonlat(
            np.asarray(poly.exterior.coords)[:, 0], np.asarray(poly.exterior.coords)[:, 1]
        )
        geo_poly = Polygon(list(zip(lon, lat)))
        if aoi_clip_box is not None:
            geo_poly = geo_poly.intersection(aoi_clip_box)
            if geo_poly.is_empty:
                continue
            if geo_poly.geom_type in ("MultiPolygon", "GeometryCollection"):
                polys = [g for g in geo_poly.geoms if g.geom_type == "Polygon" and not g.is_empty]
                if not polys:
                    continue
                geo_poly = max(polys, key=lambda g: g.area)
            if geo_poly.geom_type != "Polygon" or len(geo_poly.exterior.coords) < 3:
                continue

        c_coords = np.asarray(geo_poly.exterior.coords)
        lon, lat = c_coords[:, 0], c_coords[:, 1]
        area_m2 = abs(float(_geod.polygon_area_perimeter(lon, lat)[0]))
        if area_m2 < min_area_m2:
            continue

        conf = float(detection.change_score[sl][sub].mean())
        mean_dist = float(detection.cosine_distance[sl][sub].mean())
        max_dist = float(detection.cosine_distance[sl][sub].max())
        ratio_med = mean_dist / max(bg_median_dist, 1e-4)

        d_ndvi: Optional[float] = None
        d_ndbi: Optional[float] = None
        label = "AlphaEarth ground change"
        change_class = "ground_change"

        if t1_ndvi is not None and t2_ndvi is not None and t1_ndbi is not None and t2_ndbi is not None:
            m_ndvi1 = float(np.mean(t1_ndvi[sl][sub]))
            m_ndvi2 = float(np.mean(t2_ndvi[sl][sub]))
            m_ndbi1 = float(np.mean(t1_ndbi[sl][sub]))
            m_ndbi2 = float(np.mean(t2_ndbi[sl][sub]))
            raw_d_ndvi = m_ndvi2 - m_ndvi1
            raw_d_ndbi = m_ndbi2 - m_ndbi1
            d_ndvi = round(raw_d_ndvi, 3)
            d_ndbi = round(raw_d_ndbi, 3)

            # 1. Directional physical spectral guard
            is_valid_spectral = (raw_d_ndbi >= 0.04) or (abs(raw_d_ndvi) >= 0.10) or (conf >= 0.85)
            if not is_valid_spectral:
                continue

            # 2. Multi-modal object-level AlphaEarth + Siamese consensus verification
            if is_hybrid_siamese:
                if conf < 0.62 or max_dist < 0.060 or ratio_med < 1.02:
                    continue
                if bg_median_dist < 0.030 and conf < 0.76:
                    continue
                if raw_d_ndvi < -0.10:
                    # Suppress seasonal crop-stubble soil dryness unless confirmed by high structural conf or pure crop shift
                    if not ((conf >= 0.90 and max_dist >= 0.15) or (mean_dist >= 0.35 and raw_d_ndbi < 0.35)):
                        continue
                elif raw_d_ndbi < 0.04 and raw_d_ndvi >= 0.10 and conf < 0.65:
                    continue

            if raw_d_ndbi >= 0.04:
                label = "Bare ground to built infrastructure"
                change_class = "bare_to_built"
            elif raw_d_ndvi >= 0.10:
                label = "Agricultural vegetative activation"
                change_class = "vegetation_gain"
            elif raw_d_ndvi <= -0.10:
                label = "Crop harvest / parcel fallowing"
                change_class = "vegetation_loss"

        candidates.append({
            "area": area_m2,
            "geometry": mapping(Polygon(list(zip(lon.round(6).tolist(), lat.round(6).tolist())))),
            "class": change_class,
            "label": label,
            "confidence": round(conf, 3),
            "mean_cosine_distance": round(mean_dist, 3),
            "true_ndvi_delta": d_ndvi,
            "true_ndbi_delta": d_ndbi,
        })

    candidates.sort(key=lambda c: c["area"], reverse=True)
    features: List[Dict[str, Any]] = []
    total_area = 0.0

    for i, c in enumerate(candidates[:MAX_FEATURES], start=1):
        total_area += c["area"]
        props = {
            "id": i,
            "class": c["class"],
            "label": c["label"],
            "area_m2": round(c["area"], 1),
            "confidence": c["confidence"],
            "cosine_distance": c["mean_cosine_distance"],
            "model": detection.model_id,
        }
        if c["true_ndvi_delta"] is not None:
            props["true_ndvi_delta"] = c["true_ndvi_delta"]
        if c["true_ndbi_delta"] is not None:
            props["true_ndbi_delta"] = c["true_ndbi_delta"]

        features.append({
            "type": "Feature",
            "geometry": c["geometry"],
            "properties": props,
        })

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "model_id": detection.model_id,
            "model_name": detection.model_name,
            "total_changed_m2": round(total_area, 1),
            "total_changed_km2": round(total_area / 1e6, 4),
            "polygon_count": len(features),
        },
    }
