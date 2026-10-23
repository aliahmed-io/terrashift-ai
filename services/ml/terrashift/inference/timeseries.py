"""Multi-Year Time-Series Trajectory & Spatial Scenario Forecasting Engine.

Computes empirical expansion velocities across annual Sentinel-2 composites (2017-2024)
and evaluates linear trend extrapolation and morphological radial contagion scenarios.
"""

from __future__ import annotations

import base64
import io
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List

import numpy as np
from numpy.typing import NDArray
from PIL import Image
from pyproj import Geod
from scipy import ndimage

from terrashift.acquisition import tiles
from terrashift.inference.preprocessing import (
    EPS,
    bareness,
    greenness,
    match_statistics,
)
from terrashift.inference.rgb_change import detect_change

_geod = Geod(ellps="WGS84")
SAMPLE_YEARS = [2017, 2019, 2021, 2023, 2024]
FORECAST_YEARS = [2026, 2028, 2030]


def _to_base64_jpeg(rgb: NDArray[np.uint8], size: int = 180) -> str:
    img = Image.fromarray(rgb).resize((size, size), Image.Resampling.BILINEAR)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=84)
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/jpeg;base64,{encoded}"


def _ring_area_km2(ring: List[List[float]]) -> float:
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    return abs(float(_geod.polygon_area_perimeter(lons, lats)[0])) / 1e6


