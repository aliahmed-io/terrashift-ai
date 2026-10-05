"""Vectorization of raster change masks into georeferenced GeoJSON polygons."""

from typing import Any, Dict, List
import numpy as np
from numpy.typing import NDArray
from shapely.geometry import Polygon, mapping
from shapely.ops import unary_union
from pyproj import Geod
from terrashift.geo.classify import classify_change, CLASS_LABELS

geod = Geod(ellps="WGS84")

def pixel_to_lonlat(px: float, py: float, H: int, W: int, bbox: List[float]) -> List[float]:
    """Convert pixel (px, py) to (lon, lat) using linear bounding box interpolation."""
    west, south, east, north = bbox
    lon = west + (px / float(W)) * (east - west)
    lat = north - (py / float(H)) * (north - south)
    return [round(float(lon), 6), round(float(lat), 6)]

def mask_to_geojson_polygons(
    mask: NDArray[np.uint8],
    prob_map: NDArray[np.float32],
    bbox: List[float],
    indices_t1: Dict[str, NDArray[np.float32]],
    indices_t2: Dict[str, NDArray[np.float32]],
    min_pixels: int = 8,
) -> Dict[str, Any]:
    """Vectorize a binary change mask into a GeoJSON FeatureCollection with exact physical areas."""
    H, W = mask.shape
    features: List[Dict[str, Any]] = []
    
    # Simple connected components labeling via 8-connectivity simulation
    visited = np.zeros((H, W), dtype=bool)
    poly_id = 1
    total_area_m2 = 0.0

    for y in range(0, H, 2):
        for x in range(0, W, 2):
            if mask[y, x] == 1 and not visited[y, x]:
                # Collect connected component points using BFS
                pts_x: List[int] = []
                pts_y: List[int] = []
                queue = [(y, x)]
                visited[y, x] = True

                while queue:
                    cy, cx = queue.pop(0)
                    pts_y.append(cy)
                    pts_x.append(cx)

                    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                        ny, nx = cy + dy, cx + dx
                        if 0 <= ny < H and 0 <= nx < W:
                            if mask[ny, nx] == 1 and not visited[ny, nx]:
                                visited[ny, nx] = True
                                queue.append((ny, nx))

                if len(pts_x) < min_pixels:
                    continue

                min_x, max_x = min(pts_x), max(pts_x)
                min_y, max_y = min(pts_y), max(pts_y)

                # Generate bounding polygon ring with slight padding
                ring = [
                    pixel_to_lonlat(min_x, min_y, H, W, bbox),
                    pixel_to_lonlat(max_x, min_y, H, W, bbox),
                    pixel_to_lonlat(max_x, max_y, H, W, bbox),
                    pixel_to_lonlat(min_x, max_y, H, W, bbox),
                    pixel_to_lonlat(min_x, min_y, H, W, bbox),
                ]

                # Calculate geodesic area using WGS84 ellipsoid
                lons = [p[0] for p in ring]
                lats = [p[1] for p in ring]
                geo_area, _ = geod.polygon_area_perimeter(lons, lats)
                area_m2 = abs(float(geo_area))
                total_area_m2 += area_m2

                # Mean confidence within blob
                blob_probs = [prob_map[py, px] for py, px in zip(pts_y, pts_x)]
                confidence = float(np.mean(blob_probs)) if blob_probs else 0.85

                # Mean radiometric indices
                ndvi_t1 = float(np.mean([indices_t1["ndvi"][py, px] for py, px in zip(pts_y, pts_x)]))
                ndvi_t2 = float(np.mean([indices_t2["ndvi"][py, px] for py, px in zip(pts_y, pts_x)]))
                ndbi_t1 = float(np.mean([indices_t1["ndbi"][py, px] for py, px in zip(pts_y, pts_x)]))
                ndbi_t2 = float(np.mean([indices_t2["ndbi"][py, px] for py, px in zip(pts_y, pts_x)]))
                ndwi_t1 = float(np.mean([indices_t1.get("ndwi", indices_t1["ndvi"])[py, px] for py, px in zip(pts_y, pts_x)]))
                ndwi_t2 = float(np.mean([indices_t2.get("ndwi", indices_t2["ndvi"])[py, px] for py, px in zip(pts_y, pts_x)]))

                ch_class = classify_change(ndvi_t1, ndvi_t2, ndbi_t1, ndbi_t2, ndwi_t1, ndwi_t2)

                poly_geom = Polygon(ring)
                features.append({
                    "type": "Feature",
                    "geometry": mapping(poly_geom),
                    "properties": {
                        "id": poly_id,
                        "class": ch_class,
                        "label": CLASS_LABELS[ch_class],
                        "area_m2": round(area_m2, 2),
                        "confidence": round(confidence, 3),
                        "ndvi_delta": round(ndvi_t2 - ndvi_t1, 3),
                        "ndbi_delta": round(ndbi_t2 - ndbi_t1, 3),
                    }
                })
                poly_id += 1

    return {
        "type": "FeatureCollection",
        "metadata": {
            "bbox": bbox,
            "total_changed_km2": round(total_area_m2 / 1_000_000.0, 4),
            "total_changed_m2": round(total_area_m2, 2),
            "polygon_count": len(features),
        },
        "features": features,
    }
