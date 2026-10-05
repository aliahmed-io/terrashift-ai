"""Vectorise labelled change components into georeferenced GeoJSON polygons with geodesic areas."""

from __future__ import annotations

from typing import Any, Dict, List

import numpy as np
import shapely
from numpy.typing import NDArray
from pyproj import Geod
from scipy import ndimage
from shapely.geometry import Polygon, mapping

from terrashift.acquisition.tiles import Grid
from terrashift.geo.classify import RGB_LABELS, classify_rgb_change
from terrashift.inference.rgb_change import bareness, greenness

_geod = Geod(ellps="WGS84")
MIN_AREA_M2 = 2_000.0
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
) -> Dict[str, Any]:
    labels, count = ndimage.label(mask, structure=np.ones((3, 3), dtype=int))
    a = rgb1.astype(np.float32) / 255.0
    green_delta = greenness(matched2) - greenness(a)
    bare_delta = bareness(matched2) - bareness(a)
    bright_delta = matched2.mean(axis=-1) - a.mean(axis=-1)

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
        if area_m2 < MIN_AREA_M2:
            continue
        dg = float(green_delta[sl][sub].mean())
        db = float(bare_delta[sl][sub].mean())
        dl = float(bright_delta[sl][sub].mean())
        kind = classify_rgb_change(dg, db, dl)
        candidates.append(
            {
                "area": area_m2,
                "geometry": mapping(Polygon(list(zip(lon.round(6).tolist(), lat.round(6).tolist())))),
                "kind": kind,
                "confidence": float(probability[sl][sub].mean()),
                "dg": dg,
                "db": db,
            }
        )

    candidates.sort(key=lambda c: c["area"], reverse=True)
    features: List[Dict[str, Any]] = []
    total = 0.0
    for i, c in enumerate(candidates[:MAX_FEATURES], start=1):
        total += c["area"]
        features.append(
            {
                "type": "Feature",
                "geometry": c["geometry"],
                "properties": {
                    "id": i,
                    "class": c["kind"],
                    "label": RGB_LABELS[c["kind"]],
                    "area_m2": round(c["area"], 1),
                    "confidence": round(c["confidence"], 3),
                    "greenness_delta": round(c["dg"], 3),
                    "bareness_delta": round(c["db"], 3),
                },
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
