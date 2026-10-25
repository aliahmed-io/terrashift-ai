# TerraShift AI — Saudi Reference Benchmark Evaluation Protocol

**Author**: Omar Ayyash (Student ID: `S22107722`) · **Supervisor**: Dr. Passent  
**Protocol Version**: 6.1 (Verified GEE + STAC Localization-Aware 1-to-1 Protocol)  
**Effective Date**: October 2026  
**Target Environment**: Kingdom of Saudi Arabia (Arid Limestone, Coastal Plain Sabkha, Northern Agricultural Basin, Central Oasis Logistics)  
**Hardware Profile**: Local Commodity Multi-Core CPU (Zero Mandatory Cloud GPU)  
**Primary Sensors**:
- **Optical & SWIR Physics**: Copernicus Sentinel-2 Level-2A (10m/20m BOA Reflectance via AWS Open Data STAC)
- **Foundation Embeddings**: Google AlphaEarth Foundations V1 (`GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`, 64-D Unit-Sphere Embeddings via Google Earth Engine `project='terrashift'`)
- **Land-Cover Probabilities**: Google Dynamic World V1 (`GOOGLE/DYNAMICWORLD/V1`, 9-Class Near-Real-Time Probabilities via Google Earth Engine `project='terrashift'`)

---

## 1. Executive Summary & Scientific Integrity Mandate

TerraShift AI investigates the operational feasibility of automated satellite change detection across Saudi Arabia's hyper-arid landscape. Standard computer vision models trained on temperate European or North American urban datasets (e.g., OSCD, LEVIR-CD), as well as standalone global foundation models (Google AlphaEarth V1 and Dynamic World V1), suffer from severe false-positive alarm rates or low transition recall when deployed over Saudi Arabia without arid-calibrated spatial and physical filtering.

This protocol defines a strict, auditable evaluation methodology governed by four non-negotiable rules:
1. **Zero Synthetic Benchmark Data**: `allow_synthetic=False` is strictly enforced in all benchmark executions (`services/ml/terrashift/acquisition/earth_engine.py`). Any missing Google Earth Engine or Sentinel-2 STAC tensor raises an immediate `RuntimeError`.
2. **Localization-Aware 1-to-1 Matching (Anti-Giant-Polygon Rule)**: Unconstrained global models often emit sprawling background polygons covering 30–100% of an AOI that trivially touch multiple reference parcels. Under Protocol v6.1, a candidate polygon must satisfy both physical intersection coverage AND localization purity (`PoC` and `IoU`) to claim at most one reference event.
3. **Exact WGS84 Ellipsoidal Area Clipping**: Every vectorized polygon is geometrically clipped in `EPSG:4326` against `shapely.geometry.box(*aoi_bbox)` before WGS84 geodesic area integration (`pyproj.Geod(ellps="WGS84")`), mathematically bounding total changed area to $\le 100.0\%$ of the corridor.
4. **Separate Pooled (Micro) and Corridor Macro-Averaged Reporting**: Both Pooled (sum of TP/FP/FN across all 4 corridors) and Macro-Averaged (mean of per-corridor scores) Precision, Recall, and $F_1$ are reported side-by-side so neither is conflated with the other.

---

## 2. Evaluation Corridors & Environmental Stratification

Four reference corridors ($91.19\text{ km}^2$ total) were selected to represent distinct geomorphological and economic development typologies in Saudi Arabia, including a dedicated held-out corridor (`alkharj_industrial_pilot`) evaluated with frozen hyperparameters:

| Corridor ID | Name & Province | Bounding Box (WGS84) | Area ($\text{km}^2$) | Epoch Pair | Target Environment & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `riyadh_sedra_pilot` | **Riyadh ROSHN Sedra** (Riyadh) | `[46.70, 24.85, 46.74, 24.89]` | 17.91 | 2021-05 → 2024-07 | Northern urban growth; residential subdivisions, mass earthworks, foundation trenching bordering bare limestone plateau. (Core Development) |
| `jeddah_obhur_pilot` | **Jeddah North Obhur** (Makkah) | `[39.08, 21.72, 39.12, 21.76]` | 18.33 | 2021-04 → 2024-04 | Coastal suburban expansion; road widening, lot infill, marine grading bordered by undisturbed coastal sabkha. (Core Development) |
| `aljouf_agricultural_pilot`| **Al-Jouf Wadi As-Sirhan** (Al-Jouf) | `[38.25, 29.75, 38.30, 29.80]` | 26.80 | 2021-05 → 2024-07 | Agricultural expansion; new circular center-pivot irrigation systems bordered by hyper-arid active sand dunes. (Core Development) |
| `alkharj_industrial_pilot` | **Al-Kharj Industrial Corridor** (Riyadh) | `[47.25, 24.10, 47.30, 24.15]` | 28.15 | 2021-05 → 2024-05 | Logistics warehouse pad grading, substation foundation, and date palm parcel activation. (**Held-Out Generalization Corridor**) |
| **Total Benchmark** | **4 Representative Corridors** | — | **91.19** | **3-Year Deltas** | **Comprehensive cross-section of Saudi Arabian land-use transitions.** |

