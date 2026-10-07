"use client";

import { useEffect, useState, useCallback } from "react";
import { StudioNav } from "@/components/studio-nav";
import { OrbitalLoupe } from "@/components/ui/orbital-loupe";

interface CarbonPool {
  pool_id: string;
  label: string;
  formula: string;
  density_mg_c_ha: number;
  emissions_tco2e: number;
  share_pct: number;
}

interface CarbonResponse {
  biome_id: string;
  biome_name: string;
  pool_mode: string;
  t1_year: number;
  t2_year: number;
  total_aoi_ha: number;
  loss_area_ha: number;
  gain_area_ha: number;
  impervious_area_ha: number;
  agb_loss_tons: number;
  total_c_density_mg_ha: number;
  gross_emissions_tco2e: number;
  gross_removals_tco2e: number;
  net_flux_tco2e: number;
  is_net_sink: boolean;
  carbon_price_usd: number;
  vcm_valuation_usd: number;
  equivalencies: {
    passenger_cars_yr: number;
    homes_electricity_yr: number;
    mature_trees_10yr: number;
  };
  uhi: {
    mean_lst_shift_c: number;
    peak_hotspot_c: number;
    cooling_island_c: number;
  };
  pools: CarbonPool[];
  flux_map_base64: string;
  uhi_map_base64: string;
}

const CARBON_SCENARIOS = [
  {
    id: "green_riyadh",
    label: "Green Riyadh · King Salman Park & Wadi Hanifah (KSA)",
    biome_id: "urban_afforestation",
    t1_year: 2018,
    t2_year: 2024,
    polygon: [
      [46.715, 24.815],
      [46.775, 24.815],
      [46.775, 24.855],
      [46.715, 24.855],
      [46.715, 24.815],
    ],
  },
  {
    id: "red_sea_mangroves",
    label: "Red Sea Global · Shura Island & Mangrove Lagoon (KSA)",
    biome_id: "mangrove_blue_carbon",
    t1_year: 2018,
    t2_year: 2024,
    polygon: [
      [36.905, 25.375],
      [36.965, 25.375],
      [36.965, 25.415],
      [36.905, 25.415],
      [36.905, 25.375],
    ],
  },
  {
    id: "neom_oxagon",
    label: "NEOM · The Line & Oxagon Corridor (KSA)",
    biome_id: "arid_desert_corridor",
    t1_year: 2018,
    t2_year: 2024,
    polygon: [
      [35.055, 28.075],
      [35.115, 28.075],
      [35.115, 28.115],
      [35.055, 28.115],
      [35.055, 28.075],
    ],
  },
  {
    id: "rondonia",
    label: "Rondônia, Brazil · Amazon Deforestation",
    biome_id: "tropical_rainforest",
    t1_year: 2018,
    t2_year: 2024,
    polygon: [
      [-61.96, -10.89],
      [-61.91, -10.89],
      [-61.91, -10.84],
      [-61.96, -10.84],
      [-61.96, -10.89],
    ],
  },
] as const;

const BIOME_OPTIONS = [
  { id: "tropical_rainforest", label: "Tropical Humid Rainforest (285 Mg AGB/ha)" },
  { id: "mangrove_blue_carbon", label: "Coastal Mangrove & Blue Carbon (380 Mg SOC/ha)" },
  { id: "urban_afforestation", label: "Urban Afforestation & Greening (Green Riyadh)" },
  { id: "arid_desert_corridor", label: "Subtropical Arid & Desert Corridor (MENA)" },
  { id: "temperate_forest", label: "Temperate Mixed & Boreal Forest (175 Mg AGB/ha)" },
] as const;

