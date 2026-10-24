"""TerraShift AI — Senior Design Project Report Structured Data (v6.1 Verified GEE + STAC).

Contains the comprehensive empirical scorecards, architectural contracts,
defense questions & answers, localization sensitivity sweep, and deployment specifications
for the 100+ page senior thesis.
"""

# =========================================================================
# 1. SENIOR PROJECT DEFENSE Q&A (10 Tough Questions & Rigorous Answers)
# =========================================================================
DEFENSE_QA_PAIRS = [
    (
        "Question 1: Why does TerraShift AI exist if Google AlphaEarth Foundations and Google Dynamic World are already freely available on Google Earth Engine?",
        "Answer: Our empirical benchmark on authentic Google Earth Engine data ('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL' and 'GOOGLE/DYNAMICWORLD/V1') directly answers this question. Used alone on hyper-arid Saudi terrain, standalone Google AlphaEarth V1 (Model A) achieves only 27.0% Pooled F1 (31.4% Macro F1) and generates 90 false alarms across 91.19 km²—including 23 false alarms inside undisturbed desert Negative Control Zones—because annual embedding cosine distance reacts to natural inter-annual sand albedo, moisture, and BRDF shifts. Similarly, standalone Google Dynamic World V1 LULC transition achieves only 19.7% Pooled F1 (31.6% Recall) because it misclassifies bright concrete grading as bare desert rock. By fusing our bitemporal Siamese U-Net spatial boundaries with AlphaEarth 64-D embeddings and Sentinel-2 L2A physical spectral guards (Delta_NDBI / Delta_NDVI), TerraShift v6.0 Hybrid achieves 79.2% Pooled F1 (82.5% Macro F1), 100% Recall (19/19 events), 0 Negative Control Zone hits, and cuts false alarms by 91.2%."
    ),
    (
        "Question 2: How do you prevent a model from gaming the event-level evaluation by predicting giant sprawling polygons that accidentally touch reference parcels?",
        "Answer: A naive intersection rule or fixed area cap is scientifically flawed: a blind intersection rewards a 20 km² false-alarm blob as a 'True Positive' if it touches a 5-hectare construction site, while an arbitrary 10% AOI cap would wrongly reject genuine mega-project earthworks. Instead, we formulated a Localization-Aware Greedy 1-to-1 Bipartite Matching Protocol governed by two geometric metrics: Recall-on-Change (RoC = Area(P cap G) / Area(G)) and Precision-on-Change (PoC = Area(P cap G) / Area(P)), alongside parcel IoU. A predicted polygon P matches a reference parcel G if and only if it provides physical coverage (Area(P cap G) >= 3,500 m² or RoC >= 0.08) AND satisfies localization purity (PoC >= 0.15 and IoU >= 0.05, or PoC >= 0.30 for surgical sub-parcel detections). Furthermore, we evaluate all 7 models across 4 localization regimes (Relaxed, Standard, Moderate, Strict) in a formal sensitivity sweep."
    ),
    (
        "Question 3: Why do you report both Pooled (Micro) and Corridor Macro-Averaged Precision, Recall, and F1 side-by-side?",
        "Answer: In multi-corridor geospatial benchmarks where false alarm densities vary across biomes (for example, coastal Jeddah Obhur vs. center-pivot irrigation in Al-Jouf), Macro-averaging weights each corridor equally, whereas Pooled (micro) aggregation sums raw True Positives, False Positives, and False Negatives across the entire 91.19 km² study area before computing ratios. Reporting only Macro F1 can mask high false-alert counts in a noisy corridor. For complete scientific transparency, we report both metrics side-by-side: TerraShift v6.0 Hybrid achieves 79.2% Pooled Event F1 (65.5% Pooled Precision, 100.0% Recall) and 82.5% Macro Event F1 (70.1% Macro Precision, 100.0% Recall); TerraShift v5.1 achieves 53.5% Pooled Event F1 (36.5% Pooled Precision) and 64.1% Macro Event F1 (47.2% Macro Precision)."
    ),
    (
        "Question 4: How did you resolve the rotated UTM raster footprint vs. WGS84 AOI bounding box discrepancy so changed-area percentages never exceed 100%?",
        "Answer: Sentinel-2 L2A Cloud-Optimized GeoTIFFs are projected in UTM zones (EPSG:32637 and EPSG:32638). When a WGS84 bounding box [west, south, east, north] is transformed into UTM to read a rectangular pixel window, grid convergence slightly expands the UTM window corners by ~0.2% beyond the WGS84 box. Rather than artificially clamping percentages to 100%, we implemented exact geometric clipping in WGS84: every vectorized polygon is intersected with the exact analytic AOI bounding box (`geo_poly.intersection(shapely.box(*aoi_bbox))`) prior to integrating ellipsoidal geodesic area on the WGS84 ellipsoid via `pyproj.Geod`."
    ),
    (
        "Question 5: How does TerraShift AI distinguish pale urban concrete and asphalt from bare desert limestone when their visible spectral curves are nearly identical?",
        "Answer: In hyper-arid regions like Riyadh and Jeddah, undisturbed desert regolith and concrete both exhibit high visible and near-infrared reflectance. However, anthropogenic construction entails earthmoving, deep excavation, and mineral exposure that alter Short-Wave Infrared (SWIR-1, Band 11 at 1610 nm) reflectance relative to NIR (Band 8 at 842 nm). By deploying directional physical spectral guards alongside AlphaEarth 64-D latent vectors, TerraShift AI tracks the bitemporal shift in the Normalized Difference Built-Up Index (Delta_NDBI = NDBI_T2 - NDBI_T1) and Vegetation Index (Delta_NDVI). Undisturbed desert soil maintains near-zero NDBI/NDVI shifts across multi-year cycles, whereas structural earthwork and agricultural reclamation exhibit decisive physical signatures."
    ),
    (
        "Question 6: What is the operational difference between TerraShift v6.0 Hybrid (Annual GEE + L2A) and TerraShift v5.1 (Tactical 5-Day L2A)?",
        "Answer: Google AlphaEarth V1 embeddings ('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL') are published as annual composites, making TerraShift v6.0 Hybrid (79.2% Pooled F1 / 82.5% Macro F1) the premier engine for annual strategic compliance auditing and multi-year master-plan verification. However, municipal authorities also require sub-monthly tactical monitoring between annual GEE releases. TerraShift v5.1 (53.5% Pooled F1 / 64.1% Macro F1, 100% Recall, 0 Negative Zone hits) operates purely on 5-day Copernicus Sentinel-2 L2A STAC streams with zero GEE dependency—delivering an end-to-end dual-mode architecture covering both 5-day tactical alerts and annual foundation-model audits."
    ),
    (
        "Question 7: What is the computational and memory footprint of executing inference on commodity CPU vs. GPU?",
        "Answer: On a standard consumer laptop CPU without GPU acceleration, TerraShift AI processes each Saudi benchmark corridor in 1.485 seconds of pure compute execution (including Siamese U-Net pass, 64-D AlphaEarth cosine/hybrid fusion, L2A physical guard evaluation, and geodesic polygonization). Peak resident memory footprint is strictly bounded at 301 MB RAM. This eliminates the need for expensive GPU clusters and enables municipal agencies to deploy TerraShift AI on standard workstations at zero recurring cloud GPU cost."
    ),
    (
        "Question 8: Why did you prohibit synthetic embeddings and remove supervised calibration on the 19 reference parcels?",
        "Answer: Scientific integrity requires two strict methodological rules: (1) Official benchmarks must never use synthetic fallback tensors when cloud APIs are unauthenticated; our `EarthEngineManager` enforces `allow_synthetic=False` by default and raises a hard `RuntimeError` if genuine GEE credentials or verified GEE caches are absent. (2) Coarse parcel-level reference bounding boxes are designed for event-level detection evaluation, not dense pixel-level supervised training. Fitting and evaluating a supervised classifier on the same 19 coarse boxes would introduce label leakage and boundary noise. Removing synthetic calibration ensures every number in our leaderboard reflects honest, zero-leakage generalization."
    ),
    (
        "Question 9: How was the ground-truth reference dataset delineated, and what are its explicit provenance boundaries?",
        "Answer: The Saudi pilot benchmark spans 91.19 km² across four corridors (Riyadh ROSHN Sedra, Jeddah North Obhur, Al-Jouf Sirhan Basin, and Held-Out Al-Kharj Logistics). It comprises 19 positive change parcels and 4 undisturbed Negative Control Zones curated from multi-date Sentinel-2 L2A visual and spectral inspection cross-referenced with known Saudi urban and agricultural landmarks. We explicitly disclose that these 19 reference events are coarse parcel-level bounding boxes rather than surveyed municipal cadastral polygons or dense pixel-level segmentation masks."
    ),
    (
        "Question 10: How does TerraShift AI directly contribute to the strategic goals of Saudi Vision 2030 and the Saudi Green Initiative?",
        "Answer: TerraShift AI directly accelerates three primary pillars of Saudi Vision 2030: (1) Sustainable Urban Development, by providing municipal authorities and ROSHN with automated verification of master-planned grading boundaries and infrastructure progress; (2) The Saudi Green Initiative (SGI), by quantifying agricultural reclamation, center-pivot irrigation expansion, and afforestation canopy growth; and (3) Environmental Governance (NCEC / MEWA), by suppressing desert false alarms while detecting unpermitted land encroachment and earthworks across vast arid territories."
    ),
]

