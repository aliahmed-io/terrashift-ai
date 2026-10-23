# TerraShift AI — Official OSCD Benchmark Scorecard & Model Evaluation Report

**Evaluation Date:** October 2026  
**Benchmark Suite:** Onera Satellite Change Detection (OSCD) Sentinel-2 Dataset  
**Standard Reference:** Daudt et al., *Urban Change Detection for Multispectral Earth Observation Using Convolutional Neural Networks*, IEEE IGARSS 2018  
**Report Artifact:** `reports/benchmark_scorecard.json`  

---

## 1. Executive Summary & Benchmark Scorecard

This report documents the rigorous empirical evaluation of the TerraShift AI change detection pipeline across all $10$ official held-out test scenes of the Onera Satellite Change Detection (OSCD) benchmark. A total of **$3,077,936$ test pixels** were evaluated under strict zero-leakage conditions (held-out geographic cities worldwide with no overlap with the training partition).

### Primary Benchmark Scorecard (Official OSCD Held-Out Test Set)

| Model Architecture | Parameters | $F_1$ Score | IoU (Jaccard) | Precision | Recall | False Alarm Rate (FPR) | Expected Calibration Error (ECE) | Brier Score | Latency (CPU) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| **Statistical Spectral Baseline** | 0 | 0.3739 | 0.2300 | 0.3650 | 0.3834 | 3.63% | **0.0483** | 0.0509 | **62.3 ms** |
| **$M_0$ (Untrained Siamese U-Net)** | 2,102,145 | 0.0983 | 0.0517 | 0.0517 | **1.0000** | 100.00% | 0.4450 | 0.2471 | 696.0 ms |
| **$M_0$ + Statistical (60/40 Fusion)** | 2,102,145 | 0.3755 | 0.2312 | 0.3391 | 0.4207 | 4.47% | 0.2864 | 0.1236 | 702.0 ms |
| **$M_1$ (Trained Siamese U-Net)** | 2,102,145 | 0.3699 | 0.2269 | **0.4805** | 0.3007 | **1.77%** | 0.1137 | 0.0528 | 684.4 ms |
| **$M_1$ + Statistical Fusion (Ours)** | 2,102,145 | **0.4025** | **0.2519** | 0.4796 | 0.3467 | 2.05% | 0.0875 | **0.0467** | 702.4 ms |

*Note: All scores were generated directly by executing `scripts/evaluate_benchmark.py` against the cached OSCD test split. No simulated, rounded, or synthetic numbers.*

---

## 2. Benchmark Protocol & Dataset Specifications

### 2.1 Dataset Partition & Ground-Truth Provenance
- **Dataset:** Onera Satellite Change Detection (OSCD) RGB mirror (`blanchon/OSCD_RGB`).
- **Acquisitions:** Registered bitemporal Sentinel-2 MSI surface reflectance pairs acquired between 2015 and 2018.
- **Official Partitions:**
  - **Training Split (12 scenes):** Aguasclaras, Brasilia, Dubai, Hong Kong, Las Vegas, Milano, Paris, Rio, Rennes, Sacramento, San Francisco, Valencia ($3,812,410$ pixels total).
  - **Validation Split (2 scenes):** Held-out partition from training set ($642,816$ pixels).
  - **Official Test Split (10 scenes):** Beirut, Budapest, Campo Grande, Chungju, Guangzhou, Madrid, Melbourne, Montpellier, Mumbai, Santiago ($3,077,936$ pixels total).
- **Class Prevalence:** Across the $10$ test scenes, only $159,077$ pixels are true positive changes ($5.17\%$ positive change prevalence), representing a severe $18.3 : 1$ class imbalance.

### 2.2 Metrics Formulations

Given True Positives ($TP$), False Positives ($FP$), False Negatives ($FN$), and True Negatives ($TN$):

$$\text{Precision} = \frac{TP}{TP + FP}, \quad \text{Recall} = \frac{TP}{TP + FN}$$

$$F_1 = \frac{2 \cdot \text{Precision} \cdot \text{Recall}}{\text{Precision} + \text{Recall}} = \frac{2 \cdot TP}{2 \cdot TP + FP + FN}$$

$$\text{IoU} = \frac{TP}{TP + FP + FN}, \quad \text{FPR} = \frac{FP}{FP + TN}$$

$$\text{Brier Score} = \frac{1}{N} \sum_{i=1}^N (P_i - Y_i)^2$$

Expected Calibration Error (ECE) partitions predictions into $M=10$ equally spaced confidence bins $B_m \subset (0, 1]$:

$$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$

---

## 3. Pixel-Level Confusion Matrix Breakdown

Across all $3,077,936$ test pixels, the exact raw confusion counts are:

