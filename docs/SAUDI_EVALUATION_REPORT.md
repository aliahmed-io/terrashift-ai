# TerraShift AI — Saudi Reference Benchmark Evaluation Report (v6.1 Verified GEE + STAC)

**Author**: Omar Ayyash (Student ID: `S22107722`) · **Supervisor**: Dr. Passent  
**Evaluation Timestamp**: 2026-10-25T01:41:09Z  
**Benchmark Version**: Pilot v6.1 (Authenticated Google Earth Engine `project='terrashift'` + AWS Earth Search STAC, Localization-Aware 1-to-1 Matching, Pooled & Macro Metrics)  
**Total Evaluated AOI**: $91.19\text{ km}^2$ across 4 distinct Saudi corridors (Riyadh, Jeddah, Al-Jouf, and Held-Out Al-Kharj)  
**Evaluation Script**: [`scripts/saudi_evaluation.py`](file:///d:/terrashift-ai/scripts/saudi_evaluation.py)  
**Machine-Readable Scorecard**: [`reports/saudi_pilot_evaluation.json`](file:///d:/terrashift-ai/reports/saudi_pilot_evaluation.json)  
**101-Page Senior Thesis PDF**: [`reports/senior_project/TerraShift_Senior_Project_Report.pdf`](file:///d:/terrashift-ai/reports/senior_project/TerraShift_Senior_Project_Report.pdf)  

---

## System Enhancement Brief

> **1-Paragraph Summary**: We conducted an end-to-end empirical benchmark of TerraShift AI across four distinct Saudi Arabian geographic environments totaling $91.19\text{ km}^2$ using authentic Copernicus Sentinel-2 Level-2A Bottom-of-Atmosphere (BOA) reflectance streamed from AWS Open Data Earth Search and authenticated Google AlphaEarth Foundations V1 64-D embeddings (`GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`) alongside Google Dynamic World V1 (`GOOGLE/DYNAMICWORLD/V1`) from Google Earth Engine (`project='terrashift'`). Synthetic benchmark fallbacks are strictly prohibited (`allow_synthetic=False`), every vectorized polygon is geometrically clipped to the exact WGS84 AOI bounding box before ellipsoidal geodesic area integration, and predictions are evaluated under a Localization-Aware Greedy 1-to-1 Bipartite Matching Protocol ($\text{PoC} \ge 0.15, \text{IoU} \ge 0.05$) audited across 4 localization sensitivity regimes with separate Pooled (micro) and Corridor Macro-Averaged metrics. **TerraShift v6.0 Hybrid (Siamese + AlphaEarth 64-D + L2A Spectral Guards)** achieves Rank #1 with **79.2% Pooled Event F1** (**82.5% Macro F1**), **65.5% Pooled Strict Precision** (**70.1% Macro Precision**), **100.0% Recall** (19/19 events), a **91.2% reduction in false alarms** (from 114 down to 10), and **0 Negative Control Zone hits**, while **TerraShift v5.1 (Tuned Siamese + L2A Spectral Guards, Zero GEE Dependency)** achieves Rank #2 with **53.5% Pooled Event F1** (**64.1% Macro F1**), **100.0% Recall**, and a **71.1% false-alarm reduction** (114 down to 33).
>
> **3-Line Impact**:
> - Proves why standalone global satellite AI tools fail in hyper-arid Saudi deserts: standalone Google AlphaEarth V1 (`alphaearth_cosine`) achieves only **27.0% Pooled F1** (**31.4% Macro F1**) with **90 false alarms** and **23 false alarms inside undisturbed desert Negative Control Zones**, while standalone Google Dynamic World V1 (`dynamic_world_lulc`) achieves only **19.7% Pooled F1** (**31.6% Recall**).
> - Establishes a dual-mode operational architecture: **TerraShift v6.0 Hybrid** (`79.2% Pooled F1 / 82.5% Macro F1`) for annual strategic compliance auditing, and **TerraShift v5.1** (`53.5% Pooled F1 / 64.1% Macro F1`) for 5-day tactical Sentinel-2 L2A monitoring without GEE dependency.
> -Enforces complete methodological transparency: zero synthetic benchmark data, exact WGS84 geometric clipping, Localization-Aware 1-to-1 matching (`PoC`/`IoU`) across 4 sensitivity regimes, separate Pooled and Macro reporting, and explicit disclosure that the 19 reference events are coarse parcel-level bounding boxes curated from multi-date Sentinel-2 inspection and known landmarks.
>
> **2 Technical Changes**:
> - Authenticated `earthengine-api` (`project='terrashift'`), enforced `allow_synthetic=False` in [`earth_engine.py`](file:///d:/terrashift-ai/services/ml/terrashift/acquisition/earth_engine.py), removed synthetic classifier calibration in [`alphaearth_change.py`](file:///d:/terrashift-ai/services/ml/terrashift/inference/alphaearth_change.py), and implemented exact WGS84 AOI clipping (`geo_poly.intersection(shapely.box(*aoi_bbox))`) in [`components.py`](file:///d:/terrashift-ai/services/ml/terrashift/geo/components.py).
> - Upgraded [`saudi_evaluation.py`](file:///d:/terrashift-ai/scripts/saudi_evaluation.py) with Localization-Aware 1-to-1 matching ($\text{PoC} \ge 0.15 \land \text{IoU} \ge 0.05$, or $\text{PoC} \ge 0.30$), a 4-regime Localization Sensitivity Sweep (`relaxed`, `standard`, `moderate`, `strict`), and side-by-side Pooled and Macro scorecards.
>
> **1 Measurable Performance Metric to Monitor**:
> Pooled False Alert Density ($\text{FA}_{100, \text{pooled}}$): Reduced from $125.0\text{ alerts}/100\text{ km}^2$ (Untuned RGB) to **$36.2\text{ alerts}/100\text{ km}^2$** (TerraShift v5.1) and **$11.0\text{ alerts}/100\text{ km}^2$** (TerraShift v6.0 Hybrid) with $0$ Negative Control Zone violations.

---

## 1. Multi-Model Saudi Benchmark Leaderboard (v6.1 — Pooled & Macro Metrics)

Evaluated across 4 Saudi corridors ($91.19\text{ km}^2$ total AOI, 19 positive reference parcels, 4 negative control zones):

| Rank | Model ID | Model Architecture | Pooled Event F1 | Macro Event F1 | Pooled Strict Prec | Macro Strict Prec | Pooled Validity Prec | Recall (Events) | Total Alerts | False Alarms ($\text{FP}_{\text{dup}}+\text{FP}_{\text{bg}}$) | Pooled FA / $100\text{ km}^2$ | Neg Control Hits | Held-Out Al-Kharj Prec / Rec | CPU Compute |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **#1** | `alphaearth_hybrid` | **TerraShift v6.0 Hybrid (Siamese + AlphaEarth 64-D + L2A Guards)** | **79.2%** | **82.5%** | **65.5%** | **70.1%** | **76.0%** | **100.0%** (19/19) | 29 | **10** (4 dup, 6 bg) | **11.0** | **0** | **62.5% / 100.0%** | 1.485s |
| **#2** | `siamese_tuned_filtered` | **TerraShift v5.1 (Tuned Siamese + L2A Guards, 5-Day Tactical)** | **53.5%** | **64.1%** | **36.5%** | **47.2%** | **45.2%** | **100.0%** (19/19) | 52 | **33** (9 dup, 24 bg) | **36.2** | **0** | **31.2% / 100.0%** | 1.450s |
| **#3** | `alphaearth_cosine` | Google AlphaEarth V1 64-D Cosine ($\tau=0.12$, Model A) | 27.0% | 31.4% | 15.9% | 19.1% | 19.5% | 89.5% (17/19) | 107 | 90 (20 dup, 70 bg) | 98.7 | **23** | 11.5% / 60.0% | 0.498s |
| **#4** | `multispectral_physical` | Pure Sentinel-2 L2A Physical Baseline ($\Delta\text{NDBI}/\Delta\text{NDVI}$) | 26.5% | 26.7% | 15.4% | 15.5% | 18.2% | 94.7% (18/19) | 117 | 99 (18 dup, 81 bg) | 108.6 | 0 | 17.4% / 80.0% | 0.556s |
| **#5** | `siamese_untuned` | Untuned Siamese U-Net Baseline (RGB) | 23.8% | 25.3% | 13.6% | 14.6% | 15.8% | 94.7% (18/19) | 132 | 114 (18 dup, 96 bg) | 125.0 | 5 | 9.5% / 80.0% | 0.518s |
| **#6** | `dynamic_world_lulc` | Google Dynamic World V1 LULC Transition | 19.7% | 27.9% | 14.3% | 33.5% | 15.8% | 31.6% (6/19) | 42 | 36 (4 dup, 32 bg) | 39.5 | 6 | 100.0% / 20.0% | 0.497s |
| **#7** | `alphaearth_dynamic_world` | AlphaEarth + Dynamic World Transition (Model B) | 16.3% | 25.9% | 13.3% | 33.6% | 14.3% | 21.1% (4/19) | 30 | 26 (2 dup, 24 bg) | 28.5 | 4 | 100.0% / 20.0% | 0.464s |

---

## 2. Per-Corridor Breakdown (TerraShift v6.0 Hybrid vs. v5.1 vs. Standalone AlphaEarth V1)

| Corridor | Area ($\text{km}^2$) | Reference Parcels | TerraShift v6.0 Hybrid (Prec / Rec / F1 / FAs / Neg) | TerraShift v5.1 L2A (Prec / Rec / F1 / FAs / Neg) | Standalone AlphaEarth V1 (Prec / Rec / F1 / FAs / Neg) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1. Riyadh ROSHN Sedra** | $17.88\text{ km}^2$ | 5 Built + 1 Neg Plateau | **71.4% / 100% / 83.3%** (2 FAs, **0 Neg**) | **50.0% / 100% / 66.7%** (5 FAs, **0 Neg**) | 29.4% / 100% / 45.5% (12 FAs, **3 Neg**) |
| **2. Jeddah North Obhur** | $18.31\text{ km}^2$ | 4 Coastal + 1 Neg Sabkha | **100.0% / 100% / 100.0%** (**0 FAs**, **0 Neg**) | **80.0% / 100% / 88.9%** (1 FA, **0 Neg**) | 18.2% / 100% / 30.8% (18 FAs, **9 Neg**) |
| **3. Al-Jouf Sirhan Basin** | $26.82\text{ km}^2$ | 5 Pivots + 1 Neg Dunes | **62.5% / 100% / 76.9%** (3 FAs, **0 Neg**) | **27.8% / 100% / 43.5%** (13 FAs, **0 Neg**) | 11.9% / 100% / 21.3% (37 FAs, **1 Neg**) |
| **4. Al-Kharj (Held-Out)** | $28.18\text{ km}^2$ | 5 Mixed + 1 Neg Desert | **62.5% / 100% / 76.9%** (3 FAs, **0 Neg**) | **31.2% / 100% / 47.6%** (11 FAs, **0 Neg**) | 11.5% / 60% / 19.4% (23 FAs, **10 Neg**) |

---

## 3. Localization Purity Threshold Sensitivity Sweep (4 Regimes)

Rather than assuming a fixed area-cap rule (such as rejecting polygons $>10\%$ of the AOI), we require both physical coverage ($\text{Area}(P \cap G) \ge 3,500\text{ m}^2$ or $\text{RoC} \ge 0.08$) and localization purity ($\text{PoC} = \frac{\text{Area}(P \cap G)}{\text{Area}(P)}$ and $\text{IoU}$), and evaluate all 7 models across 4 localization regimes:

| Model Architecture | Relaxed ($\text{PoC}\ge 0.02$) | Standard ($\text{PoC}\ge 0.15, \text{IoU}\ge 0.05$) | Moderate ($\text{PoC}\ge 0.20, \text{IoU}\ge 0.10$) | Strict ($\text{PoC}\ge 0.30, \text{IoU}\ge 0.15$) |
| :--- | :--- | :--- | :--- | :--- |
| **#1 TerraShift v6.0 Hybrid** | **82.6% Pooled / 85.4% Macro** | **79.2% Pooled / 82.5% Macro** | **70.8% Pooled / 72.1% Macro** | **58.3% Pooled / 57.6% Macro** |
| **#2 TerraShift v5.1 (Siamese+L2A)** | **55.9% Pooled / 66.2% Macro** | **53.5% Pooled / 64.1% Macro** | **47.9% Pooled / 56.6% Macro** | **39.4% Pooled / 45.7% Macro** |
| **#3 Google AlphaEarth V1 (Model A)** | 27.0% Pooled / 31.4% Macro | 27.0% Pooled / 31.4% Macro | 22.2% Pooled / 25.4% Macro | 17.5% Pooled / 20.6% Macro |
| **#4 Pure Multispectral Physical** | 27.9% Pooled / 28.0% Macro | 26.5% Pooled / 26.7% Macro | 20.6% Pooled / 21.1% Macro | 17.6% Pooled / 18.0% Macro |
| **#5 Untuned Siamese Baseline** | 25.0% Pooled / 26.4% Macro | 23.8% Pooled / 25.3% Macro | 18.8% Pooled / 19.7% Macro | 16.0% Pooled / 16.8% Macro |
| **#6 Google Dynamic World V1 LULC** | 29.5% Pooled / 34.4% Macro | 19.7% Pooled / 27.9% Macro | 13.1% Pooled / 12.1% Macro | 13.1% Pooled / 12.1% Macro |
| **#7 AlphaEarth + Dynamic World** | 20.4% Pooled / 27.8% Macro | 16.3% Pooled / 25.9% Macro | 8.2% Pooled / 6.7% Macro | 8.2% Pooled / 6.7% Macro |
