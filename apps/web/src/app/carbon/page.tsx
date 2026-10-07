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

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6 space-y-6">
        {/* Top Control Bar */}
        <section className="orbital-panel rounded-xl p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-bone-100">
            Carbon & Heat
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <select
              aria-label="Scenario"
              value={scenarioIdx}
              onChange={(e) => handleSelectScenario(Number(e.target.value))}
              className="h-9 px-3 rounded-lg bg-ink-950 border border-bone-100/15 text-xs text-bone-100 focus:outline-none focus:border-signal-400"
            >
              {CARBON_SCENARIOS.map((sc, i) => (
                <option key={sc.id} value={i}>
                  {sc.label}
                </option>
              ))}
            </select>

            <select
              aria-label="IPCC Biome"
              value={biomeId}
              onChange={(e) => setBiomeId(e.target.value)}
              className="h-9 px-3 rounded-lg bg-ink-950 border border-bone-100/15 text-xs text-bone-100 focus:outline-none focus:border-signal-400"
            >
              {BIOME_OPTIONS.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>

            <div className="flex rounded-lg bg-ink-950 border border-bone-100/15 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setPoolMode("biomass_soil")}
                className={`rounded-md px-2.5 py-1 font-mono transition-colors ${
                  poolMode === "biomass_soil"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                4-Pool
              </button>
              <button
                type="button"
                onClick={() => setPoolMode("biomass_only")}
                className={`rounded-md px-2.5 py-1 font-mono transition-colors ${
                  poolMode === "biomass_only"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                Biomass Only
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-lg border border-bone-100/15 bg-ink-950 px-3 py-1.5">
              <span className="font-mono text-xs text-bone-300">${carbonPrice}/t</span>
              <input
                type="range"
                aria-label="Carbon Price"
                min={15}
                max={120}
                step={5}
                value={carbonPrice}
                onChange={(e) => setCarbonPrice(Number(e.target.value))}
                className="w-20 accent-signal-400 cursor-pointer"
              />
            </div>
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-xl bg-crimson-400/10 border border-crimson-400/40 text-crimson-400 text-xs">
            {error}
          </div>
        )}

        {loading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className="h-28 rounded-xl orbital-panel animate-pulse p-5"
              />
            ))}
          </div>
        ) : (
          <>
            {/* Top KPI Cards */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="orbital-panel rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-bone-400">
                  Gross Emissions
                </div>
                <div className="text-2xl font-semibold font-mono text-bone-100 mt-1 tabular-nums">
                  +{data.gross_emissions_tco2e.toLocaleString()} tCO2e
                </div>
                <div className="text-[11px] text-bone-400 mt-1 font-mono tabular-nums">
                  {data.loss_area_ha.toLocaleString()} ha ({data.agb_loss_tons.toLocaleString()} t AGB)
                </div>
              </div>

              <div className="orbital-panel rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-bone-400">
                  Gross Removals
                </div>
                <div className="text-2xl font-semibold font-mono text-signal-400 mt-1 tabular-nums">
                  -{data.gross_removals_tco2e.toLocaleString()} tCO2e
                </div>
                <div className="text-[11px] text-bone-400 mt-1 font-mono tabular-nums">
                  {data.gain_area_ha.toLocaleString()} ha ({data.t1_year}–{data.t2_year})
                </div>
              </div>

              <div className="orbital-panel-active rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-bone-400">
                  Net Flux & Valuation
                </div>
                <div className="text-2xl font-semibold font-mono text-signal-400 mt-1 tabular-nums">
                  {data.net_flux_tco2e > 0 ? `+${data.net_flux_tco2e.toLocaleString()}` : data.net_flux_tco2e.toLocaleString()}{" "}
                  tCO2e
                </div>
                <div className="text-[11px] text-bone-300 mt-1 font-mono tabular-nums">
                  ${data.vcm_valuation_usd.toLocaleString()} USD
                </div>
              </div>

              <div className="orbital-panel rounded-xl p-4">
                <div className="text-[10px] font-mono uppercase tracking-wider text-bone-400">
                  Surface Thermal Shift (ΔLST)
                </div>
                <div className="text-2xl font-semibold font-mono text-bone-100 mt-1 tabular-nums">
                  {data.uhi.mean_lst_shift_c > 0 ? `+${data.uhi.mean_lst_shift_c}` : data.uhi.mean_lst_shift_c}°C
                </div>
                <div className="text-[11px] text-bone-400 mt-1 font-mono tabular-nums">
                  Peak +{data.uhi.peak_hotspot_c}°C · Cooling {data.uhi.cooling_island_c}°C
                </div>
              </div>
            </section>

            {/* Interactive Loupe + IPCC 4-Pool Breakdown */}
            <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-6">
                <OrbitalLoupe
                  baseImage={data.flux_map_base64}
                  overlayImage={data.uhi_map_base64}
                  baseLabel="Carbon Flux Density"
                  overlayLabel="Thermal Anomaly (ΔLST °C)"
                />
              </div>

              <div className="lg:col-span-6 orbital-panel rounded-xl p-5 flex flex-col justify-between space-y-5">
                <div className="space-y-3">
                  <h2 className="text-sm font-semibold text-bone-100">
                    Carbon Pools
                  </h2>
                  <div className="space-y-2.5">
                    {data.pools.map((p) => (
                      <div
                        key={p.pool_id}
                        className="p-3 rounded-lg bg-ink-950/80 border border-bone-100/10"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-bone-100">{p.label}</span>
                          <span className="font-mono text-signal-400 tabular-nums">
                            {p.emissions_tco2e.toLocaleString()} tCO2e ({p.share_pct}%)
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-bone-400 font-mono mt-1 tabular-nums">
                          <span>{p.formula}</span>
                          <span>{p.density_mg_c_ha} Mg C/ha</span>
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

                {/* Equivalencies */}
                <div className="grid grid-cols-3 gap-3 text-center border-t border-bone-100/10 pt-4">
                  <div className="p-3 rounded-lg bg-ink-950/80 border border-bone-100/10">
                    <div className="text-sm font-mono font-semibold text-bone-100 tabular-nums">
                      {data.equivalencies.passenger_cars_yr.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-bone-400 mt-0.5 font-mono">
                      Vehicles / Yr
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-ink-950/80 border border-bone-100/10">
                    <div className="text-sm font-mono font-semibold text-bone-100 tabular-nums">
                      {data.equivalencies.homes_electricity_yr.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-bone-400 mt-0.5 font-mono">
                      Homes / Yr
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-ink-950/80 border border-bone-100/10">
                    <div className="text-sm font-mono font-semibold text-bone-100 tabular-nums">
                      {data.equivalencies.mature_trees_10yr.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-bone-400 mt-0.5 font-mono">
                      10-Yr Seedlings
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
