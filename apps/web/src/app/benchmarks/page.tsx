"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { StudioNav } from "@/components/studio-nav";
import { OrbitalLoupe } from "@/components/ui/orbital-loupe";
import { HOTSPOT_PRESETS, type HotspotPreset } from "@/lib/tiles";

interface AblationMethod {
  id: string;
  name: string;
  short_name: string;
  architecture: string;
  paper: string;
  github: string;
  parameters: number;
  latency_ms: number;
  f1_score: number;
  iou: number;
  precision: number;
  recall: number;
  false_alarm_rate_pct: number;
  changed_pct: number;
  blob_count: number;
  heatmap_grid: number[][];
  verdict: string;
}

interface XaiStage {
  stage: string;
  resolution: string;
  description: string;
  grid: number[][];
}

interface AblationResponse {
  year_t1: number;
  year_t2: number;
  image_t1_base64: string;
  image_t2_base64: string;
  methods: AblationMethod[];
  xai_stages: XaiStage[];
  references: { title: string; repo: string; url: string }[];
}

function magmaColor(val0to100: number): [number, number, number] {
  const t = Math.max(0, Math.min(1, val0to100 / 100));
  if (t < 0.25) {
    const s = t / 0.25;
    return [Math.round(8 + s * 45), Math.round(10 + s * 12), Math.round(24 + s * 75)];
  }
  if (t < 0.55) {
    const s = (t - 0.25) / 0.3;
    return [Math.round(53 + s * 135), Math.round(22 + s * 30), Math.round(99 + s * 20)];
  }
  if (t < 0.8) {
    const s = (t - 0.55) / 0.25;
    return [Math.round(188 + s * 62), Math.round(52 + s * 98), Math.round(119 - s * 75)];
  }
  const s = (t - 0.8) / 0.2;
  return [250, Math.round(150 + s * 95), Math.round(44 + s * 140)];
}

