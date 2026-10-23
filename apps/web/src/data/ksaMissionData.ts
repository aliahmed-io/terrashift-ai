export interface KsaMissionSite {
  readonly id: string;
  readonly pillTitle: string;
  readonly pillBadge: string;
  readonly pillBadgeTone: "amber" | "cyan" | "emerald" | "slate";
  readonly targetHeader: string;
  readonly mgrs: string;
  readonly acquisitionSubtitle: string;
  readonly crs: string;
  readonly cloudCover: string;
  readonly depth: string;
  readonly frameCoords: string;
  readonly lat: number;
  readonly lon: number;
  readonly anchorT0Label: string;
  readonly inferredT1Label: string;
  readonly baseImage: string;
  readonly overlayImage: string;
  readonly benchmarks: {
    readonly iou: string;
    readonly iouDelta: string;
    readonly f1: string;
    readonly f1Delta: string;
    readonly precision: string;
    readonly recall: string;
    readonly stage1Pct: number;
    readonly stage2Pct: number;
    readonly stage34Pct: number;
    readonly latencyMs: string;
  };
  readonly bfast: {
    readonly subtitle: string;
    readonly svgPathBaseline: string;
    readonly svgPathUpperCi: string;
    readonly markers: readonly {
      readonly cx: number;
      readonly cy: number;
      readonly color: string;
    }[];
    readonly timelineLabels: readonly {
      readonly year: string;
      readonly subtitle: string;
      readonly tone: "neutral" | "crimson" | "emerald" | "cyan";
    }[];
    readonly breakMagnitude: string;
    readonly confidence: string;
    readonly cycleFrequency: string;
  };
  readonly carbonUhi: {
    readonly badge: string;
    readonly sequestrationDelta: string;
    readonly sequestrationYoy: string;
    readonly sequestrationNote: string;
    readonly deltaLst: string;
    readonly deltaLstCompare: string;
    readonly deltaLstZoneLabel: string;
    readonly ndwi: string;
    readonly ndre: string;
  };
}