# =========================================================================
# 2. CHAPTER 8 CORRIDOR CASE STUDIES (Detailed Parcel Breakdown Tables)
# =========================================================================
RIYADH_CASE_STUDY_ROWS = [
    ["Event ID", "Category", "Area (ha)", "Baseline (T1)", "Final (T2)", "ΔNDBI", "ΔNDVI", "v6.0 Hybrid Match"],
    ["sedra_grading_sec1", "Built Earthwork", "52.4 ha", "Bare Limestone", "Graded Pad", "+0.082", "-0.012", "YES (PoC=0.81, IoU=0.41)"],
    ["sedra_spine_paving", "Paved Road", "14.1 ha", "Graded Regolith", "Asphalt Highway", "+0.065", "+0.005", "YES (PoC=0.42, IoU=0.14)"],
    ["sedra_substation", "Infrastructure", "6.8 ha", "Desert Soil", "Concrete Apron", "+0.071", "-0.008", "YES (PoC=0.72, IoU=0.33)"],
    ["sedra_block_a", "Built Earthwork", "18.5 ha", "Natural Plateau", "Excavated Lots", "+0.058", "-0.015", "YES (PoC=0.58, IoU=0.06)"],
    ["sedra_access_junc", "Road Junction", "9.2 ha", "Desert Wadis", "Paved Berm", "+0.049", "-0.002", "YES (PoC=0.61, IoU=0.08)"],
    ["sedra_neg_plateau", "Negative Control", "28.0 ha", "Undisturbed Rock", "Undisturbed Rock", "+0.004", "-0.001", "0 ALERTS (PASS; AE=3 FAs)"],
]