function HeatmapCanvas({
  grid,
  threshold,
  mode,
  accentColor,
}: {
  grid: number[][];
  threshold: number;
  mode: "heatmap" | "binary";
  accentColor?: [number, number, number];
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
    const thrInt = threshold * 100;
    const [ar, ag, ab] = accentColor ?? [56, 189, 248];

    for (let r = 0; r < rows; r++) {
      const row = grid[r] ?? [];
      for (let c = 0; c < cols; c++) {
        const val = row[c] ?? 0;
        const idx = (r * cols + c) * 4;
        if (mode === "binary") {
          if (val >= thrInt) {
            imgData.data[idx] = ar;
            imgData.data[idx + 1] = ag;
            imgData.data[idx + 2] = ab;
            imgData.data[idx + 3] = 255;
          } else {
            imgData.data[idx] = 10;
            imgData.data[idx + 1] = 15;
            imgData.data[idx + 2] = 23;
            imgData.data[idx + 3] = 255;
          }
        } else {
          const [mr, mg, mb] = magmaColor(val);
          imgData.data[idx] = mr;
          imgData.data[idx + 1] = mg;
          imgData.data[idx + 2] = mb;
          imgData.data[idx + 3] = 255;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }, [grid, threshold, mode, accentColor]);

  return (
    <canvas
      ref={canvasRef}
      className="size-full rounded-lg border border-white/10 bg-ink-950 object-cover"
      style={{ imageRendering: "auto" }}
    />
  );
}

export default function BenchmarksPage() {
  const [selectedPreset, setSelectedPreset] = useState<HotspotPreset>(
    () => HOTSPOT_PRESETS[0]!,
  );
  const [data, setData] = useState<AblationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(0.5);
  const [viewMode, setViewMode] = useState<"heatmap" | "binary">("heatmap");

  const runAblation = useCallback(async (preset: HotspotPreset) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ablation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygon: preset.polygon,
          yearT1: preset.yearT1,
          yearT2: preset.yearT2,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Ablation request failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as AblationResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to run model ablation");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runAblation(selectedPreset);
  }, [selectedPreset, runAblation]);

  const computeLiveChangedPct = (grid: number[][], thr: number): string => {
    if (!grid.length) return "0.0";
    let active = 0;
    let total = 0;
    const thrInt = thr * 100;
    for (const row of grid) {
      for (const val of row) {
        total++;
        if (val >= thrInt) active++;
      }
    }
    return ((active / Math.max(total, 1)) * 100).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-orbital-canvas text-bone-100 flex flex-col">
      <StudioNav />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8 space-y-6">
        {/* Controls Bar */}
        <section className="orbital-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-lg font-semibold text-bone-100">Model Benchmarks</h1>

          <div className="flex flex-wrap items-center gap-4">
            <select
              id="benchmark-preset"
              aria-label="Benchmark scene"
              value={selectedPreset.id}
              disabled={loading}
              onChange={(e) => {
                const found = HOTSPOT_PRESETS.find((p) => p.id === e.target.value);
                if (found) setSelectedPreset(found);
              }}
              className="rounded-lg border border-bone-100/15 bg-ink-950 px-3 py-2 text-xs font-medium text-bone-100 focus-visible:outline-none"
            >
              {HOTSPOT_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.yearT1} → {p.yearT2})
                </option>
              ))}
            </select>

            <div className="flex items-center gap-2">
              <label htmlFor="thr-slider" className="font-mono text-xs text-bone-300 tabular-nums">
                τ = {threshold.toFixed(2)}
              </label>
              <input
                id="thr-slider"
                type="range"
                min={0.15}
                max={0.85}
                step={0.02}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="h-6 w-28 accent-signal-400 cursor-pointer"
              />
            </div>

            <div className="flex rounded-lg border border-bone-100/15 bg-ink-950 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("heatmap")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  viewMode === "heatmap"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                Heatmap
              </button>
              <button
                type="button"
                onClick={() => setViewMode("binary")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  viewMode === "binary"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                Binary Mask
              </button>
            </div>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-crimson-400/50 bg-crimson-400/10 p-4 text-xs text-crimson-400">
            {error}
          </div>
        ) : null}

        {loading && !data ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-72 animate-pulse rounded-2xl orbital-panel p-4" />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            {/* 4-Way Architecture Comparison Grid */}
            <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {data.methods.map((m) => {
                const isOurs = m.id === "fc_siam_diff";
                const livePct = computeLiveChangedPct(m.heatmap_grid, threshold);
                return (
                  <article
                    key={m.id}
                    className={`flex flex-col justify-between rounded-2xl p-4 ${
                      isOurs ? "orbital-panel-active" : "orbital-panel"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-bone-100">{m.name}</h2>
                        <span className="font-mono text-xs text-bone-400 tabular-nums">
                          {m.latency_ms} ms
                        </span>
                      </div>

                      <div className="mt-3 aspect-square w-full overflow-hidden rounded-xl">
                        <HeatmapCanvas
                          grid={m.heatmap_grid}
                          threshold={threshold}
                          mode={viewMode}
                          accentColor={isOurs ? [56, 189, 248] : [16, 185, 129]}
                        />
                      </div>

                      <div className="mt-3 grid grid-cols-4 gap-1.5 rounded-xl border border-white/5 bg-ink-950/70 p-2.5 text-center">
                        <div>
                          <span className="block text-[10px] text-bone-400">F1</span>
                          <span
                            className={`font-mono text-xs font-bold tabular-nums ${
                              isOurs ? "text-signal-400" : "text-bone-100"
                            }`}
                          >
                            {(m.f1_score * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-bone-400">IoU</span>
                          <span className="font-mono text-xs font-semibold text-bone-200 tabular-nums">
                            {(m.iou * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-bone-400">False Alarm</span>
                          <span
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              m.false_alarm_rate_pct > 5 ? "text-alert-400" : "text-teal-400"
                            }`}
                          >
                            {m.false_alarm_rate_pct}%
                          </span>
                        </div>
                        <div>
                          <span className="block text-[10px] text-bone-400">Area</span>
                          <span className="font-mono text-xs font-semibold text-bone-100 tabular-nums">
                            {livePct}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            {/* Input Pair & Encoder Stages */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              <div className="lg:col-span-4">
                <OrbitalLoupe
                  baseImage={data.image_t1_base64}
                  overlayImage={data.image_t2_base64}
                  baseLabel={String(data.year_t1)}
                  overlayLabel={String(data.year_t2)}
                />
              </div>

              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {data.xai_stages.map((st) => (
                    <div key={st.stage} className="orbital-panel rounded-xl p-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-bone-100">{st.stage}</span>
                        <span className="font-mono text-[10px] text-bone-400">{st.resolution}</span>
                      </div>
                      <div className="mt-2 aspect-square w-full overflow-hidden rounded-lg">
                        <HeatmapCanvas grid={st.grid} threshold={threshold} mode="heatmap" />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Quantitative Table */}
                <div className="orbital-panel rounded-2xl p-4 overflow-x-auto">
                  <table className="w-full text-start text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-white/10 text-bone-400">
                        <th className="py-2 pe-4 text-start font-medium">Architecture</th>
                        <th className="py-2 px-3 text-end font-medium">Params</th>
                        <th className="py-2 px-3 text-end font-medium">Precision</th>
                        <th className="py-2 px-3 text-end font-medium">Recall</th>
                        <th className="py-2 px-3 text-end font-medium">F1</th>
                        <th className="py-2 px-3 text-end font-medium">IoU</th>
                        <th className="py-2 px-3 text-end font-medium">False Alarm</th>
                        <th className="py-2 ps-3 text-end font-medium">Latency</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 tabular-nums">
                      {data.methods.map((m) => {
                        const isOurs = m.id === "fc_siam_diff";
                        return (
                          <tr
                            key={m.id}
                            className={
                              isOurs ? "bg-signal-400/10 font-semibold text-bone-100" : "text-bone-200"
                            }
                          >
                            <td className="py-2.5 pe-4">{m.name}</td>
                            <td className="py-2.5 px-3 text-end font-mono">
                              {m.parameters.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-end font-mono">
                              {(m.precision * 100).toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-end font-mono">
                              {(m.recall * 100).toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-end font-mono text-signal-400">
                              {(m.f1_score * 100).toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-end font-mono">
                              {(m.iou * 100).toFixed(1)}%
                            </td>
                            <td className="py-2.5 px-3 text-end font-mono">
                              {m.false_alarm_rate_pct}%
                            </td>
                            <td className="py-2.5 ps-3 text-end font-mono">{m.latency_ms} ms</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
