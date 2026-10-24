"""Generate high-resolution satellite visual plates and quantitative charts for the 100-page Senior Project Report.

Produces 6 publication-grade PNG figures in `reports/senior_project/figures/` using:
- Authentic Copernicus Sentinel-2 Level-2A surface reflectance (RGB, NDVI, NDBI) from AWS Earth Search STAC
- Authentic Google AlphaEarth 64-D annual embeddings ('GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL') from GEE cache
- Verified multi-model benchmark results from `reports/saudi_pilot_evaluation.json`
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "services" / "ml"))

os.environ["GDAL_DISABLE_READDIR_ON_OPEN"] = "EMPTY_DIR"
os.environ["CPL_VSIL_CURL_ALLOWED_EXTENSIONS"] = ".tif,.TIF,.tiff,.TIFF"
os.environ["GDAL_HTTP_TIMEOUT"] = "30"

import matplotlib
matplotlib.use("Agg")
import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

from terrashift.acquisition.earth_engine import EarthEngineManager
from terrashift.acquisition.stac_reader import STACClient, fetch_bitemporal_stac_pair
from terrashift.inference.alphaearth_change import (
    compute_cosine_distance,
    detect_alphaearth_hybrid,
)
from terrashift.inference.rgb_change import detect_change
from scripts.saudi_evaluation import SAUDI_REFERENCE_BENCHMARK

FIG_DIR = ROOT / "reports" / "senior_project" / "figures"
FIG_DIR.mkdir(parents=True, exist_ok=True)


def _enhance_rgb(rgb: np.ndarray) -> np.ndarray:
    """Apply gentle 2nd-98th percentile contrast stretch for crisp cartographic visualization."""
    arr = rgb.astype(np.float32) / 255.0
    p2, p98 = np.percentile(arr, (2, 98))
    if p98 > p2:
        arr = np.clip((arr - p2) / (p98 - p2), 0.0, 1.0)
    return np.power(arr, 0.92)


def _bbox_to_pixel_rect(sub_bbox: list[float], aoi_bbox: list[float], shape: tuple[int, int]) -> tuple[float, float, float, float]:
    """Convert a WGS84 [w, s, e, n] box to (x, y, width, height) in image pixel coordinates."""
    H, W = shape
    w0, s0, e0, n0 = aoi_bbox
    bw, bs, be, bn = sub_bbox
    x0 = (bw - w0) / max(e0 - w0, 1e-6) * W
    x1 = (be - w0) / max(e0 - w0, 1e-6) * W
    y0 = (n0 - bn) / max(n0 - s0, 1e-6) * H
    y1 = (n0 - bs) / max(n0 - s0, 1e-6) * H
    return x0, y0, max(x1 - x0, 2.0), max(y1 - y0, 2.0)


def generate_corridor_plate(corridor: dict, out_filename: str, stac: STACClient, eem: EarthEngineManager) -> Path:
    """Render a 6-panel satellite visual comparison plate for a Saudi corridor."""
    bbox = corridor["bbox"]
    y1, y2 = corridor["year_t1"], corridor["year_t2"]
    month = corridor.get("target_month", 6)

    s1, s2 = fetch_bitemporal_stac_pair(bbox, y1, y2, month, stac_client=stac)
    H, W = s1.rgb.shape[:2]
    a1 = eem.get_annual_alphaearth_embeddings(bbox, y1, (H, W), allow_synthetic=False)
    a2 = eem.get_annual_alphaearth_embeddings(bbox, y2, (H, W), allow_synthetic=False)

    _, cos_dist = compute_cosine_distance(a1.embeddings, a2.embeddings)
    valid_mask = s1.valid_mask & s2.valid_mask
    det_siam, _ = detect_change(s1.rgb, s2.rgb, valid_mask, threshold=0.48)

    multi_ctx = {
        "t1_ndvi": s1.true_ndvi,
        "t2_ndvi": s2.true_ndvi,
        "t1_ndbi": s1.true_ndbi,
        "t2_ndbi": s2.true_ndbi,
    }
    det_hybrid = detect_alphaearth_hybrid(
        a1,
        a2,
        multispectral_context=multi_ctx,
        siamese_probability=det_siam.probability,
        siamese_mask=det_siam.mask,
        threshold=0.08,
    )

    d_ndbi = s2.true_ndbi - s1.true_ndbi
    d_ndvi = s2.true_ndvi - s1.true_ndvi
    is_agri = "agricultural" in corridor["corridor_id"]
    spectral_map = d_ndvi if is_agri else d_ndbi
    spectral_title = "(c) Sentinel-2 Physical ΔNDVI (B08/B04)" if is_agri else "(c) Sentinel-2 Physical ΔNDBI (B11/B08)"
    spectral_cmap = "RdYlGn" if is_agri else "coolwarm"

    fig, axes = plt.subplots(2, 3, figsize=(13.5, 8.4), dpi=180)
    fig.patch.set_facecolor("#FFFFFF")
    fig.suptitle(
        f"Multi-Modal Satellite Analysis Plate: {corridor['name']} ({y1} vs. {y2})\n"
        f"Sentinel-2 L2A ({s1.datetime[:10]} -> {s2.datetime[:10]}) + Google AlphaEarth 64-D Annual Embeddings",
        fontsize=12.5,
        fontweight="bold",
        color="#1B365D",
        y=0.98,
    )

    # Panel (a): T1 True Color
    ax = axes[0, 0]
    ax.imshow(_enhance_rgb(s1.rgb))
    ax.set_title(f"(a) Sentinel-2 L2A True Color ({s1.datetime[:10]})", fontsize=9.5, fontweight="bold", color="#1B365D")
    ax.axis("off")

    # Panel (b): T2 True Color + Ground Truth Boxes
    ax = axes[0, 1]
    ax.imshow(_enhance_rgb(s2.rgb))
    for ref in corridor["reference_events"]:
        rx, ry, rw, rh = _bbox_to_pixel_rect(ref["bbox"], bbox, (H, W))
        rect = mpatches.Rectangle((rx, ry), rw, rh, linewidth=1.8, edgecolor="#00E5FF", facecolor="none")
        ax.add_patch(rect)
    for neg in corridor.get("negative_zones", []):
        nx, ny, nw, nh = _bbox_to_pixel_rect(neg["bbox"], bbox, (H, W))
        rect = mpatches.Rectangle((nx, ny), nw, nh, linewidth=1.8, edgecolor="#FFB300", linestyle="--", facecolor="none")
        ax.add_patch(rect)
    ax.set_title(f"(b) Sentinel-2 L2A ({s2.datetime[:10]}) + Ref Parcels", fontsize=9.5, fontweight="bold", color="#1B365D")
    ax.axis("off")

    # Panel (c): Physical Spectral Index Shift
    ax = axes[0, 2]
    im_spec = ax.imshow(spectral_map, cmap=spectral_cmap, vmin=-0.25, vmax=0.25)
    ax.set_title(spectral_title, fontsize=9.5, fontweight="bold", color="#1B365D")
    ax.axis("off")
    plt.colorbar(im_spec, ax=ax, fraction=0.042, pad=0.03)

    # Panel (d): Siamese U-Net Probability
    ax = axes[1, 0]
    im_siam = ax.imshow(det_siam.probability, cmap="magma", vmin=0.0, vmax=1.0)
    ax.set_title("(d) Siamese U-Net Structural Probability", fontsize=9.5, fontweight="bold", color="#1B365D")
    ax.axis("off")
    plt.colorbar(im_siam, ax=ax, fraction=0.042, pad=0.03)

    # Panel (e): Real AlphaEarth 64-D Cosine Distance
    ax = axes[1, 1]
    im_ae = ax.imshow(cos_dist, cmap="viridis", vmin=0.0, vmax=max(float(np.percentile(cos_dist, 99)), 0.25))
    ax.set_title("(e) Google AlphaEarth 64-D Cosine Distance", fontsize=9.5, fontweight="bold", color="#1B365D")
    ax.axis("off")
    plt.colorbar(im_ae, ax=ax, fraction=0.042, pad=0.03)

    # Panel (f): Overlay of Verified Detections vs Reference Parcels
    ax = axes[1, 2]
    base_disp = (_enhance_rgb(s2.rgb) * 0.65).copy()
    # Highlight verified mask in bright emerald green
    mask_bool = det_hybrid.mask & ((d_ndbi >= 0.04) | (np.abs(d_ndvi) >= 0.10) | (det_siam.probability >= 0.85))
    base_disp[mask_bool, 0] = 0.13
    base_disp[mask_bool, 1] = 0.88
    base_disp[mask_bool, 2] = 0.42
    ax.imshow(np.clip(base_disp, 0.0, 1.0))
    for ref in corridor["reference_events"]:
        rx, ry, rw, rh = _bbox_to_pixel_rect(ref["bbox"], bbox, (H, W))
        rect = mpatches.Rectangle((rx, ry), rw, rh, linewidth=1.6, edgecolor="#00E5FF", facecolor="none")
        ax.add_patch(rect)
    ax.set_title("(f) TerraShift v6.0 Hybrid Verified Overlay", fontsize=9.5, fontweight="bold", color="#0B6623")
    ax.axis("off")

    plt.tight_layout(rect=[0, 0.01, 1, 0.93])
    out_path = FIG_DIR / out_filename
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return out_path


def generate_leaderboard_chart(eval_data: dict) -> Path:
    """Render Figure 5: Pooled vs Macro F1 & False Alarm comparison across all 7 models."""
    lb = eval_data["multi_model_leaderboard"]
    names = [
        m["model_name"]
        .replace("TerraShift v6.0 Frontier Hybrid (Siamese + AlphaEarth + L2A Physics)", "TerraShift v6.0 Hybrid\n(Siamese + AlphaEarth + Physics)")
        .replace("Tuned Siamese + Directional Spectral Guards (TerraShift v5.1)", "TerraShift v5.1\n(Tuned Siamese + L2A Guards)")
        .replace("AlphaEarth 64-D Cosine Dissimilarity (Model A)", "Google AlphaEarth V1\n64-D Cosine (Model A)")
        .replace("Pure Multispectral Physical Baseline", "Pure Sentinel-2 L2A\nSpectral Baseline")
        .replace("Untuned Siamese U-Net Baseline", "Untuned Siamese U-Net\nBaseline (RGB)")
        .replace("Google Dynamic World V1 LULC Transition", "Google Dynamic World V1\nLULC Transition")
        .replace("AlphaEarth + Dynamic World Transition (Model B)", "AlphaEarth + Dynamic\nWorld (Model B)")
        for m in lb
    ]
    pooled_f1 = [m["pooled_f1"] * 100.0 for m in lb]
    macro_f1 = [m["macro_f1"] * 100.0 for m in lb]
    false_alarms = [m["false_alarms"] for m in lb]
    neg_hits = [m["negative_zone_hits"] for m in lb]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13.5, 5.6), dpi=180)
    fig.patch.set_facecolor("#FFFFFF")
    y = np.arange(len(names))
    height = 0.36

    # Left panel: Pooled vs Macro F1
    b1 = ax1.barh(y - height / 2, pooled_f1, height, label="Pooled (Micro) Event F1 (%)", color="#1B365D")
    b2 = ax1.barh(y + height / 2, macro_f1, height, label="Corridor Macro Event F1 (%)", color="#22B567")
    ax1.set_yticks(y)
    ax1.set_yticklabels(names, fontsize=8.5, fontweight="bold")
    ax1.invert_yaxis()
    ax1.set_xlabel("Event F1 Score (%)", fontsize=10, fontweight="bold")
    ax1.set_title("(a) Pooled vs. Macro Event F1 Across 7 Models", fontsize=11, fontweight="bold", color="#1B365D")
    ax1.set_xlim(0, 98)
    ax1.grid(axis="x", linestyle="--", alpha=0.4)
    ax1.legend(loc="lower right", fontsize=8.5)
    for bar in b1:
        w = bar.get_width()
        ax1.text(w + 1.0, bar.get_y() + bar.get_height() / 2, f"{w:.1f}%", va="center", fontsize=8, color="#1B365D", fontweight="bold")
    for bar in b2:
        w = bar.get_width()
        ax1.text(w + 1.0, bar.get_y() + bar.get_height() / 2, f"{w:.1f}%", va="center", fontsize=8, color="#0B6623", fontweight="bold")

    # Right panel: Total False Positives & Negative Control Zone False Alarms
    b3 = ax2.barh(y - height / 2, false_alarms, height, label="Total False Alerts (All 4 Corridors)", color="#E94235")
    b4 = ax2.barh(y + height / 2, neg_hits, height, label="Negative Control Zone Hits", color="#F39223")
    ax2.set_yticks(y)
    ax2.set_yticklabels([""] * len(names))
    ax2.invert_yaxis()
    ax2.set_xlabel("False Alarm Count (Lower is Better)", fontsize=10, fontweight="bold")
    ax2.set_title("(b) False Alarm Volume & Negative Control Zone Hits", fontsize=11, fontweight="bold", color="#1B365D")
    ax2.set_xlim(0, 132)
    ax2.grid(axis="x", linestyle="--", alpha=0.4)
    ax2.legend(loc="lower right", fontsize=8.5)
    for bar in b3:
        w = bar.get_width()
        ax2.text(w + 1.5, bar.get_y() + bar.get_height() / 2, f"{int(w)} FP", va="center", fontsize=8, color="#B91C1C", fontweight="bold")
    for bar in b4:
        w = bar.get_width()
        ax2.text(w + 1.5, bar.get_y() + bar.get_height() / 2, f"{int(w)} Neg", va="center", fontsize=8, color="#B45309", fontweight="bold")

    plt.suptitle(
        "TerraShift AI Saudi Benchmark (91.19 km² · 19 Reference Events · Live GEE & Sentinel-2 L2A STAC)",
        fontsize=12.5,
        fontweight="bold",
        color="#1B365D",
        y=0.99,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    out_path = FIG_DIR / "fig5_leaderboard_pooled_vs_macro.png"
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return out_path


def generate_sensitivity_chart(eval_data: dict) -> Path:
    """Render Figure 6: Localization Threshold Sensitivity Curve & Corridor Precision Progression."""
    summaries = eval_data["multi_model_comparative_summary"]
    regimes = [
        ("relaxed_iou02_poc08", "Relaxed\n(IoU≥0.02, PoC≥0.08)"),
        ("standard_iou05_poc15", "Standard\n(IoU≥0.05, PoC≥0.15)"),
        ("moderate_iou10_poc25", "Moderate\n(IoU≥0.10, PoC≥0.25)"),
        ("strict_iou20_poc35", "Strict\n(IoU≥0.20, PoC≥0.35)"),
    ]
    x = np.arange(len(regimes))
    x_labels = [r[1] for r in regimes]

    series = [
        ("alphaearth_hybrid", "TerraShift v6.0 Frontier Hybrid", "#0B6623", "o-", 2.6),
        ("siamese_tuned_filtered", "TerraShift v5.1 (Siamese + Spectral)", "#1B365D", "s-", 2.2),
        ("alphaearth_cosine", "Google AlphaEarth 64-D Cosine", "#F39223", "^--", 2.0),
        ("multispectral_physical", "Sentinel-2 Physical Indices", "#6366F1", "d--", 1.8),
        ("siamese_untuned", "Untuned Siamese U-Net (RGB)", "#E94235", "x:", 1.8),
    ]

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(13.5, 5.2), dpi=180)
    fig.patch.set_facecolor("#FFFFFF")

    for mid, label, color, style, lw in series:
        sens = summaries[mid]["localization_sensitivity_summary"]
        y_vals = [sens[r[0]]["pooled_f1"] * 100.0 for r in regimes]
        ax1.plot(x, y_vals, style, color=color, linewidth=lw, markersize=7, label=label)
        for xi, yi in zip(x, y_vals):
            ax1.annotate(f"{yi:.1f}%", (xi, yi), textcoords="offset points", xytext=(0, 6), ha="center", fontsize=7.5, fontweight="bold", color=color)

    ax1.set_xticks(x)
    ax1.set_xticklabels(x_labels, fontsize=8.5, fontweight="bold")
    ax1.set_ylabel("Pooled Event F1 Score (%)", fontsize=10, fontweight="bold")
    ax1.set_title("(a) Localization Strictness Sensitivity Sweep", fontsize=11, fontweight="bold", color="#1B365D")
    ax1.set_ylim(0, 95)
    ax1.grid(True, linestyle="--", alpha=0.4)
    ax1.legend(loc="upper right", fontsize=8)

    # Right panel: Per-corridor Strict Precision progression across Untuned -> v5.1 -> v6.0 Hybrid
    corridors = ["Riyadh\n(ROSHN Sedra)", "Jeddah\n(North Obhur)", "Al-Jouf\n(Sirhan Pivots)", "Al-Kharj\n(Held-Out Test)"]
    c_runs = eval_data["per_corridor_results"]
    p_untuned = [r["strict_event_precision"] * 100.0 for r in c_runs["siamese_untuned"]]
    p_v51 = [r["strict_event_precision"] * 100.0 for r in c_runs["siamese_tuned_filtered"]]
    p_v60 = [r["strict_event_precision"] * 100.0 for r in c_runs["alphaearth_hybrid"]]
    p_ae = [r["strict_event_precision"] * 100.0 for r in c_runs["alphaearth_cosine"]]

    cx = np.arange(len(corridors))
    w = 0.20
    ax2.bar(cx - 1.5 * w, p_untuned, w, label="Untuned Siamese (RGB)", color="#E94235")
    ax2.bar(cx - 0.5 * w, p_ae, w, label="AlphaEarth 64-D Standalone", color="#F39223")
    ax2.bar(cx + 0.5 * w, p_v51, w, label="TerraShift v5.1 (Siamese+L2A)", color="#1B365D")
    ax2.bar(cx + 1.5 * w, p_v60, w, label="TerraShift v6.0 Hybrid (Full)", color="#22B567")

    ax2.set_xticks(cx)
    ax2.set_xticklabels(corridors, fontsize=8.5, fontweight="bold")
    ax2.set_ylabel("Strict 1-to-1 Event Precision (%)", fontsize=10, fontweight="bold")
    ax2.set_title("(b) Per-Corridor Event Precision Progression", fontsize=11, fontweight="bold", color="#1B365D")
    ax2.set_ylim(0, 112)
    ax2.grid(axis="y", linestyle="--", alpha=0.4)
    ax2.legend(loc="upper right", fontsize=8)

    plt.suptitle(
        "Localization Robustness & Regional Generalization Across Saudi Arid Corridors",
        fontsize=12.5,
        fontweight="bold",
        color="#1B365D",
        y=0.99,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.94])
    out_path = FIG_DIR / "fig6_localization_sensitivity_curve.png"
    fig.savefig(out_path, dpi=180, bbox_inches="tight")
    plt.close(fig)
    return out_path


def main() -> None:
    print("Generating publication-grade satellite plates and charts for 100-page report...", flush=True)
    with open(ROOT / "reports" / "saudi_pilot_evaluation.json") as f:
        eval_data = json.load(f)

    stac = STACClient()
    eem = EarthEngineManager()

    plate_files = [
        (SAUDI_REFERENCE_BENCHMARK[0], "fig1_riyadh_multimodal_plate.png"),
        (SAUDI_REFERENCE_BENCHMARK[1], "fig2_jeddah_multimodal_plate.png"),
        (SAUDI_REFERENCE_BENCHMARK[2], "fig3_aljouf_multimodal_plate.png"),
        (SAUDI_REFERENCE_BENCHMARK[3], "fig4_alkharj_heldout_plate.png"),
    ]
    for corr, fname in plate_files:
        p = generate_corridor_plate(corr, fname, stac, eem)
        print(f"  Generated satellite plate: {p.name}", flush=True)

    p5 = generate_leaderboard_chart(eval_data)
    print(f"  Generated chart: {p5.name}", flush=True)

    p6 = generate_sensitivity_chart(eval_data)
    print(f"  Generated chart: {p6.name}", flush=True)
    print("All 6 thesis figures generated successfully!", flush=True)


if __name__ == "__main__":
    main()