JEDDAH_CASE_STUDY_ROWS = [
    ["Event ID", "Category", "Area (ha)", "Baseline (T1)", "Final (T2)", "ΔNDBI", "ΔNDVI", "v6.0 Hybrid Match"],
    ["obhur_lot_grading", "Urban Grading", "16.2 ha", "Coastal Soil", "Subdivided Lots", "+0.074", "-0.004", "YES (PoC=0.79, IoU=0.53)"],
    ["obhur_infill_subdiv", "Urban Infill", "11.8 ha", "Desert Infill", "Boundary Walls", "+0.061", "-0.002", "YES (PoC=0.68, IoU=0.31)"],
    ["obhur_junction", "Road Paving", "7.4 ha", "Unpaved Track", "Asphalt Junction", "+0.088", "+0.001", "YES (PoC=0.54, IoU=0.11)"],
    ["obhur_eastern_paving", "Road Paving", "12.5 ha", "Gravel Bed", "Dual Carriageway", "+0.079", "-0.003", "YES (PoC=0.49, IoU=0.11)"],
    ["obhur_neg_sabkha", "Negative Control", "35.0 ha", "Saline Mudflat", "Saline Mudflat", "-0.018", "-0.006", "0 ALERTS (PASS; AE=9 FAs)"],
]

