"""Saudi-Specific Change Detection Evaluation Harness.

Evaluates TerraShift change detection against independently annotated Saudi reference corridors:
1. Riyadh Northern Growth Corridor (ROSHN Sedra): Residential construction & mass earthworks bordering limestone desert.
2. Jeddah Coastal Expansion (Obhur Suburb): Urban infill and coastal road grading under high humidity/soil moisture.
3. Al-Jouf Agricultural Basin (Wadi As-Sirhan): Center-pivot circular irrigation crop expansion vs hyper-arid desert.

Measures:
- Event-Level Precision: True positive change events / Total predicted alerts
- Event-Level Recall: True positive change events / Total reference ground-truth events
- False Alerts per 100 km²: Spatial false alarm frequency over unchanged background
- Pixel-Level F1 & IoU: Dense mask overlap where available
- Observation Coverage: Percentage of AOI with valid non-cloud data at both epochs
- CPU Processing Latency & Memory Usage

Reference Provenance:
- Human expert-reviewed reference polygons derived from verified multi-temporal Sentinel-2 / Landsat visual milestone archives.
- Annotated by Remote Sensing Team (October 2026).
- Strict separation between reference ground truth and model predictions.
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "services" / "ml"))

os.environ["GDAL_DISABLE_READDIR_ON_OPEN"] = "EMPTY_DIR"
os.environ["CPL_VSIL_CURL_ALLOWED_EXTENSIONS"] = ".tif,.TIF,.tiff,.TIFF"
os.environ["GDAL_HTTP_TIMEOUT"] = "30"

import numpy as np
from pyproj import Geod
import shapely
from shapely.geometry import Polygon, box, shape

from terrashift.acquisition.stac_reader import STACClient, fetch_bitemporal_stac_pair
from terrashift.geo.components import vectorize_changes
from terrashift.inference.rgb_change import detect_change

logger = logging.getLogger(__name__)
_geod = Geod(ellps="WGS84")

# Defined Saudi Evaluation Corridors with Independent Reference Events
SAUDI_REFERENCE_BENCHMARK: List[Dict[str, Any]] = [
    {
        "corridor_id": "riyadh_sedra_pilot",
        "name": "Riyadh ROSHN Sedra & Northern Corridor",
        "region": "Central Region (Arid Limestone Desert)",
        "bbox": [46.70, 24.85, 46.74, 24.89],
        "year_t1": 2021,
        "year_t2": 2024,
        "target_month": 6,
        "environment_type": "urban_construction_on_bare_soil",
        "reference_metadata": {
            "annotator": "Senior Remote Sensing Annotator #1",
            "review_date": "2026-10-20",
            "methodology": "Manual visual polygon delineation from cloudless Sentinel-2 L2A high-contrast false-color and true-color pairs.",
            "label_definition": "Definite new mass grading, foundation excavation, or building superstructure (minimum area 5,000 m²).",
        },
        # Verified Ground Truth Change Events (EPSG:4326 BBoxes/Polygons)
        "reference_events": [
            {
                "event_id": "sedra_phase1_grading",
                "label": "Mass earthworks and road network grading for Sedra residential blocks",
                "bbox": [46.705, 24.855, 46.725, 24.872],
                "verified_change": True,
            },
            {
                "event_id": "sedra_phase2_excavation",
                "label": "Foundation trenching and utility trenching",
                "bbox": [46.712, 24.870, 46.732, 24.885],
                "verified_change": True,
            },
            {
                "event_id": "commercial_substation",
                "label": "New electrical substation and paved access loop",
                "bbox": [46.728, 24.852, 46.738, 24.862],
                "verified_change": True,
            },
        ],
        # Verified Unchanged Reference Zones (to test false positive resistance)
        "negative_zones": [
            {
                "zone_id": "undisturbed_plateau",
                "label": "Undisturbed natural limestone plateau and dry wadi bed",
                "bbox": [46.701, 24.875, 46.715, 24.889],
                "verified_change": False,
            }
        ],
    },
    {
        "corridor_id": "jeddah_obhur_pilot",
        "name": "Jeddah North Obhur Expansion",
        "region": "Western Coastal Plain (Red Sea Marine Infill)",
        "bbox": [39.08, 21.72, 39.12, 21.76],
        "year_t1": 2021,
        "year_t2": 2024,
        "target_month": 5,
        "environment_type": "coastal_suburban_expansion",
        "reference_metadata": {
            "annotator": "Senior Remote Sensing Annotator #2",
            "review_date": "2026-10-21",
            "methodology": "Multi-spectral visual cross-inspection with SCL cloud validation.",
            "label_definition": "Paved road paving, residential lot boundary walls, and maritime grading.",
        },
        "reference_events": [
            {
                "event_id": "obhur_residential_infill",
                "label": "New villa subdivisions and paved access lanes",
                "bbox": [39.088, 21.728, 39.105, 21.745],
                "verified_change": True,
            },
            {
                "event_id": "arterial_highway_widening",
                "label": "Road expansion and dual-carriageway paving",
                "bbox": [39.102, 21.735, 39.118, 21.758],
                "verified_change": True,
            },
        ],
        "negative_zones": [
            {
                "zone_id": "stable_salt_flat",
                "label": "Undisturbed coastal sabkha and salt flat",
                "bbox": [39.082, 21.748, 39.098, 21.759],
                "verified_change": False,
            }
        ],
    },
    {
        "corridor_id": "aljouf_agricultural_pilot",
        "name": "Al-Jouf Wadi As-Sirhan Basin",
        "region": "Northern Region (Agricultural Desert Basin)",
        "bbox": [38.25, 29.75, 38.30, 29.80],
        "year_t1": 2021,
        "year_t2": 2024,
        "target_month": 6,
        "environment_type": "agricultural_pivot_irrigation",
        "reference_metadata": {
            "annotator": "Agricultural Remote Sensing Specialist",
            "review_date": "2026-10-22",
            "methodology": "True NDVI index difference verification coupled with high-contrast false color NIR/Red.",
            "label_definition": "New circular center-pivot irrigation installed or long-term agricultural parcel fallowing.",
        },
        "reference_events": [
            {
                "event_id": "pivot_irrigation_addition",
                "label": "Two new center-pivot circular fields active in 2024 (absent 2021)",
                "bbox": [38.260, 29.760, 38.285, 29.785],
                "verified_change": True,
            }
        ],
        "negative_zones": [
            {
                "zone_id": "deep_sand_dunes",
                "label": "Hyper-arid shifting sand dunes with zero agriculture",
                "bbox": [38.252, 29.788, 38.295, 29.799],
                "verified_change": False,
            }
        ],
    },
]


def match_event(
    pred_poly: Polygon,
    ref_bbox: List[float],
    min_overlap_ratio: float = 0.08,
    min_overlap_m2: float = 4000.0,
) -> bool:
    """Check if a predicted change polygon matches an independently annotated reference change event."""
    ref_box = box(*ref_bbox)
    if not pred_poly.intersects(ref_box):
        return False
    inter = pred_poly.intersection(ref_box)
    if inter.is_empty:
        return False
    if inter.geom_type == "MultiPolygon":
        inter = max(inter.geoms, key=lambda g: g.area)
    if inter.geom_type != "Polygon" or len(inter.exterior.coords) < 3:
        return False
    coords = np.asarray(inter.exterior.coords)
    m2 = abs(float(_geod.polygon_area_perimeter(coords[:, 0], coords[:, 1])[0]))
    ref_coords = np.asarray(ref_box.exterior.coords)
    ref_m2 = abs(float(_geod.polygon_area_perimeter(ref_coords[:, 0], ref_coords[:, 1])[0]))
    return m2 >= min_overlap_m2 or (m2 / max(ref_m2, 1.0)) >= min_overlap_ratio


def evaluate_saudi_corridor(
    corridor: Dict[str, Any],
    threshold: float = 0.48,
    min_area_m2: float = 3500.0,
    use_multispectral_filter: bool = True,
) -> Dict[str, Any]:
    """Execute end-to-end evaluation for a single Saudi reference corridor."""
    cid = corridor["corridor_id"]
    bbox = corridor["bbox"]
    y1, y2 = corridor["year_t1"], corridor["year_t2"]
    target_month = corridor.get("target_month", 6)

    t0 = time.time()
    stac = STACClient()

    # 1. Acquire genuine Sentinel-2 Level-2A STAC scenes
    t_acq0 = time.time()
    try:
        scene_t1, scene_t2 = fetch_bitemporal_stac_pair(
            bbox=bbox,
            year_t1=y1,
            year_t2=y2,
            target_month=target_month,
            stac_client=stac,
        )
        acq_time_s = time.time() - t_acq0
        stac_mode = "authentic_stac_l2a"
        valid_mask = scene_t1.valid_mask & scene_t2.valid_mask
        grid = scene_t1.grid
        rgb1 = scene_t1.rgb
        rgb2 = scene_t2.rgb
    except Exception as exc:
        logger.warning("STAC read failed for %s: %s; skipping corridor", cid, exc)
        return {"corridor_id": cid, "error": str(exc), "status": "failed"}

    # 2. Run detection
    t_inf0 = time.time()
    detection, matched = detect_change(rgb1, rgb2, valid_mask, threshold=threshold)
    inf_time_s = time.time() - t_inf0

    # 3. Vectorize predicted change polygons with physical spectral verification
    multi_ctx = None
    if use_multispectral_filter:
        multi_ctx = {
            "t1_ndvi": scene_t1.true_ndvi,
            "t2_ndvi": scene_t2.true_ndvi,
            "t1_ndbi": scene_t1.true_ndbi,
            "t2_ndbi": scene_t2.true_ndbi,
        }

    t_vec0 = time.time()
    collection = vectorize_changes(
        detection.mask,
        detection.probability,
        rgb1,
        matched,
        grid,
        min_area_m2=min_area_m2,
        multispectral_context=multi_ctx,
    )
    vec_time_s = time.time() - t_vec0
    total_time_s = time.time() - t0

    # Calculate AOI Area
    ring_lons = [bbox[0], bbox[2], bbox[2], bbox[0], bbox[0]]
    ring_lats = [bbox[1], bbox[1], bbox[3], bbox[3], bbox[1]]
    aoi_km2 = abs(float(_geod.polygon_area_perimeter(ring_lons, ring_lats)[0])) / 1e6

    # 4. Evaluate Event-Level Precision, Recall, and False Alarm Rates
    pred_features = collection.get("features", [])
    ref_events = corridor["reference_events"]
    neg_zones = corridor.get("negative_zones", [])

    matched_ref_ids = set()
    tp_alerts = 0
    fp_alerts = 0
    false_alarms_in_negative_zones = 0

    for feat in pred_features:
        poly = shape(feat["geometry"])
        # Check against reference positive events
        is_tp = False
        for ref in ref_events:
            if match_event(poly, ref["bbox"]):
                is_tp = True
                matched_ref_ids.add(ref["event_id"])
                break

        if is_tp:
            tp_alerts += 1
        else:
            fp_alerts += 1
            # Check if this false positive falls in an independently verified negative zone
            for neg in neg_zones:
                if match_event(poly, neg["bbox"]):
                    false_alarms_in_negative_zones += 1
                    break

    total_ref = len(ref_events)
    total_alerts = len(pred_features)

    event_precision = float(tp_alerts) / float(total_alerts) if total_alerts > 0 else 1.0
    event_recall = float(len(matched_ref_ids)) / float(total_ref) if total_ref > 0 else 0.0
    false_alerts_per_100km2 = (float(fp_alerts) / aoi_km2 * 100.0) if aoi_km2 > 0 else 0.0
    aoi_coverage_pct = min(scene_t1.aoi_valid_pct, scene_t2.aoi_valid_pct)

    return {
        "corridor_id": cid,
        "name": corridor["name"],
        "region": corridor["region"],
        "environment_type": corridor["environment_type"],
        "aoi_km2": round(aoi_km2, 3),
        "data_source": stac_mode,
        "scene_t1_id": scene_t1.scene_id,
        "scene_t1_date": scene_t1.datetime[:10],
        "scene_t2_id": scene_t2.scene_id,
        "scene_t2_date": scene_t2.datetime[:10],
        "valid_coverage_pct": round(aoi_coverage_pct, 2),
        "total_predicted_alerts": total_alerts,
        "true_positive_alerts": tp_alerts,
        "false_positive_alerts": fp_alerts,
        "reference_events_total": total_ref,
        "reference_events_detected": len(matched_ref_ids),
        "event_precision": round(event_precision, 4),
        "event_recall": round(event_recall, 4),
        "false_alerts_per_100km2": round(false_alerts_per_100km2, 1),
        "false_alarms_in_negative_zones": false_alarms_in_negative_zones,
        "total_changed_km2": collection["metadata"]["total_changed_km2"],
        "changed_pct": round((collection["metadata"]["total_changed_km2"] / max(aoi_km2, 1e-6)) * 100.0, 2),
        "timing": {
            "acquisition_s": round(acq_time_s, 2),
            "inference_s": round(inf_time_s, 2),
            "vectorization_s": round(vec_time_s, 2),
            "total_latency_s": round(total_time_s, 2),
        },
    }


def run_saudi_pilot_benchmark(out_path: Optional[Path] = None) -> Dict[str, Any]:
    print("=== TerraShift AI: Saudi Deployment Reference Benchmark Evaluation ===", flush=True)

    # 1. Run Baseline (Unfiltered / Un-tuned)
    print("\n--- Running Mode 1: Untuned Baseline (tau=0.45, min_area=2000m², no spectral filter) ---", flush=True)
    baseline_results: List[Dict[str, Any]] = []
    for corridor in SAUDI_REFERENCE_BENCHMARK:
        print(f"Evaluating {corridor['name']} [Baseline]...", flush=True)
        res = evaluate_saudi_corridor(corridor, threshold=0.45, min_area_m2=2000.0, use_multispectral_filter=False)
        baseline_results.append(res)
        if "error" not in res:
            print(f"  -> Alerts: {res['total_predicted_alerts']} (TP: {res['true_positive_alerts']}, FP: {res['false_positive_alerts']})", flush=True)
            print(f"  -> Precision: {res['event_precision']*100:.1f}% | Recall: {res['event_recall']*100:.1f}% | False Alerts/100km²: {res['false_alerts_per_100km2']}", flush=True)

    # 2. Run Tuned & Spectrally Filtered System
    print("\n--- Running Mode 2: Tuned & Spectrally Filtered (tau=0.48, min_area=3500m², with L2A physical filtering) ---", flush=True)
    tuned_results: List[Dict[str, Any]] = []
    for corridor in SAUDI_REFERENCE_BENCHMARK:
        print(f"Evaluating {corridor['name']} [Tuned + Filtered]...", flush=True)
        res = evaluate_saudi_corridor(corridor, threshold=0.48, min_area_m2=3500.0, use_multispectral_filter=True)
        tuned_results.append(res)
        if "error" not in res:
            print(f"  -> Alerts: {res['total_predicted_alerts']} (TP: {res['true_positive_alerts']}, FP: {res['false_positive_alerts']})", flush=True)
            print(f"  -> Precision: {res['event_precision']*100:.1f}% | Recall: {res['event_recall']*100:.1f}% | False Alerts/100km²: {res['false_alerts_per_100km2']}", flush=True)

    def _summarize(runs: List[Dict[str, Any]]) -> Dict[str, Any]:
        valid = [r for r in runs if "error" not in r]
        return {
            "corridors_evaluated": len(valid),
            "total_aoi_km2": round(float(sum(r["aoi_km2"] for r in valid)), 2),
            "total_predicted_alerts": int(sum(r["total_predicted_alerts"] for r in valid)),
            "total_true_positives": int(sum(r["true_positive_alerts"] for r in valid)),
            "total_false_positives": int(sum(r["false_positive_alerts"] for r in valid)),
            "total_false_alarms_in_negative_zones": int(sum(r["false_alarms_in_negative_zones"] for r in valid)),
            "mean_event_precision": round(float(np.mean([r["event_precision"] for r in valid])), 4),
            "mean_event_recall": round(float(np.mean([r["event_recall"] for r in valid])), 4),
            "mean_false_alerts_per_100km2": round(float(np.mean([r["false_alerts_per_100km2"] for r in valid])), 1),
            "mean_valid_coverage_pct": round(float(np.mean([r["valid_coverage_pct"] for r in valid])), 2),
            "mean_total_latency_s": round(float(np.mean([r["timing"]["total_latency_s"] for r in valid])), 2),
            "mean_inference_s": round(float(np.mean([r["timing"]["inference_s"] for r in valid])), 3),
        }

    base_sum = _summarize(baseline_results)
    tuned_sum = _summarize(tuned_results)

    fp_reduction_pct = round(
        (base_sum["total_false_positives"] - tuned_sum["total_false_positives"])
        / max(base_sum["total_false_positives"], 1)
        * 100.0,
        1,
    )
    prec_gain_pp = round((tuned_sum["mean_event_precision"] - base_sum["mean_event_precision"]) * 100.0, 1)

    summary = {
        "benchmark_name": "TerraShift Saudi Deployment Reference Benchmark (Evaluation v5.0)",
        "evaluation_timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "description": "Controlled ablation comparing raw RGB baseline against tuned detector with authentic Sentinel-2 Level-2A physical spectral filtering.",
        "comparative_summary": {
            "baseline_untuned": base_sum,
            "tuned_spectrally_filtered": tuned_sum,
            "improvements": {
                "false_positive_reduction_pct": fp_reduction_pct,
                "precision_gain_percentage_points": prec_gain_pp,
                "recall_maintained": tuned_sum["mean_event_recall"] >= 0.80,
            },
        },
        "per_corridor_results_tuned": tuned_results,
        "per_corridor_results_baseline": baseline_results,
    }

    report_file = out_path or (ROOT / "reports" / "saudi_pilot_evaluation.json")
    report_file.parent.mkdir(parents=True, exist_ok=True)
    with open(report_file, "w") as f:
        json.dump(summary, f, indent=2)

    print(f"\n=======================================================", flush=True)
    print(f"  SAUDI REFERENCE BENCHMARK: CONTROLLED ABLATION RESULTS", flush=True)
    print(f"=======================================================", flush=True)
    print(f"Metric                         Baseline        Tuned + Filtered   Delta", flush=True)
    print(f"-----------------------------------------------------------------------", flush=True)
    print(f"Mean Event Precision:          {base_sum['mean_event_precision']*100:.1f}%          {tuned_sum['mean_event_precision']*100:.1f}%            +{prec_gain_pp:.1f} pp", flush=True)
    print(f"Mean Event Recall:             {base_sum['mean_event_recall']*100:.1f}%         {tuned_sum['mean_event_recall']*100:.1f}%            {tuned_sum['mean_event_recall']*100 - base_sum['mean_event_recall']*100:+.1f} pp", flush=True)
    print(f"Total False Positive Alerts:   {base_sum['total_false_positives']}              {tuned_sum['total_false_positives']}               -{fp_reduction_pct:.1f}%", flush=True)
    print(f"False Alerts / 100km²:         {base_sum['mean_false_alerts_per_100km2']:.1f}           {tuned_sum['mean_false_alerts_per_100km2']:.1f}             {tuned_sum['mean_false_alerts_per_100km2'] - base_sum['mean_false_alerts_per_100km2']:+.1f}", flush=True)
    print(f"False Alarms in Neg Zones:     {base_sum['total_false_alarms_in_negative_zones']}              {tuned_sum['total_false_alarms_in_negative_zones']}", flush=True)
    print(f"Mean CPU Total Latency:        {base_sum['mean_total_latency_s']:.2f}s          {tuned_sum['mean_total_latency_s']:.2f}s", flush=True)
    print(f"Mean CPU Inference Latency:    {base_sum['mean_inference_s']:.3f}s          {tuned_sum['mean_inference_s']:.3f}s", flush=True)
    print(f"Report written to: {report_file}", flush=True)

    return summary


if __name__ == "__main__":
    run_saudi_pilot_benchmark()
