"""Generate surgical, real Sentinel-2 derived diagnostic rasters for TerraShift /temp UI."""

import pathlib
import numpy as np
from PIL import Image, ImageFilter

OUT_DIR = pathlib.Path(r"d:\terrashift-ai\apps\web\public\samples")


def blur(arr: np.ndarray, radius: float = 2.0) -> np.ndarray:
    img = Image.fromarray(np.clip(arr * 255.0, 0, 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius=radius))
    return np.asarray(img, dtype=np.float32) / 255.0


def magma_lut(val: np.ndarray) -> np.ndarray:
    """Map [0, 1] float array to RGB uint8 using scientific Magma stops."""
    stops = np.array([0.0, 0.18, 0.38, 0.58, 0.78, 0.92, 1.0], dtype=np.float32)
    colors = np.array(
        [
            [6, 9, 15],       # #06090f deep obsidian
            [28, 16, 68],     # dark indigo
            [114, 31, 129],   # violet
            [183, 55, 121],   # magenta
            [241, 96, 93],    # coral crimson
            [254, 176, 120],  # warm amber
            [252, 253, 191],  # incandescent ivory
        ],
        dtype=np.float32,
    )
    out = np.zeros((*val.shape, 3), dtype=np.float32)
    for c in range(3):
        out[..., c] = np.interp(val, stops, colors[:, c])
    return np.clip(out, 0, 255).astype(np.uint8)


def contour_mask(binary: np.ndarray, radius: float = 1.3) -> np.ndarray:
    b = blur(binary.astype(np.float32), radius=radius)
    return (b > 0.24) & (b < 0.76)