---

## 3. Reference Annotations & Provenance Disclosure

> **Provenance & Scope Disclosure**: The 19 positive change events and 4 negative undisturbed control zones listed below are **parcel-level bounding-box envelopes** curated from multi-date Sentinel-2 visual/spectral inspection (RGB, SWIR B11/B12, NDVI, NDBI) and known Saudi development landmarks (ROSHN Sedra, North Obhur, Wadi As-Sirhan, Al-Kharj Industrial City). They represent pilot-scale parcel envelopes rather than dense cadastral pixel polygons surveyed by municipal field inspectors.

### 3.1 Positive Reference Change Events ($N=19$)
- **Riyadh ROSHN Sedra ($N=5$)**:
  1. `sedra_mass_grading_sector1` (`[46.721, 24.873, 46.727, 24.881]`): Sector 1 mass residential earthworks.
  2. `sedra_spine_road_paving` (`[46.718, 24.868, 46.725, 24.873]`): Spine roadway and utility trench corridor.
  3. `sedra_substation_facility` (`[46.731, 24.865, 46.736, 24.870]`): High-voltage electrical substation apron.
  4. `sedra_residential_block_a` (`[46.715, 24.874, 46.721, 24.878]`): Northern housing block grading.
  5. `sedra_southern_access_junction` (`[46.708, 24.865, 46.712, 24.869]`): Perimeter access road junction.
- **Jeddah North Obhur ($N=4$)**:
  6. `obhur_coastal_lot_grading` (`[39.103, 21.723, 39.112, 21.732]`): Residential lot grading and plot subdivisions.
  7. `obhur_infill_subdivision` (`[39.095, 21.723, 39.102, 21.730]`): Western infill lot boundary walls.
  8. `obhur_arterial_junction` (`[39.097, 21.737, 39.101, 21.742]`): Commercial street junction paving.
  9. `obhur_eastern_access_paving` (`[39.116, 21.731, 39.121, 21.736]`): Eastern dual carriageway access paving.
- **Al-Jouf Wadi As-Sirhan ($N=5$)**:
  10. `pivot_field_alpha` (`[38.259, 29.763, 38.270, 29.773]`): 50-ha circular center pivot irrigation field Alpha.
  11. `pivot_field_beta` (`[38.249, 29.749, 38.259, 29.759]`): 50-ha circular center pivot irrigation field Beta.
  12. `pivot_field_gamma` (`[38.273, 29.784, 38.284, 29.794]`): 50-ha circular center pivot irrigation field Gamma.
  13. `pivot_field_delta` (`[38.269, 29.778, 38.280, 29.788]`): 50-ha circular center pivot irrigation field Delta.
  14. `pivot_field_epsilon` (`[38.254, 29.756, 38.264, 29.766]`): 50-ha circular center pivot irrigation field Epsilon.
- **Al-Kharj Industrial Corridor (Held-Out, $N=5$)**:
  15. `alkharj_logistics_warehouse_pad` (`[47.279, 24.130, 47.284, 24.137]`): Logistics warehouse pad mass grading ($34{,}000\text{ m}^2$).
  16. `alkharj_industrial_substation_yard` (`[47.282, 24.129, 47.286, 24.133]`): Industrial substation and storage yard foundation.
  17. `alkharj_commercial_depot` (`[47.283, 24.141, 47.288, 24.146]`): Commercial distribution depot facility.
  18. `alkharj_agricultural_parcel_surge` (`[47.270, 24.142, 47.274, 24.147]`): Date palm / fodder cultivation activation.
  19. `alkharj_industrial_access_strip` (`[47.270, 24.139, 47.274, 24.142]`): Facility access corridor and perimeter grading.

### 3.2 Negative Undisturbed Control Zones ($N=4$)
To audit false positive alarms over natural terrain, four persistent, undisturbed natural landforms were delineated:
1. `undisturbed_plateau` (Riyadh, `[46.701, 24.875, 46.715, 24.889]`): Bare limestone desert plateau and dry wadi bed.
2. `stable_salt_flat` (Jeddah, `[39.082, 21.748, 39.098, 21.759]`): Marine coastal sabkha salt crust.
3. `undisturbed_nefud_dunes` (Al-Jouf, `[38.285, 29.775, 38.295, 29.795]`): Hyper-arid Great Nefud dunes outside agricultural basin.
4. `undisturbed_southern_desert` (Al-Kharj, `[47.251, 24.101, 47.262, 24.108]`): Natural desert plateau south of industrial park.

---

## 4. Localization-Aware 1-to-1 Matching & Sensitivity Sweep

