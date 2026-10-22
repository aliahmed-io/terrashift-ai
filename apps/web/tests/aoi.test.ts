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

  it("verifies all 5 corridors are defined with valid bounding boxes and EPSG codes", async () => {
    const { CORRIDOR_PROFILES } = await import("../src/lib/aoi-context");
    const corridorIds = ["roshn", "wadi", "neom", "redsea", "rondonia"] as const;
    for (const id of corridorIds) {
      const p = CORRIDOR_PROFILES[id];
      expect(p).toBeDefined();
      expect(p.bbox.length).toBe(4);
      expect(p.bbox[0]).toBeLessThan(p.bbox[2]); // minLon < maxLon
      expect(p.bbox[1]).toBeLessThan(p.bbox[3]); // minLat < maxLat
      expect(p.epsg).toBeGreaterThan(32000);
      expect(p.baseAreaHa).toBeGreaterThan(0);
      expect(p.baseChangePct).toBeGreaterThan(0);
    }
  });
});
