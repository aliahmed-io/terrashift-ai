"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { StudioNav } from "@/components/studio-nav";

export interface StacCaseStudy {
  id: string;
  title: string;
  region: string;
  category: "vision2030" | "deforestation" | "hydrology" | "urban";
  categoryLabel: string;
  lat: number;
  lon: number;
  t1: number;
  t2: number;
  deltaPct: number;
  deltaLabel: string;
  areaHa: number;
  cloudCover: number;
  confidence: number;
  alertStatus: "CRITICAL" | "ACTIVE" | "SINK_VERIFIED";
  thresholdRule: string;
  revisitDays: number;
  summary: string;
}

const STAC_ATLAS_ITEMS: StacCaseStudy[] = [
  {
    id: "S2B_NEOM_THE_LINE_2019_2024",
    title: "NEOM · The Line Spine Excavation",
    region: "Tabuk Province, Saudi Arabia",
    category: "vision2030",
    categoryLabel: "Saudi Vision 2030",
    lat: 28.12,
    lon: 35.1,
    t1: 2019,
    t2: 2024,
    deltaPct: 18.4,
    deltaLabel: "+18.4% Linear Excavation",
    areaHa: 1420.5,
    cloudCover: 0.4,
    confidence: 0.96,
    alertStatus: "CRITICAL",
    thresholdRule: "ΔNDBI > +0.08 OR Corridor > 25 ha",
    revisitDays: 5,
    summary:
      "High-contrast linear foundation trenching, logistics staging camps, and haul-road networks across hyper-arid alluvial plains.",
  },
  {
    id: "S2A_NEOM_OXAGON_PORT_2018_2024",
    title: "NEOM Oxagon · Industrial Port & Solar Hub",
    region: "Duba Coast, Saudi Arabia",
    category: "vision2030",
    categoryLabel: "Saudi Vision 2030",
    lat: 28.07,
    lon: 34.93,
    t1: 2018,
    t2: 2024,
    deltaPct: 14.2,
    deltaLabel: "+14.2% Coastal Buildout",
    areaHa: 980.2,
    cloudCover: 0.8,
    confidence: 0.94,
    alertStatus: "ACTIVE",
    thresholdRule: "Coastal Reclamation > 10 ha",
    revisitDays: 5,
    summary:
      "Container terminal dredging, green-hydrogen electrolyzer pads, and coastal industrial basin expansion along the Red Sea.",
  },
  {
    id: "S2B_RED_SEA_SHURA_2018_2024",
    title: "Red Sea Global · Shura Island & Mangroves",
    region: "Al Wajh Lagoon, Saudi Arabia",
    category: "vision2030",
    categoryLabel: "Saudi Vision 2030",
    lat: 25.58,
    lon: 36.93,
    t1: 2018,
    t2: 2024,
    deltaPct: 9.8,
    deltaLabel: "+9.8% Eco-Infrastructure",
    areaHa: 640.0,
    cloudCover: 1.1,
    confidence: 0.93,
    alertStatus: "ACTIVE",
    thresholdRule: "Mangrove Buffer Loss > 0.5 ha",
    revisitDays: 5,
    summary:
      "3.3 km inter-island causeway, low-impact overwater villas, and protected coastal blue-carbon mangrove nursery zones.",
  },
  {
    id: "S2A_GREEN_RIYADH_WADI_2019_2024",
    title: "Green Riyadh · Wadi Hanifah Afforestation",
    region: "Riyadh, Saudi Arabia",
    category: "vision2030",
    categoryLabel: "Saudi Vision 2030",
    lat: 24.66,
    lon: 46.68,
    t1: 2019,
    t2: 2024,
    deltaPct: 11.6,
    deltaLabel: "+11.6% Canopy Gain (Sink)",
    areaHa: 890.4,
    cloudCover: 0.6,
    confidence: 0.95,
    alertStatus: "SINK_VERIFIED",
    thresholdRule: "ΔNDVI > +0.10 (Carbon Credit Verification)",
    revisitDays: 5,
    summary:
      "Irrigated urban corridor greening and native Acacia restoration reducing localized surface Urban Heat Island by -2.1°C.",
  },
  {
    id: "S2B_DUBAI_SOUTH_LOGISTICS_2017_2024",
    title: "Dubai South · Al Maktoum Aerotropolis",
    region: "Dubai, United Arab Emirates",
    category: "urban",
    categoryLabel: "MENA Megaprojects",
    lat: 24.89,
    lon: 55.16,
    t1: 2017,
    t2: 2024,
    deltaPct: 22.1,
    deltaLabel: "+22.1% Impervious Built",
    areaHa: 1840.0,
    cloudCover: 1.2,
    confidence: 0.97,
    alertStatus: "CRITICAL",
    thresholdRule: "Impervious Surface > 50 ha / yr",
    revisitDays: 5,
    summary:
      "Rapid desert-to-urban conversion featuring aviation logistics warehouses, arterial interchanges, and residential sub-districts.",
  },
  {
    id: "S2A_AMAZON_RONDONIA_2018_2024",
    title: "Rondônia · Fishbone Primary Forest Loss",
    region: "Ariquemes, Brazil",
    category: "deforestation",
    categoryLabel: "Deforestation Alert",
    lat: -10.86,
    lon: -61.93,
    t1: 2018,
    t2: 2024,
    deltaPct: -19.7,
    deltaLabel: "-19.7% Primary Canopy",
    areaHa: 2150.8,
    cloudCover: 6.4,
    confidence: 0.96,
    alertStatus: "CRITICAL",
    thresholdRule: "Primary Forest Clearing > 2.0 ha",
    revisitDays: 5,
    summary:
      "Systematic fishbone deforestation along secondary logging roads converting high-biomass Amazon rainforest into pasture.",
  },
  {
    id: "S2B_BORNEO_NUSANTARA_2019_2024",
    title: "East Kalimantan · Nusantara Capital Clearing",
    region: "Borneo, Indonesia",
    category: "deforestation",
    categoryLabel: "Deforestation Alert",
    lat: -0.97,
    lon: 116.71,
    t1: 2019,
    t2: 2024,
    deltaPct: -16.4,
    deltaLabel: "-16.4% Canopy Conversion",
    areaHa: 1620.3,
    cloudCover: 8.2,
    confidence: 0.92,
    alertStatus: "CRITICAL",
    thresholdRule: "Canopy Loss > 5.0 ha OR Road Cut",
    revisitDays: 5,
    summary:
      "Canopy clearing and earthworks for Indonesia's new planned capital city Nusantara amidst tropical lowland forests.",
  },
  {
    id: "S2A_SANTA_CRUZ_SOY_2017_2024",
    title: "Santa Cruz · Chiquitano Dry Forest Frontier",
    region: "Tierras Bajas, Bolivia",
    category: "deforestation",
    categoryLabel: "Deforestation Alert",
    lat: -17.65,
    lon: -62.15,
    t1: 2017,
    t2: 2024,
    deltaPct: -24.3,
    deltaLabel: "-24.3% Radial Clearings",
    areaHa: 2890.0,
    cloudCover: 4.1,
    confidence: 0.97,
    alertStatus: "CRITICAL",
    thresholdRule: "Agricultural Parcel Expansion > 10 ha",
    revisitDays: 5,
    summary:
      "Geometric radial and rectilinear industrial soy/cattle clearings replacing intact Chiquitano dry tropical forest.",
  },
  {
    id: "S2B_CONGO_BASIN_LOGGING_2018_2024",
    title: "Yangambi · Congo Basin Selective Logging",
    region: "Tshopo Province, DRC",
    category: "deforestation",
    categoryLabel: "Deforestation Alert",
    lat: 0.78,
    lon: 24.47,
    t1: 2018,
    t2: 2024,
    deltaPct: -8.9,
    deltaLabel: "-8.9% Corridor Disturbance",
    areaHa: 740.6,
    cloudCover: 9.5,
    confidence: 0.91,
    alertStatus: "ACTIVE",
    thresholdRule: "Logging Haul Track Detection > 1.0 ha",
    revisitDays: 10,
    summary:
      "Smallholder shifting cultivation expansion and selective timber extraction corridors along the Congo River basin.",
  },
  {
    id: "S2A_GERD_RESERVOIR_2018_2024",
    title: "Grand Ethiopian Renaissance Dam (GERD) Filling",
    region: "Benishangul-Gumuz, Ethiopia",
    category: "hydrology",
    categoryLabel: "Hydrology & Climate",
    lat: 11.21,
    lon: 35.09,
    t1: 2018,
    t2: 2024,
    deltaPct: 31.5,
    deltaLabel: "+31.5% Surface Inundation",
    areaHa: 3420.0,
    cloudCover: 3.8,
    confidence: 0.98,
    alertStatus: "CRITICAL",
    thresholdRule: "Reservoir Water Extent Δ > 50 ha",
    revisitDays: 5,
    summary:
      "Multi-stage Blue Nile reservoir impoundment submerging riverine gorge valleys behind the main roller-compacted concrete dam.",
  },
  {
    id: "S2B_ARAL_SEA_DESICCATION_2017_2024",
    title: "South Aral Sea · Basin Desiccation & Salt Flats",
    region: "Karakalpakstan, Uzbekistan",
    category: "hydrology",
    categoryLabel: "Hydrology & Climate",
    lat: 45.02,
    lon: 59.58,
    t1: 2017,
    t2: 2024,
    deltaPct: -27.8,
    deltaLabel: "-27.8% Water Retreat",
    areaHa: 4120.5,
    cloudCover: 1.9,
    confidence: 0.97,
    alertStatus: "CRITICAL",
    thresholdRule: "Shoreline Retreat > 100m",
    revisitDays: 10,
    summary:
      "Progressive shallow-basin evaporation exposing high-albedo solonchak salt crusts (Aralkum Desert) across the eastern lobe.",
  },
  {
    id: "S2A_LAKE_MEAD_DROUGHT_2017_2024",
    title: "Lake Mead · Overton Arm Megadrought",
    region: "Nevada / Arizona, USA",
    category: "hydrology",
    categoryLabel: "Hydrology & Climate",
    lat: 36.14,
    lon: -114.42,
    t1: 2017,
    t2: 2024,
    deltaPct: -14.6,
    deltaLabel: "-14.6% Shoreline Contraction",
    areaHa: 1190.2,
    cloudCover: 0.5,
    confidence: 0.96,
    alertStatus: "ACTIVE",
    thresholdRule: "Bathymetric Ring Exposure > 5 ha",
    revisitDays: 5,
    summary:
      "Colorado River basin structural deficit exposing carbonate 'bathtub ring' mineral margins and shrinking marina channels.",
  },
];

