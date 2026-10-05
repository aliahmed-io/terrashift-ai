"""Sentinel-2 cloudless mosaic access (EOX, free, no API key) via the Web-Mercator XYZ tile grid."""

from __future__ import annotations

import math
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from io import BytesIO
from typing import Callable, List, Optional, Sequence

import httpx
import numpy as np
from numpy.typing import NDArray
from PIL import Image

TILE_SIZE = 256
MIN_YEAR = 2017
MAX_YEAR = 2025
MAX_ZOOM = 13
MIN_ZOOM = 8
MAX_SIDE_PX = 1400
MIN_SIDE_PX = 24
TILE_URL = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{year}_3857/default/g/{z}/{y}/{x}.jpg"

TileFetcher = Callable[[int, int, int, int], NDArray[np.uint8]]


class TileError(Exception):
    """Raised when imagery cannot be retrieved for the requested window."""


class AoiError(Exception):
    """Raised when the requested area cannot be processed."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


@dataclass(frozen=True)
class Grid:
    zoom: int
    x0: float
    y0: float
    width: int
    height: int

    def to_lonlat(self, col: NDArray[np.float64], row: NDArray[np.float64]) -> tuple[NDArray[np.float64], NDArray[np.float64]]:
        n = TILE_SIZE * 2**self.zoom
        px = self.x0 + col
        py = self.y0 + row
        lon = px / n * 360.0 - 180.0
        lat = np.degrees(np.arctan(np.sinh(np.pi * (1.0 - 2.0 * py / n))))
        return lon, lat

    def meters_per_pixel(self, lat: float) -> float:
        return 156543.03392 * math.cos(math.radians(lat)) / 2**self.zoom


def clamp_year(year: int) -> int:
    return max(MIN_YEAR, min(MAX_YEAR, year))


def lonlat_to_pixel(lon: float, lat: float, zoom: int) -> tuple[float, float]:
    n = TILE_SIZE * 2**zoom
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def plan_grid(bbox: Sequence[float]) -> Grid:
    west, south, east, north = bbox
    for zoom in range(MAX_ZOOM, MIN_ZOOM - 1, -1):
        x0, y1 = lonlat_to_pixel(west, south, zoom)
        x1, y0 = lonlat_to_pixel(east, north, zoom)
        width = math.ceil(x1 - x0)
        height = math.ceil(y1 - y0)
        if max(width, height) <= MAX_SIDE_PX:
            if min(width, height) < MIN_SIDE_PX:
                raise AoiError("AOI_TOO_SMALL", "The selected area is too small to analyse.")
            return Grid(zoom=zoom, x0=math.floor(x0), y0=math.floor(y0), width=width, height=height)
    raise AoiError("AOI_TOO_LARGE", "The selected area is too large to analyse.")


_client: Optional[httpx.Client] = None


def _http() -> httpx.Client:
    global _client
    if _client is None:
        _client = httpx.Client(timeout=20.0, limits=httpx.Limits(max_connections=16))
    return _client


def fetch_tile(year: int, zoom: int, x: int, y: int) -> NDArray[np.uint8]:
    url = TILE_URL.format(year=year, z=zoom, x=x, y=y)
    last: Optional[Exception] = None
    for _ in range(3):
        try:
            resp = _http().get(url)
            resp.raise_for_status()
            image = Image.open(BytesIO(resp.content)).convert("RGB")
            return np.asarray(image, dtype=np.uint8)
        except Exception as exc:  # noqa: BLE001 - retried then surfaced as TileError
            last = exc
    raise TileError(f"Tile {zoom}/{x}/{y} for {year} unavailable: {last}")


def fetch_mosaic(
    year: int,
    grid: Grid,
    fetcher: Optional[Callable[[int, int, int, int], NDArray[np.uint8]]] = None,
) -> NDArray[np.uint8]:
    get = fetcher or (lambda z, x, y, yr=year: fetch_tile(yr, z, x, y))
    tx0 = int(grid.x0 // TILE_SIZE)
    ty0 = int(grid.y0 // TILE_SIZE)
    tx1 = int((grid.x0 + grid.width - 1) // TILE_SIZE)
    ty1 = int((grid.y0 + grid.height - 1) // TILE_SIZE)
    coords = [(tx, ty) for ty in range(ty0, ty1 + 1) for tx in range(tx0, tx1 + 1)]

    with ThreadPoolExecutor(max_workers=8) as pool:
        tiles = list(pool.map(lambda c: get(grid.zoom, c[0], c[1]), coords))

    cols = tx1 - tx0 + 1
    rows = ty1 - ty0 + 1
    canvas = np.zeros((rows * TILE_SIZE, cols * TILE_SIZE, 3), dtype=np.uint8)
    for (tx, ty), tile in zip(coords, tiles):
        oy = (ty - ty0) * TILE_SIZE
        ox = (tx - tx0) * TILE_SIZE
        canvas[oy : oy + TILE_SIZE, ox : ox + TILE_SIZE] = tile

    cx = int(grid.x0 - tx0 * TILE_SIZE)
    cy = int(grid.y0 - ty0 * TILE_SIZE)
    return canvas[cy : cy + grid.height, cx : cx + grid.width]


def polygon_mask(ring: Sequence[Sequence[float]], grid: Grid) -> NDArray[np.bool_]:
    """Rasterise a lon/lat ring into the mosaic pixel grid."""
    from PIL import ImageDraw

    points: List[tuple[float, float]] = []
    for lon, lat in ring:
        px, py = lonlat_to_pixel(lon, lat, grid.zoom)
        points.append((px - grid.x0, py - grid.y0))
    img = Image.new("L", (grid.width, grid.height), 0)
    ImageDraw.Draw(img).polygon(points, fill=1)
    return np.asarray(img, dtype=bool)
