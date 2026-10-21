import { describe, expect, it } from "vitest";
import { HOTSPOT_PRESETS, calculatePolygonAreaKm2 } from "../src/lib/tiles";

describe("Cross-page AOI State & Presets", () => {
  it("verifies all presets contain valid closed coordinates for Siamese inference", () => {
    for (const preset of HOTSPOT_PRESETS) {
      expect(preset.polygon.length).toBeGreaterThanOrEqual(4);
      const ring = preset.polygon;
      expect(ring[0]).toEqual(ring[ring.length - 1]);
      const area = calculatePolygonAreaKm2(ring);
      expect(area).toBeGreaterThan(0.5);
      expect(area).toBeLessThan(100);
    }
  });

  it("validates year ordering for bi-temporal pairs", () => {
    for (const preset of HOTSPOT_PRESETS) {
      expect(preset.yearT1).toBeLessThan(preset.yearT2);
      expect(preset.yearT1).toBeGreaterThanOrEqual(2017);
      expect(preset.yearT2).toBeLessThanOrEqual(2025);
    }
  });
});
