"use client";

import { useEffect, useState, useCallback } from "react";
import { StudioNav } from "@/components/studio-nav";

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
  {
    id: "green_riyadh",
    label: "Green Riyadh · Wadi Hanifah Afforestation",
    biome_id: "urban_afforestation",
    t1_year: 2019,
    t2_year: 2024,
    polygon: [
      [46.66, 24.64],
      [46.71, 24.64],
      [46.71, 24.69],
      [46.66, 24.69],
      [46.66, 24.64],
    ],
  },
  {
    id: "red_sea_mangroves",
    label: "Al Wajh Lagoon · Red Sea Mangrove Blue Carbon",
    biome_id: "mangrove_blue_carbon",
    t1_year: 2018,
    t2_year: 2024,
    polygon: [
      [36.91, 25.56],
      [36.96, 25.56],
      [36.96, 25.61],
      [36.91, 25.61],
      [36.91, 25.56],
    ],
  },
  {
    id: "neom_oxagon",
    label: "NEOM Oxagon · Coastal Industrial Corridor",
    biome_id: "arid_desert_corridor",
    t1_year: 2019,
    t2_year: 2024,
    polygon: [
      [34.91, 28.05],
      [34.96, 28.05],
      [34.96, 28.1],
      [34.91, 28.1],
      [34.91, 28.05],
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
    <div className="min-h-screen bg-[#070B12] text-[#F1F5F9] flex flex-col">
      <StudioNav />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-8 space-y-8">
        {/* Header & GitHub Provenance */}
        <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/[0.08] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded bg-[#10B981]/10 border border-[#10B981]/25 text-[#10B981] text-[11px] font-mono uppercase tracking-wider mb-3">
              <span>IPCC Tier-1 Carbon Flux & Urban Microclimate Engine</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">
              Carbon Flux, Biomass Pools & Urban Heat Island Calculator
            </h1>
            <p className="text-sm text-[#94A3B8] mt-1.5 max-w-3xl">
              Converts Siamese U-Net pixel-level canopy loss, afforestation gain, and impervious expansion into{" "}
              <span className="text-slate-200 font-mono">Mg CO2e</span> gross emissions, gross carbon removals,{" "}
              <span className="text-slate-200 font-mono">ΔLST (°C)</span> thermal anomalies, and Voluntary Carbon Market (VCM) credit valuations.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <a
              href="https://github.com/wri/carbon-budget"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-mono transition-colors"
            >
              Ref: wri/carbon-budget (Harris et al. 2021)
            </a>
            <a
              href="https://github.com/wri/gfw_forest_loss_geotrellis"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-md bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 font-mono transition-colors"
            >
              Ref: wri/gfw_forest_loss_geotrellis
            </a>
          </div>
        </section>

        {/* Controls Bar */}
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-[#0D131F] border border-white/[0.08] rounded-xl p-4">
          {/* Scenario Selector */}
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
              1. Target AOI Scenario
            </label>
            <select
              value={scenarioIdx}
              onChange={(e) => handleSelectScenario(Number(e.target.value))}
              className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-white/[0.12] text-xs text-white focus:outline-none focus:border-[#0EA5E9]"
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
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
              2. IPCC Tier-1 Biome Factor
            </label>
            <select
              value={biomeId}
              onChange={(e) => setBiomeId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg bg-[#070B12] border border-white/[0.12] text-xs text-white focus:outline-none focus:border-[#0EA5E9]"
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
            <label className="block text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
              3. WRI Carbon Pool Scope (-p flag)
            </label>
            <div className="grid grid-cols-2 gap-1.5 h-10 p-1 rounded-lg bg-[#070B12] border border-white/[0.12]">
              <button
                type="button"
                onClick={() => setPoolMode("biomass_soil")}
                className={`rounded text-xs font-mono transition-colors ${
                  poolMode === "biomass_soil"
                    ? "bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                biomass_soil (4-Pool)
              </button>
              <button
                type="button"
                onClick={() => setPoolMode("biomass_only")}
                className={`rounded text-xs font-mono transition-colors ${
                  poolMode === "biomass_only"
                    ? "bg-[#0EA5E9]/20 text-[#0EA5E9] border border-[#0EA5E9]/40"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                biomass_only (No SOC)
              </button>
            </div>
          </div>

          {/* Carbon Credit Price Slider */}
          <div>
            <div className="flex items-center justify-between text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mb-1.5">
              <span>4. VCM Credit Price (RVCMC / Verra)</span>
              <span className="text-[#10B981] font-semibold">${carbonPrice} / tCO2e</span>
            </div>
            <input
              type="range"
              min={15}
              max={120}
              step={5}
              value={carbonPrice}
              onChange={(e) => setCarbonPrice(Number(e.target.value))}
              className="w-full h-2 mt-2 accent-[#10B981] bg-[#070B12] rounded-lg cursor-pointer"
            />
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-32 rounded-xl bg-[#0D131F] border border-white/[0.06] animate-pulse p-5"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Top KPI Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-[#0D131F] border border-white/[0.08] rounded-xl p-5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  Gross GHG Emissions (Source)
                </div>
                <div className="text-2xl font-semibold font-mono text-[#F97316] mt-2">
                  +{data.gross_emissions_tco2e.toLocaleString()} tCO2e
                </div>
                <div className="text-xs text-[#94A3B8] mt-1 font-mono">
                  Canopy Loss: {data.loss_area_ha.toLocaleString()} ha ({data.agb_loss_tons.toLocaleString()} t AGB)
                </div>
              </div>

              <div className="bg-[#0D131F] border border-white/[0.08] rounded-xl p-5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  Gross Carbon Removals (Sink)
                </div>
                <div className="text-2xl font-semibold font-mono text-[#10B981] mt-2">
                  -{data.gross_removals_tco2e.toLocaleString()} tCO2e
                </div>
                <div className="text-xs text-[#94A3B8] mt-1 font-mono">
                  Greening / Gain: {data.gain_area_ha.toLocaleString()} ha ({data.t1_year}–{data.t2_year})
                </div>
              </div>

              <div className="bg-[#0D131F] border border-white/[0.08] rounded-xl p-5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  Net GHG Flux & VCM Valuation
                </div>
                <div
                  className={`text-2xl font-semibold font-mono mt-2 ${
                    data.is_net_sink ? "text-[#10B981]" : "text-[#EF4444]"
                  }`}
                >
                  {data.net_flux_tco2e > 0 ? `+${data.net_flux_tco2e.toLocaleString()}` : data.net_flux_tco2e.toLocaleString()}{" "}
                  tCO2e
                </div>
                <div className="text-xs text-slate-300 mt-1 font-mono">
                  ${data.vcm_valuation_usd.toLocaleString()} USD ({data.is_net_sink ? "Net Carbon Credit" : "Social Carbon Liability"})
                </div>
              </div>

              <div className="bg-[#0D131F] border border-white/[0.08] rounded-xl p-5">
                <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8]">
                  Surface Urban Heat Island (ΔLST)
                </div>
                <div className="text-2xl font-semibold font-mono text-[#38BDF8] mt-2">
                  {data.uhi.mean_lst_shift_c > 0 ? `+${data.uhi.mean_lst_shift_c}` : data.uhi.mean_lst_shift_c}°C Mean
                </div>
                <div className="text-xs text-[#94A3B8] mt-1 font-mono">
                  Hotspot: +{data.uhi.peak_hotspot_c}°C · Green Cooling: {data.uhi.cooling_island_c}°C
                </div>
              </div>
            </section>

            {/* Spatial Rasters + IPCC 4-Pool Breakdown */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Dual Spatial Rasters */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0D131F] border border-white/[0.08] rounded-xl p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        30m Carbon Flux Density Raster
                      </h2>
                      <p className="text-[11px] text-[#94A3B8] font-mono">
                        Red: Gross Emissions · Emerald: Sequestration
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-slate-300">
                      {data.total_c_density_mg_ha} MgC/ha
                    </span>
                  </div>
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.08] bg-black">
                    <img
                      src={data.flux_map_base64}
                      alt="Spatial Carbon Flux Raster"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="bg-[#0D131F] border border-white/[0.08] rounded-xl p-4 flex flex-col">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h2 className="text-sm font-semibold text-white">
                        Urban Heat Island (ΔLST °C) Raster
                      </h2>
                      <p className="text-[11px] text-[#94A3B8] font-mono">
                        Amber: Impervious Warming · Cyan: Vegetative Cooling
                      </p>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-white/[0.06] text-[10px] font-mono text-slate-300">
                      {data.impervious_area_ha} ha Built
                    </span>
                  </div>
                  <div className="relative aspect-square rounded-lg overflow-hidden border border-white/[0.08] bg-black">
                    <img
                      src={data.uhi_map_base64}
                      alt="Urban Heat Island Anomaly Raster"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>

              {/* IPCC 4-Pool Table & Equivalencies */}
              <div className="lg:col-span-5 bg-[#0D131F] border border-white/[0.08] rounded-xl p-5 flex flex-col justify-between space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-sm font-semibold text-white">
                      IPCC Tier-1 Carbon Pool Decomposition
                    </h2>
                    <span className="text-[11px] font-mono text-[#10B981]">
                      44/12 Stoichiometric Factor
                    </span>
                  </div>
                  <div className="space-y-3">
                    {data.pools.map((p) => (
                      <div
                        key={p.pool_id}
                        className="p-3 rounded-lg bg-[#070B12] border border-white/[0.06]"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-white">{p.label}</span>
                          <span className="font-mono text-[#F97316]">
                            {p.emissions_tco2e.toLocaleString()} tCO2e ({p.share_pct}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-[#94A3B8] font-mono mt-1">
                          <span>Formula: {p.formula}</span>
                          <span>Density: {p.density_mg_c_ha} Mg C/ha</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-2">
                          <div
                            className="h-full bg-[#10B981]"
                            style={{ width: `${Math.min(100, Math.max(4, p.share_pct))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-World Climate Equivalencies */}
                <div className="border-t border-white/[0.08] pt-4">
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] mb-2.5">
                    EPA Greenhouse Gas Equivalencies
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-2.5 rounded-lg bg-[#070B12] border border-white/[0.06]">
                      <div className="text-sm font-mono font-semibold text-white">
                        {data.equivalencies.passenger_cars_yr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        Vehicles / Year
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#070B12] border border-white/[0.06]">
                      <div className="text-sm font-mono font-semibold text-white">
                        {data.equivalencies.homes_electricity_yr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
                        Homes Powered / Yr
                      </div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#070B12] border border-white/[0.06]">
                      <div className="text-sm font-mono font-semibold text-white">
                        {data.equivalencies.mature_trees_10yr.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-[#94A3B8] mt-0.5">
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
