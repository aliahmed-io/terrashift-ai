# TerraShift AI — Saudi Reference Benchmark Evaluation Protocol

**Protocol Version**: 5.1 (Preliminary Pilot Protocol)  
**Effective Date**: October 2026  
**Target Environment**: Kingdom of Saudi Arabia (Arid Limestone, Coastal Plain Sabkha, Northern Agricultural Basin, Central Oasis Logistics)  
**Hardware Profile**: Local Commodity Multi-Core CPU (Zero Mandatory Cloud GPU / Zero Mandatory Paid API Keys)  
**Primary Sensor**: Sentinel-2 Multi-Spectral Instrument (Level-2A Bottom-Of-Atmosphere BOA Reflectance via AWS Open Data)  

---

## 1. Executive Summary & Objective

TerraShift AI investigates the operational feasibility of automated satellite change detection across Saudi Arabia's arid landscape. Standard computer vision models trained on temperate European or North American urban datasets (e.g. OSCD, LEVIR-CD) suffer from severe false-positive alarm rates when deployed over Saudi Arabia. These false alarms stem from:
1. **Limestone & Gravel Reflectance Fluctuations**: Seasonal and solar zenith angle disparities alter the optical brightness of natural desert surfaces without physical ground modification.
2. **Spectral Similarity between Concrete and Calcrete**: Arid limestone soils exhibit spectral signatures closely mirroring foundation trenches and crushed gravel roadways.
3. **Sabkha Moisture & Salt Dynamics**: Sub-surface coastal water table changes in regions like Jeddah alter the refractive properties and albedo of salt crusts.
4. **Extreme Contrast in Agricultural Basins**: Center-pivot irrigation circular fields in Al-Jouf transition between hyper-arid dunes and dense chlorophyll canopies.

This protocol defines an independent, reproducible evaluation methodology designed to measure event-level detection accuracy, false alarm frequencies, and operational latency on authentic Sentinel-2 Level-2A imagery without inflated claims or unearned precision metrics.

---

## 2. Evaluation Corridors & Environmental Stratification

Four reference corridors were selected to represent distinct geomorphological and economic development typologies in Saudi Arabia, including a dedicated held-out corridor evaluated with frozen hyperparameters:

| Corridor ID | Name & Province | Bounding Box (WGS84) | Area ($\text{km}^2$) | Epoch Pair | Target Environment & Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `riyadh_sedra_pilot` | **Riyadh ROSHN Sedra** (Riyadh) | `[46.70, 24.85, 46.74, 24.89]` | 17.91 | 2021-05 → 2024-07 | Northern urban growth; residential subdivisions, mass earthworks, foundation trenching bordering bare limestone plateau. (Core Development) |
| `jeddah_obhur_pilot` | **Jeddah North Obhur** (Makkah) | `[39.08, 21.72, 39.12, 21.76]` | 18.33 | 2021-04 → 2024-04 | Coastal suburban expansion; road widening, lot infill, marine grading bordered by undisturbed coastal sabkha. (Core Development) |
| `aljouf_agricultural_pilot`| **Al-Jouf Wadi As-Sirhan** (Al-Jouf) | `[38.25, 29.75, 38.30, 29.80]` | 26.80 | 2021-05 → 2024-07 | Agricultural expansion; new circular center-pivot irrigation systems bordered by hyper-arid active sand dunes. (Core Development) |
| `alkharj_industrial_pilot` | **Al-Kharj Industrial Corridor** (Riyadh) | `[47.25, 24.10, 47.30, 24.15]` | 28.15 | 2021-05 → 2024-05 | Logistics warehouse pad grading, substation foundation, and date palm parcel activation. (**Held-Out Generalization Corridor**) |
| **Total Benchmark** | **4 Representative Corridors** | — | **91.19** | **3-Year Deltas** | **Comprehensive cross-section of Saudi Arabian land-use transitions.** |

---

## 3. Independent Reference Annotations

To prevent precision inflation from coarse bounding envelopes, reference annotations are delineated as discrete, parcel-level features ($N=19$ across all corridors):

### 3.1 Positive Ground Truth Change Events ($N=19$)
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

## 4. Evaluation Metrics & Strict 1-to-1 Matching Formulation

### 4.1 Strict Greedy 1-to-1 Matching
To eliminate many-to-one precision inflation:
1. Predictions $\mathcal{P} = \{p_1, \dots, p_M\}$ are sorted in descending order of neural confidence score.
2. Ground truth reference events $\mathcal{R} = \{r_1, \dots, r_N\}$ maintain an unclaimed registry.
3. For each prediction $p_{(i)}$:
   - A match occurs if $\text{Area}(p_{(i)} \cap r_j) \ge 4{,}000\text{ m}^2$ OR $\frac{\text{Area}(p_{(i)} \cap r_j)}{\text{Area}(r_j)} \ge 0.08$.
   - If $r_j$ is unclaimed, $r_j$ is claimed and $p_{(i)}$ is marked as **True Positive (TP)**.
   - If all matching reference events are already claimed, $p_{(i)}$ is marked as **Duplicate Detection ($\text{FP}_{\text{dup}}$)**.
   - If no reference event matches, $p_{(i)}$ is marked as **Background False Alarm ($\text{FP}_{\text{bg}}$)**.

### 4.2 Primary Operational Metrics
1. **Strict 1-to-1 Event Precision**:
   $$\text{Precision}_{\text{strict}} = \frac{\text{TP}}{\text{Total Predictions}} = \frac{\text{TP}}{\text{TP} + \text{FP}_{\text{dup}} + \text{FP}_{\text{bg}}}$$
2. **Event Validity Precision**:
   $$\text{Precision}_{\text{validity}} = \frac{\text{TP}}{\text{TP} + \text{FP}_{\text{bg}}}$$
3. **Duplicate Alert Rate**:
   $$\text{Rate}_{\text{dup}} = \frac{\text{FP}_{\text{dup}}}{\text{Total Predictions}}$$
4. **Event Recall**:
   $$\text{Recall} = \frac{\text{Claimed Reference Events}}{\text{Total Reference Events}}$$
5. **Pooled Area False Alert Density**:
   $$\text{FA}_{100, \text{pooled}} = \frac{\sum (\text{FP}_{\text{dup}} + \text{FP}_{\text{bg}})}{\sum \text{AOI Area (km}^2\text{)}} \times 100$$
6. **Macro-Averaged False Alert Density**:
   $$\text{FA}_{100, \text{macro}} = \frac{1}{K} \sum_{k=1}^K \text{FA}_{100, k}$$
7. **SCL Clear-Land Surface Validity**:
   $$SCL_{\text{valid}} = \min(SCL_{\text{valid}}^{T1}, SCL_{\text{valid}}^{T2}) \times 100\%$$
   *(Disclosure: SCL masks guarantee clear-land surface validity under standard operational criteria; thin sub-pixel cirrus or dust haze can pass).*
8. **Pure CPU Compute Latency**:
   Measured CPU forward pass time ($1.166\text{s}$) plus geographic vectorization time ($0.253\text{s}$) independent of network STAC I/O.
