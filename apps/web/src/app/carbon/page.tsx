"use client";

import React, { useState, useEffect } from "react";
import { StudioShell } from "@/components/studio-nav";
import { useAoi } from "@/lib/aoi-context";

interface CarbonPool {
  pool_name: string;
  stock_mg_c_ha: number;
  flux_tco2e: number;
  share_pct: number;
}

function formatComma(num: number, decimals = 1): string {
  return num.toFixed(decimals).replace(".", ",");
}

export default function CarbonPage() {
  const { activeCorridor, activeYear, activeMonth, temporalModifier, getRasterUrl } = useAoi();
  const [biome, setBiome] = useState<string>("arid_afforestation");
  const [priceUsd, setPriceUsd] = useState<number>(35);
  const [netSinkTco2e, setNetSinkTco2e] = useState<number>(-142800);
  const [vcmValuationM, setVcmValuationM] = useState<number>(4.99);
  const [vehiclesYr, setVehiclesYr] = useState<number>(31043);
  const [pools, setPools] = useState<CarbonPool[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/carbon", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset_id: activeCorridor.id,
        biome,
        disturbed_area_ha: Math.round(312 * temporalModifier),
        greening_area_ha: Math.round(1420 * temporalModifier),
        carbon_price_usd: priceUsd,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            net_balance_tco2e?: number;
            voluntary_credit_value_usd_millions?: number;
            equivalent_passenger_vehicles_yr?: number;
            pools?: CarbonPool[];
          } | null
        ) => {
          if (!cancelled && data) {
            if (typeof data.net_balance_tco2e === "number") {
              setNetSinkTco2e(data.net_balance_tco2e);
            }
            if (typeof data.voluntary_credit_value_usd_millions === "number") {
              setVcmValuationM(data.voluntary_credit_value_usd_millions);
            }
            if (typeof data.equivalent_passenger_vehicles_yr === "number") {
              setVehiclesYr(data.equivalent_passenger_vehicles_yr);
            }
            if (data.pools?.length) {
              setPools(data.pools);
            }
          }
        }
      )
      .catch(() => {
        // Fallback already in state
      });
    return () => {
      cancelled = true;
    };
  }, [biome, priceUsd, temporalModifier]);

  const cycleBiome = () => {
    const order = [
      "arid_afforestation",
      "coastal_mangrove",
      "tropical_moist_forest",
    ];
    const next = order[(order.indexOf(biome) + 1) % order.length] ?? "arid_afforestation";
    setBiome(next);
  };

  const displayPools = [
    {
      val: `${formatComma(pools?.[0]?.stock_mg_c_ha ?? 32.0, 1)} Mg`,
      dist: `${(pools?.[0]?.flux_tco2e ?? -88536).toLocaleString("en-US")} tCO2e`,
      pct: "62 %",
      w: "62%",
      color: "bg-[#22b567]",
    },
    {
      val: `${formatComma(pools?.[1]?.stock_mg_c_ha ?? 8.3, 1)} Mg`,
      dist: `${(pools?.[1]?.flux_tco2e ?? -22848).toLocaleString("en-US")} tCO2e`,
      pct: "16 %",
      w: "16%",
      color: "bg-[#22b567]",
    },
    {
      val: `${formatComma(pools?.[2]?.stock_mg_c_ha ?? 6.9, 1)} Mg`,
      dist: `${(pools?.[2]?.flux_tco2e ?? -19992).toLocaleString("en-US")} tCO2e`,
      pct: "14 %",
      w: "14%",
      color: "bg-[#f39223]",
    },
    {
      val: `${formatComma(pools?.[3]?.stock_mg_c_ha ?? 2.6, 1)} Mg`,
      dist: `${(pools?.[3]?.flux_tco2e ?? -11424).toLocaleString("en-US")} tCO2e`,
      pct: "8 %",
      w: "8%",
      color: "bg-[#e94235]",
    },
  ];

  return (
    <StudioShell>
      <div className="w-full h-full p-6 grid grid-cols-12 gap-5 overflow-hidden">
        <div className="col-span-7 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-5 flex flex-col min-h-0">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1c1f23]">
                Spatial Carbon Flux &amp; Surface Thermal Shift (ΔLST)
              </h2>
              <p className="text-[12px] text-[#8c929c]">
                Wadi Hanifah &amp; Green Riyadh Canopy Sinks vs Corridor Grading ({activeMonth} {activeYear})
              </p>
            </div>
            <button
              type="button"
              onClick={cycleBiome}
              title="Click to cycle IPCC biome tier"
              className="text-[12px] font-semibold text-[#22b567] hover:opacity-80 transition-opacity cursor-pointer"
            >
              IPCC Tier-1 Verified
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between text-[12px] mb-2">
                <span className="font-medium text-[#3b4048]">
                  Carbon Flux Density
                </span>
                <span className="font-semibold text-[#22b567]">
                  {formatComma(activeCorridor.carbonMgPerHa * temporalModifier, 1)} Mg C / ha
                </span>
              </div>
              <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                <img
                  src={getRasterUrl("carbon")}
                  alt="Carbon Flux Map"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>

            <div className="flex flex-col min-h-0">
              <div className="flex items-center justify-between text-[12px] mb-2">
                <span className="font-medium text-[#3b4048]">
                  Thermal Shift (ΔLST)
                </span>
                <span className="font-semibold text-[#f39223]">
                  {formatComma(activeCorridor.thermalDeltaC * temporalModifier, 1)} °C Canopy Cooling
                </span>
              </div>
              <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                <img
                  src={getRasterUrl("thermal")}
                  alt="Thermal Shift Map"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-5 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-7 flex flex-col justify-between min-h-0">
          <div>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[18px] font-semibold text-[#1c1f23]">
                IPCC 4-Pool Carbon Ledger
              </h3>
              <button
                type="button"
                onClick={() => setPriceUsd((p) => (p === 35 ? 50 : p === 50 ? 25 : 35))}
                title="Click to toggle VCM carbon credit price ($25 / $35 / $50)"
                className="text-[12px] text-[#8c929c] hover:text-[#1c1f23] transition-colors cursor-pointer"
              >
                Verra VM0047 (${priceUsd}/t)
              </button>
            </div>

            <div className="text-[13px] font-medium text-[#3b4048] mb-5">
              Stoichiometric Pool Breakdown
            </div>

            <div className="space-y-4">
              {displayPools.map((p, idx) => (
                <div key={idx}>
                  <div className="flex items-center justify-between text-[12.5px] mb-2">
                    <span className="font-semibold text-[#1c1f23] tabular-nums">
                      {p.val}
                    </span>
                    <div className="flex items-center gap-3 tabular-nums">
                      <span className="font-medium text-[#3b4048]">{p.dist}</span>
                      <span className="text-[#9aa0aa] w-9 text-right">{p.pct}</span>
                    </div>
                  </div>
                  <div className="h-[5px] w-full bg-[#edeff2] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${p.color}`}
                      style={{ width: p.w }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-5 border-t border-[#edeff2] grid grid-cols-3 gap-3 text-center">
            <div>
              <div className="text-[16px] font-semibold text-[#1c1f23] tabular-nums">
                {formatComma(netSinkTco2e / 1000, 1)}k
              </div>
              <div className="text-[11px] text-[#8c929c] mt-0.5">
                Net tCO2e Sink
              </div>
            </div>
            <div>
              <div className="text-[16px] font-semibold text-[#22b567] tabular-nums">
                ${formatComma(vcmValuationM, 2)}M
              </div>
              <div className="text-[11px] text-[#8c929c] mt-0.5">
                VCM Valuation
              </div>
            </div>
            <div>
              <div className="text-[16px] font-semibold text-[#1c1f23] tabular-nums">
                {vehiclesYr.toLocaleString("en-US")}
              </div>
              <div className="text-[11px] text-[#8c929c] mt-0.5">
                Vehicles / Yr
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
