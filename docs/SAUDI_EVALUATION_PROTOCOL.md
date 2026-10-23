# TerraShift AI — Saudi Reference Benchmark Evaluation Protocol

**Protocol Version**: 5.0  
**Effective Date**: October 2026  
**Target Environment**: Kingdom of Saudi Arabia (Arid, Hyper-Arid, and Coastal Marine Ecoregions)  
**Hardware Profile**: Local Commodity CPU (Zero Mandatory Cloud GPU / Zero Mandatory Paid API Keys)  
**Primary Sensor**: Sentinel-2 Multi-Spectral Instrument (Level-2A Bottom-Of-Atmosphere Reflectance)  

---

## 1. Executive Summary & Objective

TerraShift AI investigates the operational feasibility of automated satellite change detection across Saudi Arabia's arid landscape. Standard computer vision models trained on temperate European or North American urban datasets (e.g. OSCD, LEVIR-CD) suffer from elevated false-positive alarm rates when deployed over Saudi Arabia. These false alarms stem from:
1. **Limestone & Gravel Reflectance Fluctuations**: Seasonal and solar zenith angle disparities alter the brightness of natural desert surfaces without physical ground modification.
2. **Spectral Similarity between Concrete and Calcrete**: Arid limestone soils exhibit spectral signatures closely mirroring foundation trenches and crushed gravel roadways.
3. **Sabkha Moisture & Salt Dynamics**: Sub-surface coastal water table changes in regions like Jeddah alter the refractive properties of salt crusts.
4. **Extreme Contrast in Agricultural Basins**: Center-pivot irrigation circular fields in Al-Jouf transition between hyper-arid dunes and dense chlorophyll canopies.

This protocol defines an independent, reproducible evaluation methodology designed to measure event-level detection accuracy, false alarm frequencies, and operational latency on authentic Sentinel-2 Level-2A imagery.

---

## 2. Evaluation Corridors & Environmental Stratification

Three reference corridors were selected to represent distinct geomorphological and economic development typologies in Saudi Arabia:

| Corridor ID | Name & Province | Bounding Box (WGS84) | Area ($\text{km}^2$) | Epoch Pair | Target Environment |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `riyadh_sedra_pilot` | **Riyadh ROSHN Sedra** (Riyadh Province) | `[46.70, 24.85, 46.74, 24.89]` | 17.91 | 2021-05 → 2024-07 | Northern urban growth; residential subdivisions, mass earthworks, foundation trenching bordering bare limestone plateau. |
| `jeddah_obhur_pilot` | **Jeddah North Obhur** (Makkah Province) | `[39.08, 21.72, 39.12, 21.76]` | 18.33 | 2021-04 → 2024-04 | Coastal suburban expansion; road widening, lot infill, marine grading bordered by undisturbed coastal sabkha. |
| `aljouf_agricultural_pilot`| **Al-Jouf Wadi As-Sirhan** (Al-Jouf Province) | `[38.25, 29.75, 38.30, 29.80]` | 26.80 | 2021-05 → 2024-07 | Agricultural expansion; new circular center-pivot irrigation systems bordered by hyper-arid active sand dunes. |
| **Total Benchmark** | **3 Representative Corridors** | — | **63.04** | **3-Year Deltas** | **Representative cross-section of Saudi Arabian land-use transitions.** |

---

## 3. Independent Reference Annotations

Reference data was prepared through manual visual interpretation of cloudless bitemporal Sentinel-2 L2A high-contrast false-color and true-color composites, validated against historical high-resolution visual milestones.

### Positive Ground Truth Change Events ($N=6$)
1. **`sedra_phase1_grading`** (`[46.705, 24.855, 46.725, 24.872]`): Mass earthworks and primary road network grading for Sedra residential blocks.
2. **`sedra_phase2_excavation`** (`[46.712, 24.870, 46.732, 24.885]`): Structural excavation and foundation trenching for multi-block housing.
3. **`commercial_substation`** (`[46.728, 24.852, 46.738, 24.862]`): New electrical distribution substation and paved access loop.
4. **`obhur_residential_infill`** (`[39.088, 21.728, 39.105, 21.745]`): Residential lot boundary walls, building superstructures, and paved access lanes.
5. **`arterial_highway_widening`** (`[39.102, 21.735, 39.118, 21.758]`): Multi-lane arterial roadway expansion and dual-carriageway asphalt paving.
6. **`pivot_irrigation_addition`** (`[38.260, 29.760, 38.285, 29.785]`): Two new center-pivot circular agricultural fields installed and irrigated in 2024 (absent 2021).

### Negative Undisturbed Control Zones ($N=3$)
To rigorously audit false positive alarms over natural desert terrain, three persistent, undisturbed natural landforms were delineated:
1. **`undisturbed_plateau`** (Riyadh, `[46.701, 24.875, 46.715, 24.889]`): Bare limestone desert plateau and natural dry wadi bed with zero construction.
2. **`stable_salt_flat`** (Jeddah, `[39.082, 21.748, 39.098, 21.759]`): Marine sabkha and natural coastal salt crust with zero human development.
3. **`deep_sand_dunes`** (Al-Jouf, `[38.252, 29.788, 29.295, 29.799]`): Hyper-arid shifting longitudinal sand dunes with zero agriculture or infrastructure.

---

## 4. Evaluation Metrics & Matching Criteria

### 4.1 Event Matching Formulation
Let $P_i$ denote a predicted change polygon and $R_j$ denote an independent reference ground truth event bounding envelope. An alert is declared a **True Positive (TP)** if:
$$\text{Area}(P_i \cap R_j) \ge 4{,}000\text{ m}^2 \quad \text{OR} \quad \frac{\text{Area}(P_i \cap R_j)}{\text{Area}(R_j)} \ge 0.08$$
Any predicted polygon failing this condition is designated a **False Positive (FP)** alert.

### 4.2 Primary Operational Metrics
1. **Event-Level Precision ($P_{\text{event}}$)**:
   $$P_{\text{event}} = \frac{\text{TP Alerts}}{\text{Total Predicted Alerts}}$$
2. **Event-Level Recall ($R_{\text{event}}$)**:
   $$R_{\text{event}} = \frac{\text{Detected Reference Events}}{\text{Total Reference Events}}$$
3. **False Alert Frequency ($\text{FA}_{100}$)**:
   $$\text{FA}_{100} = \frac{\text{FP Alerts}}{\text{AOI Area (km}^2\text{)}} \times 100$$
4. **Valid Observation Coverage ($C_{\text{valid}}$)**:
   $$C_{\text{valid}} = \min(SCL_{\text{valid}}^{T1}, SCL_{\text{valid}}^{T2}) \times 100\%$$
5. **CPU Latency & Processing Speed**:
   Acquisition streaming time, neural inference time, and geometric vectorization time measured on commodity Intel/AMD multi-core CPU.

---

## 5. Controlled Ablation Setup

The benchmark compares two distinct operational configurations on identical hardware:
- **Mode 1 (Untuned Baseline)**: Raw RGB Siamese U-Net + heuristic fusion operating at default $\tau = 0.45$, minimum area threshold $2{,}000\text{ m}^2$, without multispectral physical verification.
- **Mode 2 (Tuned + Spectrally Filtered)**: Calibrated threshold $\tau = 0.48$, spatial scale filtering $3{,}500\text{ m}^2$, and physical spectral filtering leveraging authentic Sentinel-2 L2A bands ($B04, B08, B11$) to compute true $\Delta\text{NDBI}$ and $\Delta\text{NDVI}$, rejecting pure desert albedo fluctuations.