ALJOUF_CASE_STUDY_ROWS = [
    ["Event ID", "Category", "Area (ha)", "Baseline (T1)", "Final (T2)", "ΔNDBI", "ΔNDVI", "v6.0 Hybrid Match"],
    ["pivot_field_alpha", "Agriculture", "50.3 ha", "Hyper-Arid Sand", "Circular Crops", "-0.042", "+0.284", "YES (PoC=0.66, IoU=0.39)"],
    ["pivot_field_beta", "Agriculture", "50.1 ha", "Hyper-Arid Sand", "Circular Crops", "-0.038", "+0.261", "YES (PoC=0.84, IoU=0.71)"],
    ["pivot_field_gamma", "Agriculture", "50.2 ha", "Hyper-Arid Sand", "Circular Crops", "-0.045", "+0.312", "YES (PoC=0.81, IoU=0.59)"],
    ["pivot_field_delta", "Agriculture", "50.0 ha", "Hyper-Arid Sand", "Circular Crops", "-0.031", "+0.245", "YES (PoC=0.47, IoU=0.11)"],
    ["pivot_field_epsilon", "Agriculture", "50.4 ha", "Circular Crops", "Harvested Soil", "+0.015", "-0.228", "YES (PoC=0.41, IoU=0.05)"],
    ["aljouf_neg_dunes", "Negative Control", "45.0 ha", "Active Sand Dunes", "Active Sand Dunes", "-0.005", "+0.002", "0 ALERTS (PASS; AE=1 FA)"],
]

ALKHARJ_CASE_STUDY_ROWS = [
    ["Event ID", "Category", "Area (ha)", "Baseline (T1)", "Final (T2)", "ΔNDBI", "ΔNDVI", "v6.0 Hybrid Match"],
    ["alkharj_warehouse", "Industrial", "24.5 ha", "Desert Gravel", "Logistics Pad", "+0.091", "-0.011", "YES (PoC=0.74, IoU=0.39)"],
    ["alkharj_substation", "Infrastructure", "8.2 ha", "Alluvial Fan", "Substation Yard", "+0.068", "-0.006", "YES (PoC=0.45, IoU=0.06)"],
    ["alkharj_depot", "Commercial", "15.0 ha", "Gravel Plains", "Distribution Hub", "+0.084", "-0.009", "YES (PoC=0.51, IoU=0.09)"],
    ["alkharj_date_orchard", "Agriculture", "19.8 ha", "Desert Bed", "Date Palm Canopy", "-0.025", "+0.184", "YES (PoC=0.79, IoU=0.44)"],
    ["alkharj_access_road", "Road Corridor", "10.4 ha", "Unpaved Trail", "Graded Highway", "+0.059", "-0.004", "YES (PoC=0.68, IoU=0.30)"],
    ["alkharj_neg_desert", "Negative Control", "32.0 ha", "Undisturbed Regolith", "Undisturbed Regolith", "+0.002", "-0.001", "0 ALERTS (PASS; AE=10 FAs)"],
]

# =========================================================================
# 3. CHAPTER 5 ARCHITECTURAL COMPONENT INTERACTION & SSE STATES
# =========================================================================
COMPONENT_INTERACTION_ROWS = [
    ["Subsystem / Module", "Primary Technology", "Protocol / Contract", "Execution Role", "Latency Bound"],
    ["Next.js Presentation Tier", "Next.js 16 (React 19)", "HTTP / REST / SSE", "Client orchestration, UI state, MapLibre GL", "< 50 ms TTFB"],
    ["Cartographic Renderer", "MapLibre GL GPU WebGL", "GeoJSON Vector Specs", "Hardware-accelerated polygon rendering", "60 FPS Render"],
    ["FastAPI Inference Engine", "Python 3.12 / FastAPI", "OpenAPI 3.1 REST", "Model execution, pipeline scheduling", "< 15 ms Routing"],
    ["STAC COG Streamer", "rasterio / GDAL HTTP", "HTTP Range Requests", "Windowed bitemporal satellite tile fetch", "< 600 ms Fetch"],
    ["GEE Foundation Bridge", "earthengine-api (OAuth2)", "NPY Tensor Stream", "Authentic 64-D AlphaEarth & 9-Band DW fetch", "Cached (< 25 ms)"],
    ["Siamese U-Net Core", "PyTorch 2.4 CPU", "Tensor (B, C, H, W)", "Bitemporal change probability segmentation", "< 500 ms Inference"],
    ["Physical Spectral Guard", "NumPy / Spectral Indices", "Boolean Mask & Tensors", "Directional NDBI/NDVI false alarm rejection", "< 40 ms Filter"],
    ["Geodesic Vectorizer", "rasterio / shapely / pyproj", "GeoJSON RFC 7946", "Exact WGS84 AOI clip & ellipsoidal area", "< 60 ms Vectorize"],
]

