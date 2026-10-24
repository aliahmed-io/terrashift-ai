"""Google Earth Engine (GEE) Integration for AlphaEarth & Dynamic World.

Integrates:
1. Google Satellite Embedding V1 Annual ('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL')
   - 64-dimensional unit-normalized pretrained embeddings (A00 - A63) at 10m resolution.
   - Produced by Google and Google DeepMind (Brown et al., 2025).
2. Google Dynamic World V1 ('GOOGLE/DYNAMICWORLD/V1')
   - 9-class near-real-time global land use land cover (LULC) probabilities.

Methodological & Scientific Integrity Guarantees:
- Reads Google Cloud project ID from EARTH_ENGINE_PROJECT_ID (defaulting to 'terrashift').
- Synthetic embeddings and synthetic Dynamic World probabilities are STRICTLY PROHIBITED in
  benchmarks and production (`allow_synthetic=False` by default).
- Raises a clear RuntimeError if genuine Earth Engine data cannot be fetched when `allow_synthetic=False`.
- Caches verified live GEE downloads in `.cache/gee_verified/` with strict provenance verification.
"""

from __future__ import annotations

import io
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from numpy.typing import NDArray
from scipy.ndimage import zoom

logger = logging.getLogger(__name__)

# AlphaEarth 64 Embedding Band Names
ALPHAEARTH_BANDS: List[str] = [f"A{i:02d}" for i in range(64)]

# Dynamic World 9 Land-Cover Classes
DYNAMIC_WORLD_CLASSES: List[str] = [
    "water",
    "trees",
    "grass",
    "flooded_vegetation",
    "crops",
    "shrub_and_scrub",
    "built",
    "bare",
    "snow_and_ice",
]

ROOT_DIR = Path(__file__).resolve().parent.parent.parent.parent.parent


@dataclass
class AlphaEarthScene:
    """Analysis-ready AlphaEarth 64-D embedding + Dynamic World LULC scene."""
    year: int
    bbox: List[float]                   # [min_lon, min_lat, max_lon, max_lat]
    shape: Tuple[int, int]              # (height, width)
    embeddings: NDArray[np.float32]     # (H, W, 64) unit-normalized vectors
    valid_mask: NDArray[np.bool_]       # (H, W) valid data mask
    source: str                         # "google_earth_engine" | "google_earth_engine_cached" | "unit_test_synthetic_only"
    dw_probabilities: Optional[NDArray[np.float32]] = None  # (H, W, 9) DW class probs
    dw_label: Optional[NDArray[np.uint8]] = None            # (H, W) dominant DW class index
    provenance: Optional[Dict[str, Any]] = None


def _resize_3d(arr: NDArray[np.float32], target_shape: Tuple[int, int]) -> NDArray[np.float32]:
    """Resize (H0, W0, C) float32 array to (H, W, C) via bilinear interpolation."""
    h0, w0, _ = arr.shape
    th, tw = target_shape
    if (h0, w0) == (th, tw):
        return arr
    zh = float(th) / float(h0)
    zw = float(tw) / float(w0)
    return zoom(arr, (zh, zw, 1.0), order=1).astype(np.float32)


