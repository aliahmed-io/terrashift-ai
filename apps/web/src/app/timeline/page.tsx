"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { StudioNav } from "@/components/studio-nav";
import { OrbitalLoupe } from "@/components/ui/orbital-loupe";
import { HOTSPOT_PRESETS, type HotspotPreset } from "@/lib/tiles";

interface TimeSeriesObservation {
  year: number;
  changed_km2: number;
  changed_pct: number;
  annual_velocity_km2_yr: number;
  mean_ndvi: number;
  mean_ndbi: number;
  thumbnail_base64: string;
}

interface BfastBreakpoint {
  breakpoint_year: number;
  peak_velocity_km2_yr: number;
  mosum_statistic: number;
  confidence_level: number;
  significance_p: number;
  dominant_driver: string;
}

interface ForecastPoint {
  year: number;
  projected_km2: number;
  projected_pct: number;
  lower_ci_km2: number;
  upper_ci_km2: number;
}

interface TimeSeriesResponse {
  aoi_km2: number;
  observations: TimeSeriesObservation[];
  bfast_breakpoint: BfastBreakpoint;
  forecasts: ForecastPoint[];
  regression_slope_km2_yr: number;
  forecast_grid: number[][];
  reference: {
    repo: string;
    url: string;
    algorithm: string;
  };
}

