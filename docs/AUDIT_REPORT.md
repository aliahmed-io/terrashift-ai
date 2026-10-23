# TerraShift AI — Baseline Architecture, Scientific Integrity & Feasibility Audit (Phase 0)

> **Document Version:** 1.0.0 (Phase 0 Baseline Freeze)  
> **Date:** October 2026  
> **Repository Branch:** `baseline-freeze` (branched from `main` @ `29822cb`)  
> **Evaluator:** Senior Machine Learning & Geospatial Software Engineering Review  
> **Scope:** Forensic code inspection, runtime execution verification, scientific validity analysis, and implementation roadmap.

---

## Executive Summary & System Enhancement Brief

**Summary:**  
A forensic codebase audit was conducted across the TerraShift Next.js 16/MapLibre frontend, FastAPI ML microservice, and geospatial data pipelines to establish the reproducible baseline ($M_0$) and verify all scientific claims prior to architectural changes. All existing test suites (21 pytest units, 8 vitest specs, TypeScript strict mode, ESLint `--max-warnings=0`, and Next.js 16 Turbopack production build) execute cleanly and pass without warnings. However, the deep inspection reveals severe scientific and structural discrepancies between documented claims and actual runtime code: the PyTorch checkpoint (`siamese_unet_checkpoint.pt`) is randomly initialized with zero training batches recorded in BatchNorm layers; the live pipeline substitutes RGB Excess-Green and Red-Green ratios for true Sentinel-2 NDVI/NDBI while labeling them as real spectral bands; benchmark metrics (F1 0.89–0.93, IoU 0.82–0.87) are statically hardcoded; the Next.js API layer falls back to synthetic mock polygons and fake confidence (0.964) whenever ML latency exceeds 3.5 seconds; and multi-class classification, BFAST time-series breakpoints, and spatial forecasting rely on heuristic thresholding and morphological dilation rather than validated statistical or deep learning models.

**Impact Statement:**  
- **Scientific Integrity:** Replaces fabricated metrics, synthetic mock fallbacks, and misleading band labels with verifiable, reproducible observations.  
- **Engineering Reliability:** Fixes service timeouts, test pathing dependencies, and establishes a genuine evaluation harness with held-out ground truth.  
- **Defense Readiness:** Guarantees that every metric, chart, and polygon defended during academic review is backed by documented, reproducible code and data.

**Key Technical Changes:**  
1. Freezes baseline $M_0$ on branch `baseline-freeze` and documents exact reproduction commands and weight tensor statistics across all components.  
2. Classifies all 7 UI pages and backend endpoints into verified capabilities, heuristic estimates, and unsupported claims requiring immediate correction.

**Performance / UX Metric to Monitor:**  
End-to-end reproducible evaluation pipeline coverage: transition from 0% genuine evaluated test pixels to 100% verified scorecard on public Sentinel-2 change benchmark (OSCD) with exact confusion counts.

---

## 1. Verified Architecture & End-to-End Data Flow

The TerraShift platform consists of a modern two-tier architecture designed for geospatial change detection and regional monitoring:

