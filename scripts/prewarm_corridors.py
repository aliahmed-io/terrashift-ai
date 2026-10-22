"""Pre-warm TerraShift Sentinel-2 diagnostic raster cache for all 5 corridors."""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure services/ml is in python path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services" / "ml"))

from terrashift.acquisition import tiles
from terrashift.api.main import CORRIDORS
from terrashift.inference.renderer import render_diagnostic_raster

EFFECTS = ["split", "nir", "ndbi", "magma", "confusion", "contagion", "carbon", "thermal"]


def prewarm() -> None:
    cache_dir = ROOT / "services" / "ml" / ".cache" / "renders"
    cache_dir.mkdir(parents=True, exist_ok=True)

    print(f"Pre-warming TerraShift cache at: {cache_dir}")

    for cid, info in CORRIDORS.items():
        print(f"\n--- Corridor: {cid} ({info['name']}) ---")
        grid = tiles.plan_grid(info["bbox"])
        print(f"Grid: {grid.width}x{grid.height} (zoom {grid.zoom})")

        try:
            rgb1 = tiles.fetch_mosaic(2018, grid)
            rgb2 = tiles.fetch_mosaic(2024, grid)
        except Exception as exc:
            print(f"Failed to fetch mosaic for {cid}: {exc}")
            continue

        for eff in EFFECTS:
            # Default parameters matching API queries
            cache_key = f"{cid}_{eff}_2018_2024_45_44.jpg"
            out_path = cache_dir / cache_key

            if out_path.exists() and out_path.stat().st_size > 1000:
                print(f"  [CACHED] {eff} -> {cache_key} ({out_path.stat().st_size} bytes)")
                continue

            try:
                jpeg_bytes = render_diagnostic_raster(
                    rgb1, rgb2, effect=eff, split_ratio=0.44, threshold=0.45
                )
                with open(out_path, "wb") as f:
                    f.write(jpeg_bytes)
                print(f"  [RENDERED] {eff} -> {cache_key} ({len(jpeg_bytes)} bytes)")
            except Exception as exc:
                print(f"  [ERROR] {eff}: {exc}")

    print("\nPre-warming complete!")


if __name__ == "__main__":
    prewarm()
