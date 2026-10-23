"""Vectorise labelled change components into georeferenced GeoJSON polygons with geodesic areas."""

from __future__ import annotations

from typing import Any, Dict, List, Optional

import numpy as np
import shapely
from numpy.typing import NDArray
from pyproj import Geod
from scipy import ndimage
from shapely.geometry import Polygon, mapping

from terrashift.acquisition.tiles import Grid
from terrashift.geo.classify import (
    CLASS_LABELS,
    RGB_LABELS,
    classify_change,
    classify_rgb_change,
)
from terrashift.inference.rgb_change import bareness, greenness

_geod = Geod(ellps="WGS84")
MIN_AREA_M2 = 3_500.0
MAX_FEATURES = 150


def _component_polygon(sub: NDArray[np.bool_], ox: int, oy: int) -> Polygon | None:
    boxes: List[Any] = []
    for r in range(sub.shape[0]):
        row = sub[r]
        if not row.any():
            continue
        padded = np.concatenate(([0], row.view(np.int8), [0]))
        edges = np.diff(padded)
        for s, e in zip(np.where(edges == 1)[0], np.where(edges == -1)[0]):
            boxes.append(shapely.box(ox + s, oy + r, ox + e, oy + r + 1))
    if not boxes:
        return None
    union = shapely.union_all(boxes)
    if union.geom_type == "MultiPolygon":
        union = max(union.geoms, key=lambda g: g.area)
    if union.geom_type != "Polygon":
        return None
    return Polygon(union.exterior).simplify(0.8)


def vectorize_changes(
    mask: NDArray[np.bool_],
    probability: NDArray[np.float32],
    rgb1: NDArray[np.uint8],
    matched2: NDArray[np.float32],
    grid: Grid,
    min_area_m2: float = MIN_AREA_M2,
    multispectral_context: Optional[Dict[str, NDArray[np.float32]]] = None,
) -> Dict[str, Any]:
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    a = rgb1.astype(np.float32) / 255.0
    green_delta = greenness(matched2) - greenness(a)
    bare_delta = bareness(matched2) - bareness(a)
    bright_delta = matched2.mean(axis=-1) - a.mean(axis=-1)

    has_multi = multispectral_context is not None
    t1_ndvi = multispectral_context.get("t1_ndvi") if has_multi and multispectral_context else None
    t2_ndvi = multispectral_context.get("t2_ndvi") if has_multi and multispectral_context else None
    t1_ndbi = multispectral_context.get("t1_ndbi") if has_multi and multispectral_context else None
    t2_ndbi = multispectral_context.get("t2_ndbi") if has_multi and multispectral_context else None

    slices = ndimage.find_objects(labels)
    candidates: List[Dict[str, Any]] = []
    for idx, sl in enumerate(slices, start=1):
        if sl is None:
            continue
        sub = labels[sl] == idx
        poly = _component_polygon(sub, sl[1].start, sl[0].start)
        if poly is None or poly.is_empty:
            continue
        lon, lat = grid.to_lonlat(
            np.asarray(poly.exterior.coords)[:, 0], np.asarray(poly.exterior.coords)[:, 1]
        )
        area_m2 = abs(float(_geod.polygon_area_perimeter(lon, lat)[0]))
        if area_m2 < min_area_m2:
            continue

        conf = float(probability[sl][sub].mean())

        # Physical False Alarm Suppression over Arid Landscapes:
        # If genuine multispectral indices (NDBI, NDVI) are present, verify that either
        # a structural change (building/grading: positive d_true_ndbi >= 0.04) or
        # vegetative change (|d_true_ndvi| >= 0.10) occurred, or confidence is very high (>= 0.85).
        # Natural arid variations (sun angle, drying, sabkha salt-crust shifts) produce negative
        # or negligible NDBI deltas and near-zero NDVI deltas.
        d_true_ndvi: Optional[float] = None
        d_true_ndbi: Optional[float] = None
        if t1_ndvi is not None and t2_ndvi is not None and t1_ndbi is not None and t2_ndbi is not None:
            m_ndvi1 = float(np.mean(t1_ndvi[sl][sub]))
            m_ndvi2 = float(np.mean(t2_ndvi[sl][sub]))
            m_ndbi1 = float(np.mean(t1_ndbi[sl][sub]))
            m_ndbi2 = float(np.mean(t2_ndbi[sl][sub]))
            d_true_ndvi = m_ndvi2 - m_ndvi1
            d_true_ndbi = m_ndbi2 - m_ndbi1

            # Directional physical verification:
            # - Built-up expansion requires positive d_true_ndbi >= 0.04
            # - Vegetation expansion/loss requires |d_true_ndvi| >= 0.10
            # - Or high neural model confidence >= 0.85
            is_valid_spectral_change = (
                (d_true_ndbi >= 0.04)
                or (abs(d_true_ndvi) >= 0.10)
                or (conf >= 0.85)
            )
            if not is_valid_spectral_change:
                continue

            kind = classify_change(m_ndvi1, m_ndvi2, m_ndbi1, m_ndbi2, 0.0, 0.0)
            label = CLASS_LABELS.get(kind, "Ground surface change")
        else:
            dg = float(green_delta[sl][sub].mean())
            db = float(bare_delta[sl][sub].mean())
            dl = float(bright_delta[sl][sub].mean())
            kind = classify_rgb_change(dg, db, dl)
            label = RGB_LABELS.get(kind, "Surface change")

        candidates.append(
            {
                "area": area_m2,
                "geometry": mapping(Polygon(list(zip(lon.round(6).tolist(), lat.round(6).tolist())))),
                "kind": kind,
                "label": label,
                "confidence": conf,
                "dg": float(green_delta[sl][sub].mean()),
                "db": float(bare_delta[sl][sub].mean()),
                "true_ndvi_delta": round(d_true_ndvi, 3) if d_true_ndvi is not None else None,
                "true_ndbi_delta": round(d_true_ndbi, 3) if d_true_ndbi is not None else None,
            }
        )

    candidates.sort(key=lambda c: c["area"], reverse=True)
    features: List[Dict[str, Any]] = []
    total = 0.0
    for i, c in enumerate(candidates[:MAX_FEATURES], start=1):
        total += c["area"]
        props: Dict[str, Any] = {
            "id": i,
            "class": c["kind"],
            "label": c["label"],
            "area_m2": round(c["area"], 1),
            "confidence": round(c["confidence"], 3),
            "greenness_delta": round(c["dg"], 3),
            "bareness_delta": round(c["db"], 3),
        }
        if c["true_ndvi_delta"] is not None:
            props["true_ndvi_delta"] = c["true_ndvi_delta"]
        if c["true_ndbi_delta"] is not None:
            props["true_ndbi_delta"] = c["true_ndbi_delta"]

        features.append(
            {
                "type": "Feature",
                "geometry": c["geometry"],
                "properties": props,
            }
        )
    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "total_changed_m2": round(total, 1),
            "total_changed_km2": round(total / 1e6, 4),
            "polygon_count": len(features),
        },
    }
