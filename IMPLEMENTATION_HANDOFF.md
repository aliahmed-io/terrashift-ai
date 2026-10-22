# TerraShift AI — Implementation Plan & Handoff Notes for Implementing Model

> **Full Artifact Copy:** Also available in [`implementation_plan.md`](file:///C:/Users/aliha/.gemini/antigravity/brain/402fc4d3-dde6-4003-80f6-dc9090d89608/implementation_plan.md).

## 1. Non-Negotiable Rules for the Implementing Model
1. **DO NOT Change the Approved UI Design:** Keep the Daylight Cartographic UI (`#f6f7f9` background, `#ffffff` cards, `#1c1f23` charcoal text, `#22b567` emerald / `#f39223` amber / `#e94235` crimson accents) across all 7 routes (`/`, `/analyze`, `/benchmarks`, `/timeline`, `/lab`, `/carbon`, `/watchlist`) 100% intact.
2. **DO NOT Change the Look of the 8 City Diagnostic Rasters:** When replacing static `.jpg` files in `apps/web/public/samples/` with live backend-rendered rasters, **use the exact color Look-Up Tables (LUTs), dark-basemap blending weights, Gaussian smoothing radii, and `1.4px` vector contour overlays** defined in [`scripts/generate_real_eo_renders.py`](file:///d:/terrashift-ai/scripts/generate_real_eo_renders.py).
3. **Zero API Keys Required:** Continue using the keyless **Element84 AWS Earth Search STAC API** (`https://earth-search.aws.element84.com/v1/search`, collection `sentinel-2-l2a`) and **EOX Sentinel-2 Cloudless WMTS** (`https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-{year}_3857/default/g/{z}/{y}/{x}.jpg`).

---

## 2. File-by-File Execution Checklist

1. **Create `services/ml/terrashift/acquisition/cog_reader.py`**:
   - Perform HTTP range windowed reads (`rasterio.windows.from_bounds`) on the 10 Sentinel-2 L2A bands (`B02, B03, B04, B05, B06, B07, B08, B8A, B11, B12`) and `SCL` cloud mask returned by [`STACClient.search_scenes()`](file:///d:/terrashift-ai/services/ml/terrashift/acquisition/stac.py).
   - Normalize reflectance (`DN / 10000.0`, clipped to `[0, 1]`), co-register $T_2$ to $T_1$ via Fourier phase correlation on `B08`, and cache compressed tensors in `services/ml/.cache/tensors/{corridor_id}_{year}_{month}.npz`.

2. **Create `services/ml/terrashift/inference/renderer.py`**:
   - Port the exact rendering math from [`scripts/generate_real_eo_renders.py`](file:///d:/terrashift-ai/scripts/generate_real_eo_renders.py) into `render_effect(t1_tensor, t2_tensor, prob_map, gt_mask, effect_name, split_ratio=0.44, threshold=0.45) -> bytes`.
   - Support all 8 effects (`split`, `nir`, `ndbi`, `magma`, `confusion`, `contagion`, `carbon`, `thermal`) dynamically for any corridor (`roshn`, `wadi`, `neom`, `redsea`, `rondonia`) or custom AOI polygon.

3. **Update [`services/ml/terrashift/api/main.py`](file:///d:/terrashift-ai/services/ml/terrashift/api/main.py) & [`services/ml/terrashift/pipeline.py`](file:///d:/terrashift-ai/services/ml/terrashift/pipeline.py)**:
   - Add `GET /v1/render/{corridor_id}/{effect}` (serving live/cached JPEG diagnostic rasters).
   - Add `POST /v1/corridor/telemetry` (computing real 10-band mean reflectances `spectralBands2018`/`spectralBands2024`, geodesic `baseAreaHa`, `baseChangePct`, 5 classified `anomalyRows`, `baseF1`/`baseIou`/`basePrecision`/`baseRecall`, `carbonMgPerHa`, and `thermalDeltaC`).
   - Upgrade `run_analysis()` in `pipeline.py` to run the 10-channel `SiameseUNet` (`terrashift/models/siamese_unet.py`) and Integrated Gradients SHAP attribution.

4. **Create Next.js Proxy Routes & Wire [`apps/web/src/lib/aoi-context.tsx`](file:///d:/terrashift-ai/apps/web/src/lib/aoi-context.tsx)**:
   - Create `apps/web/src/app/api/raster/[corridorId]/[effect]/route.ts` and `apps/web/src/app/api/telemetry/route.ts`.
   - In `aoi-context.tsx`, fetch `POST /api/telemetry` whenever `(activeCorridorId, activeYear, activeMonth)` changes, and expose `getRasterUrl(effect)` so all 7 pages (`/`, `/analyze`, `/benchmarks`, `/timeline`, `/lab`, `/carbon`, `/watchlist`) display live corridor-specific satellite rasters and live telemetry.

5. **Create & Run `scripts/prewarm_corridors.py`**:
   - Pre-fetch and cache the real Sentinel-2 tiles/tensors and all 8 rendered diagnostic effects for all 5 corridors (`roshn`, `wadi`, `neom`, `redsea`, `rondonia`) so switching corridors in the UI responds in `< 50 ms` while displaying each corridor's real satellite geography.