SSE_STATE_TRANSITIONS_ROWS = [
    ["Step #", "State Label", "Progress %", "Telemetry Payload Attributes", "Failure Fallback"],
    ["Step 1", "Planning imagery window", "8%", "bbox, target_years, resolution, crs", "Clamp to valid WGS84 coordinates"],
    ["Step 2", "Querying Sentinel-2 STAC", "18%", "stac_catalog_url, cloud_threshold, items_found", "Widen acquisition date window (+/- 30d)"],
    ["Step 3", "Acquiring genuine L2A COGs", "58%", "granule_id, bands_acquired, byte_range_mb", "Fallback to EOX cloudless mosaic"],
    ["Step 4", "Hybrid AlphaEarth & L2A Guards", "80%", "model_type, raw_alerts, screened_artifacts", "Raise explicit error if GEE unauthenticated"],
    ["Step 5", "Vectorising & WGS84 AOI clipping", "96%", "polygons_count, total_area_m2, geodesic_area", "Exact shapely.box(*aoi_bbox) clip"],
    ["Done", "Streaming Complete", "100%", "geojson_feature_collection, benchmark_metrics", "Emit RFC 7807 error JSON object"],
]

# =========================================================================
# 4. APPENDIX B DETAILED SCORECARDS, POOLED VS MACRO, & SENSITIVITY SWEEP
# =========================================================================
APPENDIX_B_SCORECARD_ROWS = [
    ["Model Architecture", "Corridor Name", "Alerts", "TP", "FP_dup", "FP_bg", "Strict Prec", "Recall", "FA / 100km²"],
    ["alphaearth_hybrid (TerraShift v6.0)", "Riyadh Sedra", "7", "5", "1", "1", "71.4%", "100.0%", "11.2"],
    ["alphaearth_hybrid (TerraShift v6.0)", "Jeddah Obhur", "4", "4", "0", "0", "100.0%", "100.0%", "0.0"],
    ["alphaearth_hybrid (TerraShift v6.0)", "Al-Jouf Sirhan", "8", "5", "2", "1", "62.5%", "100.0%", "11.2"],
    ["alphaearth_hybrid (TerraShift v6.0)", "Al-Kharj Held-Out", "8", "5", "1", "2", "62.5%", "100.0%", "10.6"],
    ["siamese_tuned_filtered (TerraShift v5.1)", "Riyadh Sedra", "10", "5", "2", "3", "50.0%", "100.0%", "27.9"],
    ["siamese_tuned_filtered (TerraShift v5.1)", "Jeddah Obhur", "5", "4", "0", "1", "80.0%", "100.0%", "5.5"],
    ["siamese_tuned_filtered (TerraShift v5.1)", "Al-Jouf Sirhan", "18", "5", "5", "8", "27.8%", "100.0%", "48.5"],
    ["siamese_tuned_filtered (TerraShift v5.1)", "Al-Kharj Held-Out", "16", "5", "2", "9", "31.2%", "100.0%", "39.1"],
    ["alphaearth_cosine (Model A)", "Riyadh Sedra", "17", "5", "4", "8", "29.4%", "100.0%", "67.0"],
    ["alphaearth_cosine (Model A)", "Jeddah Obhur", "22", "4", "1", "17", "18.2%", "100.0%", "98.1"],
    ["alphaearth_cosine (Model A)", "Al-Jouf Sirhan", "42", "5", "12", "25", "11.9%", "100.0%", "138.0"],
    ["alphaearth_cosine (Model A)", "Al-Kharj Held-Out", "26", "3", "3", "20", "11.5%", "60.0%", "81.7"],
    ["multispectral_physical", "Riyadh Sedra", "33", "5", "5", "23", "15.2%", "100.0%", "156.4"],
    ["multispectral_physical", "Jeddah Obhur", "25", "4", "3", "18", "16.0%", "100.0%", "114.4"],
    ["multispectral_physical", "Al-Jouf Sirhan", "37", "5", "8", "24", "13.5%", "100.0%", "119.4"],
    ["multispectral_physical", "Al-Kharj Held-Out", "23", "4", "2", "17", "17.4%", "80.0%", "67.5"],
    ["siamese_untuned", "Riyadh Sedra", "39", "5", "6", "28", "12.8%", "100.0%", "189.9"],
    ["siamese_untuned", "Jeddah Obhur", "26", "4", "3", "19", "15.4%", "100.0%", "119.9"],
    ["siamese_untuned", "Al-Jouf Sirhan", "24", "5", "5", "14", "20.8%", "100.0%", "70.9"],
    ["siamese_untuned", "Al-Kharj Held-Out", "42", "4", "4", "34", "9.5%", "80.0%", "134.9"],
    ["dynamic_world_lulc", "Riyadh Sedra", "1", "1", "0", "0", "100.0%", "20.0%", "0.0"],
    ["dynamic_world_lulc", "Jeddah Obhur", "25", "2", "1", "22", "8.0%", "50.0%", "125.3"],
    ["dynamic_world_lulc", "Al-Jouf Sirhan", "15", "2", "3", "10", "13.3%", "40.0%", "48.5"],
    ["dynamic_world_lulc", "Al-Kharj Held-Out", "1", "1", "0", "0", "100.0%", "20.0%", "0.0"],
    ["alphaearth_dynamic_world (Model B)", "Riyadh Sedra", "1", "1", "0", "0", "100.0%", "20.0%", "0.0"],
    ["alphaearth_dynamic_world (Model B)", "Jeddah Obhur", "13", "1", "0", "12", "7.7%", "25.0%", "65.4"],
    ["alphaearth_dynamic_world (Model B)", "Al-Jouf Sirhan", "15", "1", "2", "12", "6.7%", "20.0%", "52.2"],
    ["alphaearth_dynamic_world (Model B)", "Al-Kharj Held-Out", "1", "1", "0", "0", "100.0%", "20.0%", "0.0"],
]