function buildStacItemJson(item: StacCaseStudy) {
  const d = 0.025;
  const bbox = [
    Number((item.lon - d).toFixed(4)),
    Number((item.lat - d).toFixed(4)),
    Number((item.lon + d).toFixed(4)),
    Number((item.lat + d).toFixed(4)),
  ];
  return {
    stac_version: "1.0.0",
    stac_extensions: [
      "https://stac-extensions.github.io/eo/v1.1.0/schema.json",
      "https://stac-extensions.github.io/proj/v1.1.0/schema.json",
      "https://stac-extensions.github.io/mlm/v1.2.0/schema.json",
    ],
    type: "Feature",
    id: item.id,
    collection: `terrashift-${item.category}-v1`,
    bbox,
    geometry: {
      type: "Polygon",
      coordinates: [
        [
          [bbox[0], bbox[1]],
          [bbox[2], bbox[1]],
          [bbox[2], bbox[3]],
          [bbox[0], bbox[3]],
          [bbox[0], bbox[1]],
        ],
      ],
    },
    properties: {
      title: item.title,
      description: item.summary,
      datetime: `${item.t2}-06-15T10:30:00Z`,
      start_datetime: `${item.t1}-01-01T00:00:00Z`,
      end_datetime: `${item.t2}-12-31T23:59:59Z`,
      constellation: "sentinel-2",
      instruments: ["msi"],
      gsd: 10.0,
      "eo:cloud_cover": item.cloudCover,
      "proj:epsg": 3857,
      "terrashift:model": "SiameseResUNet-10ch-v1.1",
      "terrashift:change_pct": item.deltaPct,
      "terrashift:affected_area_ha": item.areaHa,
      "terrashift:confidence": item.confidence,
      "terrashift:alert_status": item.alertStatus,
      "terrashift:threshold_rule": item.thresholdRule,
    },
    links: [
      {
        rel: "self",
        href: `https://terrashift.ai/stac/items/${item.id}.json`,
        type: "application/geo+json",
      },
      {
        rel: "collection",
        href: `https://terrashift.ai/stac/collections/terrashift-${item.category}-v1.json`,
        type: "application/json",
      },
    ],
    assets: {
      t1_composite: {
        href: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${item.t1}_3857/default/g/{z}/{y}/{x}.jpg`,
        type: "image/jpeg",
        title: `Sentinel-2 Cloudless ${item.t1} Baseline`,
        roles: ["visual", "data"],
      },
      t2_composite: {
        href: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${item.t2}_3857/default/g/{z}/{y}/{x}.jpg`,
        type: "image/jpeg",
        title: `Sentinel-2 Cloudless ${item.t2} Target`,
        roles: ["visual", "data"],
      },
      change_vectors: {
        href: `/api/analyze?item=${item.id}`,
        type: "application/geo+json",
        title: "Siamese U-Net Change Polygons",
        roles: ["labels", "metadata"],
      },
    },
  };
}

