export type CorridorId = "roshn" | "wadi" | "neom" | "redsea" | "rondonia";

export type MonthLabel = "Jan" | "Feb" | "Mar" | "Apr" | "May" | "Jun" | "Jul" | "Aug" | "Sep" | "Oct" | "Nov" | "Dec";

export const TIMELINE_MONTHS: readonly MonthLabel[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const TIMELINE_YEARS: readonly number[] = [2018, 2019, 2020, 2021, 2022, 2023, 2024] as const;

export interface CorridorProfile {
  id: CorridorId;
  name: string;
  shortName: string;
  subtitle: string;
  coordsLabel: string;
  epsg: number;
  stacId: string;
  tileId: string;
  bbox: [number, number, number, number];
  polygon: [number, number][];
  baseAreaHa: number;
  baseChangePct: number;
  baseF1: number;
  baseIou: number;
  basePrecision: number;
  baseRecall: number;
  defaultEffect: "split" | "nir" | "ndbi" | "magma" | "confusion" | "contagion" | "carbon" | "thermal";
  anomalyRows: {
    label: string;
    baseVal: number;
    baseAreaHa: number;
    pct: number;
    tone: "emerald" | "amber" | "crimson";
  }[];
  spectralBands2018: number[];
  spectralBands2024: number[];
  carbonMgPerHa: number;
  thermalDeltaC: number;
}

export const CORRIDOR_PROFILES: Record<CorridorId, CorridorProfile> = {
  roshn: {
    id: "roshn",
    name: "ROSHN Sedra Corridor",
    shortName: "ROSHN Sedra",
    subtitle: "North Riyadh · King Salman Airport & Sedra Mega-Development",
    coordsLabel: "Riyadh Province · 24.83°N, 46.72°E",
    epsg: 32638,
    stacId: "S2B_ROSHN_RIYADH_2018_2024",
    tileId: "S2B_38RMV_20240614",
    bbox: [46.63, 24.75, 46.81, 24.87],
    polygon: [
      [46.63, 24.75],
      [46.81, 24.75],
      [46.81, 24.87],
      [46.63, 24.87],
      [46.63, 24.75],
    ],
    baseAreaHa: 4824.2,
    baseChangePct: 12.9,
    baseF1: 0.914,
    baseIou: 0.842,
    basePrecision: 0.938,
    baseRecall: 0.891,
    defaultEffect: "split",
    anomalyRows: [
      { label: "Superblock Structural Grading", baseVal: 0.38, baseAreaHa: 3110, pct: 64, tone: "emerald" },
      { label: "Arterial & Ring Road Expansion", baseVal: 0.195, baseAreaHa: 890, pct: 19, tone: "amber" },
      { label: "Subgrade Excavation & Compaction", baseVal: 0.085, baseAreaHa: 412, pct: 8, tone: "crimson" },
      { label: "High-Albedo Concrete Pouring", baseVal: 0.05, baseAreaHa: 212, pct: 5, tone: "crimson" },
      { label: "Riparian Buffer & Canopy Infill", baseVal: 0.24, baseAreaHa: 200, pct: 4, tone: "emerald" },
    ],
    spectralBands2018: [0.14, 0.17, 0.22, 0.25, 0.28, 0.31, 0.34, 0.36, 0.41, 0.38],
    spectralBands2024: [0.19, 0.23, 0.3, 0.33, 0.37, 0.42, 0.45, 0.47, 0.52, 0.49],
    carbonMgPerHa: -49.4,
    thermalDeltaC: -3.8,
  },
  wadi: {
    id: "wadi",
    name: "Wadi Hanifah Canopy",
    shortName: "Wadi Hanifah",
    subtitle: "Green Riyadh · Riparian Afforestation & Microclimate Corridor",
    coordsLabel: "Riyadh Province · 24.66°N, 46.68°E",
    epsg: 32638,
    stacId: "S2B_WADI_HANIFAH_2018_2024",
    tileId: "S2A_38RMV_20240525",
    bbox: [46.64, 24.62, 46.72, 24.7],
    polygon: [
      [46.64, 24.62],
      [46.72, 24.62],
      [46.72, 24.7],
      [46.64, 24.7],
      [46.64, 24.62],
    ],
    baseAreaHa: 3080.0,
    baseChangePct: 14.8,
    baseF1: 0.928,
    baseIou: 0.865,
    basePrecision: 0.946,
    baseRecall: 0.911,
    defaultEffect: "nir",
    anomalyRows: [
      { label: "Dense Riparian Acacia Canopy", baseVal: 0.44, baseAreaHa: 1143, pct: 72, tone: "emerald" },
      { label: "Irrigated Parkland Turf & Shrubs", baseVal: 0.31, baseAreaHa: 890, pct: 14, tone: "emerald" },
      { label: "Terraced Wadi Bank Stabilization", baseVal: 0.125, baseAreaHa: 542, pct: 7, tone: "amber" },
      { label: "Channel Weir & Stone Revetment", baseVal: 0.065, baseAreaHa: 310, pct: 4, tone: "crimson" },
      { label: "Pedestrian Trail & Plaza Paving", baseVal: 0.04, baseAreaHa: 195, pct: 3, tone: "crimson" },
    ],
    spectralBands2018: [0.13, 0.16, 0.21, 0.23, 0.26, 0.29, 0.31, 0.33, 0.39, 0.36],
    spectralBands2024: [0.11, 0.15, 0.14, 0.28, 0.38, 0.46, 0.51, 0.53, 0.31, 0.27],
    carbonMgPerHa: -64.2,
    thermalDeltaC: -4.6,
  },
  neom: {
    id: "neom",
    name: "NEOM · The Line Spine Sector 1",
    shortName: "NEOM The Line",
    subtitle: "Tabuk Province · Linear Excavation & Logistics Corridor",
    coordsLabel: "Tabuk Province · 28.12°N, 35.10°E",
    epsg: 32636,
    stacId: "S2B_NEOM_SPINE_2018_2024",
    tileId: "S2B_36RUV_20240611",
    bbox: [35.06, 28.09, 35.14, 28.15],
    polygon: [
      [35.06, 28.09],
      [35.14, 28.09],
      [35.14, 28.15],
      [35.06, 28.15],
      [35.06, 28.09],
    ],
    baseAreaHa: 1420.5,
    baseChangePct: 18.4,
    baseF1: 0.936,
    baseIou: 0.879,
    basePrecision: 0.952,
    baseRecall: 0.921,
    defaultEffect: "magma",
    anomalyRows: [
      { label: "Primary Spine Trench Excavation", baseVal: 0.465, baseAreaHa: 820, pct: 58, tone: "emerald" },
      { label: "Modular Logistics Batching Yards", baseVal: 0.285, baseAreaHa: 310, pct: 22, tone: "amber" },
      { label: "Heavy Haulage Service Roadways", baseVal: 0.14, baseAreaHa: 165, pct: 11, tone: "crimson" },
      { label: "Substation & Solar Array Pads", baseVal: 0.085, baseAreaHa: 85, pct: 6, tone: "crimson" },
      { label: "Coastal Desalination Pipeline", baseVal: 0.19, baseAreaHa: 40, pct: 3, tone: "emerald" },
    ],
    spectralBands2018: [0.16, 0.2, 0.26, 0.29, 0.32, 0.34, 0.36, 0.38, 0.44, 0.41],
    spectralBands2024: [0.22, 0.27, 0.35, 0.39, 0.43, 0.46, 0.49, 0.51, 0.56, 0.53],
    carbonMgPerHa: 18.6,
    thermalDeltaC: 1.9,
  },
  redsea: {
    id: "redsea",
    name: "Red Sea Global · Shura Lagoon",
    shortName: "Red Sea Shura",
    subtitle: "Al Wajh Coast · Regenerative Island Bridge & Mangrove Buffer",
    coordsLabel: "Al Wajh Coast · 25.58°N, 36.93°E",
    epsg: 32637,
    stacId: "S2A_REDSEA_SHURA_2018_2024",
    tileId: "S2A_37RLL_20240602",
    bbox: [36.89, 25.55, 36.96, 25.61],
    polygon: [
      [36.89, 25.55],
      [36.96, 25.55],
      [36.96, 25.61],
      [36.89, 25.61],
      [36.89, 25.55],
    ],
    baseAreaHa: 640.8,
    baseChangePct: 9.2,
    baseF1: 0.904,
    baseIou: 0.825,
    basePrecision: 0.924,
    baseRecall: 0.885,
    defaultEffect: "ndbi",
    anomalyRows: [
      { label: "Mangrove Nursery & Blue Carbon", baseVal: 0.395, baseAreaHa: 340, pct: 53, tone: "emerald" },
      { label: "Shura Causeway & Viaduct Span", baseVal: 0.21, baseAreaHa: 155, pct: 24, tone: "amber" },
      { label: "Overwater Resort Villa Piers", baseVal: 0.115, baseAreaHa: 82, pct: 13, tone: "crimson" },
      { label: "Lagoon Channel Carbonate Sand", baseVal: 0.06, baseAreaHa: 38, pct: 6, tone: "crimson" },
      { label: "Native Dune Halophyte Planting", baseVal: 0.28, baseAreaHa: 25, pct: 4, tone: "emerald" },
    ],
    spectralBands2018: [0.18, 0.21, 0.24, 0.22, 0.19, 0.17, 0.15, 0.14, 0.12, 0.1],
    spectralBands2024: [0.16, 0.22, 0.2, 0.29, 0.35, 0.39, 0.42, 0.44, 0.28, 0.24],
    carbonMgPerHa: -58.4,
    thermalDeltaC: -2.9,
  },
  rondonia: {
    id: "rondonia",
    name: "Rondônia · Primary Forest Loss",
    shortName: "Rondônia Canopy",
    subtitle: "Ariquemes Basin · Fishbone Canopy Clearance Benchmark",
    coordsLabel: "Ariquemes, Brazil · 10.86°S, 61.93°W",
    epsg: 32720,
    stacId: "S2B_RONDONIA_BR_2018_2024",
    tileId: "S2B_20LLQ_20240719",
    bbox: [-61.96, -10.89, -61.9, -10.83],
    polygon: [
      [-61.96, -10.89],
      [-61.9, -10.89],
      [-61.9, -10.83],
      [-61.96, -10.83],
      [-61.96, -10.89],
    ],
    baseAreaHa: 2151.4,
    baseChangePct: 20.1,
    baseF1: 0.942,
    baseIou: 0.89,
    basePrecision: 0.956,
    baseRecall: 0.929,
    defaultEffect: "confusion",
    anomalyRows: [
      { label: "Intact Dipterocarp & Terra Firme", baseVal: 0.485, baseAreaHa: 1120, pct: 52, tone: "emerald" },
      { label: "Fishbone Lateral Pasture Clearing", baseVal: 0.415, baseAreaHa: 580, pct: 27, tone: "crimson" },
      { label: "Secondary Regrowth Capoeira", baseVal: 0.26, baseAreaHa: 260, pct: 12, tone: "amber" },
      { label: "Unpaved Logging Spur Roads", baseVal: 0.11, baseAreaHa: 125, pct: 6, tone: "crimson" },
      { label: "Riparian Gallery Buffer Zone", baseVal: 0.34, baseAreaHa: 66, pct: 3, tone: "emerald" },
    ],
    spectralBands2018: [0.09, 0.12, 0.08, 0.26, 0.41, 0.49, 0.54, 0.56, 0.24, 0.16],
    spectralBands2024: [0.14, 0.17, 0.22, 0.25, 0.31, 0.35, 0.38, 0.4, 0.42, 0.36],
    carbonMgPerHa: 118.4,
    thermalDeltaC: 4.2,
  },
};

const MONTH_MODIFIERS: Record<MonthLabel, number> = {
  Jan: 0.88,
  Feb: 0.91,
  Mar: 0.95,
  Apr: 0.98,
  May: 1.02,
  Jun: 1.04,
  Jul: 1.0,
  Aug: 1.03,
  Sep: 0.99,
  Oct: 0.96,
  Nov: 0.93,
  Dec: 0.9,
};

export function getTemporalModifier(year: number, month: MonthLabel): number {
  const yearFactor = 0.55 + ((year - 2018) / 6) * 0.45;
  const monthFactor = MONTH_MODIFIERS[month] ?? 1.0;
  return yearFactor * monthFactor;
}
