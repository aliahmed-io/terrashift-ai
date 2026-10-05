import type { Region, Scene } from "@/lib/scene";

export interface AoiPreset {
  id: string;
  name: string;
  region: string;
  seed: number;
  bbox: readonly [number, number, number, number];
}

export const PRESETS: readonly AoiPreset[] = [
  { id: "rondonia", name: "Rondônia frontier", region: "Brazil", seed: 7, bbox: [-63.2, -9.9, -63.12, -9.84] },
  { id: "creek", name: "Dubai Creek sprawl", region: "UAE", seed: 21, bbox: [55.3, 25.18, 55.38, 25.24] },
  { id: "kalimantan", name: "Kalimantan clearing", region: "Indonesia", seed: 33, bbox: [114.1, -2.3, 114.18, -2.24] },
  { id: "mekong", name: "Mekong delta fringe", region: "Vietnam", seed: 48, bbox: [105.6, 9.9, 105.68, 9.96] },
];

export function ringFor(region: Region, scene: Scene, bbox: AoiPreset["bbox"], steps = 32): number[][] {
  const [west, south, east, north] = bbox;
  const ring: number[][] = [];
  for (let k = 0; k <= steps; k += 1) {
    const a = ((k % steps) / steps) * Math.PI * 2;
    const px = region.cx + Math.cos(a) * region.rx;
    const py = region.cy + Math.sin(a) * region.ry;
    const lon = west + (px / scene.width) * (east - west);
    const lat = north - (py / scene.height) * (north - south);
    ring.push([Number(lon.toFixed(6)), Number(lat.toFixed(6))]);
  }
  return ring;
}

export interface ChangeFeatureCollection {
  type: "FeatureCollection";
  metadata: {
    bbox: AoiPreset["bbox"];
    date_t1: string;
    date_t2: string;
    total_changed_km2: number;
    provenance: string;
  };
  features: Array<{
    type: "Feature";
    geometry: { type: "Polygon"; coordinates: number[][][] };
    properties: { id: number; class: string; area_m2: number; confidence: number };
  }>;
}

export function toGeoJson(
  scene: Scene,
  preset: AoiPreset,
  dateT1: string,
  dateT2: string,
  provenance: string,
): ChangeFeatureCollection {
  return {
    type: "FeatureCollection",
    metadata: {
      bbox: preset.bbox,
      date_t1: dateT1,
      date_t2: dateT2,
      total_changed_km2: scene.changedM2 / 1e6,
      provenance,
    },
    features: scene.regions.map((r) => ({
      type: "Feature",
      geometry: { type: "Polygon", coordinates: [ringFor(r, scene, preset.bbox)] },
      properties: {
        id: r.id,
        class: r.kind === "clearing" ? "vegetation_loss_to_bare" : "bare_to_built",
        area_m2: r.areaM2,
        confidence: Number(r.confidence.toFixed(3)),
      },
    })),
  };
}