```
[ Browser Client: Daylight Cartographic UI ]
  │
  ├─ Framework: Next.js 16.3.8 (React 19.2.8, Turbopack, Tailwind CSS v4, Motion 14, Lenis)
  ├─ Map Engine: MapLibre GL 6.12.0 with custom WebWorker (`/maplibre/maplibre-gl-worker.mjs`)
  ├─ State: Global AOI & Corridor Context (`apps/web/src/lib/aoi-context.tsx`)
  └─ Routes (7 Active Pages):
       ├── `/`           (StitchCommandDeck - Corridor overview & diagnostic switcher)
       ├── `/analyze`    (AnalyzeClient - Live polygon drawing & streaming analysis)
       ├── `/benchmarks` (Model ablation study & PR curve visualization)
       ├── `/timeline`   (Multi-year trajectory ledger, BFAST breakpoint, 2030 forecast)
       ├── `/lab`        (Pair analysis sandbox, patch upload, confusion audit)
       ├── `/carbon`     (IPCC Tier-1 carbon flux & UHI thermal impact)
       ├── `/watchlist`  (Monitored regions with SQLite persistent storage)
       └── `/temp`       (Diagnostic raster inspection gallery)
  │
  ▼ HTTP Fetch / SSE Stream Proxy (Timeout: 3500ms - 4500ms)
[ Next.js BFF API Routes (`apps/web/src/app/api/`) ]
  │
  ├─ `/api/analyze`                     --> Proxies to `/v1/analyze/stream`
  ├─ `/api/ablation`                    --> Proxies to `/v1/ablation`
  ├─ `/api/timeseries`                  --> Proxies to `/v1/timeseries`
  ├─ `/api/carbon`                      --> Proxies to `/v1/carbon`
  ├─ `/api/lab`                         --> Proxies to `/v1/lab/analyze`
  ├─ `/api/telemetry`                   --> Proxies to `/v1/corridor/telemetry`
  ├─ `/api/watchlist`                   --> Proxies to `/v1/watchlist`
  └─ `/api/raster/[corridorId]/[effect]`--> Proxies to `/v1/render/{corridor_id}/{effect}`
  │
  ▼ REST API (Port 8000)
[ Python Geospatial Microservice (`services/ml/`) ]
  │
  ├─ Framework: FastAPI 1.1.0, Uvicorn 0.54, Pydantic v2, Python 3.12.5
  ├─ Inference Pipeline: `terrashift.pipeline.run_analysis`
  ├─ Model Architecture: `terrashift.models.siamese_unet.SiameseUNet` (2,102,145 params)
  ├─ Heuristic Detection: `terrashift.inference.rgb_change.detect_change`
  ├─ Raster Renderer: `terrashift.inference.renderer.render_diagnostic_raster`
  ├─ Diagnostic Scripts: `scripts/generate_real_eo_renders.py`, `scripts/prewarm_corridors.py`
  └─ Data Sources:
       ├── EOX Sentinel-2 Cloudless WMTS (XYZ tiles: `tiles.maps.eox.at`, 2017–2024) [Active Live Path]
       ├── Element84 AWS Earth Search STAC API (`earth-search.aws.element84.com/v1`) [Metadata Only]
       └── Google Maps Satellite Tiles (`mt{0-3}.google.com`) [Basemap High-Res Layer]
```

### Verified Live Inference Data Path (`/v1/analyze`)
1. **Request Intake:** Client submits GeoJSON polygon vertices $[lon, lat]$, $T_1$ year (2018), and $T_2$ year (2024) to `POST /v1/analyze/stream` or `POST /v1/analyze`.
2. **Window Planning:** `tiles.plan_grid(bbox)` calculates optimal Web-Mercator zoom level ($8 \le z \le 13$) and pixel bounding grid.
3. **Imagery Fetch:** `tiles.fetch_mosaic(year, grid)` downloads $256 \times 256$ JPEG tiles from EOX Sentinel-2 cloudless mosaic and composites them into an 8-bit RGB array.
4. **Radiometric Normalization:** `match_statistics()` matches per-channel median and Median Absolute Deviation (MAD) of $T_2$ to $T_1$ within the polygon mask to eliminate atmospheric and seasonal gain differences.
5. **Feature Proxy Extraction:** Computes Excess-Green index and Red/Green ratio from RGB channels.
6. **Euclidean Difference & Heuristic Probability:** Computes $L_2$ distance on RGB, uniform spatial filter ($3 \times 3$), and estimates a statistical baseline: $\tau_{stat} = \text{median} + 3.6 \times \text{MAD}$. Sigmoid scaling converts this to `physics_prob`.
7. **Neural Forward Pass:** The 5-channel stack $[R, G, B, \text{ExG}, \text{R/G}]$ is passed through `SiameseUNet`. The output logits are passed through sigmoid to produce `deep_prob`.
8. **Fixed Fusion:** Model outputs are blended via fixed weighting:
   $$\text{probability} = 0.60 \times \text{deep\_prob} + 0.40 \times \text{physics\_prob}$$
   *(If PyTorch is absent or fails, `probability = physics_prob`)*.
9. **Morphological Post-Processing:** Thresholding at $\tau$ (default 0.50) followed by $3 \times 3$ binary opening and closing.
10. **Vectorization & Area Calculation:** `geo.components.vectorize_changes()` extracts connected components, simplifies polygon geometry, projects to WGS84, and computes geodesic area using `pyproj.Geod` ellipsoidal calculations.

---

## 2. Forensic Findings: Implemented vs. Unsupported Claims

The audit reveals a clear dichotomy between solid geospatial engineering (tiling, MapLibre UI, geodesic math, REST APIs) and scientific fabrications designed to make the system look more advanced than it is.

### Scientific Integrity & Claim Matrix