class EarthEngineManager:
    """Manages Earth Engine lifecycle and verified GEE queries."""

    def __init__(self, project_id: Optional[str] = None):
        self.project_id = project_id or os.getenv("EARTH_ENGINE_PROJECT_ID", "terrashift")
        self._is_initialized = False
        self._init_attempted = False
        self._init_error: Optional[str] = None

    def initialize(self) -> bool:
        """Initialize Earth Engine client with registered project."""
        if self._is_initialized:
            return True
        if self._init_attempted:
            return self._is_initialized

        self._init_attempted = True
        if self.project_id == "test-unauthenticated-project":
            self._init_error = "Explicit unit-test unauthenticated project ID."
            self._is_initialized = False
            return False

        cred_file = Path.home() / ".config" / "earthengine" / "credentials"
        has_sa = "GOOGLE_APPLICATION_CREDENTIALS" in os.environ

        if not cred_file.exists() and not has_sa:
            self._init_error = "No Earth Engine credentials file found at ~/.config/earthengine/credentials."
            self._is_initialized = False
            return False

        try:
            import ee
            if self.project_id:
                ee.Initialize(project=self.project_id)
                self._is_initialized = True
                logger.info("Google Earth Engine initialized with project '%s'", self.project_id)
            else:
                ee.Initialize()
                self._is_initialized = True
                logger.info("Google Earth Engine initialized with default credentials")
        except Exception as exc:
            self._init_error = str(exc)
            self._is_initialized = False
            logger.warning("Google Earth Engine initialization failed: %s", exc)

        return self._is_initialized

    @property
    def is_available(self) -> bool:
        return self.initialize()

    def get_annual_alphaearth_embeddings(
        self,
        bbox: List[float],
        year: int,
        target_shape: Tuple[int, int] = (256, 256),
        allow_synthetic: bool = False,
    ) -> AlphaEarthScene:
        """Fetch genuine 64-D AlphaEarth annual embeddings and Dynamic World LULC probabilities.

        Args:
            bbox: [west, south, east, north] in EPSG:4326.
            year: Calendar year (e.g., 2021, 2024).
            target_shape: Desired (height, width) pixel dimensions aligned to the study grid.
            allow_synthetic: MUST be False in all official benchmarks and production runs.
                             May only be set to True inside isolated unit tests.
        """
        # 1. Check verified GEE disk cache first
        cache_dir = ROOT_DIR / "services" / "ml" / ".cache" / "gee_verified"
        cache_dir.mkdir(parents=True, exist_ok=True)
        bbox_slug = f"{bbox[0]:.4f}_{bbox[1]:.4f}_{bbox[2]:.4f}_{bbox[3]:.4f}_{year}"
        cache_path = cache_dir / f"gee_ae_dw_{bbox_slug}.npz"

        if not allow_synthetic and self.project_id != "test-unauthenticated-project" and cache_path.exists():
            try:
                data = np.load(cache_path, allow_pickle=False)
                src = str(data["source_tag"])
                if src == "google_earth_engine":
                    raw_emb = data["embeddings"].astype(np.float32)
                    raw_dw = data["dw_probabilities"].astype(np.float32)
                    emb = _resize_3d(raw_emb, target_shape)
                    norms = np.linalg.norm(emb, axis=-1, keepdims=True)
                    norms[norms == 0] = 1.0
                    emb = emb / norms
                    dw_probs = _resize_3d(raw_dw, target_shape)
                    dw_label = np.argmax(dw_probs, axis=-1).astype(np.uint8)
                    valid_mask = np.isfinite(emb).all(axis=-1) & (norms[:, :, 0] > 1e-4)
                    return AlphaEarthScene(
                        year=year,
                        bbox=bbox,
                        shape=target_shape,
                        embeddings=emb,
                        valid_mask=valid_mask,
                        source="google_earth_engine_cached",
                        dw_probabilities=dw_probs,
                        dw_label=dw_label,
                        provenance={
                            "dataset": "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL + GOOGLE/DYNAMICWORLD/V1",
                            "producer": "Google / Google DeepMind",
                            "bands": 64,
                            "resolution_m": 10,
                            "project_id": self.project_id,
                            "cache_file": str(cache_path.name),
                        },
                    )
            except Exception as exc:
                logger.warning("Corrupt GEE cache at %s (%s); re-fetching from live GEE", cache_path, exc)

        # 2. Query live Google Earth Engine
        if self.initialize():
            scene = self._fetch_gee_alphaearth(bbox, year, target_shape, cache_path=cache_path)
            return scene

        # 3. Handle unauthenticated state strictly
        if not allow_synthetic:
            raise RuntimeError(
                f"Genuine Google Earth Engine data is required (`allow_synthetic=False`), "
                f"but Earth Engine initialization failed: {self._init_error}. "
                f"Run `earthengine authenticate` and `earthengine set_project {self.project_id}`."
            )

        return self._generate_unit_test_synthetic_scene(bbox, year, target_shape)

    def _fetch_gee_alphaearth(
        self,
        bbox: List[float],
        year: int,
        target_shape: Tuple[int, int],
        cache_path: Optional[Path] = None,
    ) -> AlphaEarthScene:
        """Query live Earth Engine servers for AlphaEarth 64-D embeddings and Dynamic World LULC."""
        import ee
        import requests

        aoi = ee.Geometry.Rectangle(bbox)
        start_date = f"{year}-01-01"
        end_date = f"{year + 1}-01-01"

        col = (
            ee.ImageCollection("GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL")
            .filterDate(start_date, end_date)
            .filterBounds(aoi)
            .select(ALPHAEARTH_BANDS)
        )
        count = col.size().getInfo()
        if count == 0:
            raise ValueError(f"No AlphaEarth annual embeddings found in GEE for year {year} in bbox {bbox}")

        ae_image = col.mosaic().toFloat().clip(aoi)

        # Query Dynamic World summer window (May-Aug) to match Sentinel-2 summer phenology, fallback to full year
        dw_summer = (
            ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
            .filterDate(f"{year}-05-01", f"{year}-09-01")
            .filterBounds(aoi)
            .select(DYNAMIC_WORLD_CLASSES)
        )
        dw_count = dw_summer.size().getInfo()
        if dw_count > 0:
            dw_image = dw_summer.mean().toFloat().clip(aoi)
        else:
            dw_image = (
                ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
                .filterDate(start_date, end_date)
                .filterBounds(aoi)
                .select(DYNAMIC_WORLD_CLASSES)
                .mean()
                .toFloat()
                .clip(aoi)
            )

        combined = ee.Image.cat([ae_image, dw_image])

        # Download at 256x256 in EPSG:4326 (~15m-20m grid over 0.04-0.05 deg corridor, well within 50MB GEE limit)
        dl_dim = "256x256"
        url = combined.getDownloadURL({
            "region": aoi,
            "dimensions": dl_dim,
            "format": "NPY",
            "crs": "EPSG:4326",
        })

        resp = requests.get(url, timeout=90)
        resp.raise_for_status()
        raw_arr = np.load(io.BytesIO(resp.content))

        if not raw_arr.dtype.names:
            raise RuntimeError(f"Expected structured NPY array from GEE, got dtype {raw_arr.dtype}")

        # Note: GEE NPY arrays are ordered North-to-South (row 0 = North), matching STACGrid!
        raw_emb = np.stack([raw_arr[b].astype(np.float32) for b in ALPHAEARTH_BANDS], axis=-1)
        raw_dw = np.stack([raw_arr[b].astype(np.float32) for b in DYNAMIC_WORLD_CLASSES], axis=-1)

        # Replace any NaN/inf before caching and resizing
        raw_emb = np.nan_to_num(raw_emb, nan=0.0, posinf=0.0, neginf=0.0)
        raw_dw = np.nan_to_num(raw_dw, nan=0.0, posinf=0.0, neginf=0.0)

        # Save verified raw download to cache
        if cache_path is not None:
            np.savez_compressed(
                cache_path,
                embeddings=raw_emb,
                dw_probabilities=raw_dw,
                source_tag=np.array("google_earth_engine"),
            )

        # Resize to match exact target_shape of the corridor STACGrid
        embeddings = _resize_3d(raw_emb, target_shape)
        dw_probs = _resize_3d(raw_dw, target_shape)

        # Re-normalize 64-D embeddings to unit hypersphere
        norms = np.linalg.norm(embeddings, axis=-1, keepdims=True)
        valid_mask = (norms[:, :, 0] > 1e-4) & np.isfinite(embeddings).all(axis=-1)
        norms[norms == 0] = 1.0
        embeddings = embeddings / norms

        dw_sum = np.sum(dw_probs, axis=-1, keepdims=True)
        dw_sum[dw_sum == 0] = 1.0
        dw_probs = np.clip(dw_probs / dw_sum, 0.0, 1.0).astype(np.float32)
        dw_label = np.argmax(dw_probs, axis=-1).astype(np.uint8)

        return AlphaEarthScene(
            year=year,
            bbox=bbox,
            shape=target_shape,
            embeddings=embeddings,
            valid_mask=valid_mask,
            source="google_earth_engine",
            dw_probabilities=dw_probs,
            dw_label=dw_label,
            provenance={
                "dataset": "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL + GOOGLE/DYNAMICWORLD/V1",
                "producer": "Google / Google DeepMind",
                "bands": len(ALPHAEARTH_BANDS),
                "dw_classes": len(DYNAMIC_WORLD_CLASSES),
                "resolution_m": 10,
                "project_id": self.project_id,
                "ae_tiles_merged": count,
                "dw_scenes_composited": dw_count,
            },
        )

    def _generate_unit_test_synthetic_scene(
        self,
        bbox: List[float],
        year: int,
        target_shape: Tuple[int, int],
    ) -> AlphaEarthScene:
        """Isolated synthetic generator strictly for offline pytest unit tests (`allow_synthetic=True`)."""
        H, W = target_shape
        seed = int(abs(bbox[0] * 1000 + bbox[1] * 100 + year)) % (2**31 - 1)
        rng = np.random.RandomState(seed)

        raw_emb = rng.randn(H, W, 64).astype(np.float32)
        norms = np.linalg.norm(raw_emb, axis=-1, keepdims=True)
        norms[norms == 0] = 1.0
        embeddings = raw_emb / norms
        valid_mask = np.ones((H, W), dtype=bool)

        dw_probs = rng.dirichlet(
            np.array([0.05, 0.05, 0.1, 0.02, 0.15, 0.1, 0.2, 0.32, 0.01]), size=(H, W)
        ).astype(np.float32)
        dw_label = np.argmax(dw_probs, axis=-1).astype(np.uint8)

        return AlphaEarthScene(
            year=year,
            bbox=bbox,
            shape=target_shape,
            embeddings=embeddings,
            valid_mask=valid_mask,
            source="unit_test_synthetic_only",
            dw_probabilities=dw_probs,
            dw_label=dw_label,
            provenance={
                "dataset": "UNIT_TEST_SYNTHETIC_FIXTURE",
                "status": "unit_test_only_prohibited_in_benchmarks",
            },
        )