### 4.1 Geometric Overlap Measures
For each predicted polygon $P_i$ and ground-truth reference parcel box $G_j$, we compute on the WGS84 ellipsoid:
- **Intersection Area**: $A_{\cap}(P_i, G_j) = \text{Area}_{\text{WGS84}}(P_i \cap G_j)$
- **Recall on Change ($\text{RoC}$, Parcel Coverage)**:
  $$\text{RoC}(P_i, G_j) = \frac{\text{Area}_{\text{WGS84}}(P_i \cap G_j)}{\text{Area}_{\text{WGS84}}(G_j)}$$
- **Precision on Change ($\text{PoC}$, Prediction Purity)**:
  $$\text{PoC}(P_i, G_j) = \frac{\text{Area}_{\text{WGS84}}(P_i \cap G_j)}{\text{Area}_{\text{WGS84}}(P_i)}$$
- **Intersection-over-Union ($\text{IoU}$)**:
  $$\text{IoU}(P_i, G_j) = \frac{\text{Area}_{\text{WGS84}}(P_i \cap G_j)}{\text{Area}_{\text{WGS84}}(P_i \cup G_j)}$$

### 4.2 Standard Protocol v6.1 Eligibility & Greedy 1-to-1 Assignment
Instead of an arbitrary area cap on predictions, a candidate pair $(P_i, G_j)$ is eligible to match under the **Standard (`PoC>=0.15, IoU>=0.05`)** regime if and only if:
1. **Parcel Coverage**: $A_{\cap}(P_i, G_j) \ge 3{,}500\text{ m}^2$ OR $\text{RoC}(P_i, G_j) \ge 0.08$, **AND**
2. **Localization Purity**: $(\text{PoC}(P_i, G_j) \ge 0.15 \text{ AND } \text{IoU}(P_i, G_j) \ge 0.05)$ OR $\text{PoC}(P_i, G_j) \ge 0.30$ (allowing compact surgical sub-parcel detections whose area resides $\ge 30\%$ inside the reference parcel).

Predictions are sorted in descending order of confidence score. Each prediction $P_i$ selects the highest-$\text{IoU}$ unclaimed eligible reference event $G_j$:
- If an unclaimed eligible $G_j$ exists, $G_j$ is claimed and $P_i$ is recorded as a **True Positive ($\text{TP}$)**.
- If $P_i$ satisfies the eligibility criteria only against already-claimed reference events, $P_i$ is penalized as a **Duplicate False Positive ($\text{FP}_{\text{dup}}$)**.
- If $P_i$ fails localization purity or misses all reference parcels (including sprawling giant polygons with $\text{PoC} < 0.15$), $P_i$ is penalized as a **Background False Alarm ($\text{FP}_{\text{bg}}$)**.

### 4.3 Multi-Threshold Localization Sensitivity Sweep
To ensure full transparency across evaluation stringencies, every run evaluates all 7 models across four localization regimes simultaneously (`reports/saudi_pilot_evaluation.json`):
1. **`relaxed` (`PoC>=0.05, IoU>=0.02`)**: Permissive overlap threshold.
2. **`standard` (`PoC>=0.15, IoU>=0.05`)**: Official headline benchmark regime.
3. **`moderate` (`PoC>=0.20, IoU>=0.08`)**: Stricter boundary alignment.
4. **`strict` (`PoC>=0.25, IoU>=0.10`)**: High parcel localization purity.

### 4.4 Pooled (Micro) vs. Corridor Macro-Averaged Metrics
- **Pooled (Micro) Metrics**: Computed from the global sums across all $K=4$ corridors ($\sum \text{TP}, \sum \text{FP}, \sum \text{FN}$):
  $$\text{Precision}_{\text{pooled}} = \frac{\sum_{k=1}^K \text{TP}_k}{\sum_{k=1}^K (\text{TP}_k + \text{FP}_k)}, \quad \text{Recall}_{\text{pooled}} = \frac{\sum_{k=1}^K \text{TP}_k}{19}, \quad F_{1,\text{pooled}} = \frac{2 \cdot \text{Precision}_{\text{pooled}} \cdot \text{Recall}_{\text{pooled}}}{\text{Precision}_{\text{pooled}} + \text{Recall}_{\text{pooled}}}$$
- **Corridor Macro-Averaged Metrics**: Computed as the unweighted arithmetic mean across the $K=4$ corridors:
  $$\text{Precision}_{\text{macro}} = \frac{1}{K}\sum_{k=1}^K \text{Precision}_k, \quad \text{Recall}_{\text{macro}} = \frac{1}{K}\sum_{k=1}^K \text{Recall}_k, \quad F_{1,\text{macro}} = \frac{2 \cdot \text{Precision}_{\text{macro}} \cdot \text{Recall}_{\text{macro}}}{\text{Precision}_{\text{macro}} + \text{Recall}_{\text{macro}}}$$