| Feature / Claim | Documented Claim in Presentation / Readme | Actual Implementation in Code | Verification Status | Defect Severity |
| :--- | :--- | :--- | :--- | :--- |
| **Model Weights & Provenance** | "Trained on LEVIR-CD & OSCD Sentinel-2; F1=0.891, IoU=0.824" | Checkpoint `siamese_unet_checkpoint.pt` has zero trained batches (`num_batches_tracked = 0` across all 16 BatchNorm layers); weights are random initializations; metrics dict was manually embedded. | **UNSUPPORTED / FABRICATED** | Critical |
| **Training Pipeline** | Supervised deep learning with Combined BCE + Soft Dice Loss | No `DataLoader`, no `Dataset`, and zero training scripts exist in the repository. | **MISSING** | High |
| **Spectral Bands (NDVI/NDBI)** | "Sentinel-2 Multi-Spectral Bands B04, B08, B11, SCL" | Live pipeline reads 8-bit RGB tiles from EOX; computes RGB Excess-Green and Red/Green ratio; labels them as B04, B08, B11 in metadata. True multispectral functions in `features/indices.py` are disconnected from live inference. | **MISLEADING PROXY** | High |
| **Model-Heuristic Fusion** | "Optimal 60/40 deep learning + physics-guided fusion" | Hardcoded linear formula `0.60 * deep_prob + 0.40 * physics_prob` in `rgb_change.py` without empirical calibration or ablation justification. | **UNJUSTIFIED HEURISTIC** | Medium |
| **Next.js BFF Fallback** | Robust proxying to ML backend microservice | When ML service takes $> 3.5\text{s}$, `api/analyze/route.ts` generates synthetic rectangular GeoJSON polygons with hardcoded confidence `0.964` and fake scene IDs. | **MISLEADING MOCK** | Critical |
| **Corridor Telemetry** | "Live 10-band spectral reflectance curves for 2018 vs 2024" | In `main.py` lines 578–589, 10 spectral bands are created by taking mean RGB and multiplying by arbitrary multipliers (`mean_r * 1.15`, `mean_g * 1.45`). | **FABRICATED METRIC** | Critical |
| **Explainable AI (XAI)** | "Grad-CAM++ and Integrated Gradients multi-stage XAI" | Computes absolute difference between intermediate encoder activation tensors (`torch.abs(e1_1 - e1_2)`); no gradients or attribution theory used. | **MISLABELED DIAGNOSTIC** | Medium |
| **BFAST Breakpoint Analysis** | "BFASTmonitor harmonic decomposition & structural break detection" | Samples only 5 annual static composites; forces monotonic progression (`prev * 1.08`); fabricates p-value (`significance_p = 0.012`) and confidence (`0.95`). | **UNSUPPORTED CLAIM** | High |
| **2030 Spatial Forecast** | "Spatio-temporal regression & cellular automata frontier prediction" | Simple linear regression on 5 annual numbers combined with morphological dilation (3 and 6 iterations) of the current change mask. | **UNSUPPORTED HEURISTIC** | High |
| **Ground-Truth Validation in Lab** | "Ground-truth audit with F1=0.934, IoU=0.876, TP/FP/FN confusion" | "Ground-truth" mask is generated by running `detect_change()` on the same input image; model is evaluated against its own predictions. | **CIRCULAR EVALUATION** | Critical |
| **PlanetScope 3m Integration** | "Acquisition: Sentinel-2 L2A (10m) + PlanetScope SuperDove (3m) 8-Band" | PlanetScope is a paid proprietary API; zero Planet API integrations exist in codebase; all imagery is EOX Sentinel-2. | **FALSE SENSOR CLAIM** | High |
| **Carbon & UHI Analysis** | "WRI Carbon-Budget & Land Surface Temperature anomaly" | Carbon uses static IPCC Tier-1 tabular multipliers; LST delta is derived from RGB index deltas multiplied by arbitrary scalars (`ndbi * 4.2 - ndvi * 3.6`), not thermal satellite bands. | **MODELED ESTIMATE (LST PROXY)** | Medium |
| **Zero-Paid-Key Architecture** | Public demo operational without paid credentials | Verified: EOX WMTS, Element84 STAC, and Nominatim OSM operate without keys. | **VERIFIED WORKING** | None |
| **Geodesic Geometry** | Exact surface area calculation on WGS84 ellipsoid | `pyproj.Geod(ellps="WGS84")` in Python and spherical approximation in TypeScript properly calculate square meters and hectares. | **VERIFIED WORKING** | None |

---

## 3. Baseline Execution Verification & Status

