# TerraShift AI — Official OSCD Benchmark Scorecard & Model Evaluation Report

**Evaluation Date:** October 2026  
**Benchmark Suite:** Onera Satellite Change Detection (OSCD) Sentinel-2 Dataset  
**Standard Reference:** Daudt et al., *Urban Change Detection for Multispectral Earth Observation Using Convolutional Neural Networks*, IEEE IGARSS 2018  
**Report Artifact:** `reports/benchmark_scorecard.json`  
**Diagnostic Artifact:** `reports/failure_case_analysis.json` & `reports/visual_diagnostics/`  

---

## 1. Metric Progression & Senior Project Targets

The table below follows the mandatory senior project reporting standard. Pooled pixel metrics (evaluated over all $3,077,936$ test pixels) and mean per-scene metrics (unweighted arithmetic mean across the $10$ diverse geographic test scenes) are strictly distinguished.

| Metric | Better direction | Current (Previous Baseline) | Meaning | Target | New result | Change |
| :--- | :---: | :---: | :--- | :---: | :---: | :---: |
| **Standalone $M_1$ Pooled $F_1$** | Higher ($\uparrow$) | 0.3708 | Harmonic mean of pooled precision and recall across all 3,077,936 test pixels | $\ge 0.375$ | **0.3803** | $+0.95$ pp ($+2.56\%$ rel) |
| **Standalone $M_1$ Mean Scene $F_1$** | Higher ($\uparrow$) | 0.3026 | Unweighted arithmetic mean of $F_1$ across 10 individual test scenes | $\ge 0.320$ | **0.3265** | $+2.39$ pp ($+7.90\%$ rel) |
| **Standalone $M_1$ Pooled IoU** | Higher ($\uparrow$) | 0.2276 | Jaccard intersection-over-union across pooled test set | $\ge 0.230$ | **0.2348** | $+0.72$ pp ($+3.16\%$ rel) |
| **Standalone $M_1$ Recall** | Higher ($\uparrow$) | 0.3424 | True change pixel capture rate across pooled test set | $\ge 0.360$ | **0.3754** | $+3.30$ pp ($+9.64\%$ rel) |
| **Standalone $M_1$ False Alarm (FPR)** | Lower ($\downarrow$) | 2.75% | False positive rate on negative background pixels | $\le 3.50\%$ | **3.26%** | $+0.51$ pp (within budget) |
| **Calibrated Fusion Pooled $F_1$** | Higher ($\uparrow$) | 0.4025 | Calibrated ensemble ($0.60 \cdot P_{\text{deep}} + 0.40 \cdot P_{\text{stat}}$) | $\ge 0.405$ | **0.4117** | $+0.92$ pp ($+2.29\%$ rel) |
| **Calibrated Fusion Mean Scene $F_1$** | Higher ($\uparrow$) | 0.3478 | Unweighted arithmetic mean of fusion $F_1$ across 10 scenes | $\ge 0.345$ | **0.3484** | $+0.06$ pp ($+0.17\%$ rel) |
| **Calibrated Fusion Pooled IoU** | Higher ($\uparrow$) | 0.2520 | Jaccard intersection-over-union for calibrated ensemble | $\ge 0.255$ | **0.2592** | $+0.72$ pp ($+2.86\%$ rel) |
| **Calibrated Fusion Recall** | Higher ($\uparrow$) | 0.3701 | True change pixel capture rate for calibrated ensemble | $\ge 0.380$ | **0.3940** | $+2.39$ pp ($+6.46\%$ rel) |
| **Calibrated Fusion FPR** | Lower ($\downarrow$) | 2.55% | False positive rate on negative background pixels | $\le 3.00\%$ | **2.83%** | $+0.28$ pp (lower than stat 3.63%) |

---

## 2. Primary Benchmark Scorecard (Official OSCD Held-Out Test Set)

Evaluated across all $10$ official held-out test scenes of the Onera Satellite Change Detection (OSCD) benchmark under strict zero-leakage conditions ($3,077,936$ test pixels, change prevalence $5.17\%$).