LOCALIZATION_SENSITIVITY_ROWS = [
    ["Model Architecture", "Relaxed (PoC≥0.02)", "Standard (PoC≥0.15, IoU≥0.05)", "Moderate (PoC≥0.20, IoU≥0.10)", "Strict (PoC≥0.30, IoU≥0.15)"],
    ["#1 TerraShift v6.0 Hybrid", "82.6% Pooled / 85.4% Macro", "79.2% Pooled / 82.5% Macro", "70.8% Pooled / 72.1% Macro", "58.3% Pooled / 57.6% Macro"],
    ["#2 TerraShift v5.1 (Siamese+L2A)", "55.9% Pooled / 66.2% Macro", "53.5% Pooled / 64.1% Macro", "47.9% Pooled / 56.6% Macro", "39.4% Pooled / 45.7% Macro"],
    ["#3 Google AlphaEarth V1 (Model A)", "27.0% Pooled / 31.4% Macro", "27.0% Pooled / 31.4% Macro", "22.2% Pooled / 25.4% Macro", "17.5% Pooled / 20.6% Macro"],
    ["#4 Pure Multispectral Physical", "27.9% Pooled / 28.0% Macro", "26.5% Pooled / 26.7% Macro", "20.6% Pooled / 21.1% Macro", "17.6% Pooled / 18.0% Macro"],
    ["#5 Untuned Siamese Baseline", "25.0% Pooled / 26.4% Macro", "23.8% Pooled / 25.3% Macro", "18.8% Pooled / 19.7% Macro", "16.0% Pooled / 16.8% Macro"],
    ["#6 Google Dynamic World V1 LULC", "29.5% Pooled / 34.4% Macro", "19.7% Pooled / 27.9% Macro", "13.1% Pooled / 12.1% Macro", "13.1% Pooled / 12.1% Macro"],
    ["#7 AlphaEarth + Dynamic World", "20.4% Pooled / 27.8% Macro", "16.3% Pooled / 25.9% Macro", "8.2% Pooled / 6.7% Macro", "8.2% Pooled / 6.7% Macro"],
]

CONFUSION_MATRIX_RIYADH_ROWS = [
    ["Riyadh Sedra Benchmark (17.9 km²)", "TerraShift v6.0 Hybrid", "TerraShift v5.1 (L2A)", "Standalone AlphaEarth V1"],
    ["Actual Change Events (N=5)", "5 / 5 Detected (100% Recall)", "5 / 5 Detected (100% Recall)", "5 / 5 Detected (100% Recall)"],
    ["False Alarms & Negative Control", "2 FAs (0 Neg Zone Hits)", "5 FAs (0 Neg Zone Hits)", "12 FAs (3 Neg Zone Hits)"],
    ["Corridor Precision & Event F1", "71.4% Prec / 83.3% F1", "50.0% Prec / 66.7% F1", "29.4% Prec / 45.5% F1"],
]