export default function CarbonPage() {
  const [scenarioIdx, setScenarioIdx] = useState<number>(0);
  const [biomeId, setBiomeId] = useState<string>("tropical_rainforest");
  const [poolMode, setPoolMode] = useState<"biomass_soil" | "biomass_only">("biomass_soil");
  const [carbonPrice, setCarbonPrice] = useState<number>(35);
  const [data, setData] = useState<CarbonResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const runCarbonAudit = useCallback(
    async (idx: number, biome: string, mode: "biomass_soil" | "biomass_only", price: number) => {
      const sc = CARBON_SCENARIOS[idx] ?? CARBON_SCENARIOS[0];
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/carbon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            polygon: sc.polygon,
            year_t1: sc.t1_year,
            year_t2: sc.t2_year,
            biome_id: biome,
            pool_mode: mode,
            carbon_price_usd: price,
          }),
        });
        if (!res.ok) {
          throw new Error(`Carbon flux engine returned HTTP ${res.status}`);
        }
        const json = (await res.json()) as CarbonResponse;
        setData(json);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Carbon flux computation failed");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void runCarbonAudit(scenarioIdx, biomeId, poolMode, carbonPrice);
  }, [scenarioIdx, biomeId, poolMode, carbonPrice, runCarbonAudit]);

  const handleSelectScenario = (idx: number) => {
    const sc = CARBON_SCENARIOS[idx];
    if (!sc) return;
    setScenarioIdx(idx);
    setBiomeId(sc.biome_id);
  };

  return (
    <div className="min-h-screen bg-orbital-canvas text-bone-100 flex flex-col">
      <StudioNav />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Header & GitHub Provenance */}
        <section className="orbital-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-phosphor-400/10 border border-phosphor-400/30 text-phosphor-400 text-[10px] font-mono uppercase tracking-widest mb-3">
              <span className="size-1.5 rounded-full bg-phosphor-400" />
              <span>IPCC Tier-1 Carbon Flux & Urban Microclimate Engine</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-bone-100">
              Carbon Flux, Biomass Pools & Urban Heat Island
            </h1>
            <p className="text-xs sm:text-sm text-bone-300 mt-1.5 max-w-3xl leading-relaxed">
              Converts Siamese U-Net pixel-level canopy loss, afforestation gain, and impervious expansion into{" "}
              <span className="text-bone-100 font-mono">Mg CO2e</span> gross emissions, gross carbon removals,{" "}
              <span className="text-bone-100 font-mono">ΔLST (°C)</span> thermal anomalies, and Voluntary Carbon Market (VCM) credit valuations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href="https://github.com/wri/carbon-budget"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-ink-950/90 hover:border-signal-400/50 border border-bone-100/15 text-bone-200 font-mono transition-colors"
            >
              Ref: wri/carbon-budget (Harris et al. 2021)
            </a>
            <a
              href="https://github.com/wri/gfw_forest_loss_geotrellis"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-ink-950/90 hover:border-signal-400/50 border border-bone-100/15 text-bone-200 font-mono transition-colors"
            >
              Ref: wri/gfw_forest_loss_geotrellis
            </a>
          </div>
        </section>

        {/* Controls Bar */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 orbital-panel rounded-2xl p-5">
          {/* Scenario Selector */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-bone-400 mb-1.5">
              1. Target AOI Scenario
            </label>
            <select
              value={scenarioIdx}
              onChange={(e) => handleSelectScenario(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg bg-ink-950 border border-bone-100/15 text-xs text-bone-100 focus:outline-none focus:border-signal-400"
            >
              {CARBON_SCENARIOS.map((sc, i) => (
                <option key={sc.id} value={i}>
                  {sc.label}
                </option>
              ))}
            </select>
          </div>

          {/* IPCC Biome Selector */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-bone-400 mb-1.5">
              2. IPCC Tier-1 Biome Factor
            </label>
            <select
              value={biomeId}
              onChange={(e) => setBiomeId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-ink-950 border border-bone-100/15 text-xs text-bone-100 focus:outline-none focus:border-signal-400"
            >
              {BIOME_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </div>

          {/* WRI Carbon Pool Mode */}
          <div>
            <label className="block text-[10px] font-mono uppercase tracking-wider text-bone-400 mb-1.5">
              3. WRI Carbon Pool Scope (-p flag)
            </label>
            <div className="grid grid-cols-2 gap-1.5 h-10 p-1 rounded-lg bg-ink-950 border border-bone-100/15">
              <button
                type="button"
                onClick={() => setPoolMode("biomass_soil")}
                className={`rounded text-xs font-mono transition-colors ${
                  poolMode === "biomass_soil"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                biomass_soil (4-Pool)
              </button>
              <button
                type="button"
                onClick={() => setPoolMode("biomass_only")}
                className={`rounded text-xs font-mono transition-colors ${
                  poolMode === "biomass_only"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                biomass_only (No SOC)
              </button>
            </div>
          </div>

          {/* Carbon Credit Price Slider */}
          <div>
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-bone-400 mb-1.5">
              <span>4. VCM Credit Price (RVCMC / Verra)</span>
              <span className="text-phosphor-400 font-semibold">${carbonPrice} / tCO2e</span>
            </div>
            <input
              type="range"
              min={15}
              max={120}
              step={5}
              value={carbonPrice}
              onChange={(e) => setCarbonPrice(Number(e.target.value))}
              className="w-full h-2 mt-2 accent-signal-400 bg-ink-950 rounded-lg cursor-pointer"
            />
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-crimson-400/10 border border-crimson-400/40 text-crimson-400 text-sm">
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-32 rounded-xl orbital-panel animate-pulse p-5"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Top KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="orbital-panel rounded-xl p-5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-bone-400">
                  Gross GHG Emissions (Source)
                </div>
                <div className="text-2xl font-semibold font-mono text-crimson-400 mt-2 tabular-nums">
                  +{data.gross_emissions_tco2e.toLocaleString()} tCO2e
                </div>
                <div className="text-xs text-bone-300 mt-1 font-mono tabular-nums">
                  Canopy Loss: {data.loss_area_ha.toLocaleString()} ha ({data.agb_loss_tons.toLocaleString()} t AGB)
                </div>
              </div>

              <div className="orbital-panel rounded-xl p-5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-bone-400">
                  Gross Carbon Removals (Sink)
                </div>
                <div className="text-2xl font-semibold font-mono text-phosphor-400 mt-2 tabular-nums">
                  -{data.gross_removals_tco2e.toLocaleString()} tCO2e
                </div>
                <div className="text-xs text-bone-300 mt-1 font-mono tabular-nums">
                  Greening / Gain: {data.gain_area_ha.toLocaleString()} ha ({data.t1_year}–{data.t2_year})
                </div>
              </div>

              <div className="orbital-panel-active rounded-xl p-5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-signal-400">
                  Net GHG Flux & VCM Valuation
                </div>
                <div
                  className={`text-2xl font-semibold font-mono mt-2 tabular-nums ${
                    data.is_net_sink ? "text-phosphor-400" : "text-crimson-400"
                  }`}
                >
                  {data.net_flux_tco2e > 0 ? `+${data.net_flux_tco2e.toLocaleString()}` : data.net_flux_tco2e.toLocaleString()}{" "}
                  tCO2e
                </div>
                <div className="text-xs text-bone-200 mt-1 font-mono tabular-nums">
                  ${data.vcm_valuation_usd.toLocaleString()} USD ({data.is_net_sink ? "Net Carbon Credit" : "Social Carbon Liability"})
                </div>
              </div>

              <div className="orbital-panel rounded-xl p-5">
                <div className="text-[10px] font-mono uppercase tracking-widest text-bone-400">
                  Surface Urban Heat Island (ΔLST)
                </div>
                <div className="text-2xl font-semibold font-mono text-lagoon-400 mt-2 tabular-nums">
                  {data.uhi.mean_lst_shift_c > 0 ? `+${data.uhi.mean_lst_shift_c}` : data.uhi.mean_lst_shift_c}°C Mean
                </div>
                <div className="text-xs text-bone-300 mt-1 font-mono tabular-nums">
                  Hotspot: +{data.uhi.peak_hotspot_c}°C · Green Cooling: {data.uhi.cooling_island_c}°C
                </div>
              </div>
            </section>

            {/* Interactive X-Ray Loupe + Spatial Rasters + IPCC 4-Pool Breakdown */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 6 Cols: Interactive OrbitalLoupe comparing Carbon Flux vs Urban Heat Island */}
              <div className="lg:col-span-6">
                <OrbitalLoupe
                  baseImage={data.flux_map_base64}
                  overlayImage={data.uhi_map_base64}
                  baseLabel="30m Carbon Flux Density"
                  overlayLabel="Urban Heat Island (ΔLST °C)"
                  telemetryTag={`${data.total_c_density_mg_ha} MgC/ha · ${data.impervious_area_ha} ha Built`}
                  accentColor="phosphor"
                />
              </div>

              {/* Right 6 Cols: IPCC 4-Pool Table & Equivalencies */}
              <div className="lg:col-span-6 orbital-panel rounded-2xl p-6 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="font-display text-2xl text-bone-100">
                      IPCC Tier-1 Carbon Pool Decomposition
                    </h2>
                    <span className="text-xs font-mono text-phosphor-400">
                      44/12 Stoichiometric Factor
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.pools.map((p) => (
                      <div
                        key={p.pool_id}
                        className="p-3.5 rounded-xl bg-ink-950/80 border border-bone-100/10"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-bone-100">{p.label}</span>
                          <span className="font-mono text-signal-400 tabular-nums">
                            {p.emissions_tco2e.toLocaleString()} tCO2e ({p.share_pct}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-bone-400 font-mono mt-1 tabular-nums">
                          <span>Formula: {p.formula}</span>
                          <span>Density: {p.density_mg_c_ha} Mg C/ha</span>
                        </div>
                        <div className="w-full h-1.5 bg-bone-100/10 rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-signal-400"
                            style={{ width: `${Math.min(100, Math.max(4, p.share_pct))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-World Climate Equivalencies */}
                <div className="border-t border-bone-100/10 pt-4">
                  <div className="text-[10px] font-mono uppercase tracking-widest text-bone-400 mb-3">
                    EPA Greenhouse Gas Equivalencies
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-ink-950/80 border border-bone-100/10">
                      <div className="text-sm font-mono font-semibold text-bone-100 tabular-nums">
                        {data.equivalencies.passenger_cars_yr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-bone-400 mt-0.5 font-mono">
                        Vehicles / Year
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-ink-950/80 border border-bone-100/10">
                      <div className="text-sm font-mono font-semibold text-bone-100 tabular-nums">
                        {data.equivalencies.homes_electricity_yr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-bone-400 mt-0.5 font-mono">
                        Homes Powered / Yr
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-ink-950/80 border border-bone-100/10">
                      <div className="text-sm font-mono font-semibold text-bone-100 tabular-nums">
                        {data.equivalencies.mature_trees_10yr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-bone-400 mt-0.5 font-mono">
                        10-Yr Seedlings
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
