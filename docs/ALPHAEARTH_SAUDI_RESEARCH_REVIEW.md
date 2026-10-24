# Deep Review: Saudi AlphaEarth Research & Reproducibility Analysis

**Reference Publication**:  
Manikandan, K. P., Veettil, N. K., Muhammad, M. A. G., Makkar, M. R., & Alhems, L. M. (2026).  
*Foundation-Model Embeddings for Land-Cover Mapping and Annual Change Detection in a Hyper-Arid Region: A Case Study of Saudi Arabia (2017–2024)*.  
*Remote Sensing*, 18(18), 3163. DOI: [10.3390/rs18183163](https://doi.org/10.3390/rs18183163)  
**Primary Research Codebase**: `https://github.com/4IRSA/alphaearth-saudi-landcover`  
**Archived Zenodo Package**: DOI: [10.5281/zenodo.21918869](https://doi.org/10.5281/zenodo.21918869)  
**Review Author**: TerraShift AI Senior Geospatial & Computer Vision Team  
**Review Date**: October 2026  

---

## 1. Executive Summary & Research Problem

The study investigates whether Google's **AlphaEarth Foundations** satellite embeddings (`GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`) can accurately map land cover and screen multi-year land-surface transitions across the Kingdom of Saudi Arabia ($2.15 \times 10^6\text{ km}^2$), an environment dominated by hyper-arid desert ($>85\%$ bare rock, gravel, and sand).

### Core Research Questions Addressed by the Authors:
1. *Representation Quality*: Can a 64-dimensional foundation-model embedding trained self-supervised on global satellite imagery capture fine spectral-spatial distinctions in hyper-arid terrain?
2. *Spatial Generalization & Autocorrelation*: Does standard random K-fold cross-validation artificially inflate classification accuracy in remote sensing, and does spatially blocked cross-validation reveal true generalization error?
3. *Annual Change Screening*: Can temporal cosine similarity between annual embedding mosaics detect physical ground transitions between 2017 and 2024?

---

## 2. Dataset & AlphaEarth Embedding Specifications

### Google Satellite Embedding V1 Annual (`GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL`)
- **Spatial Resolution**: $10\text{ meters}$ per pixel.
- **Temporal Resolution**: Annual calendar-year composite ($2017$–$2024$).
- **Dimensionality**: $64\text{ channels}$ (`A00` through `A63`).
- **Mathematical Property**: Embedding vectors are **unit-normalized** ($\|\mathbf{u}\|_2 = 1.0$). Consequently, the vector dot product equals the exact cosine similarity:
  $$\cos(\mathbf{u}, \mathbf{v}) = \sum_{k=0}^{63} u_k \cdot v_k$$
  The cosine distance (dissimilarity) is defined as:
  $$D_{\text{cosine}}(\mathbf{u}, \mathbf{v}) = 1 - \cos(\mathbf{u}, \mathbf{v}) = 1 - \sum_{k=0}^{63} u_k \cdot v_k$$
- **Pretraining**: Developed by Google DeepMind (Brown et al., 2025; arXiv:2507.22291). The model compresses multi-band optical and synthetic aperture radar (SAR) time series into fixed-length latent vectors.

### Supervised Classification Labels
- **Base Label Set**: ESA WorldCover 2021 ($10\text{m}$ resolution) covering 9 classes: Tree cover (10), Shrubland (20), Grassland (30), Cropland (40), Built-up (50), Bare / sparse vegetation (60), Permanent water bodies (80), Herbaceous wetland (90), Mangroves (95).
- **Spatial Blocking**: Saudi Arabia is stratified into 5-degree geographic blocks ($5^\circ \times 5^\circ$) to evaluate cross-regional spatial transferability.
- **Independent Visual Reference Sample**: 388 points manually scored by two independent remote sensing analysts from Very High Resolution (VHR) Google Earth historical imagery (`validation_scored.csv`).
- **Cropland Change Subtest**: 49 multi-temporal consensus points verified between 2017 and 2024 (`cropland_subtest_consensus.csv`).

---

## 3. Findings & Quantitative Results Analysis

### A. Spatially Blocked vs. Random Cross-Validation
| Evaluation Regime | Overall Accuracy (OA) | Macro F1 | Key Scientific Takeaway |
| :--- | :--- | :--- | :--- |
| **Full-Fit (Random Sample Split)** | **95.3%** | **0.884** | Heavily inflated by spatial autocorrelation between proximal training/testing pixels. |
| **Spatially Blocked Cross-Validation (5° Blocks)** | **81.5% ± 0.4%** | **0.700 ± 0.007** | **The true, scientifically defensible generalization performance** across unseen geographic blocks. |

> **Critical Scientific Distinction for TerraShift**:  
> The widely cited **$81.5\%$** figure is a **Land-Cover Classification Accuracy** under spatial block cross-validation, **NOT a change-detection accuracy**. It measures whether a pixel is correctly categorized into 1 of 9 land-cover classes in 2021. It must never be presented as TerraShift's change-detection precision or F1.

### B. Cosine-Similarity Change Screening & Threshold Sensitivity
In `scripts/06_screening.py` and `Table 2`, the authors evaluate how national land area is flagged as changed under varying cosine similarity thresholds between 2017 and 2024:

| Cosine Threshold ($\tau_{\text{sim}}$) | Equivalent Distance ($1 - \tau_{\text{sim}}$) | Flagged National Area (%) | Operational Characterization |
| :--- | :--- | :--- | :--- |
| $\tau = 0.95$ | $D = 0.05$ | $68.4\%$ | Extreme false alarm rate: natural desert drift is flagged as change. |
| $\tau = 0.90$ | $D = 0.10$ | $18.2\%$ | Moderate sensitivity; captures extensive bare-soil seasonal shifts. |
| **$\tau = 0.88$ (Paper Default)** | **$D = 0.12$** | **$7.4\%$** | **Optimal balance on consensus Cropland sub-test** (Fisher $p < 0.001$). |
| $\tau = 0.85$ | $D = 0.15$ | $3.1\%$ | High-confidence change screening; suppresses minor albedo shifts. |
| $\tau = 0.80$ | $D = 0.20$ | $0.8\%$ | Detects only catastrophic structural transitions (e.g. dense urban construction). |

### C. The Cropland Subtest Results
On the 49-point consensus cropland sub-test at $\tau = 0.88$:
- **Precision**: $76.9\%$ on agricultural pivot activation/deactivation.
- **Recall**: $83.3\%$.
- **Fisher's Exact Test**: $p = 0.0004$ (statistically significant distinction between changed and unchanged agricultural parcels).

---

## 4. Key Limitations of the Saudi AlphaEarth Study

1. **Screening Indicator vs. Change Detection Product**:  
   As explicitly acknowledged in `src/alphaearth/screening.py`:
   > *"The layer flags pixels whose 2017 and 2024 embedding vectors have diverged. It is a screening indicator, not a validated change product: no national precision or recall is estimated, and the only quantitative two-date assessment is restricted to the Cropland class."*
   The research does not provide polygon-level or event-level precision for urban construction, infrastructure, or coastal development.

2. **Embedding Drift on Natural Bare Ground**:  
   Hyper-arid sand dunes, calcrete plains, and gravel plains exhibit subtle embedding drift across multi-year intervals due to solar zenith differences and shifting sand textures. When evaluated with pure cosine distance, this creates significant background false alarms ($18.2\%$ of the country flagged at $\tau = 0.90$).

3. **Temporal Coarseness**:  
   AlphaEarth V1 provides **annual composites only**. It cannot resolve sub-annual, monthly, or seasonal dynamics (e.g. distinguishing a 3-week construction event from seasonal vegetation greening).

4. **WorldCover Class Inaccuracies**:  
   ESA WorldCover 2021 has known confusions in the Arabian Peninsula between calcrete limestone desert and low-density urban sprawl, which propagate into supervised classifiers trained directly on WorldCover labels.

---

## 5. Directly Reusable Components vs. TerraShift Enhancements

| Component | From 4IRSA / Manikandan et al. (2026) | TerraShift AI Implementation / Adaptation |
| :--- | :--- | :--- |
| **Earth Engine Mosaicing** | Server-side annual composite filtering and clipping (`gee/04_export_cosine_similarity.js`). | Reused in `services/ml/terrashift/acquisition/earth_engine.py` with bounding box windowing and memory safety guards. |
| **Cosine Dot-Product Calculation** | Vector dot-product on unit-normalized 64-D vectors. | Reused in `services/ml/terrashift/inference/alphaearth_change.py` as **Model A (Cosine-Distance Detector)**. |
| **Screening Threshold Baseline** | $\tau_{\text{sim}} = 0.88$ ($D_{\text{cosine}} \ge 0.12$). | Adopted as the empirical baseline for AlphaEarth cosine screening. |
| **Dynamic World Joint Analysis** | Not investigated in the paper. | **TerraShift Innovation (Model B)**: Combines AlphaEarth embeddings with Google Dynamic World (`GOOGLE/DYNAMICWORLD/V1`) class transitions. |
| **Physical Multispectral Guard** | Not used (embeddings treated as black-box features). | **TerraShift Innovation (Model D Hybrid)**: Combines AlphaEarth vector divergence with directional $\Delta\text{NDBI} \ge +0.04$ and $|\Delta\text{NDVI}| \ge 0.10$ to eliminate desert albedo drift. |
| **Evaluation Protocol** | Point-wise contingency on 49 cropland points. | **TerraShift Innovation**: Strict greedy 1-to-1 polygon event matching across 4 Saudi corridors ($91.19\text{ km}^2$) with 19 discrete ground-truth events. |

---

## 6. Attribution & Licensing Compliance

- **Dataset**: *Google AlphaEarth Foundations Satellite Embedding V1 Annual* is produced by Google and Google DeepMind, made available via Google Earth Engine under the Earth Engine Terms of Service for non-commercial academic research.
- **Codebase**: `4IRSA/alphaearth-saudi-landcover` is licensed under the Apache License 2.0 / MIT. All derived concepts and equations maintain explicit scholarly citation and attribution in TerraShift's codebase and documentation.
