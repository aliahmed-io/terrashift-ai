# TerraShift AI — Satellite Image Change & Environmental Disturbance Detection Platform

> An end-to-end geospatial AI web platform that processes bi-temporal and multi-year multispectral satellite imagery over user-selected coordinates, neutralizing seasonal and atmospheric noise via a 5-channel Weight-Sharing Siamese U-Net to segment, benchmark, forecast, and value real-world physical ground changes.

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black.svg)](https://nextjs.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.14-EE4C2C.svg)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Production-009688.svg)](https://fastapi.tiangolo.com/)
[![STAC](https://img.shields.io/badge/STAC-1.0.0-10B981.svg)](https://stacspec.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 0. System Enhancement Brief

- **Summary:** TerraShift AI is a 7-page geospatial intelligence and scientific validation platform. It ingests multi-date Sentinel-2 Level-2A surface reflectance tiles, constructs 5-channel radiometric index stacks (`[R, G, B, NDVI, NDBI]`), executes a PyTorch Weight-Sharing Siamese U-Net (`FC-Siam-diff`) with multi-scale $|f_k(T_1) - f_k(T_2)|$ feature fusion, vectorizes change masks into georeferenced GeoJSON polygons, and provides specialized research studios for 4-way model ablation & XAI attribution (`/benchmarks`), BFAST 5-epoch structural breakpoint detection & 2030 forecasting (`/timeline`), custom image-pair & LEVIR-CD ground-truth confusion matrices (`/lab`), IPCC Tier-1 4-pool carbon flux & Urban Heat Island ($\Delta\text{LST}$) valuation (`/carbon`), and an RFC 7946 STAC 1.0.0 Global & Saudi Vision 2030 Case-Study Atlas (`/watchlist`).
- **Impact (3-Line Summary):**
  - **Scientific Rigor & Explainability:** Side-by-side 4-model ablation (`L1-RGB`, `Spectral-Otsu`, `FC-EF 10-ch`, and `FC-Siam-diff`) with 4-stage encoder difference heatmaps and pixel-level ground-truth confusion matrices.
  - **Temporal & Climate Actionability:** Extends bi-temporal detection into 5-epoch BFAST structural breakpoint monitoring (`2017–2024`), `2026–2030` spatial expansion risk forecasting, and IPCC 4-pool $\text{tCO}_2\text{e}$ + $\Delta\text{LST}\,(^\circ\text{C})$ microclimate valuation.
  - **Interoperable Operations & Localization:** Full English/Arabic (`EN` / `عربي` RTL) support in the Map Studio and 12 exportable RFC 7946 STAC 1.0.0 items covering Saudi Vision 2030 giga-projects (NEOM The Line, Oxagon, Red Sea Global, Green Riyadh) and global deforestation/hydrology frontiers.
- **Key Technical Changes:**
  1. Built 5 FastAPI deep-learning & geospatial engines (`pipeline.py`, `ablation.py`, `timeseries.py`, `pair_lab.py`, `carbon.py`) served via `/v1/analyze/stream`, `/v1/ablation`, `/v1/timeseries`, `/v1/lab/analyze`, and `/v1/carbon`.
  2. Architected a 7-route Next.js 16 App Router frontend (`/`, `/analyze`, `/benchmarks`, `/timeline`, `/lab`, `/carbon`, `/watchlist`) with synchronized dual-MapLibre GL viewports, URL query deep-linking, and zero-warning strict TypeScript types.
- **Monitored Metric:** Sub-1.5s p95 server inference latency across ablation, BFAST 5-epoch analysis, and IPCC carbon flux rasters with `0` TypeScript/ESLint errors across all 14 compiled routes.

---

## 1. Platform Architecture & 7 Interactive Routes

| Route | Module Name | Core Capabilities | Open-Source GitHub References |
|---|---|---|---|
| `/` | **Editorial Landing Experience** | Scroll-driven 3D globe & bi-temporal storytelling | [`MapLibre GL JS`](https://github.com/maplibre/maplibre-gl-js) |
| `/analyze` | **Bi-Temporal GIS Map Studio** | Synchronized dual MapLibre GL canvas, SSE streaming inference, GeoJSON vectorization, PDF report export, `EN`/`عربي` RTL toggle | [`Element84 Earth Search`](https://stacindex.org/catalogs/earth-search) |
| `/benchmarks` | **Model Ablation & XAI Attribution Lab** | 4-way model benchmark (`L1-RGB`, `Spectral-Otsu`, `FC-EF`, `FC-Siam-diff`) + 4-stage encoder $|f_1 - f_2|$ XAI heatmaps | [`rcdaudt/fully_convolutional_change_detection`](https://github.com/rcdaudt/fully_convolutional_change_detection), [`likyoo/open-cd`](https://github.com/likyoo/open-cd) |
| `/timeline` | **Multi-Year BFAST & 2030 Forecast Studio** | 5-epoch (`2017–2024`) trajectory, OLS MOSUM structural breakpoint detection, and `2026–2030` expansion risk projection | [`diku-dk/bfast`](https://github.com/diku-dk/bfast) |
| `/lab` | **Custom Image-Pair & LEVIR-CD Sandbox** | Drag-and-drop custom Before/After images (drone/satellite) or LEVIR-CD/OSCD patches with TP/FP/FN confusion matrices | [`justchenhao/BIT_CD`](https://github.com/justchenhao/BIT_CD), [`microsoft/torchgeo`](https://github.com/microsoft/torchgeo) |
| `/carbon` | **IPCC Carbon Flux & Urban Heat Calculator** | 4-pool carbon decomposition (`AGC`, `BGC`, `Deadwood`, `SOC`), `biomass_soil` vs `biomass_only` mode, $\Delta\text{LST}\,(^\circ\text{C})$ thermal map, VCM credit valuation | [`wri/carbon-budget`](https://github.com/wri/carbon-budget), [`wri/gfw_forest_loss_geotrellis`](https://github.com/wri/gfw_forest_loss_geotrellis), [`sentinel-hub/custom-scripts`](https://github.com/sentinel-hub/custom-scripts) |
| `/watchlist` | **STAC 1.0.0 Case-Study Atlas & Watchlist** | 12 Saudi Vision 2030 & global STAC 1.0.0 items, live RFC 7946 `.stac.json` inspector/exporter, 5-day revisit alert rules, 1-click studio launch | [`radiantearth/stac-browser`](https://github.com/radiantearth/stac-browser), [`radiantearth/stac-spec`](https://github.com/radiantearth/stac-spec) |

---

## 2. Repository Layout

```
terrashift-ai/
├── .github/workflows/ci.yml               # GitHub Actions CI (Typecheck, Vitest, Next Build, Pytest)
├── apps/
│   └── web/                               # Next.js 16 App Router Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx               # Editorial landing page
│       │   │   ├── analyze/page.tsx       # Interactive bi-temporal GIS studio
│       │   │   ├── benchmarks/page.tsx    # 4-way model ablation & XAI stage viewer
│       │   │   ├── timeline/page.tsx      # 2017-2024 BFAST breakpoint & 2030 forecast studio
│       │   │   ├── lab/page.tsx           # Custom image-pair & LEVIR-CD confusion matrix lab
│       │   │   ├── carbon/page.tsx        # IPCC Tier-1 carbon flux & Urban Heat Island calculator
│       │   │   ├── watchlist/page.tsx     # STAC 1.0.0 Vision 2030 & Global Case-Study Atlas
│       │   │   └── api/                   # Server-side BFF proxies (/analyze, /ablation, /timeseries, /lab, /carbon, /report, /geocode, /model/weights)
│       │   ├── components/
│       │   │   ├── studio-nav.tsx         # Unified cross-studio navigation header
│       │   │   ├── map/map-canvas.tsx     # Dual synchronized MapLibre GL + Sentinel-2/Mapbox canvas
│       │   │   ├── search/location-search.tsx # Global autocomplete geocoding
│       │   │   └── analyze/analyze-client.tsx # Change detection studio client
│       │   └── tokens/                    # 8pt grid typed design tokens
│       └── tests/                         # Vitest unit test suite
├── services/
│   └── ml/                                # Python FastAPI & PyTorch Microservice
│       ├── terrashift/
│       │   ├── acquisition/               # Sentinel-2 tile mosaic & cloud masking
│       │   ├── features/                  # Radiometric indices (NDVI, NDBI, NDWI, 5-ch stack)
│       │   ├── inference/                 # PyTorch Siamese U-Net, ablation, BFAST timeseries, pair_lab, IPCC carbon flux
│       │   ├── models/                    # Trained PyTorch Siamese U-Net weights (.pt) & architecture
│       │   ├── report/                    # ReportLab executive PDF generator
│       │   └── api/                       # FastAPI routes & Pydantic schemas
│       ├── tests/                         # Pytest test suite (14/14 passing)
│       └── requirements.txt
└── README.md
```

---

## 3. Quickstart & Quality Gates

### 1. Start the FastAPI / PyTorch ML Microservice (`port 8000`)

```bash
cd services/ml
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\activate
# Linux / macOS:
source .venv/bin/activate

pip install -r requirements.txt
uvicorn terrashift.api.main:app --host 127.0.0.1 --port 8000 --reload
```

### 2. Start the Next.js 16 Web Studio (`port 3000`)

```bash
cd apps/web
npm install
npm run dev
```

### 3. Run Full Verification Gate

```bash
# Frontend checks (in apps/web):
npm run typecheck    # Strict TypeScript check (0 errors)
npm test             # Vitest unit test suite (5 passed)
npm run build        # Production Next.js 16 build (14/14 routes)

# Backend checks (in repository root):
PYTHONPATH=services/ml pytest services/ml/tests -v   # 14 passed
```

---

## 4. Release Checklist & Operational Baseline (v1.2.0)

- **Changelog (v1.2.0):**
  - Added `/benchmarks` (4-model ablation + 4-stage Siamese encoder XAI heatmaps).
  - Added `/timeline` (5-epoch 2017–2024 Sentinel-2 BFAST breakpoint detector + 2026–2030 spatial risk forecast).
  - Added `/lab` (custom drag-and-drop image pair & LEVIR-CD/OSCD ground-truth confusion matrix evaluator).
  - Added `/carbon` (IPCC Tier-1 4-pool `biomass_soil` / `biomass_only` carbon flux & $\Delta\text{LST}$ Urban Heat Island calculator).
  - Added `/watchlist` (12 Saudi Vision 2030 & global STAC 1.0.0 items with `.stac.json` export and deep-linking into `/analyze`).
- **Migration Notes:** No breaking schema changes to existing `/v1/analyze` or `/v1/report` endpoints; new endpoints (`/v1/ablation`, `/v1/timeseries`, `/v1/lab/analyze`, `/v1/carbon`) are additive and stateless.
- **Performance Baseline:**
  - Next.js 16 production build: 14 routes pre-rendered/compiled in `< 15s`.
  - FastAPI `/healthz`: `< 10ms`; `/v1/lab/analyze`: `< 250ms`; `/v1/ablation` & `/v1/carbon`: `< 1.5s`.
- **Canary & Rollback Plan:** Stateless container/process architecture allows instant rollback to commit `5f0a485` via `git revert d7c9b12` if upstream tile latency spikes; server-side deterministic synthetic fallback ensures 100% availability even if external tile providers are unreachable.