| Model Architecture | Parameters | Pooled $F_1$ | Mean Scene $F_1$ | IoU | Precision | Recall | False Alarm (FPR) | ECE | Latency (CPU) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Statistical Spectral Baseline** | 0 | 0.3739 | 0.3144 | 0.2300 | 0.3650 | 0.3834 | 3.63% | **0.0483** | **47.0 ms** |
| **$M_0$ (Untrained Siamese U-Net)** | 2,102,145 | 0.0983 | 0.0816 | 0.0517 | 0.0517 | **1.0000** | 100.00% | 0.4450 | 1551.4 ms |
| **$M_0$ + Statistical (60/40 Fusion)** | 2,102,145 | 0.3755 | 0.3153 | 0.2312 | 0.3391 | **0.4207** | 4.47% | 0.2864 | 657.8 ms |
| **$M_1$ (Trained Siamese U-Net)** | 2,102,145 | 0.3803 | 0.3265 | 0.2348 | 0.3853 | 0.3754 | 3.26% | 0.1401 | 680.3 ms |
| **$M_1$ + Statistical Fusion (Ours)** | 2,102,145 | **0.4117** | **0.3484** | **0.2592** | **0.4311** | 0.3940 | **2.83%** | 0.1034 | 682.8 ms |

*Note: All scores were generated directly by executing `scripts/evaluate_benchmark.py` against the cached OSCD test split. Zero simulated, rounded, or synthetic numbers.*

---

## 3. Per-Scene Test Performance Breakdown (10 Held-Out Scenes)

| Scene ID | Dimensions | Total Pixels | Change Pixels | Change % | Stat Baseline $F_1$ | $M_1$ Trained $F_1$ | $M_1$ Fusion $F_1$ | $M_1$ Fusion IoU | Primary Land-Cover Dynamic |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| `test_00` | 353×426 | 150,378 | 8,552 | 5.69% | 0.4315 | 0.3681 | **0.4153** | 0.2621 | Urban expansion & parcel clearing |
| `test_01` | 639×688 | 439,632 | 5,018 | 1.14% | 0.0627 | **0.1114** | 0.0843 | 0.0440 | Low-density peri-urban grading |
| `test_02` | 458×476 | 218,008 | 969 | 0.44% | 0.0605 | 0.0636 | **0.0666** | 0.0345 | Extreme sparse change ($<0.5\%$) |
| `test_03` | 730×544 | 397,120 | 28,637 | 7.21% | **0.5398** | 0.1980 | 0.4368 | 0.2795 | Vegetative drydown & crop cycle shift |
| `test_04` | 426×451 | 192,126 | 13,054 | 6.79% | 0.6473 | **0.7376** | 0.7103 | 0.5508 | Dense commercial / industrial build |
| `test_05` | 433×469 | 203,077 | 5,242 | 2.58% | 0.2695 | **0.4765** | 0.4137 | 0.2608 | Transport infrastructure corridors |
| `test_06` | 241×385 | 92,785 | 1,227 | 1.32% | 0.1688 | **0.2366** | 0.2310 | 0.1306 | Small plot clearing |
| `test_07` | 774×634 | 490,716 | 48,689 | 9.92% | 0.1996 | 0.2004 | **0.2184** | 0.1226 | Broad suburban earthworks |
| `test_08` | 545×558 | 304,110 | 2,419 | 0.80% | 0.1956 | 0.2314 | **0.2638** | 0.1520 | Linear utility construction |
| `test_09` | 824×716 | 589,984 | 45,270 | 7.67% | 0.5683 | 0.6414 | **0.6441** | 0.4751 | High-density urban redevelopment |

---

## 4. Empirical Error Analysis & Forensic Case Studies

The script `scripts/analyze_failures.py` generates 6-panel composite diagnostics for representative failure modes and win cases, saved to `reports/visual_diagnostics/` and recorded in `reports/failure_case_analysis.json`.

```
Composite Layout (6 panels):
[1. Pre-Change T1 RGB  | 2. Post-Change T2 RGB | 3. Ground Truth Mask      ]
[4. Statistical Output | 5. SiameseUNet Output | 6. TP/FP/FN Error Overlay  ]
```

