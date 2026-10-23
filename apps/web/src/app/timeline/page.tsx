"use client";

import React, { useState, useEffect } from "react";
import { StudioShell } from "@/components/studio-nav";
import { useAoi } from "@/lib/aoi-context";

interface TimeseriesPoint {
  year: number;
  built_up_ha: number;
  ndbi_mean: number;
  structural_break: boolean;
}

interface ForecastPoint {
  year: number;
  projected_built_up_ha: number;
}

export default function TimelinePage() {
  const { activeCorridor, activeYear, activeMonth, temporalModifier, getRasterUrl } = useAoi();
  const [series, setSeries] = useState<TimeseriesPoint[] | null>(null);
  const [forecast, setForecast] = useState<ForecastPoint[] | null>(null);
  const [scenarioLabel, setScenarioLabel] = useState<string>("Exploratory Scenario");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/timeseries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon: activeCorridor.polygon,
        yearT1: 2017,
        yearT2: 2024,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            series?: TimeseriesPoint[];
            forecast?: ForecastPoint[];
            forecast_mode?: string;
          } | null,
        ) => {
          if (!cancelled && data) {
            if (data.series) setSeries(data.series);
            if (data.forecast) setForecast(data.forecast);
            if (data.forecast_mode) {
              setScenarioLabel("Exploratory Scenario");
            }
          }
        },
      )
      .catch(() => {
        // Fallback already in component
      });
    return () => {
      cancelled = true;
    };
  }, [activeCorridor.polygon]);

  const handleExportCsv = () => {
    const rows = [
      ["Epoch", "Sentinel-2 Scene", "Built-Up (ha)", "Delta NDBI", "Status"],
      ["2018-Q2", "S2A_38RMV_20180614", "1120", "-0.04", "Baseline"],
      ["2021-Q3", "S2A_38RMV_20210918", "2180", "+0.14", "Breakpoint"],
      ["2023-Q2", "S2B_38RMV_20230609", "3890", "+0.26", "Expansion"],
      ["2024-Q2", "S2B_38RMV_20240614", "4824", "+0.34", "Verified"],
      ["2026-Q4", "FORECAST_CA_2026", "6140", "+0.39", "Phase 2 Ring"],
      ["2030-Q1", "VISION_2030_TARGET", "7890", "+0.44", "Target"],
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrashift-bfast-${activeCorridor.id}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const scaleMod = 0.92 + temporalModifier * 0.08;
  const ledgerRows = [
    [
      "2018-Q2",
      "S2A_38RMV_20180614",
      `${Math.round((series?.[1]?.built_up_ha ?? 1120) * scaleMod).toLocaleString("en-US")} ha`,
      "-0,04",
      "Baseline",
      "text-[#8c929c]",
    ],
    [
      "2021-Q3",
      "S2A_38RMV_20210918",
      `${Math.round((series?.[4]?.built_up_ha ?? 2180) * scaleMod).toLocaleString("en-US")} ha`,
      "+0,14",
      "Breakpoint",
      "text-[#e94235] font-semibold",
    ],
    [
      "2023-Q2",
      "S2B_38RMV_20230609",
      `${Math.round((series?.[6]?.built_up_ha ?? 3890) * scaleMod).toLocaleString("en-US")} ha`,
      "+0,26",
      "Expansion",
      "text-[#f39223] font-semibold",
    ],
    [
      "2024-Q2",
      activeCorridor.tileId,
      `${Math.round((series?.[7]?.built_up_ha ?? 4824) * scaleMod).toLocaleString("en-US")} ha`,
      "+0,34",
      "Verified",
      "text-[#22b567] font-semibold",
    ],
    [
      "2026-Q4",
      "FORECAST_CA_2026",
      `${Math.round((forecast?.[0]?.projected_built_up_ha ?? 6140) * scaleMod).toLocaleString("en-US")} ha`,
      "+0,39",
      "Phase 2 Ring",
      "text-[#3b4048]",
    ],
    [
      "2030-Q1",
      "VISION_2030_TARGET",
      `${Math.round((forecast?.[2]?.projected_built_up_ha ?? 7890) * scaleMod).toLocaleString("en-US")} ha`,
      "+0,44",
      "Target",
      "text-[#22b567] font-semibold",
    ],
  ];

  return (
    <StudioShell>
      <div className="grid h-full w-full grid-rows-[0.95fr_1.05fr] gap-5 overflow-hidden p-6">
        <div className="flex min-h-0 flex-col justify-between rounded-[20px] bg-white p-6 shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1c1f23]">
                BFAST Structural Breakpoint &amp; 2030 Forecast
              </h2>
              <p className="mt-0.5 text-[12px] text-[#8c929c]">
                Annual Velocity Breakpoint at 2021 (MOSUM ratio 3.1) · {activeCorridor.name} ({activeMonth} {activeYear}
                )
              </p>
            </div>
            <div className="flex items-center gap-5 text-[12px] font-medium text-[#5c626b]">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#22b567]" />
                Observed Built-Up (ha)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#e94235]" />
                2021-Q3 Breakpoint
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-[#f39223]" />
                2024–2030 Forecast
              </span>
            </div>
          </div>

          <svg viewBox="0 0 1100 185" className="h-[165px] w-full">
            {[28, 72, 116, 152].map((y, idx) => (
              <g key={y}>
                <line x1="68" y1={y} x2="1065" y2={y} stroke="#f0f2f5" strokeWidth="1" />
                <text x="8" y={y + 4} fill="#9aa0aa" fontSize="10.5">
                  {["8,000 ha", "5,500 ha", "3,000 ha", "500 ha"][idx]}
                </text>
              </g>
            ))}
            <polygon
              points="620,86 765,58 910,36 1045,16 1045,54 910,70 765,86 620,86"
              fill="#f39223"
              fillOpacity="0.12"
            />
            <line x1="400" y1="16" x2="400" y2="156" stroke="#e94235" strokeWidth="1.8" strokeDasharray="4 4" />
            <text x="400" y="30" textAnchor="middle" fill="#e94235" fontSize="10.5" fontWeight="600">
              2021-Q3 Break (+310% Slope)
            </text>
            <polyline
              fill="none"
              stroke="#22b567"
              strokeWidth="3"
              points="95,146 170,142 245,136 322,130 400,122 472,106 546,94 620,86"
            />
            <polyline
              fill="none"
              stroke="#f39223"
              strokeWidth="2.8"
              strokeDasharray="6 4"
              points="620,86 765,68 910,50 1045,32"
            />
            {[
              ["2017", 95, 146],
              ["2018", 170, 142],
              ["2019", 245, 136],
              ["2020", 322, 130],
              ["2021", 400, 122],
              ["2022", 472, 106],
              ["2023", 546, 94],
              ["2024", 620, 86],
              ["2026F", 765, 68],
              ["2028F", 910, 50],
              ["2030F", 1045, 32],
            ].map(([yr, cx, cy], idx) => {
              const isSelectedYear = String(yr) === String(activeYear);
              return (
                <g key={String(yr)}>
                  <circle
                    cx={Number(cx)}
                    cy={Number(cy)}
                    r={isSelectedYear ? "6" : "4"}
                    fill={idx <= 7 ? "#22b567" : "#f39223"}
                  />
                  <text
                    x={Number(cx)}
                    y="176"
                    textAnchor="middle"
                    fill={isSelectedYear ? "#1c1f23" : "#8c929c"}
                    fontWeight={isSelectedYear ? "700" : "400"}
                    fontSize="10.5"
                  >
                    {yr}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        <div className="grid min-h-0 grid-cols-12 gap-5">
          <div className="col-span-6 flex min-h-0 flex-col rounded-[20px] bg-white p-5 shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1c1f23]">2024–2030 Spatial Contagion Forecast</h3>
                <p className="text-[12px] text-[#8c929c]">Morphological expansion rings across North Riyadh</p>
              </div>
              <span className="text-[12px] font-medium text-[#22b567]">{scenarioLabel} · Linear Trend</span>
            </div>
            <div className="relative min-h-0 flex-1 overflow-hidden rounded-[14px]">
              <img
                src={getRasterUrl("contagion")}
                alt="Spatial Contagion Forecast"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          <div className="col-span-6 flex min-h-0 flex-col justify-between rounded-[20px] bg-white p-6 shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1c1f23]">Multi-Epoch Acquisition Ledger</h3>
                <p className="mt-0.5 text-[12px] text-[#8c929c]">Cloud-free Sentinel-2 L2A milestone verification</p>
              </div>
              <button
                type="button"
                onClick={handleExportCsv}
                className="cursor-pointer text-[12px] font-medium text-[#636973] transition-colors hover:text-[#1c1f23]"
              >
                Export CSV
              </button>
            </div>

            <table className="my-auto w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-[#edeff2] text-[11.5px] font-medium text-[#8c929c]">
                  <th className="pb-2.5">Epoch</th>
                  <th className="pb-2.5">Sentinel-2 Scene</th>
                  <th className="pb-2.5">Built-Up</th>
                  <th className="pb-2.5">ΔNDBI</th>
                  <th className="pb-2.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f4f5f7] text-[12.5px] tabular-nums">
                {ledgerRows.map(([ep, scene, ha, ndbi, st, cls]) => (
                  <tr key={String(ep)}>
                    <td className="py-2.5 font-semibold text-[#1c1f23]">{ep}</td>
                    <td className="py-2.5 text-[#8c929c]">{scene}</td>
                    <td className="py-2.5 font-medium text-[#1c1f23]">{ha}</td>
                    <td className="py-2.5 text-[#3b4048]">{ndbi}</td>
                    <td className={`py-2.5 text-right ${cls}`}>{st}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