CONFUSION_MATRIX_JEDDAH_ROWS = [
    ["Jeddah Obhur Benchmark (18.3 km²)", "TerraShift v6.0 Hybrid", "TerraShift v5.1 (L2A)", "Standalone AlphaEarth V1"],
    ["Actual Change Events (N=4)", "4 / 4 Detected (100% Recall)", "4 / 4 Detected (100% Recall)", "4 / 4 Detected (100% Recall)"],
    ["False Alarms & Negative Control", "0 FAs (0 Neg Zone Hits)", "1 FA (0 Neg Zone Hits)", "18 FAs (9 Neg Zone Hits)"],
    ["Corridor Precision & Event F1", "100.0% Prec / 100.0% F1", "80.0% Prec / 88.9% F1", "18.2% Prec / 30.8% F1"],
]

CONFUSION_MATRIX_ALJOUF_ROWS = [
    ["Al-Jouf Sirhan Benchmark (26.8 km²)", "TerraShift v6.0 Hybrid", "TerraShift v5.1 (L2A)", "Standalone AlphaEarth V1"],
    ["Actual Change Events (N=5)", "5 / 5 Detected (100% Recall)", "5 / 5 Detected (100% Recall)", "5 / 5 Detected (100% Recall)"],
    ["False Alarms & Negative Control", "3 FAs (0 Neg Zone Hits)", "13 FAs (0 Neg Zone Hits)", "37 FAs (1 Neg Zone Hit)"],
    ["Corridor Precision & Event F1", "62.5% Prec / 76.9% F1", "27.8% Prec / 43.5% F1", "11.9% Prec / 21.3% F1"],
]

CONFUSION_MATRIX_ALKHARJ_ROWS = [
    ["Al-Kharj Held-Out (28.2 km²)", "TerraShift v6.0 Hybrid", "TerraShift v5.1 (L2A)", "Standalone AlphaEarth V1"],
    ["Actual Change Events (N=5)", "5 / 5 Detected (100% Recall)", "5 / 5 Detected (100% Recall)", "3 / 5 Detected (60% Recall)"],
    ["False Alarms & Negative Control", "3 FAs (0 Neg Zone Hits)", "11 FAs (0 Neg Zone Hits)", "23 FAs (10 Neg Zone Hits)"],
    ["Corridor Precision & Event F1", "62.5% Prec / 76.9% F1", "31.2% Prec / 47.6% F1", "11.5% Prec / 19.4% F1"],
]

# =========================================================================
# 5. APPENDIX C REST API SPECIFICATION
# =========================================================================
API_ENDPOINTS_ROWS = [
    ["HTTP Verb", "Path Endpoint", "Request Body / Params", "Response Schema", "Description"],
    ["POST", "/v1/analyze", "AnalyzeRequest (JSON)", "AnalyzeResponse (JSON)", "Synchronous change detection analysis"],
    ["POST", "/v1/analyze/stream", "AnalyzeRequest (JSON)", "text/event-stream (SSE)", "Streaming change detection with step telemetry"],
    ["GET", "/api/benchmarks/saudi", "None", "SaudiPilotReport (JSON)", "Empirical 7-model leaderboard (Pooled & Macro)"],
    ["POST", "/v1/ablation", "AnalyzeRequest (JSON)", "AblationStudyResponse", "4-way model ablation & spectral attribution"],
    ["GET", "/healthz", "None", "HealthStatus (JSON)", "Liveness and readiness health probe"],
    ["POST", "/v1/stac/search", "StacSearchRequest", "SceneCatalogResponse", "Queries AWS Earth Search Sentinel-2 L2A catalog"],
    ["POST", "/v1/report", "ReportRequest (JSON)", "application/pdf", "Generates audit PDF report with GeoJSON summary"],
]

# =========================================================================
# 6. APPENDIX D DEPLOYMENT PREREQUISITES & VERIFICATION GATES
# =========================================================================
DEPLOYMENT_PREREQS_ROWS = [
    ["Component", "Minimum Requirement", "Recommended Specification", "Verification Command"],
    ["Host CPU", "Dual-Core x86_64 / ARM64", "8-Core Modern CPU (e.g. Intel i7 / AMD Ryzen)", "python -c 'import os; print(os.cpu_count())'"],
    ["System RAM", "4 GB DDR4", "16 GB DDR4/DDR5", "python -c 'import psutil; print(psutil.virtual_memory().total)'"],
    ["Disk Storage", "5 GB Available Space", "20 GB NVMe SSD (for GEE & COG caching)", "df -h . (Linux) / Get-PSDrive (PowerShell)"],
    ["Python Runtime", "Python 3.11.0 64-bit", "Python 3.12.3 64-bit", "python --version"],
    ["Node.js Engine", "Node.js v20.12.0 LTS", "Node.js v22.0.0+", "node --version"],
    ["Google Earth Engine", "Registered Cloud Project ('terrashift')", "OAuth2 Credentials or Service Account", "python -c \"import ee; ee.Initialize(project='terrashift')\""],
]