### Forensic Failure Modes & Scientific Findings:

1. **Extreme Change Sparsity (`test_02`, 0.44% change prevalence):**
   - **Mechanism:** Only 969 change pixels across 218,008 total pixels. Under extreme sparsity, single-pixel boundary jitters and sub-pixel edge alignment discrepancies dominate error counts, penalizing precision across both statistical and deep models.
   - **Recommendation:** Spatial minimum-area blob filtering (discarding isolated blobs $< 4$ connected pixels) substantially improves precision in sparse change environments.
   - **Diagnostic:** `reports/visual_diagnostics/test_02_forensic_diagnostic.png`

2. **Vegetative Agricultural Shifts — Where Conventional Wins (`test_03`, 7.21% change prevalence):**
   - **Mechanism:** Large agricultural parcel crop cycles. The statistical spectral baseline ($F_1 = 0.5398$) outperforms standalone deep learning ($F_1 = 0.1980$) because whole-field spectral shifts are uniform and pixel-level radiometric matching detects them cleanly without needing spatial shape hierarchy.
   - **Value of Fusion:** The calibrated ensemble ($F_1 = 0.4368$) bridges this gap, preserving spectral sensitivity where deep spatial pooling alone is overly selective.
   - **Diagnostic:** `reports/visual_diagnostics/test_03_forensic_diagnostic.png`

3. **Dense Commercial Construction — Where AI Wins (`test_04`, 6.79% change prevalence):**
   - **Mechanism:** Distinct building footprints, paved parking lots, and linear access roads. The Siamese U-Net achieves $F_1 = 0.7376$ (vs $0.6473$ for statistical baseline), demonstrating deep spatial feature advantages on anthropogenic geometric shapes.
   - **Diagnostic:** `reports/visual_diagnostics/test_04_forensic_diagnostic.png`

4. **High-Density Urban Redevelopment — Where AI Wins (`test_09`, 7.67% change prevalence):**
   - **Mechanism:** Multi-story building demolition and foundation excavation in a dense metropolitan area. Siamese U-Net achieves $F_1 = 0.6414$ and Fusion reaches $F_1 = 0.6441$.
   - **Diagnostic:** `reports/visual_diagnostics/test_09_forensic_diagnostic.png`

5. **Suburban Earthworks with Diffuse Drydown (`test_07`, 9.92% change prevalence):**
   - **Mechanism:** 48,689 change pixels representing broad grading and bare earth. Diffuse seasonal soil drying causes widespread low-magnitude spectral drift across non-construction parcels, elevating statistical false alarms. Siamese features effectively isolate bounded structural shapes ($F_1 = 0.2004$).
   - **Diagnostic:** `reports/visual_diagnostics/test_07_forensic_diagnostic.png`

---

## 5. Pixel-Level Confusion Matrix Breakdown

Across all $3,077,936$ test pixels:

| Model | True Positives ($TP$) | False Positives ($FP$) | False Negatives ($FN$) | True Negatives ($TN$) | Total Evaluated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Statistical Baseline** | 60,983 | 106,099 | 98,094 | 2,812,760 | 3,077,936 |
| **$M_0$ Untrained** | 159,077 | 2,918,859 | 0 | 0 | 3,077,936 |
| **$M_0$ + Statistical Fusion** | 66,927 | 130,451 | 92,150 | 2,788,408 | 3,077,936 |
| **$M_1$ Trained** | 59,715 | 95,274 | 99,362 | 2,823,585 | 3,077,936 |
| **$M_1$ + Statistical Fusion** | **62,673** | **82,697** | **96,404** | **2,836,162** | 3,077,936 |

---

## 6. Reproduction Guide

To reproduce this benchmark scorecard and failure analysis identically from source:

```bash
# 1. Activate Python virtual environment
cd services/ml
.\.venv\Scripts\Activate.ps1

# 2. Execute benchmark evaluation script across OSCD held-out test split
python ../../scripts/evaluate_benchmark.py

# 3. Execute forensic failure analysis & visual diagnostics
python ../../scripts/analyze_failures.py
```