function ForecastRiskCanvas({
  grid,
  horizonYear,
}: {
  grid: number[][];
  horizonYear: 2024 | 2028 | 2030;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid.length) return;
    const rows = grid.length;
    const cols = grid[0]?.length ?? 48;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgData = ctx.createImageData(cols, rows);
    for (let r = 0; r < rows; r++) {
      const row = grid[r] ?? [];
      for (let c = 0; c < cols; c++) {
        const val = row[c] ?? 0;
        const idx = (r * cols + c) * 4;

        if (val >= 85 && horizonYear === 2030) {
          // 2030 outer contagion ring (Alert Red)
          imgData.data[idx] = 255;
          imgData.data[idx + 1] = 82;
          imgData.data[idx + 2] = 64;
          imgData.data[idx + 3] = 255;
        } else if (val >= 65 && horizonYear >= 2028) {
          // 2028 expansion frontier (Sky Cyan)
          imgData.data[idx] = 56;
          imgData.data[idx + 1] = 189;
          imgData.data[idx + 2] = 248;
          imgData.data[idx + 3] = 255;
        } else if (val >= 35) {
          // Historical observed change 2017-2024 (Teal)
          imgData.data[idx] = 61;
          imgData.data[idx + 1] = 214;
          imgData.data[idx + 2] = 195;
          imgData.data[idx + 3] = 255;
        } else {
          // Background with subtle probability glow
          const glow = Math.round(val * 0.6);
          imgData.data[idx] = 10 + glow;
          imgData.data[idx + 1] = 15 + glow;
          imgData.data[idx + 2] = 24 + glow * 2;
          imgData.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [grid, horizonYear]);

  return (
    <canvas
      ref={canvasRef}
      className="size-full rounded-xl border border-white/10 bg-ink-950 object-cover"
    />
  );
}

export default function TimelinePage() {
  const [selectedPreset, setSelectedPreset] = useState<HotspotPreset>(
    () => HOTSPOT_PRESETS[0]!,
  );
  const [data, setData] = useState<TimeSeriesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [horizonYear, setHorizonYear] = useState<2024 | 2028 | 2030>(2030);

  const runTimeSeries = useCallback(async (preset: HotspotPreset) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/timeseries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygon: preset.polygon,
          yearT1: preset.yearT1,
          yearT2: preset.yearT2,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Time-series request failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as TimeSeriesResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to run time-series analysis");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runTimeSeries(selectedPreset);
  }, [selectedPreset, runTimeSeries]);

  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ["year", "type", "changed_km2", "changed_pct", "annual_velocity_km2_yr", "mean_ndvi", "mean_ndbi"],
      ...data.observations.map((o) => [
        String(o.year),
        "observed",
        String(o.changed_km2),
        String(o.changed_pct),
        String(o.annual_velocity_km2_yr),
        String(o.mean_ndvi),
        String(o.mean_ndbi),
      ]),
      ...data.forecasts.map((f) => [
        String(f.year),
        "forecast",
        String(f.projected_km2),
        String(f.projected_pct),
        String(data.regression_slope_km2_yr),
        "",
        "",
      ]),
    ];
    const csvContent = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrashift-timeseries-${selectedPreset.id}-2017-2030.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-orbital-canvas text-bone-100 flex flex-col">
      <StudioNav />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6 space-y-6">
        {/* Top Control Bar */}
        <section className="orbital-panel flex flex-col gap-4 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-bone-100">
            2030 Forecast
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <select
              id="timeline-preset"
              aria-label="Monitored Region"
              value={selectedPreset.id}
              disabled={loading}
              onChange={(e) => {
                const found = HOTSPOT_PRESETS.find((p) => p.id === e.target.value);
                if (found) setSelectedPreset(found);
              }}
              className="rounded-lg border border-bone-100/15 bg-ink-950 px-3 py-2 text-xs font-medium text-bone-100 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
            >
              {HOTSPOT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.location})
                </option>
              ))}
            </select>

            {data ? (
              <button
                type="button"
                onClick={exportCsv}
                className="rounded-lg bg-signal-400 px-3.5 py-2 text-xs font-semibold text-ink-950 hover:bg-signal-500 transition-colors"
              >
                Export CSV
              </button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-crimson-400/50 bg-crimson-400/10 p-4 text-xs text-crimson-400">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-5">
            {[1, 2, 3, 4, 5].map((n) => (
              <div
                key={n}
                className="h-64 animate-pulse rounded-xl orbital-panel"
              />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            {/* KPI Row */}
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="orbital-panel-active rounded-xl p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                  BFAST Breakpoint
                </span>
                <p className="mt-1 font-mono text-2xl font-semibold text-bone-100 tabular-nums">
                  {data.bfast_breakpoint.breakpoint_year}
                </p>
                <span className="font-mono text-[11px] text-bone-400 tabular-nums">
                  MOSUM {data.bfast_breakpoint.mosum_statistic} (p = {data.bfast_breakpoint.significance_p})
                </span>
              </div>

              <div className="orbital-panel rounded-xl p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                  Peak Velocity
                </span>
                <p className="mt-1 font-mono text-2xl font-semibold text-signal-400 tabular-nums">
                  {data.bfast_breakpoint.peak_velocity_km2_yr}&nbsp;km²/yr
                </p>
                <span className="text-[11px] text-bone-400 line-clamp-1">
                  {data.bfast_breakpoint.dominant_driver}
                </span>
              </div>

              <div className="orbital-panel rounded-xl p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                  2024 Observed
                </span>
                <p className="mt-1 font-mono text-2xl font-semibold text-bone-100 tabular-nums">
                  {data.observations[data.observations.length - 1]?.changed_km2}&nbsp;km²
                </p>
                <span className="font-mono text-[11px] text-bone-400 tabular-nums">
                  {data.observations[data.observations.length - 1]?.changed_pct}% of {data.aoi_km2}&nbsp;km²
                </span>
              </div>

              <div className="orbital-panel rounded-xl p-4">
                <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                  2030 Projected
                </span>
                <p className="mt-1 font-mono text-2xl font-semibold text-signal-400 tabular-nums">
                  {data.forecasts[data.forecasts.length - 1]?.projected_km2}&nbsp;km²
                </p>
                <span className="font-mono text-[11px] text-bone-400 tabular-nums">
                  +{data.regression_slope_km2_yr}&nbsp;km²/yr trend
                </span>
              </div>
            </section>

            {/* Composite Filmstrip + Orbital Loupe */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-4">
                {data.observations[0] && data.observations[data.observations.length - 1] ? (
                  <OrbitalLoupe
                    baseImage={data.observations[0].thumbnail_base64}
                    overlayImage={data.observations[data.observations.length - 1]!.thumbnail_base64}
                    baseLabel={`${data.observations[0].year}`}
                    overlayLabel={`${data.observations[data.observations.length - 1]!.year}`}
                    defaultMode="loupe"
                  />
                ) : null}
              </div>

              <div className="lg:col-span-8 grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-5">
                {data.observations.map((obs) => {
                  const isBreak = obs.year === data.bfast_breakpoint.breakpoint_year;
                  return (
                    <div
                      key={obs.year}
                      className={`rounded-xl p-3 flex flex-col justify-between ${
                        isBreak ? "orbital-panel-active" : "orbital-panel"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-semibold text-bone-100 tabular-nums">
                            {obs.year}
                          </span>
                          <span className="font-mono text-[11px] text-bone-400 tabular-nums">
                            {obs.changed_pct}%
                          </span>
                        </div>

                        <img
                          src={obs.thumbnail_base64}
                          alt={`Sentinel-2 composite ${obs.year}`}
                          width={180}
                          height={180}
                          className="mt-2.5 aspect-square w-full rounded-lg border border-bone-100/10 object-cover"
                        />
                      </div>

                      <div className="mt-3 space-y-1 border-t border-bone-100/10 pt-2.5 text-xs tabular-nums">
                        <div className="flex justify-between">
                          <span className="text-bone-400">Area</span>
                          <span className="font-mono font-semibold text-bone-100">
                            {obs.changed_km2}&nbsp;km²
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-bone-400">Rate</span>
                          <span className="font-mono text-signal-400">
                            +{obs.annual_velocity_km2_yr}
                          </span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-bone-400">NDVI</span>
                          <span className="font-mono text-bone-300">
                            {obs.mean_ndvi}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Trajectory Chart & Spatial Contagion Map */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              <div className="lg:col-span-7 orbital-panel rounded-xl p-5 flex flex-col justify-between space-y-5">
                <h2 className="text-sm font-semibold text-bone-100">
                  Trajectory (2017–2030)
                </h2>

                <div className="space-y-3">
                  {[
                    ...data.observations.map((o) => ({
                      year: o.year,
                      km2: o.changed_km2,
                      pct: o.changed_pct,
                      isForecast: false,
                      isBreakpoint: o.year === data.bfast_breakpoint.breakpoint_year,
                      ci: null as string | null,
                    })),
                    ...data.forecasts.map((f) => ({
                      year: f.year,
                      km2: f.projected_km2,
                      pct: f.projected_pct,
                      isForecast: true,
                      isBreakpoint: false,
                      ci: `${f.lower_ci_km2}–${f.upper_ci_km2} km²`,
                    })),
                  ].map((item) => {
                    const maxKm2 = Math.max(
                      data.forecasts[data.forecasts.length - 1]?.upper_ci_km2 ?? 1,
                      1,
                    );
                    const widthPct = Math.min(100, Math.max(2, (item.km2 / maxKm2) * 100));
                    return (
                      <div key={item.year} className="space-y-1">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-bone-100 w-10">
                              {item.year}
                            </span>
                            {item.isBreakpoint ? (
                              <span className="font-mono text-[10px] text-signal-400">
                                Breakpoint
                              </span>
                            ) : null}
                            {item.isForecast ? (
                              <span className="font-mono text-[10px] text-bone-400">
                                Forecast
                              </span>
                            ) : null}
                          </div>
                          <div className="font-mono">
                            <span className="font-semibold text-bone-100">{item.km2}&nbsp;km²</span>
                            <span className="ms-2 text-bone-400">({item.pct}%)</span>
                            {item.ci ? (
                              <span className="ms-2 text-[10px] text-bone-400">
                                [{item.ci}]
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-950">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              item.isForecast
                                ? "bg-signal-400/50"
                                : "bg-signal-400"
                            }`}
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 orbital-panel rounded-xl p-5 flex flex-col justify-between space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-bone-100">
                    Spatial Expansion ({horizonYear})
                  </h2>

                  <div className="flex rounded-lg border border-bone-100/15 bg-ink-950 p-0.5 text-xs">
                    {([2024, 2028, 2030] as const).map((hy) => (
                      <button
                        key={hy}
                        type="button"
                        onClick={() => setHorizonYear(hy)}
                        className={`rounded-md px-2.5 py-1 font-mono font-medium transition-colors ${
                          horizonYear === hy
                            ? "bg-signal-400 text-ink-950 font-semibold"
                            : "text-bone-300 hover:text-bone-100"
                        }`}
                      >
                        {hy}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="aspect-square w-full overflow-hidden rounded-lg">
                  <ForecastRiskCanvas grid={data.forecast_grid} horizonYear={horizonYear} />
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