### Environment & Tool Versions
- **Operating System:** Windows 11 Pro (win32)
- **Node.js Environment:** Next.js 16.3.8, React 19.2.8, Turbopack, npm
- **Python Environment:** Python 3.12.5 in `services/ml/.venv`, PyTorch 2.5.1+cpu, NumPy 2.1.2, SciPy 1.14.1, Pillow 11.0.0, FastAPI 0.115.4, httpx 0.27.2, pytest 9.1.1
- **Hardware:** Local CPU / CUDA capable host

### Command-by-Command Verification Log

#### 1. Python ML Test Suite
- **Command:** `& ".\services\ml\.venv\Scripts\python.exe" -m pytest` (executed from `services/ml`)
- **Outcome:** **PASSED (21 passed, 1 warning in 21.72s)**
  - `tests/test_pipeline.py`: 16 passed
  - `tests/test_renderer.py`: 5 passed
  - *Note on baseline blocker:* Running pytest from the repository root failed with `ModuleNotFoundError: No module named 'terrashift'` because `pytest.ini` resides in `services/ml`. Running with `Cwd = services/ml` resolves cleanly.

#### 2. Frontend Vitest Suite
- **Command:** `npm --prefix apps/web run test`
- **Outcome:** **PASSED (2 test files, 8 tests passed in 3.59s)**
  - `tests/tiles.test.ts`: 5 passed
  - `tests/aoi.test.ts`: 3 passed

#### 3. Frontend TypeScript Typecheck
- **Command:** `npm --prefix apps/web run typecheck` (`tsc --noEmit`)
- **Outcome:** **PASSED (Exit code 0, 0 type errors)**

#### 4. Frontend ESLint Lint Suite
- **Command:** `npm --prefix apps/web run lint` (`eslint src tests --max-warnings=0`)
- **Outcome:** **PASSED (Exit code 0, 0 warnings across all files)**

#### 5. Next.js Production Build
- **Command:** `npm --prefix apps/web run build` (`next build` with Turbopack)
- **Outcome:** **PASSED (Exit code 0 in 8.2s)**
  - Compiled successfully; generated 17 static routes and 8 dynamic API routes.

---

## 4. Deep Inspection of Baseline Model ($M_0$)

### Architecture Specifications
- **Class:** `terrashift.models.siamese_unet.SiameseUNet`
- **Input Channels:** 5 channels for $T_1$ and 5 channels for $T_2$
- **Base Channels:** 32 (Encoder stages: 32 -> 64 -> 128 -> 256)
- **Parameters:** 2,102,145 trainable weights
- **Skip Connections:** Multi-scale feature difference ($|f_1 - f_2|$) concatenated with feature sum ($f_1 + f_2$) through $1 \times 1$ convolution.
- **Head:** $1 \times 1$ convolution mapping 32 channels to 1 logit map.

### Weight Tensor Forensics
Inspection of `services/ml/terrashift/models/siamese_unet_checkpoint.pt`:
```python
# Inspected via PyTorch CPU loader:
enc1.net.0.weight: shape [32, 5, 3, 3], mean:  0.0015, std: 0.0854 (Kaiming normal)
enc1.net.1.running_mean: shape [32], mean: 0.0, std: 0.0
enc1.net.1.running_var:  shape [32], mean: 1.0, std: 0.0
enc1.net.1.num_batches_tracked: 0.0
# Set of num_batches_tracked across all 16 BatchNorm layers: {0}
```
**Conclusion:** $M_0$ has never been trained on any dataset. Its weights are identical to random initialization. Because the live inference code blends this random output with the physics-guided statistical baseline (`0.60 * deep_prob + 0.40 * physics_prob`), the change masks displayed in the application are currently driven almost entirely by the heuristic statistical difference in `rgb_change.py` and edge filters, rather than deep learned representations.

---

## 5. Prioritized Defect List

### P0 — Critical Scientific & Integrity Defects (Must Fix for A+ Readiness)
1. **Remove Fabricated Fallbacks in BFF Proxy (`api/analyze/route.ts`):**  
   Replace synthetic rectangle generator with an honest error state (`IMAGERY_FETCH_TIMEOUT` or `BACKEND_UNAVAILABLE`) when the ML microservice does not reply. Never return fake polygons or unearned confidence (0.964).
2. **Eliminate Hardcoded Benchmark Metrics Across UI:**  
   Remove static strings claiming F1 0.914, IoU 0.842, and Precision 0.938 across `corridors.ts`, `ksaMissionData.ts`, and `benchmarks/page.tsx` until verified against a real benchmark.
