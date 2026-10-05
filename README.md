# TerraShift AI — Satellite Image Change & Environmental Disturbance Detection

> An end-to-end geospatial AI web platform that processes bi-temporal multispectral satellite imagery over user-selected coordinates, automatically neutralizing seasonal and atmospheric noise to segment and quantify real-world physical ground changes like urban expansion or land clearing.

[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16%20(App%20Router)-black.svg)](https://nextjs.org/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.14-EE4C2C.svg)](https://pytorch.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-Production-009688.svg)](https://fastapi.tiangolo.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

## 0. System Enhancement Brief

- **Summary:** TerraShift AI transitions from an illustrative prototype into a production-grade geospatial intelligence platform. It ingests authentic multi-date Sentinel-2 Level-2A surface reflectance tiles from AWS Open Data via Element84's zero-authentication STAC API, applies physical atmospheric/cloud gating via the Scene Classification Layer (SCL), constructs 5-channel radiometric index stacks (`[R, G, B, NDVI, NDBI]`), executes Siamese U-Net deep change segmentation in PyTorch, vectorizes change masks into georeferenced GeoJSON polygons with precise metric areas, and delivers an interactive GIS console featuring MapLibre GL, CartoDB Dark Matter tiles, and automated executive PDF audit reports.
- **Impact (3-Line Summary):**
  - **Zero Operating Costs:** Powered entirely by free, open, and keyless public geospatial sources (Element84 AWS Earth Search STAC, CartoDB Dark Matter, and OpenStreetMap Nominatim).
  - **Physics-Guided Noise Immunity:** Multi-spectral index stacks (NDVI, NDBI, NDWI) and SCL/QA60 filtering eliminate seasonal vegetation cycles and cloud-shadow false positives before model inference.
  - **Sub-Pixel Spatial Quantification:** Converts raster change detections into vector GeoJSON polygons with exact geodesic metric areas ($m^2$ and $km^2$) and downloadable executive PDF audit reports.
- **Key Technical Changes:**
  1. Built an asynchronous STAC acquisition client and windowed COG processing engine targeting Sentinel-2 Level-2A.
  2. Implemented a 5-channel Siamese U-Net architecture with multi-scale feature difference fusion, combined BCE + Soft Dice loss, and Shapely/Pyproj geodetic polygon vectorization.
- **Monitored Metric:** Sub-45s end-to-end acquisition, cloud validation, deep vision inference, and polygon vectorization for a $25\text{ km}^2$ bounding box.

---

## 1. 100% Free & Zero-Key Geospatial Sources

| Service | Source / Provider | Endpoint / Spec | Authentication |
|---|---|---|---|
| **Satellite Imagery** | Element84 AWS Earth Search STAC | `https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a` | **None** (Open Public Access) |
| **Raster Data** | AWS Open Data Sentinel-2 COGs | Direct HTTPS S3 COG URLs (`sentinel-cogs`) | **None** (HTTP Range GET) |
| **Basemap Tiles** | CartoDB Dark Matter | `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png` | **None** (Open Attribution) |
| **Global Geocoding** | OpenStreetMap Nominatim | `https://nominatim.openstreetmap.org/search` | **None** (Open Rate-Limited) |
| **GIS Engine** | MapLibre GL JS | Open source vector & raster web map | **None** |
| **Deep Learning** | PyTorch 2.x | Native Siamese U-Net neural network | Open Source |

---

## 2. Repository Layout

```
terrashift-ai/
├── apps/
│   └── web/                               # Next.js 16 App Router Frontend
│       ├── src/
│       │   ├── app/
│       │   │   ├── page.tsx               # Awwwards-grade storytelling landing page
│       │   │   ├── analyze/page.tsx       # Interactive GIS analysis studio
│       │   │   └── api/
│       │   │       ├── analyze/route.ts   # BFF proxy with rate-limiting & fallback
│       │   │       ├── geocode/route.ts   # OpenStreetMap Nominatim geocoding proxy
│       │   │       └── report/route.ts    # Streaming executive PDF audit report
│       │   ├── components/
│       │   │   ├── map/map-canvas.tsx     # MapLibre GL + CartoDB Dark Matter GIS canvas
│       │   │   ├── search/location-search.tsx # Global autocomplete geocoding
│       │   │   └── analyze/analyze-client.tsx # 3-Column change detection studio
│       │   └── tokens/                    # 8pt grid typed design tokens
│       └── tests/                         # Vitest unit test suite
├── services/
│   └── ml/                                # Python FastAPI ML Microservice
│       ├── terrashift/
│       │   ├── acquisition/               # STAC search, SCL cloud gating, compositing
│       │   ├── features/                  # Radiometric indices (NDVI, NDBI, NDWI, 5-ch stack)
│       │   ├── models/                    # PyTorch Siamese U-Net & physics-guided engine
│       │   ├── geo/                       # Shapely vectorization & metric area calculation
│       │   ├── report/                    # ReportLab executive PDF generator
│       │   └── api/                       # FastAPI routes & schemas
│       ├── tests/                         # Pytest test suite (100% passing)
│       └── requirements.txt
├── .gitignore
└── README.md
```

---

## 3. Quickstart & Local Setup

### Frontend (`apps/web`)

```bash
cd apps/web
npm install
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) for the storytelling landing page or [http://localhost:3000/analyze](http://localhost:3000/analyze) for the GIS analysis studio.

Quality gates:
```bash
npm run typecheck    # TypeScript strict check (0 errors)
npm test             # Vitest test suite
npm run build        # Production Next.js build
```

### ML Microservice (`services/ml`)

```bash
cd services/ml
python -m venv .venv
# On Windows:
.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
# Run the FastAPI server:
uvicorn terrashift.api.main:app --host 0.0.0.0 --port 8000 --reload
```

Run test suite:
```bash
pytest tests -v
```

---

## 4. Radiometric Physics Formulations

$$\text{NDVI} = \frac{\text{B08 (NIR)} - \text{B04 (Red)}}{\text{B08} + \text{B04} + 10^{-6}}$$

$$\text{NDBI} = \frac{\text{B11 (SWIR)} - \text{B08 (NIR)}}{\text{B11} + \text{B08} + 10^{-6}}$$

$$\text{NDWI} = \frac{\text{B03 (Green)} - \text{B08 (NIR)}}{\text{B03} + \text{B08} + 10^{-6}}$$

Input Tensor to Siamese U-Net:
$$\mathbf{X}_{T} = \left[ R, G, B, \text{NDVI}, \text{NDBI} \right] \in \mathbb{R}^{5 \times H \times W}$$
