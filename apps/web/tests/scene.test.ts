import { describe, expect, it } from "vitest";
import { PRESETS, toGeoJson } from "../src/lib/geo";
import { generateScene } from "../src/lib/scene";

describe("scene", () => {
  it("is deterministic per seed", () => {
    const a = generateScene(7);
    const b = generateScene(7);
    expect(a.changedM2).toBe(b.changedM2);
    expect(a.mask).toEqual(b.mask);
  });

  it("measures changed area as pixels x 100 m2 and sums region areas", () => {
    const s = generateScene(7);
    const sum = s.regions.reduce((acc, r) => acc + r.areaM2, 0);
    expect(s.changedM2).toBe(sum);
    expect(s.changedM2 % 100).toBe(0);
  });

  it("shows naive differencing over-flags relative to true change", () => {
    const s = generateScene(7);
    expect(s.naivePct).toBeGreaterThan(s.changedPct * 2);
  });
});

describe("geojson", () => {
  it("exports one closed polygon per region", () => {
    const preset = PRESETS[0];
    if (!preset) throw new Error("no preset");
    const s = generateScene(preset.seed);
    const fc = toGeoJson(s, preset, "2024-06-14", "2025-01-22", "demo-synthetic");
    expect(fc.features).toHaveLength(s.regions.length);
    for (const f of fc.features) {
      const ring = f.geometry.coordinates[0] ?? [];
      expect(ring[0]).toEqual(ring[ring.length - 1]);
    }
  });
});