3. **Disclose Model Provenance Honestly:**  
   Clearly identify $M_0$ as an untrained Siamese U-Net operating in tandem with a statistical spectral baseline. Do not claim LEVIR-CD training until an actual training run is executed and measured.
4. **Remove Circular Evaluation in `/lab`:**  
   Do not evaluate images against masks generated by the model's own heuristic detection. Label sample pairs as illustrative demonstrations or evaluate against public benchmark ground truth (OSCD).

### P1 — High-Priority Scientific & Geospatial Defects
5. **Accurately Label Spectral Proxies vs. True Multispectral Bands:**  
   Label RGB Excess-Green and Red-Green ratios accurately as RGB-derived proxies. When true Sentinel-2 L2A surface reflectance (B04, B08, B11) is available from STAC/COG, route them through `features/indices.py` for true NDVI and NDBI.
6. **Qualify Time-Series and Forecast Claims:**  
   Rename "BFAST Structural Breakpoint Detection" to "Annual Bitemporal Velocity Analysis" and remove fabricated p-values (`p = 0.012`). Explicitly label 2026–2030 projections as exploratory morphological scenarios rather than validated forecasts.
7. **Transparent Carbon & UHI Modeling Assumptions:**  
   Document that carbon flux is an IPCC Tier-1 modeled estimate with documented uncertainty bands. Document that Land Surface Temperature ($\Delta\text{LST}$) is an empirical proxy derived from vegetation and bareness deltas rather than direct thermal satellite radiometry.
8. **Remove Unsupported Sensor Claims:**  
   Remove references to "PlanetScope SuperDove (3m) 8-Band Constellation" in `ksaMissionData.ts`. Acknowledge that the imagery is 100% public Sentinel-2.

### P2 — Engineering & Robustness Enhancements
9. **Pytest Path Configuration at Root:**  
   Add root-level pytest configuration or documentation so tests run seamlessly from repository root.
10. **Internal Token Enforcement:**  
    Enforce `INTERNAL_TOKEN` validation on sensitive endpoints or remove dead code in `config.py`.
11. **Timeout Optimization:**  
    Tune Next.js BFF timeout from 3500ms to an appropriate budget (or stream directly) so real tile mosaics don't trigger unnecessary timeouts.

---

## 6. Risks to Scientific Validity & Security

1. **Examiner Audit Risk (Academic Defense):**  
   If an academic examiner inspects `siamese_unet_checkpoint.pt` or `apps/web/src/app/api/analyze/route.ts`, the discovery of hardcoded metrics, zero-batch BatchNorm layers, and synthetic fallback polygons would immediately undermine project credibility.
2. **Data Leakage Risk:**  
   If benchmarks are evaluated without strict spatial or patch-level separation between training and test sets, reported metrics will be scientifically invalid.
3. **Security & Keyless Integrity:**  
   The project is currently secure against credential leaks (zero live secrets in git), but open CORS (`*`) and unauthenticated internal endpoints must maintain defensive rate limiting.

---

## 7. Realistic Scope & Phased Implementation Recommendation

Given the 2–4 week timeframe, attempting to train multiple massive architectures, calibrate five-class semantic models, and conduct multi-city ground truth surveys would risk shipping an unfinished, broken system. 

### Recommended Tactical Plan:

```
[Phase 1: Days 2-5]   Integrity Sweep & Honest Fallbacks
                      └── Remove synthetic mock fallbacks, eliminate fake metrics, correct labels.
[Phase 2: Days 4-8]   Spectral Pipeline & Input Honesty
                      └── Clearly distinguish RGB baseline from true Sentinel-2 L2A spectral bands.
[Phase 3: Days 7-12]  Reproducible Benchmark Harness
                      └── Integrate OSCD public Sentinel-2 benchmark; establish true held-out scorecard.
[Phase 4: Days 10-16] Controlled ML Improvement (M0 vs M1)
                      └── Train Siamese U-Net on real benchmark; measure actual F1/IoU vs baseline.
[Phase 5: Days 14-19] Validate Analytical Claims
                      └── Transparent carbon/UHI disclosures; qualify time-series claims.
[Phase 6: Days 19-28] Regression, System Hardening & Defense Preparation
                      └── Full end-to-end regression across all 7 routes; defense-ready documentation.
```

By prioritizing truth, measurement, and scientific defensibility over unsupported feature claims, TerraShift will present an impeccably engineered senior project that easily withstands rigorous technical examination.
