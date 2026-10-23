# TerraShift AI — Saudi Deployment & Live Acquisition Audit

**Audit Date:** October 2026  
**Audited Commit:** `fffe141` (`main`)  
**Target Environment:** Saudi Vision 2030 Megaprojects (Riyadh ROSHN Sedra, Jeddah Coastal Expansion, Al-Jouf Agricultural/Desert Transitions)  
**Hardware Profile:** Local Multi-Core CPU (Intel / AMD, no mandatory cloud GPU)  
**Mandate:** Research Mandate v5.0 — Saudi Deployment First, CPU-Optimized Pipeline  

---

## 1. Executive Summary

This audit establishes the baseline gaps between TerraShift AI's current implementation and the requirements of real-world operational monitoring in the Kingdom of Saudi Arabia. While the platform has achieved reproducible $F_1 = 0.4117$ on the international OSCD benchmark with sub-second CPU inference and strict type safety, the primary live analysis route (`/analyze`) has historically executed on 8-bit EOX WMTS RGB composites while querying STAC scene metadata post-hoc. 

This audit documents five verified deficiencies and defines the exact engineering interventions required to establish a 100% genuine, traceable Sentinel-2 Level-2A data pipeline.

---

## 2. Verification of Reported Repository Deficiencies

Each identified deficiency was verified against actual repository source code on commit `fffe141`:

| Deficiency | Source Location | Verified Code Behavior | Severity | Required Engineering Fix |
| :--- | :--- | :--- | :---: | :--- |
| **1. Live analysis runs on RGB mosaic tiles** | `services/ml/terrashift/pipeline.py:59-71` | `rgb1 = fetch(req.year_t1)` calls `tiles.fetch_mosaic(year, grid)` which stitches 8-bit Web Mercator WMTS JPEG/PNG tiles from EOX. | **Critical** | Implement windowed STAC asset reader in `acquisition/stac_reader.py` to stream genuine surface reflectance COGs. |
| **2. STAC metadata decoupled from analyzed pixels** | `services/ml/terrashift/pipeline.py:87-100` | STAC search is executed *after* `detect_change(rgb1, rgb2)` completes. Returned scene IDs (e.g. `S2A_32TNQ...`) do not match the pixels analyzed by the neural model. | **Critical** | Invert dependency: search STAC first, acquire matched COG windows, and feed actual acquisition pixels to the detector. |
| **3. Multispectral module lacked raster asset reader** | `services/ml/terrashift/acquisition/multispectral.py:28-40` | `MultispectralScene` and `analyze_bitemporal_spectral_change()` exist as data structures, but no function downloaded or read COG arrays from S3/HTTP URLs. | **Critical** | Integrate `rasterio` with windowed bounds reading (`from_bounds`) directly from Element 84 AWS Open Data S3 COG URLs. |
| **4. Zero valid-pixel division and NaN vulnerability** | `services/ml/terrashift/acquisition/multispectral.py:120-125` | `np.mean(scene_t1.true_ndvi[joint_valid])` executed without checking `if np.any(joint_valid)`. If an AOI is 100% cloud/shadow or off-tile, it generates `RuntimeWarning: Mean of empty slice` and outputs `NaN`. | **High** | Add explicit empty-slice guards returning `0.0` or raising `InsufficientDataError` when valid pixel coverage is below 10%. |
| **5. Ambiguous provenance in UI reporting** | `apps/web/src/app/analyze/page.tsx` & `components/` | UI displays "NDVI" and "NDBI" labels even when running over RGB mosaic proxies, risking scientific misattribution during academic defense. | **High** | Distinguish operational data modes: `Mode: STAC L2A (True Reflectance)` vs `Mode: EOX WMTS (Optical Proxy Fallback)`. |

---

## 3. Physical Remote Sensing Challenges in Saudi Arabia

Ground conditions in the Kingdom present unique remote-sensing challenges documented in recent literature (e.g. *Springer Nature Land Use Classification in Riyadh, 2026*):

1. **High Background Soil Reflectance:**
   - Dry limestone bedrock, silica desert sands, and alluvial gravel have high Red ($B04$) and SWIR ($B11/B12$) reflectance that closely mimics concrete aggregate and dry road base.
   - *Requirement:* Standard RGB differences trigger massive false alarms across unpaved grading; NIR/Red absorption ratios ($\text{NDVI}$) and SWIR/NIR contrasts ($\text{NDBI}$) are essential to differentiate native desert gravel from poured concrete structures.
2. **Seasonal Sun Angle Disparities:**
   - Winter vs. summer solar zenith angle variations ($>30^\circ$ shift in Riyadh) create building and escarpment shadow shifts across stable urban blocks.
   - *Requirement:* Multi-temporal acquisitions must be restricted to comparable seasonal windows ($\pm 30$ days of target calendar date) to avoid shadow-induced change false positives.
3. **Sub-Pixel Edge Jitter on 10m/20m Sentinel-2 Pixels:**
   - High-density residential construction in Riyadh (e.g. ROSHN Sedra parcel boundaries) features narrow 6–10m streets. Registration jitter across dates causes boundary fringing.
   - *Requirement:* Morphological closing prior to opening to bridge sub-pixel grid gaps, plus post-detection minimum-area filtering ($\ge 2,000\text{ m}^2$) to reject isolated single-pixel noise.

---

## 4. Hardware Budget & CPU Constraints

All implementations must run on standard developer CPU hardware without requiring paid GPU instances:

- **Compute:** Local Multi-Core CPU (Intel / AMD 4–8 cores).
- **RAM Budget:** Peak memory $\le 2.0\text{ GB}$ per analysis request.
- **Latency Target:** End-to-end analysis for a typical Saudi AOI ($10\text{–}50\text{ km}^2$, $\sim 500 \times 500$ pixels) in $\le 5.0\text{ seconds}$ on cold cache, $\le 1.5\text{ seconds}$ on warm cache.
- **Windowed Reads:** Never download full 500MB Sentinel-2 granule files. Use `rasterio.windows.from_bounds` over HTTP Range Requests to read only the $200\text{–}600$ pixel AOI envelope.
- **Provider:** Element 84 Earth Search STAC API (`https://earth-search.aws.element84.com/v1`) querying the `sentinel-2-l2a` collection hosted on the Registry of Open Data on AWS (100% free, no API key required).

---

## 5. Verification Gate Baseline

The starting baseline on commit `fffe141` was verified prior to Phase 1 execution:

- **Git Commit:** `fffe141` (`main`)
- **Working Tree:** Clean (all prior changes committed)
- **Pytest:** 21 passed, 0 failed in 10.75s
- **Vitest:** 8 passed, 0 failed in 1.84s
- **TypeScript:** `tsc --noEmit` exited with code 0
- **ESLint:** `eslint src tests --max-warnings=0` exited with code 0
- **Next.js 16 Build:** All 17 routes compiled cleanly