export default function WatchlistPage() {
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [subscribedIds, setSubscribedIds] = useState<Record<string, boolean>>({
    S2B_NEOM_THE_LINE_2019_2024: true,
    S2A_GREEN_RIYADH_WADI_2019_2024: true,
    S2A_AMAZON_RONDONIA_2018_2024: true,
    S2A_GERD_RESERVOIR_2018_2024: true,
  });
  const [selectedStacItem, setSelectedStacItem] = useState<StacCaseStudy>(STAC_ATLAS_ITEMS[0]!);

  const filteredItems = useMemo(() => {
    return STAC_ATLAS_ITEMS.filter((item) => {
      const matchesCat = activeCategory === "all" || item.category === activeCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.region.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);
      return matchesCat && matchesSearch;
    });
  }, [activeCategory, searchQuery]);

  const toggleSubscription = (id: string) => {
    setSubscribedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDownloadStac = (item: StacCaseStudy) => {
    const jsonStr = JSON.stringify(buildStacItemJson(item), null, 2);
    const blob = new Blob([jsonStr], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.id}.stac.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeWatchCount = Object.values(subscribedIds).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-orbital-canvas text-bone-100 flex flex-col">
      <StudioNav />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Header & STAC Provenance */}
        <section className="orbital-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-signal-400/10 border border-signal-400/30 text-signal-400 text-[10px] font-mono uppercase tracking-widest mb-3">
              <span className="size-1.5 rounded-full bg-signal-400" />
              <span>STAC 1.0.0 Spatio-Temporal Asset Catalog & Watchlist</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-bone-100">
              Global & Saudi Vision 2030 Case-Study Atlas
            </h1>
            <p className="text-xs sm:text-sm text-bone-300 mt-1.5 max-w-3xl leading-relaxed">
              Browse 12 curated Sentinel-2 change-detection STAC items across Saudi Vision 2030 giga-projects, tropical deforestation frontiers, and hydrological basins. Configure automated 5-day revisit alert rules or launch directly into the Map Studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href="https://github.com/radiantearth/stac-browser"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-ink-950/90 hover:border-signal-400/50 border border-bone-100/15 text-bone-200 font-mono transition-colors"
            >
              Ref: radiantearth/stac-browser
            </a>
            <a
              href="https://github.com/radiantearth/stac-spec"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-ink-950/90 hover:border-signal-400/50 border border-bone-100/15 text-bone-200 font-mono transition-colors"
            >
              Ref: radiantearth/stac-spec (v1.0.0)
            </a>
          </div>
        </section>

        {/* Filter Bar & Watchlist Summary */}
        <section className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 orbital-panel rounded-2xl p-4">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: "all", label: "All STAC Items (12)" },
              { id: "vision2030", label: "Saudi Vision 2030 (4)" },
              { id: "deforestation", label: "Deforestation & Forest (4)" },
              { id: "hydrology", label: "Hydrology & Water (3)" },
              { id: "urban", label: "MENA Megaprojects (1)" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveCategory(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === tab.id
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "bg-ink-950/80 text-bone-300 hover:text-bone-100 border border-bone-100/10"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by region, STAC ID, or project..."
              className="h-9 px-3 rounded-lg bg-ink-950 border border-bone-100/15 text-xs text-bone-100 placeholder:text-bone-400 focus:outline-none focus:border-signal-400 w-full md:w-64"
            />
            <div className="shrink-0 px-3 py-1.5 rounded-lg bg-phosphor-400/10 border border-phosphor-400/30 text-phosphor-400 text-xs font-mono tabular-nums">
              {activeWatchCount} Active Watch Rules
            </div>
          </div>
        </section>

        {/* Main Grid: Left 8 Cols = STAC Cards, Right 4 Cols = STAC 1.0.0 Item Inspector */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* STAC Catalog Grid */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredItems.map((item) => {
              const isSubscribed = Boolean(subscribedIds[item.id]);
              const isSelected = selectedStacItem.id === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedStacItem(item)}
                  className={`cursor-pointer rounded-2xl p-5 transition-all flex flex-col justify-between ${
                    isSelected
                      ? "orbital-panel-active"
                      : "orbital-panel hover:border-bone-100/25"
                  }`}
                >
                  <div>
                    {/* Top Row: Category Badge & Alert Status */}
                    <div className="flex items-center justify-between gap-2 mb-2.5">
                      <span className="px-2 py-0.5 rounded bg-ink-950/80 border border-bone-100/10 text-[10px] font-mono uppercase tracking-wider text-bone-300">
                        {item.categoryLabel}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                          item.alertStatus === "CRITICAL"
                            ? "bg-crimson-400/15 text-crimson-400 border border-crimson-400/30"
                            : item.alertStatus === "SINK_VERIFIED"
                              ? "bg-phosphor-400/15 text-phosphor-400 border border-phosphor-400/30"
                              : "bg-signal-400/15 text-signal-400 border border-signal-400/30"
                        }`}
                      >
                        {item.alertStatus}
                      </span>
                    </div>

                    <h2 className="font-display text-xl text-bone-100">{item.title}</h2>
                    <div className="text-xs text-bone-400 font-mono mt-0.5 tabular-nums">
                      {item.region} · [{item.lat.toFixed(2)}°, {item.lon.toFixed(2)}°]
                    </div>

                    <p className="text-xs text-bone-300 mt-2.5 leading-relaxed">
                      {item.summary}
                    </p>

                    {/* STAC Metadata Strip */}
                    <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 rounded-xl bg-ink-950/80 border border-bone-100/10 text-center font-mono tabular-nums">
                      <div>
                        <div className="text-[10px] text-bone-400">Epoch Window</div>
                        <div className="text-xs font-semibold text-bone-100 mt-0.5">
                          {item.t1} → {item.t2}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-bone-400">Detected Shift</div>
                        <div
                          className={`text-xs font-semibold mt-0.5 ${
                            item.alertStatus === "SINK_VERIFIED"
                              ? "text-phosphor-400"
                              : "text-signal-400"
                          }`}
                        >
                          {item.deltaPct > 0 ? `+${item.deltaPct}%` : `${item.deltaPct}%`}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-bone-400">Affected Area</div>
                        <div className="text-xs font-semibold text-bone-100 mt-0.5">
                          {item.areaHa.toLocaleString()} ha
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Watch Rule Toggle & Deep Links */}
                  <div className="mt-4 pt-3 border-t border-bone-100/10 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSubscription(item.id);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-[11px] font-mono transition-colors border ${
                        isSubscribed
                          ? "bg-phosphor-400/15 border-phosphor-400/40 text-phosphor-400"
                          : "bg-ink-950/80 border-bone-100/15 text-bone-300 hover:text-bone-100"
                      }`}
                    >
                      {isSubscribed ? "Watch Rule: ON (5d)" : "Enable Watch Rule"}
                    </button>

                    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Link
                        href={`/analyze?lat=${item.lat}&lon=${item.lon}&t1=${item.t1}&t2=${item.t2}&label=${encodeURIComponent(item.title)}`}
                        className="px-3 py-1.5 rounded-lg bg-signal-400 hover:bg-signal-500 text-ink-950 font-semibold text-xs transition-colors"
                      >
                        Open in Map Studio
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column: Live STAC 1.0.0 Item Inspector */}
          <div className="lg:col-span-4 orbital-panel rounded-2xl p-5 sticky top-20 space-y-4">
            <div className="flex items-center justify-between border-b border-bone-100/10 pb-3">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-signal-400">
                  STAC 1.0.0 Feature Inspector
                </div>
                <h3 className="text-sm font-semibold text-bone-100 font-mono mt-0.5">
                  {selectedStacItem.id}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => handleDownloadStac(selectedStacItem)}
                className="px-2.5 py-1.5 rounded-lg bg-ink-950 hover:border-signal-400/50 border border-bone-100/15 text-xs font-mono text-bone-100 transition-colors"
              >
                Export .stac.json
              </button>
            </div>

            {/* Watchlist Rule Specification */}
            <div className="p-3 rounded-xl bg-ink-950/80 border border-bone-100/10 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-bone-400 font-mono">Automated Trigger Rule</span>
                <span className="text-phosphor-400 font-mono">
                  Sentinel-2 ({selectedStacItem.revisitDays}d Revisit)
                </span>
              </div>
              <div className="text-xs font-mono text-bone-100">
                {selectedStacItem.thresholdRule}
              </div>
              <div className="text-[11px] text-bone-400 font-mono tabular-nums">
                eo:cloud_cover: {selectedStacItem.cloudCover}% · mlm:confidence:{" "}
                {(selectedStacItem.confidence * 100).toFixed(1)}%
              </div>
            </div>

            {/* STAC JSON Code Viewer */}
            <div>
              <div className="text-[10px] font-mono uppercase tracking-widest text-bone-400 mb-1.5">
                RFC 7946 STAC Item Payload
              </div>
              <pre className="p-3 rounded-xl bg-ink-950 border border-bone-100/10 text-[11px] font-mono text-bone-200 overflow-x-auto max-h-[380px] overflow-y-auto leading-relaxed">
                {JSON.stringify(buildStacItemJson(selectedStacItem), null, 2)}
              </pre>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