def run_timeseries_study(polygon: List[List[float]]) -> Dict[str, Any]:
    """Fetch multi-year Sentinel-2 composites, compute empirical change velocities,
    and generate linear trend extrapolation and morphological dilation scenarios.
    """
    ring = [list(p) for p in polygon]
    if ring[0] != ring[-1]:
        ring.append(ring[0])

    aoi_km2 = max(_ring_area_km2(ring), 0.1)
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    bbox = [min(lons), min(lats), max(lons), max(lats)]

    grid = tiles.plan_grid(bbox)
    valid = tiles.polygon_mask(ring, grid)
    if valid.sum() < 16:
        valid[:] = True
    valid_count = max(int(np.sum(valid)), 1)

    # Fetch annual composites in parallel threads
    def _fetch_year(y: int) -> NDArray[np.uint8]:
        return tiles.fetch_mosaic(y, grid)

    with ThreadPoolExecutor(max_workers=5) as pool:
        mosaics = list(pool.map(_fetch_year, SAMPLE_YEARS))

    base_rgb = mosaics[0]
    base_float = base_rgb.astype(np.float32) / 255.0

    observations: List[Dict[str, Any]] = []
    observed_km2_series: List[float] = []
    ndvi_series: List[float] = []
    ndbi_series: List[float] = []

    latest_mask = np.zeros_like(valid, dtype=bool)
    latest_prob = np.zeros(valid.shape, dtype=np.float32)

    for idx, (yr, rgb) in enumerate(zip(SAMPLE_YEARS, mosaics)):
        cur_float = rgb.astype(np.float32) / 255.0
        matched = match_statistics(cur_float, base_float, valid) if idx > 0 else base_float

        ndvi_map = greenness(matched)
        ndbi_map = bareness(matched)
        mean_ndvi = round(float(np.mean(ndvi_map[valid])), 3)
        mean_ndbi = round(float(np.mean(ndbi_map[valid])), 3)

        if idx == 0:
            changed_pct = 0.0
            changed_km2 = 0.0
        else:
            det, _ = detect_change(base_rgb, rgb, valid)
            changed_ratio = float(np.sum(det.mask)) / valid_count
            # Honest, unconstrained detection for this epoch
            changed_km2 = round(changed_ratio * aoi_km2, 3)
            changed_pct = round((changed_km2 / aoi_km2) * 100.0, 2)
            latest_mask = det.mask
            latest_prob = det.probability

        prev_val = observed_km2_series[-1] if observed_km2_series else 0.0
        dt_years = max(yr - (SAMPLE_YEARS[idx - 1] if idx > 0 else yr), 1)
        annual_velocity = round((changed_km2 - prev_val) / dt_years, 3)

        observed_km2_series.append(changed_km2)
        ndvi_series.append(mean_ndvi)
        ndbi_series.append(mean_ndbi)

        observations.append(
            {
                "year": yr,
                "changed_km2": changed_km2,
                "changed_pct": changed_pct,
                "annual_velocity_km2_yr": annual_velocity,
                "mean_ndvi": mean_ndvi,
                "mean_ndbi": mean_ndbi,
                "thumbnail_base64": _to_base64_jpeg(
                    (matched * 255.0).clip(0, 255).astype(np.uint8), 180
                ),
            }
        )

    # -------------------------------------------------------------------------
    # Annual Velocity Excursion Analysis (Empirical Breakpoint Heuristic)
    # -------------------------------------------------------------------------
    velocities = [obs["annual_velocity_km2_yr"] for obs in observations[1:]]
    max_vel_idx = int(np.argmax(velocities)) if velocities else 0
    breakpoint_year = SAMPLE_YEARS[max_vel_idx + 1]
    mean_vel = float(np.mean(velocities)) if velocities else 0.0
    max_vel = float(velocities[max_vel_idx]) if velocities else 0.0
    velocity_ratio = round(max_vel / (abs(mean_vel) + EPS), 2)

    breakpoint_info = {
        "breakpoint_year": breakpoint_year,
        "peak_velocity_km2_yr": round(max_vel, 3),
        "mean_velocity_km2_yr": round(mean_vel, 3),
        "velocity_ratio": velocity_ratio,
        "acceleration_detected": bool(velocity_ratio > 1.35),
        "dominant_driver": (
            "Vegetation Clearing / Canopy Loss (ΔNDVI Drop)"
            if (ndvi_series[-1] - ndvi_series[0]) < -0.02
            else "Urban & Impervious Surface Expansion (ΔNDBI Surge)"
        ),
        "metric_type": "Annual expansion velocity peak-to-mean ratio across 5 sampled Sentinel-2 epochs",
        "disclaimer": "This is an empirical annual velocity ratio across discrete epochs. It is NOT a continuous daily OLS-MOSUM significance test.",
    }

    # -------------------------------------------------------------------------
    # Linear Trend Regression & Prediction Error Envelopes
    # -------------------------------------------------------------------------
    years_arr = np.array(SAMPLE_YEARS, dtype=np.float64)
    y_arr = np.array(observed_km2_series, dtype=np.float64)
    slope, intercept = np.polyfit(years_arr, y_arr, 1)

    # Calculate real regression residual standard error
    residuals = y_arr - (slope * years_arr + intercept)
    dof = max(len(years_arr) - 2, 1)
    s_err = float(np.sqrt(np.sum(residuals ** 2) / dof))
    mean_year = float(np.mean(years_arr))
    ss_years = float(np.sum((years_arr - mean_year) ** 2)) + EPS

    forecasts: List[Dict[str, Any]] = []
    last_km2 = observed_km2_series[-1]
    last_year = SAMPLE_YEARS[-1]

    for fy in FORECAST_YEARS:
        dt = fy - last_year
        proj_km2 = min(round(last_km2 + slope * dt, 3), round(aoi_km2, 3))
        proj_km2 = max(proj_km2, 0.0)
        proj_pct = round((proj_km2 / aoi_km2) * 100.0, 2)

        # Standard statistical prediction standard error
        se_pred = s_err * np.sqrt(1.0 + 1.0 / len(years_arr) + ((fy - mean_year) ** 2) / ss_years)
        ci_band = round(float(1.96 * se_pred), 3)

        forecasts.append(
            {
                "year": fy,
                "projected_km2": proj_km2,
                "projected_pct": proj_pct,
                "lower_prediction_interval_km2": max(round(proj_km2 - ci_band, 3), 0.0),
                "upper_prediction_interval_km2": min(round(proj_km2 + ci_band, 3), aoi_km2),
            }
        )

    # -------------------------------------------------------------------------
    # Spatial Expansion Scenario Map (Iterative Radial Morphological Dilation)
    # -------------------------------------------------------------------------
    dilated_2028 = ndimage.binary_dilation(latest_mask, iterations=3) & valid & (~latest_mask)
    dilated_2030 = (
        ndimage.binary_dilation(latest_mask, iterations=6)
        & valid
        & (~latest_mask)
        & (~dilated_2028)
    )
    risk_map = np.zeros(valid.shape, dtype=np.float32)
    risk_map[latest_mask] = 0.45
    risk_map[dilated_2028] = 0.78
    risk_map[dilated_2030] = 0.98
    risk_map = np.maximum(risk_map, latest_prob * 0.4)

    pil_risk = Image.fromarray((np.clip(risk_map, 0.0, 1.0) * 100.0).astype(np.uint8)).resize(
        (48, 48), Image.Resampling.NEAREST
    )
    forecast_grid = np.asarray(pil_risk, dtype=int).tolist()

    return {
        "aoi_km2": round(aoi_km2, 2),
        "observations": observations,
        "bfast_breakpoint": breakpoint_info,
        "forecasts": forecasts,
        "regression_slope_km2_yr": round(float(slope), 4),
        "residual_standard_error_km2": round(s_err, 4),
        "forecast_grid": forecast_grid,
        "projection_model": "Ordinary Least Squares linear extrapolation with standard prediction error envelope",
        "scenario_disclaimer": "2026-2030 projections are exploratory morphological scenarios assuming continuation of historical baseline trends. They do not model policy, macroeconomic, or developer phasing shifts.",
    }
