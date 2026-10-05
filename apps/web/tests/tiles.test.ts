import { describe, expect, it } from "vitest";
import {
  calculatePolygonAreaKm2,
  calculatePolygonAreaM2,
  formatArea,
  getEoxTileUrl,
  HOTSPOT_PRESETS,
  MAX_AOI_KM2,
} from "../src/lib/tiles";

describe("tiles and spherical geometry", () => {
  it("clamps EOX tile year between 2017 and 2025", () => {
    expect(getEoxTileUrl(2010)).toContain("s2cloudless-2017_3857");
    expect(getEoxTileUrl(2030)).toContain("s2cloudless-2025_3857");
    expect(getEoxTileUrl(2021)).toContain("s2cloudless-2021_3857");
  });

  it("calculates realistic geodesic area for a degree box", () => {
    // 0.05 deg x 0.04 deg box at equator: approx 5.5km x 4.4km = ~24 km2
    const box: [number, number][] = [
      [0.0, 0.0],
      [0.05, 0.0],
      [0.05, 0.04],
      [0.0, 0.04],
      [0.0, 0.0],
    ];
    const km2 = calculatePolygonAreaKm2(box);
    expect(km2).toBeGreaterThan(20);
    expect(km2).toBeLessThan(30);
  });

  it("returns zero area for empty or degenerate polygon", () => {
    expect(calculatePolygonAreaM2([])).toBe(0);
    expect(calculatePolygonAreaM2([[10, 20], [10, 21]])).toBe(0);
  });

  it("formats area thresholds cleanly", () => {
    expect(formatArea(500)).toBe("500 m²");
    expect(formatArea(15000)).toBe("1.5 ha");
    expect(formatArea(2400000)).toBe("2.40 km²");
    expect(formatArea(18000000)).toBe("18.0 km²");
  });

  it("verifies all hotspot presets are valid, closed, and under 100 km2", () => {
    expect(HOTSPOT_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of HOTSPOT_PRESETS) {
      expect(preset.polygon.length).toBeGreaterThanOrEqual(4);
      const first = preset.polygon[0]!;
      const last = preset.polygon[preset.polygon.length - 1]!;
      expect(first[0]).toBe(last[0]);
      expect(first[1]).toBe(last[1]);
      const area = calculatePolygonAreaKm2(preset.polygon);
      expect(area).toBeGreaterThan(0.1);
      expect(area).toBeLessThanOrEqual(MAX_AOI_KM2);
    }
  });
});