export const KSA_MISSION_SITES: readonly KsaMissionSite[] = [
  {
    id: "riyadh",
    pillTitle: "ROSHN Riyadh & King Salman Park",
    pillBadge: "+428.4 km² Δ",
    pillBadgeTone: "amber",
    targetHeader: "RIYADH METROPOLITAN TRANSFORMATION (NORTH-CENTRAL AXIS)",
    mgrs: "MGRS: 38R MV 6842 3418",
    acquisitionSubtitle: "Acquisition: Sentinel-2 MSI L2A (10m) True Color Composites",
    crs: "EPSG:32638 (UTM 38N)",
    cloudCover: "0.02%",
    depth: "12-BIT BOA L2A",
    frameCoords: "N 24°50'06\" // E 46°44'42\"",
    lat: 24.835,
    lon: 46.745,
    anchorT0Label: "SENTINEL-2A: 2018-04-12 [PRE-DEVELOPMENT]",
    inferredT1Label: "SIAMESE-U-NET-M1: 2024-03-28 [TRANSFORMATION]",
    baseImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/12/1778/2580.jpg",
    overlayImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/12/1778/2580.jpg",
    benchmarks: {
      iou: "25.19%",
      iouDelta: "+2.19%",
      f1: "40.25%",
      f1Delta: "+2.86%",
      precision: "47.96%",
      recall: "34.67%",
      stage1Pct: 94.1,
      stage2Pct: 88.5,
      stage34Pct: 96.3,
      latencyMs: "70.2ms",
    },
    bfast: {
      subtitle: "Multi-Year Velocity & Urban Expansion Trajectory (2017 - 2030 Scenario)",
      svgPathBaseline: "M 0,90 Q 30,80 60,90 T 120,92 T 180,95 L 210,110 L 260,115 L 320,60 L 390,30 L 450,20 L 500,15",
      svgPathUpperCi: "M 0,85 Q 30,75 60,85 T 120,87 T 180,90 L 210,105 L 260,110 L 320,52 L 390,24 L 450,14 L 500,10",
      markers: [
        { cx: 210, cy: 110, color: "#FF3B5C" },
        { cx: 320, cy: 60, color: "#00F5A0" },
        { cx: 450, cy: 20, color: "#38E8FF" },
      ],
      timelineLabels: [
        { year: "2018", subtitle: "Arid Baseline", tone: "neutral" },
        { year: "2020 Breakpoint", subtitle: "Mass Grading (-0.42 Δ)", tone: "crimson" },
        { year: "2023 Infrastructure", subtitle: "Greening Phase 1 (+0.58 Δ)", tone: "emerald" },
        { year: "2030 Target", subtitle: "Vision 2030 Scenario", tone: "cyan" },
      ],
      breakMagnitude: "-0.42 → +0.58",
      confidence: "MOSUM Ratio > 1.35 (Break Detected)",
      cycleFrequency: "Annual S2 Composites",
    },
    carbonUhi: {
      badge: "SGI GAIN",
      sequestrationDelta: "+142,800",
      sequestrationYoy: "+28.4% YOY",
      sequestrationNote: "King Salman Park & Wadi Hanifah (IPCC Tier-1 Modeled ±30%)",
      deltaLst: "-3.8°C",
      deltaLstCompare: "vs +4.2°C Dense Fabric",
      deltaLstZoneLabel: "COOLING PROXY",
      ndwi: "+0.41 (Hydrated)",
      ndre: "0.68 (Optimal Health)",
    },
  },
  {
    id: "neom",
    pillTitle: "NEOM The Line (Sector 01)",
    pillBadge: "89.2 km²",
    pillBadgeTone: "cyan",
    targetHeader: "NEOM THE LINE — LINEAR FOUNDATION CORRIDOR & SPINE",
    mgrs: "MGRS: 36R VU 9814 0821",
    acquisitionSubtitle: "Acquisition: Sentinel-2 MSI L2A (10m) Multi-Temporal Composites",
    crs: "EPSG:32636 (UTM 36N)",
    cloudCover: "0.00%",
    depth: "12-BIT BOA L2A",
    frameCoords: "N 28°05'42\" // E 35°05'06\"",
    lat: 28.095,
    lon: 35.085,
    anchorT0Label: "SENTINEL-2A: 2018-05-19 [UNTOUCHED TABUK BASIN]",
    inferredT1Label: "SIAMESE-U-NET-M1: 2024-04-14 [EXCAVATION TRENCH]",
    baseImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/12/1714/2447.jpg",
    overlayImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/12/1714/2447.jpg",
    benchmarks: {
      iou: "25.19%",
      iouDelta: "+2.19%",
      f1: "40.25%",
      f1Delta: "+2.86%",
      precision: "47.96%",
      recall: "34.67%",
      stage1Pct: 96.4,
      stage2Pct: 91.2,
      stage34Pct: 97.8,
      latencyMs: "70.2ms",
    },
    bfast: {
      subtitle: "Linear Earthworks Velocity & Spine Excavation Breakpoint (2017 - 2030 Scenario)",
      svgPathBaseline: "M 0,102 Q 40,100 90,101 T 180,100 L 225,82 L 290,48 L 360,28 L 430,18 L 500,12",
      svgPathUpperCi: "M 0,97 Q 40,95 90,96 T 180,95 L 225,75 L 290,40 L 360,21 L 430,12 L 500,7",
      markers: [
        { cx: 225, cy: 82, color: "#FF3B5C" },
        { cx: 290, cy: 48, color: "#FFB020" },
        { cx: 430, cy: 18, color: "#38E8FF" },
      ],
      timelineLabels: [
        { year: "2018", subtitle: "Desert Baseline", tone: "neutral" },
        { year: "2021 Breakpoint", subtitle: "Trench Excavation (+0.64 ΔNDBI)", tone: "crimson" },
        { year: "2024 Spine", subtitle: "Module 1 Piling (89.2 km²)", tone: "emerald" },
        { year: "2030 Target", subtitle: "Phase 1 Operational Scenario", tone: "cyan" },
      ],
      breakMagnitude: "+0.64 ΔNDBI",
      confidence: "MOSUM Ratio > 1.50 (Break Detected)",
      cycleFrequency: "Annual S2 Composites",
    },
    carbonUhi: {
      badge: "ZERO-GRID",
      sequestrationDelta: "+64,200",
      sequestrationYoy: "+19.2% YOY",
      sequestrationNote: "95% Land Preservation Mandate (IPCC Tier-1 Modeled ±30%)",
      deltaLst: "-2.1°C",
      deltaLstCompare: "Canyon Shade vs +3.4°C Graded Berm",
      deltaLstZoneLabel: "SHADED SPINE PROXY",
      ndwi: "+0.18 (Desal Buffer)",
      ndre: "0.42 (Arid Shrub)",
    },
  },
  {
    id: "redsea",
    pillTitle: "Red Sea Shura Island",
    pillBadge: "14.6 km²",
    pillBadgeTone: "emerald",
    targetHeader: "RED SEA GLOBAL — SHURA ISLAND CAUSEWAY & LAGOON",
    mgrs: "MGRS: 37R KL 9240 0912",
    acquisitionSubtitle: "Acquisition: Sentinel-2 MSI L2A Bathymetric & Coastal Stack",
    crs: "EPSG:32637 (UTM 37N)",
    cloudCover: "0.01%",
    depth: "12-BIT BOA L2A",
    frameCoords: "N 25°23'42\" // E 36°56'06\"",
    lat: 25.395,
    lon: 36.935,
    anchorT0Label: "SENTINEL-2A: 2018-03-08 [UNINHABITED ATOLL]",
    inferredT1Label: "SIAMESE-U-NET-M1: 2024-03-22 [3.3KM SEA BRIDGE & RESORTS]",
    baseImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/12/1749/2468.jpg",
    overlayImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/12/1749/2468.jpg",
    benchmarks: {
      iou: "25.19%",
      iouDelta: "+2.19%",
      f1: "40.25%",
      f1Delta: "+2.86%",
      precision: "47.96%",
      recall: "34.67%",
      stage1Pct: 95.2,
      stage2Pct: 90.4,
      stage34Pct: 95.8,
      latencyMs: "70.2ms",
    },
    bfast: {
      subtitle: "Coastal Causeway Construction & Mangrove Expansion (2017 - 2030 Scenario)",
      svgPathBaseline: "M 0,95 Q 50,92 100,94 T 190,93 L 240,68 L 310,45 L 380,32 L 450,22 L 500,18",
      svgPathUpperCi: "M 0,90 Q 50,87 100,89 T 190,88 L 240,61 L 310,38 L 380,26 L 450,16 L 500,12",
      markers: [
        { cx: 240, cy: 68, color: "#FFB020" },
        { cx: 310, cy: 45, color: "#00F5A0" },
        { cx: 450, cy: 22, color: "#38E8FF" },
      ],
      timelineLabels: [
        { year: "2018", subtitle: "Natural Lagoon", tone: "neutral" },
        { year: "2021 Causeway", subtitle: "3.3km Bridge Span", tone: "crimson" },
        { year: "2024 Nursery", subtitle: "50M Mangrove Target", tone: "emerald" },
        { year: "2030 Target", subtitle: "30% Net Conservation Scenario", tone: "cyan" },
      ],
      breakMagnitude: "+0.49 ΔNDWI",
      confidence: "MOSUM Ratio > 1.25 (Break Detected)",
      cycleFrequency: "Annual S2 Composites",
    },
    carbonUhi: {
      badge: "BLUE CARBON",
      sequestrationDelta: "+218,500",
      sequestrationYoy: "+34.0% YOY",
      sequestrationNote: "Al Wajh Mangrove Soil Organic Carbon (IPCC Tier-1 Modeled ±30%)",
      deltaLst: "-4.4°C",
      deltaLstCompare: "Marine Lagoon Breeze vs Coastal Sabkha",
      deltaLstZoneLabel: "LAGOON PROXY",
      ndwi: "+0.72 (Marine Lagoon)",
      ndre: "0.74 (Mangrove Canopy)",
    },
  },
  {
    id: "aljouf",
    pillTitle: "Al-Jouf Agri Pivots",
    pillBadge: "1,240 circles",
    pillBadgeTone: "slate",
    targetHeader: "AL-JOUF WADI AS-SIRHAN — CENTER-PIVOT AFFORESTATION OASIS",
    mgrs: "MGRS: 37R MP 3781 1690",
    acquisitionSubtitle: "Acquisition: Sentinel-2 MSI L2A Agricultural Composites",
    crs: "EPSG:32637 (UTM 37N)",
    cloudCover: "0.00%",
    depth: "12-BIT BOA L2A",
    frameCoords: "N 29°59'06\" // E 38°21'18\"",
    lat: 29.985,
    lon: 38.355,
    anchorT0Label: "SENTINEL-2A: 2018-03-15 [BASELINE ARID BASIN]",
    inferredT1Label: "SIAMESE-U-NET-M1: 2024-03-30 [OLIVE & PIVOT EXPANSION]",
    baseImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/11/845/1242.jpg",
    overlayImage: "https://a.tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/11/845/1242.jpg",
    benchmarks: {
      iou: "25.19%",
      iouDelta: "+2.19%",
      f1: "40.25%",
      f1Delta: "+2.86%",
      precision: "47.96%",
      recall: "34.67%",
      stage1Pct: 97.1,
      stage2Pct: 94.8,
      stage34Pct: 98.2,
      latencyMs: "70.2ms",
    },
    bfast: {
      subtitle: "Multi-Year Olive Orchard Expansion Trajectory (2017 - 2030 Scenario)",
      svgPathBaseline: "M 0,98 Q 35,70 70,95 T 140,92 L 200,62 L 270,40 L 350,24 L 430,16 L 500,11",
      svgPathUpperCi: "M 0,92 Q 35,64 70,89 T 140,86 L 200,55 L 270,33 L 350,18 L 430,10 L 500,6",
      markers: [
        { cx: 200, cy: 62, color: "#00F5A0" },
        { cx: 350, cy: 24, color: "#38E8FF" },
      ],
      timelineLabels: [
        { year: "2018", subtitle: "Baseline Pivots", tone: "neutral" },
        { year: "2020 Expansion", subtitle: "+320 Olive Circles", tone: "emerald" },
        { year: "2024 Canopy", subtitle: "20M Olive Trees (+0.69 ΔNDVI)", tone: "emerald" },
        { year: "2030 SGI", subtitle: "Aquifer-Optimum Yield Scenario", tone: "cyan" },
      ],
      breakMagnitude: "+0.69 ΔNDVI",
      confidence: "MOSUM Ratio > 1.40 (Break Detected)",
      cycleFrequency: "Annual S2 Composites",
    },
    carbonUhi: {
      badge: "AGRI SINK",
      sequestrationDelta: "+310,400",
      sequestrationYoy: "+41.2% YOY",
      sequestrationNote: "Al-Jouf Olive Orchards & Shelterbelts (IPCC Tier-1 Modeled ±30%)",
      deltaLst: "-5.2°C",
      deltaLstCompare: "Irrigated Canopy vs +4.8°C Surrounding Nafud Desert",
      deltaLstZoneLabel: "OASIS PROXY",
      ndwi: "+0.54 (Drip Regulated)",
      ndre: "0.81 (High Chlorophyll)",
    },
  },
];