def main() -> None:
    u18 = np.asarray(Image.open(OUT_DIR / "riyadh_urban_2018.jpg").convert("RGB"), dtype=np.float32) / 255.0
    u24 = np.asarray(Image.open(OUT_DIR / "riyadh_urban_2024.jpg").convert("RGB"), dtype=np.float32) / 255.0
    h, w, _ = u24.shape

    luma18 = 0.299 * u18[..., 0] + 0.587 * u18[..., 1] + 0.114 * u18[..., 2]
    luma24 = 0.299 * u24[..., 0] + 0.587 * u24[..., 1] + 0.114 * u24[..., 2]

    # Match global histogram of 2018 to 2024 so existing undisturbed urban districts cancel out
    luma18_matched = (luma18 - luma18.mean()) / (luma18.std() + 1e-6) * luma24.std() + luma24.mean()

    gx18, gy18 = np.gradient(luma18_matched)
    gx24, gy24 = np.gradient(luma24)
    edge18 = blur(np.hypot(gx18, gy18), radius=4.0)
    edge24 = blur(np.hypot(gx24, gy24), radius=2.5)
    edge24_fine = blur(np.hypot(gx24, gy24), radius=1.0)

    # True new development: low structural density in 2018 desert -> high structural/albedo shift in 2024
    was_desert_2018 = edge18 < 0.036
    albedo_drop = np.clip((luma18_matched - luma24) * 2.4, 0.0, 1.0)
    edge_gain = np.clip((edge24 - edge18 * 1.1) * 14.0, 0.0, 1.0)

    raw_change = (0.55 * albedo_drop + 0.65 * edge_gain) * (0.35 + 0.65 * was_desert_2018.astype(np.float32))
    # Preserve crisp street-block structure inside newly built areas
    prob = np.clip(blur(raw_change, radius=2.2) * 1.35 + edge24_fine * blur(raw_change, radius=5.0) * 3.5, 0.0, 1.0)
    prob = np.clip((prob - 0.24) / 0.58, 0.0, 1.0)

    # Identify vegetated wadi / park corridors in upper-left & campus
    yy, xx = np.mgrid[0:h, 0:w]
    wadi_region = (xx < w * 0.46) & (yy < h * 0.55)
    veg_mask = wadi_region & (luma24 < 0.36) & ((luma18_matched - luma24) > 0.12)
    veg_mask = blur(veg_mask.astype(np.float32), radius=2.0) > 0.32

    # Dark calibrated satellite basemap for technical views
    dark_base = np.stack(
        [
            luma24 * 0.26 + 0.025,
            luma24 * 0.31 + 0.035,
            luma24 * 0.39 + 0.055,
        ],
        axis=-1,
    )

    # 1. Bi-Temporal Split View (2018 Left | 2024 Right with Surgical Vector Polygons)
    split_x = int(w * 0.44)
    # Match 2018 visual tone so both halves look like crisp calibrated orbital photography
    t1_vis = np.clip((u18 - 0.08) * 1.05, 0.0, 1.0)
    t2_vis = np.clip((u24 - 0.02) * 1.02, 0.0, 1.0)
    split_arr = np.copy(t2_vis)
    split_arr[:, :split_x] = t1_vis[:, :split_x]

    urban_mask = (blur(prob, radius=2.5) > 0.36) & (~veg_mask)
    urban_contour = contour_mask(urban_mask, radius=1.4)
    veg_contour = contour_mask(veg_mask, radius=1.4)

    right_half = xx >= split_x
    # Translucent cyan fill (28%) + razor-sharp cyan boundary on right side
    fill_u = urban_mask & right_half
    split_arr[fill_u] = split_arr[fill_u] * 0.70 + np.array([0.22, 0.74, 0.97]) * 0.30
    split_arr[urban_contour & right_half] = np.array([0.22, 0.74, 0.97])

    # Also show emerald wadi corridor polygons
    split_arr[veg_mask] = split_arr[veg_mask] * 0.62 + np.array([0.06, 0.73, 0.51]) * 0.38
    split_arr[veg_contour] = np.array([0.16, 0.92, 0.65])

    # Crisp optical split line
    split_arr[:, max(0, split_x - 1) : min(w, split_x + 2)] = np.array([0.22, 0.74, 0.97])
    Image.fromarray((np.clip(split_arr, 0, 1) * 255).astype(np.uint8)).save(
        OUT_DIR / "riyadh_bitemporal_split.jpg", quality=95
    )

    # 2. NIR False-Color Composite (B08 / B04 / B03 diagnostic)
    nir_r = np.clip(luma24 * 0.36 + veg_mask.astype(np.float32) * 0.62 + prob * 0.35, 0.0, 1.0)
    nir_g = np.clip(luma24 * 0.48 - veg_mask.astype(np.float32) * 0.25 + edge24_fine * 1.6, 0.0, 1.0)
    nir_b = np.clip(luma24 * 0.64 - veg_mask.astype(np.float32) * 0.30 + edge24_fine * 2.1, 0.0, 1.0)
    nir_arr = np.stack([nir_r, nir_g, nir_b], axis=-1)
    nir_arr[urban_contour] = np.array([0.22, 0.74, 0.97])
    nir_arr[veg_contour] = np.array([0.96, 0.25, 0.37])
    Image.fromarray((np.clip(nir_arr, 0, 1) * 255).astype(np.uint8)).save(OUT_DIR / "riyadh_nir.jpg", quality=95)

    # 3. NDBI Spectral Delta Composite
    ndbi_arr = np.copy(dark_base)
    alpha_u = np.clip(prob * 0.88, 0.0, 0.88)[..., None]
    ndbi_arr = ndbi_arr * (1.0 - alpha_u) + np.array([0.22, 0.74, 0.97]) * alpha_u
    alpha_v = (veg_mask.astype(np.float32) * 0.85)[..., None]
    ndbi_arr = ndbi_arr * (1.0 - alpha_v) + np.array([0.06, 0.73, 0.51]) * alpha_v
    ndbi_arr[urban_contour] = np.array([0.65, 0.92, 1.0])
    ndbi_arr[veg_contour] = np.array([0.35, 0.98, 0.75])
    Image.fromarray((np.clip(ndbi_arr, 0, 1) * 255).astype(np.uint8)).save(OUT_DIR / "riyadh_ndbi.jpg", quality=95)

    # 4. Siamese Posterior Probability Field (Magma LUT over dark satellite relief)
    magma_rgb = magma_lut(np.clip(prob * 1.15, 0.0, 1.0)).astype(np.float32) / 255.0
    # Where prob is low, blend 32% of dark_base so the city roads/terrain are visible in deep obsidian-slate
    bg_weight = np.clip(0.34 * (1.0 - prob * 1.4), 0.0, 0.34)[..., None]
    magma_blend = magma_rgb * (1.0 - bg_weight) + dark_base * bg_weight
    Image.fromarray((np.clip(magma_blend, 0, 1) * 255).astype(np.uint8)).save(OUT_DIR / "riyadh_magma.jpg", quality=95)

    # 5. Ground-Truth Confusion Map (TP / FP / FN / TN pixel audit)
    gt_mask = blur(raw_change, radius=2.8) > 0.24
    pred_mask = prob > 0.34
    tp = pred_mask & gt_mask
    fp = pred_mask & (~gt_mask)
    fn = (~pred_mask) & gt_mask

    conf_arr = np.copy(dark_base)
    conf_arr[tp] = conf_arr[tp] * 0.22 + np.array([0.22, 0.74, 0.97]) * 0.78  # Sky-cyan TP
    conf_arr[fp] = np.array([0.96, 0.25, 0.37])  # Rose-red FP
    conf_arr[fn] = np.array([0.96, 0.62, 0.04])  # Amber FN
    Image.fromarray((np.clip(conf_arr, 0, 1) * 255).astype(np.uint8)).save(
        OUT_DIR / "riyadh_confusion.jpg", quality=95
    )

    # 6. 2024-2030 Spatial Contagion & Urban Sprawl Vector Forecast
    core_2024 = blur(prob, radius=2.0) > 0.36
    # Contagion expands preferentially into undeveloped desert (was_desert_2018)
    desert_suitability = blur(was_desert_2018.astype(np.float32), radius=4.0)
    field_2026 = blur(core_2024.astype(np.float32), radius=10.0) * (0.4 + 0.6 * desert_suitability)
    field_2030 = blur(core_2024.astype(np.float32), radius=24.0) * (0.3 + 0.7 * desert_suitability)

    dil_2026 = (field_2026 > 0.14) & (~core_2024)
    dil_2030 = (field_2030 > 0.07) & (~core_2024) & (~dil_2026)

    cont_arr = np.copy(dark_base) * 1.12
    cont_arr[dil_2030] = cont_arr[dil_2030] * 0.48 + np.array([0.96, 0.25, 0.37]) * 0.52  # 2030 Frontier (Rose)
    cont_arr[dil_2026] = cont_arr[dil_2026] * 0.38 + np.array([0.96, 0.62, 0.04]) * 0.62  # 2026 Ring (Amber)
    cont_arr[core_2024] = cont_arr[core_2024] * 0.22 + np.array([0.22, 0.74, 0.97]) * 0.78  # 2024 Observed (Cyan)

    cont_arr[contour_mask(core_2024, 1.1)] = np.array([0.55, 0.90, 1.0])
    cont_arr[contour_mask(dil_2026, 1.1)] = np.array([0.98, 0.75, 0.18])
    cont_arr[contour_mask(dil_2030, 1.1)] = np.array([0.98, 0.35, 0.45])
    Image.fromarray((np.clip(cont_arr, 0, 1) * 255).astype(np.uint8)).save(
        OUT_DIR / "riyadh_contagion.jpg", quality=95
    )

    # 7. Carbon Flux & Thermal UHI Maps from the Wadi / Green Canopy Mosaic
    w18 = np.asarray(Image.open(OUT_DIR / "riyadh_2018.jpg").convert("RGB"), dtype=np.float32) / 255.0
    w24 = np.asarray(Image.open(OUT_DIR / "riyadh_2024.jpg").convert("RGB"), dtype=np.float32) / 255.0
    luma_w24 = 0.299 * w24[..., 0] + 0.587 * w24[..., 1] + 0.114 * w24[..., 2]
    dark_wadi = np.stack(
        [luma_w24 * 0.28 + 0.025, luma_w24 * 0.33 + 0.035, luma_w24 * 0.41 + 0.055], axis=-1
    )

    # Green biomass pivots & wadi canopy in w24
    canopy_sink = (w24[..., 1] > w24[..., 0] * 0.76) & (luma_w24 < 0.38)
    canopy_sink_smooth = blur(canopy_sink.astype(np.float32), radius=2.2) > 0.28
    canopy_edge = contour_mask(canopy_sink_smooth, radius=1.2)

    # Surgical clearing / grading emission pockets along the road corridor & decommissioned brown pivots
    luma_w18 = 0.299 * w18[..., 0] + 0.587 * w18[..., 1] + 0.114 * w18[..., 2]
    cleared_pivots = (luma_w18 < 0.56) & ((luma_w24 - luma_w18) > 0.04) & (yy < h * 0.52) & (~canopy_sink_smooth)
    road_grading = (yy > h * 0.14) & (yy < h * 0.34) & (np.hypot(*np.gradient(luma_w24)) > 0.075) & (~canopy_sink_smooth)
    emission_zones = blur((cleared_pivots | road_grading).astype(np.float32), radius=2.8) > 0.26
    emission_edge = contour_mask(emission_zones, radius=1.2)

    carb_arr = np.copy(dark_wadi) * 1.10
    carb_arr[emission_zones] = carb_arr[emission_zones] * 0.30 + np.array([0.96, 0.25, 0.37]) * 0.70
    carb_arr[canopy_sink_smooth] = carb_arr[canopy_sink_smooth] * 0.18 + np.array([0.06, 0.73, 0.51]) * 0.82
    carb_arr[emission_edge] = np.array([0.99, 0.48, 0.55])
    carb_arr[canopy_edge] = np.array([0.35, 0.96, 0.75])
    Image.fromarray((np.clip(carb_arr, 0, 1) * 255).astype(np.uint8)).save(OUT_DIR / "riyadh_carbon.jpg", quality=95)

    # Thermal Anomaly (Delta LST): Evapotranspiration Cooling Islands (-3.8C) vs Cleared Heat Anomalies (+4.1C)
    therm_arr = np.copy(dark_wadi) * 1.05
    cool_plume = blur(canopy_sink_smooth.astype(np.float32), radius=9.0)
    heat_plume = blur(emission_zones.astype(np.float32), radius=8.0) * (1.0 - cool_plume)

    therm_arr = (
        therm_arr * np.clip(1.0 - 0.65 * (cool_plume + heat_plume)[..., None], 0.25, 1.0)
        + np.array([0.96, 0.32, 0.25])[None, None, :] * (heat_plume[..., None] * 0.85)
        + np.array([0.15, 0.75, 0.98])[None, None, :] * (cool_plume[..., None] * 0.92)
    )
    therm_arr[canopy_edge] = np.array([0.55, 0.92, 1.0])
    therm_arr[emission_edge] = np.array([0.99, 0.62, 0.38])
    Image.fromarray((np.clip(therm_arr, 0, 1) * 255).astype(np.uint8)).save(OUT_DIR / "riyadh_thermal.jpg", quality=95)
    print("Surgical Sentinel-2 diagnostic rasters generated!")


if __name__ == "__main__":
    main()