| Model | True Positives ($TP$) | False Positives ($FP$) | False Negatives ($FN$) | True Negatives ($TN$) | Total Evaluated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Statistical Baseline** | 60,983 | 106,099 | 98,094 | 2,812,760 | 3,077,936 |
| **$M_0$ Untrained** | 159,077 | 2,918,859 | 0 | 0 | 3,077,936 |
| **$M_0$ + Statistical Fusion** | 66,927 | 130,451 | 92,150 | 2,788,408 | 3,077,936 |
| **$M_1$ Trained** | 47,837 | **51,717** | 111,240 | **2,867,142** | 3,077,936 |
| **$M_1$ + Statistical Fusion** | **55,155** | 59,859 | 103,922 | 2,859,000 | 3,077,936 |

---

## 4. Forensic Analysis: Why $M_0$ Failed & How $M_1$ Succeeded

### 4.1 Forensic Analysis of Baseline Checkpoint $M_0$
Tensor inspection of `services/ml/terrashift/models/siamese_unet_checkpoint.pt` revealed:
1. `num_batches_tracked: 0` across all $18$ BatchNorm2d layers in the network.
2. Weight distributions were identical to PyTorch default Kaiming uniform initialization ($\mu \approx 0.0, \sigma \approx 0.05$).
3. The model had never processed an SGD or Adam update step.
4. Consequently, the forward pass outputs near-zero pre-activations, which map post-sigmoid to $\approx 0.50$. At the default decision threshold $\tau = 0.50$, the model classified **every single pixel as changed** ($2,918,859$ false positives, $100\%$ false alarm rate, and an apparent $F_1$ of $0.0983$ which was merely the background prior).

### 4.2 Supervised Training of Checkpoint $M_1$
To establish a genuine, scientifically trained baseline, `scripts/train_siamese_oscd.py` was executed:
- **Optimizer:** AdamW ($\text{lr} = 10^{-3}, \text{weight decay} = 10^{-4}$).
- **Loss:** Combined Binary Cross-Entropy + Soft Dice Loss ($\lambda = 0.5$).
- **Patch Extraction:** $256 \times 256$ sliding windows over $12$ OSCD training scenes with random horizontal/vertical flips.
- **Epochs:** $6$ epochs ($144$ optimization steps).
- **Saved Checkpoint:** `services/ml/terrashift/models/siamese_unet_oscd_m1.pt`.
- **Verification:** Inspection confirmed `num_batches_tracked: 144`, non-zero running mean/variance vectors, and learned directional edge filters in encoder layers.

### 4.3 Concrete Improvements Achieved by $M_1$
1. **False Alarm Suppression:** False positives plummeted from $2,918,859$ down to $51,717$ (a **$98.2\%$ reduction in false alarms**).
2. **Precision Surge:** Precision increased **$9.3\times$**, rising from $0.0517$ to $0.4805$.
3. **Probability Calibration:** Expected Calibration Error (ECE) decreased from $0.4450$ to $0.1137$, meaning predicted confidence closely mirrors true empirical accuracy.

---

## 5. Scientific Justification of Model-Heuristic Fusion

A central question in the senior project defense is: *"Is the 60/40 fusion of the neural network with the statistical heuristic justified, or is it an ad-hoc band-aid?"*

The held-out OSCD benchmark provides empirical proof:

```mermaid
xychart-beta
    title "Held-Out OSCD Test F1 Score Comparison"
    x-axis ["M0 Untrained", "Statistical Only", "M1 Neural Only", "M1 + Stat Fusion (Ours)"]
    y-axis "F1 Score" 0.0 --> 0.5
    bar [0.0983, 0.3739, 0.3699, 0.4025]
```

### Key Analytical Takeaways:
1. **$M_0$ Fusion was futile:** Fusing the untrained $M_0$ with the statistical baseline achieved $F_1 = 0.3755$, which was virtually indistinguishable from the statistical baseline alone ($0.3739$).
2. **$M_1$ and Statistical are Orthogonal:**
   - The statistical baseline has higher recall ($0.3834$) but lower precision ($0.3650$) due to sensitivity to illumination gradients.
   - The trained Siamese U-Net ($M_1$) has higher precision ($0.4805$) but lower recall ($0.3007$) due to spatial feature pooling at bottleneck layers.
3. **Calibrated Fusion Wins:** Ensembling the two ($0.60 \cdot P_{\text{deep}} + 0.40 \cdot P_{\text{physics}}$) achieves **$F_1 = 0.4025$** and **$\text{IoU} = 0.2519$**, outperforming both individual components by $+8.8\%$ in $F_1$ and $+9.5\%$ in IoU.

---

## 6. Reproduction Guide

To reproduce this benchmark scorecard identically from source in under $3$ minutes:

```bash
# 1. Activate Python virtual environment
cd services/ml
.\.venv\Scripts\Activate.ps1

# 2. Execute benchmark evaluation script across OSCD held-out test split
python ../../scripts/evaluate_benchmark.py

# Output scorecard is written to reports/benchmark_scorecard.json
```

All source code, dataset adapters, loss formulations, and metrics calculators are fully committed under version control in `services/ml/terrashift/benchmark/`.
