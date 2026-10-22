# TerraShift AI — Baseline ($M_0$) Execution & Reproduction Guide

This guide provides the exact commands, environment configuration, and verification steps to reproduce and run the baseline system ($M_0$) prior to model upgrades.

---

## 1. System Enhancement Brief

**Summary:**  
Provides standardized, reproducible commands to set up, build, test, and serve both the Python FastAPI geospatial microservice and the Next.js 16/MapLibre web interface, establishing the frozen baseline ($M_0$) verification protocol.

**Impact:**  
- **Reproducibility:** Eliminates environmental guesswork and guarantees examiners can verify baseline test runs and weight tensors.  
- **Test Integrity:** Documents exact working directories and CLI flags for zero-failure pytest, vitest, typecheck, and lint runs.  
- **Zero-Key Verification:** Validates that the entire baseline operates without mandatory paid API keys.

**Technical Changes:**  
1. Added root-level and service-level test execution procedures.  
2. Codified weight tensor inspection commands for forensic checkpoint verification.

**Performance / UX Metric to Monitor:**  
Zero test failures and clean build exit codes across all test environments.

---

## 2. Environment Prerequisites

- **Node.js:** v20.x or v22.x
- **Python:** v3.12.x
- **Package Managers:** npm, pip (within virtual environment)
- **Git Branch:** `baseline-freeze`

---

## 3. Verification of Existing Test Suites

Run these commands from the repository root (`d:\terrashift-ai`):

### A. Python ML Microservice Test Suite (21 Tests)
The Python virtual environment is located at `services/ml/.venv`. To run pytest with correct `PYTHONPATH`:

```powershell
# From services/ml directory:
cd services/ml
& ".\.venv\Scripts\python.exe" -m pytest
cd ../..
```
*Expected Result:*
```
21 passed, 1 warning in ~21s
```

### B. Frontend Vitest Suite (8 Tests)
```powershell
npm --prefix apps/web run test
```
*Expected Result:*
```
Test Files  2 passed (2)
     Tests  8 passed (8)
```

### C. TypeScript Typecheck
```powershell
npm --prefix apps/web run typecheck
```
*Expected Result:* Clean exit (code 0) with zero type errors.

### D. ESLint Suite
```powershell
npm --prefix apps/web run lint
```
*Expected Result:* Clean exit (code 0) with `--max-warnings=0`.

### E. Next.js Production Build
```powershell
npm --prefix apps/web run build
```
*Expected Result:* `▲ Next.js 16.3.8 (Turbopack)` compiles in ~8s with 17 static and 8 dynamic routes.

---

## 4. Checkpoint $M_0$ Inspection Command

To inspect the PyTorch checkpoint weights, parameters, and BatchNorm batch history:

```powershell
& ".\services\ml\.venv\Scripts\python.exe" -c @"
import torch
ckpt = torch.load('services/ml/terrashift/models/siamese_unet_checkpoint.pt', map_location='cpu')
print('Architecture:', ckpt.get('architecture'))
print('Parameters:', ckpt.get('parameters'))
sd = ckpt['state_dict']
bn_batches = {sd[k].item() for k in sd if 'num_batches_tracked' in k}
print('BatchNorm num_batches_tracked across all layers:', bn_batches)
"@
```
*Expected Output:*
```
Architecture: SiameseUNet-5Ch
Parameters: 2102145
BatchNorm num_batches_tracked across all layers: {0}
```

---

## 5. Running the Application Locally

### Terminal 1: Python FastAPI ML Microservice
```powershell
cd services/ml
& ".\.venv\Scripts\python.exe" -m uvicorn terrashift.api.main:app --host 127.0.0.1 --port 8000 --reload
```
- Health Check: `http://127.0.0.1:8000/healthz`
- Swagger Docs: `http://127.0.0.1:8000/docs`

### Terminal 2: Next.js Frontend
```powershell
npm --prefix apps/web run dev
```
- Web Application: `http://localhost:3000`
- Active Routes:
  - `/` — Command Deck & Corridor switcher
  - `/analyze` — Live Polygon Change Detection
  - `/benchmarks` — Model Benchmark Comparison
  - `/timeline` — Trajectory & Breakpoint Analysis
  - `/lab` — Image-Pair Sandbox
  - `/carbon` — Carbon Flux & Urban Heat
  - `/watchlist` — Monitored AOI Ledger