DEPLOYMENT_ENV_ROWS = [
    ["Variable Name", "Default Value", "Scope / Usage", "Security Sensitivity"],
    ["NEXT_PUBLIC_MAPBOX_TOKEN", "'' (Empty string)", "apps/web (MapLibre raster tile provider)", "Public (Client-Safe)"],
    ["ML_SERVICE_URL", "'http://127.0.0.1:8000'", "apps/web (Internal FastAPI backend endpoint)", "Private (Server-Side Proxy)"],
    ["GEE_PROJECT_ID", "'terrashift'", "services/ml (Authenticated Earth Engine project)", "Internal Configuration"],
    ["GEE_SERVICE_ACCOUNT", "'' (Optional)", "services/ml (Headless server GEE authentication)", "Confidential (Server Key)"],
    ["CACHE_DIR", "'services/ml/.cache'", "services/ml (Verified GEE & COG tile cache)", "Internal File Path"],
    ["MAX_CONCURRENT_INFERENCES", "'4'", "services/ml (Thread pool worker limit)", "System Configuration"],
]

VERIFICATION_CHECKLIST_ROWS = [
    ["Gate #", "Verification Gate Name", "Target Standard", "Observed Value", "Status"],
    ["Gate 1", "Clean Next.js 16 Production Build", "0 Errors / 0 Warnings", "Compiled in 5.5s (17/17 routes)", "PASSED (LAW)"],
    ["Gate 2", "ESLint Production Sweep", "--max-warnings=0", "0 Warnings, 0 Errors", "PASSED (LAW)"],
    ["Gate 3", "Frontend Component Tests (Vitest)", "100% Passing", "8 / 8 Tests Passing", "PASSED"],
    ["Gate 4", "Backend Unit Tests (pytest)", "100% Passing", "31 / 31 Tests Passing", "PASSED"],
    ["Gate 5", "Zero Synthetic Benchmark Data", "allow_synthetic=False", "100% Verified GEE ('terrashift') + STAC", "VERIFIED"],
    ["Gate 6", "Localization-Aware 1-to-1 Matching", "PoC ≥ 0.15 & IoU ≥ 0.05", "Enforced across 19 Events + 4 Regimes", "VERIFIED"],
    ["Gate 7", "Negative Control Zone Auditing", "0 False Positives", "0 / 4 Hits (vs 23 for standalone AE)", "VERIFIED"],
    ["Gate 8", "Held-Out Corridor Generalization", "Al-Kharj Frozen", "100% Recall, 62.5% Prec (v6.0 Hybrid)", "VERIFIED"],
    ["Gate 9", "Exact WGS84 Geodesic Area Clip", "≤ 100.0% AOI Area", "Exact shapely.box(*aoi_bbox) clip", "PASSED"],
    ["Gate 10", "CPU Latency & Memory Bound", "< 2.0s / < 500 MB RAM", "1.485s Compute / 301 MB Peak RAM", "PASSED"],
    ["Gate 11", "Client-Side Key Leakage Audit", "Zero Client Secrets", "All Secrets on Server/Edge", "PASSED"],
    ["Gate 12", "Separate Pooled & Macro Reporting", "Both Reported Explicitly", "79.2% Pooled F1 / 82.5% Macro F1", "VERIFIED"],
    ["Gate 13", "Academic Bibliography Integrity", "All Real DOIs / arXiv", "36 / 36 Verified Citations", "VERIFIED"],
    ["Gate 14", "Reproducible Scorecards", "All Scorecards Saved", "reports/saudi_pilot_evaluation.json", "VERIFIED"],
    ["Gate 15", "100+ Page University PDF Thesis", "100–110 Pages + Figures", "Publication-Grade PDF with 8 Plates", "VERIFIED"],
]
