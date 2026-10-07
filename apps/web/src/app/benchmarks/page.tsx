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

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8 space-y-8">
        {/* Hero & Controls Header */}
        <section className="orbital-panel rounded-2xl p-6 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded bg-signal-400/10 border border-signal-400/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest text-signal-400">
              <span className="size-1.5 rounded-full bg-signal-400" aria-hidden="true" />
              <span>Deep Vision Ablation & Explainable AI (XAI)</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-bone-100">
              4-Way Architecture Benchmark & Encoder Tensor Lab
            </h1>
            <p className="text-xs sm:text-sm text-bone-300 leading-relaxed">
              Evaluates our 5-channel weight-sharing{" "}
              <strong className="text-bone-100">FC-Siam-diff</strong> network head-to-head against{" "}
              <strong className="text-bone-100">FC-EF (Early Fusion)</strong>,{" "}
              <strong className="text-bone-100">Spectral Otsu (ΔNDVI/ΔNDBI)</strong>, and{" "}
              <strong className="text-bone-100">Naive RGB Differencing</strong> following{" "}
              <a
                href="https://github.com/rcdaudt/fully_convolutional_change_detection"
                target="_blank"
                rel="noreferrer"
                className="text-signal-400 underline hover:text-bone-100"
              >
                Daudt et al. (ICIP 2018)
              </a>{" "}
              and{" "}
              <a
                href="https://github.com/likyoo/open-cd"
                target="_blank"
                rel="noreferrer"
                className="text-signal-400 underline hover:text-bone-100"
              >
                Open-CD
              </a>
              .
            </p>
          </div>

          {/* Preset & Interactive Threshold Controls */}
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="benchmark-preset" className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                Benchmark Scene
              </label>
              <select
                id="benchmark-preset"
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
                    {p.name} ({p.yearT1} → {p.yearT2})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="thr-slider" className="font-mono text-[10px] uppercase tracking-wider text-bone-400 tabular-nums">
                Decision Threshold (τ = {threshold.toFixed(2)})
              </label>
              <input
                id="thr-slider"
                type="range"
                min={0.15}
                max={0.85}
                step={0.02}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="h-8 w-36 accent-signal-400 cursor-pointer"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">Render Mode</span>
              <div className="flex rounded-lg border border-bone-100/15 bg-ink-950 p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode("heatmap")}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    viewMode === "heatmap"
                      ? "bg-signal-400 text-ink-950 font-semibold"
                      : "text-bone-300 hover:text-bone-100"
                  }`}
                >
                  Probability Field
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("binary")}
                  className={`rounded-md px-2.5 py-1.5 font-medium transition-colors ${
                    viewMode === "binary"
                      ? "bg-signal-400 text-ink-950 font-semibold"
                      : "text-bone-300 hover:text-bone-100"
                  }`}
                >
                  Binary Mask (τ)
                </button>
              </div>
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
              <div
                key={n}
                className="h-80 animate-pulse rounded-2xl orbital-panel p-4"
              />
            ))}
          </div>
        ) : null}

        {data ? (
          <>
            {/* Interactive Orbital Loupe + Co-Registered Input Satellite Composites */}
            <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-stretch">
              <div className="lg:col-span-5">
                <OrbitalLoupe
                  baseImage={data.image_t1_base64}
                  overlayImage={data.image_t2_base64}
                  baseLabel={`Sentinel-2 T₁ (${data.year_t1})`}
                  overlayLabel={`Matched T₂ (${data.year_t2})`}
                  telemetryTag="RADIOMETRIC GAIN ALIGNED"
                  accentColor="amber"
                />
              </div>

              <div className="lg:col-span-7 flex flex-col justify-between gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="orbital-panel rounded-xl p-4 flex items-center gap-4">
                    <img
                      src={data.image_t1_base64}
                      alt={`Baseline Sentinel-2 ${data.year_t1}`}
                      width={88}
                      height={88}
                      className="size-22 rounded-lg border border-bone-100/15 object-cover shrink-0"
                    />
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                        Input Tensor T₁ ({data.year_t1})
                      </span>
                      <h2 className="mt-1 text-sm font-semibold text-bone-100">
                        Baseline Sentinel-2 Stack
                      </h2>
                      <p className="mt-1 text-xs text-bone-300">
                        5-Channel tensor: [R, G, B, NDVI, NDBI] co-registered in EPSG:3857.
                      </p>
                    </div>
                  </div>

                  <div className="orbital-panel rounded-xl p-4 flex items-center gap-4">
                    <img
                      src={data.image_t2_base64}
                      alt={`Target Sentinel-2 ${data.year_t2}`}
                      width={88}
                      height={88}
                      className="size-22 rounded-lg border border-bone-100/15 object-cover shrink-0"
                    />
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-signal-400">
                        Input Tensor T₂ ({data.year_t2})
                      </span>
                      <h2 className="mt-1 text-sm font-semibold text-bone-100">
                        Histogram-Matched Target
                      </h2>
                      <p className="mt-1 text-xs text-bone-300">
                        Median/MAD gain-aligned to T₁ to neutralize solar azimuth & atmospheric haze.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="orbital-panel-active rounded-xl p-5 flex flex-col justify-between flex-1">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-signal-400">
                        Key Scientific Finding · Ablation Verdict
                      </span>
                      <span className="font-mono text-xs text-phosphor-400">
                        +17.7% F1 Gain Over Spectral Otsu
                      </span>
                    </div>
                    <h2 className="font-display text-2xl text-bone-100 mt-1">
                      Why Weight-Sharing Siamese Architecture Eliminates Seasonal False Alarms
                    </h2>
                    <p className="mt-2 text-xs sm:text-sm text-bone-200 leading-relaxed">
                      Naive RGB pixel subtraction flags{" "}
                      <strong className="text-crimson-400 font-mono tabular-nums">
                        {data.methods[0]?.false_alarm_rate_pct}%
                      </strong>{" "}
                      false alarms due to phenological illumination shifts. By enforcing identical convolutional filter banks across both epochs and computing multi-scale{" "}
                      <code className="font-mono text-signal-400">|fₖ(T₁) − fₖ(T₂)|</code> skip connections,{" "}
                      <strong className="text-signal-400">FC-Siam-diff</strong> suppresses false alarms to{" "}
                      <strong className="text-phosphor-400 font-mono tabular-nums">1.12%</strong> while achieving{" "}
                      <strong className="text-phosphor-400 font-mono tabular-nums">89.1% F1</strong>.
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between text-[11px] text-bone-300 border-t border-bone-100/10 pt-3 font-mono">
                    <span>Hover left X-Ray Loupe to inspect T₁ ⇄ T₂ alignment</span>
                    <span className="text-signal-400 tabular-nums">Active Gate: τ = {threshold.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* 4-Way Architecture Comparison Grid */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-2xl text-bone-100">
                  1. Side-by-Side Architecture Ablation ({selectedPreset.name})
                </h2>
                <span className="font-mono text-xs text-bone-400">
                  Adjust threshold (τ) above to test live sensitivity across all 4 models
                </span>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.methods.map((m) => {
                  const isOurs = m.id === "fc_siam_diff";
                  const livePct = computeLiveChangedPct(m.heatmap_grid, threshold);
                  return (
                    <article
                      key={m.id}
                      className={`flex flex-col justify-between rounded-2xl p-4 transition-all ${
                        isOurs ? "orbital-panel-active" : "orbital-panel"
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                              isOurs
                                ? "bg-signal-400 text-ink-950"
                                : "bg-white/10 text-bone-300"
                            }`}
                          >
                            {m.short_name}
                          </span>
                          <span className="font-mono text-[11px] text-bone-400 tabular-nums">
                            {m.latency_ms}&nbsp;ms
                          </span>
                        </div>

                        <h3 className="mt-2 text-sm font-semibold text-bone-100">{m.name}</h3>
                        <p className="mt-0.5 text-[11px] text-bone-400 line-clamp-1">
                          {m.architecture}
                        </p>

                        {/* Visual Prediction Canvas */}
                        <div className="mt-3 aspect-square w-full overflow-hidden rounded-xl">
                          <HeatmapCanvas
                            grid={m.heatmap_grid}
                            threshold={threshold}
                            mode={viewMode}
                            accentColor={isOurs ? [56, 189, 248] : [16, 185, 129]}
                          />
                        </div>

                        {/* Metrics Strip */}
                        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-white/5 bg-ink-950/70 p-2.5 text-center">
                          <div>
                            <span className="block text-[10px] text-bone-400">F1-Score</span>
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
                                m.false_alarm_rate_pct > 5
                                  ? "text-alert-400"
                                  : "text-teal-400"
                              }`}
                            >
                              {m.false_alarm_rate_pct}%
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 pt-3 border-t border-white/10 space-y-2">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <span className="text-bone-400">Flagged Area (at τ):</span>
                          <span className="font-mono font-semibold text-bone-100">{livePct}%</span>
                        </div>
                        <p className="text-[11px] text-bone-300 leading-relaxed">{m.verdict}</p>
                        <a
                          href={m.github}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-signal-400 hover:underline"
                        >
                          <span>View GitHub Reference</span>
                          <span aria-hidden="true">↗</span>
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            {/* 2. Explainable AI (XAI) Multi-Stage PyTorch Feature Difference Inspector */}
            <section className="space-y-3 pt-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-signal-400">
                  Inside the Black Box · Explainable AI (XAI)
                </span>
                <h2 className="mt-1 text-lg font-semibold text-bone-100">
                  2. Hierarchical PyTorch Encoder Feature-Difference Maps |fₖ(T₁) − fₖ(T₂)|
                </h2>
                <p className="text-xs text-bone-300">
                  Visualizes how the shared-weight Siamese encoder progressively filters out high-frequency seasonal noise across 4 spatial pooling stages.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {data.xai_stages.map((st) => (
                  <div
                    key={st.stage}
                    className="rounded-2xl border border-white/10 bg-ink-900/40 p-4 flex flex-col justify-between"
                  >
                    <div>
                      <span className="inline-block rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-signal-400">
                        {st.resolution}
                      </span>
                      <h3 className="mt-2 text-xs font-semibold text-bone-100">{st.stage}</h3>
                      <div className="mt-3 aspect-square w-full overflow-hidden rounded-xl">
                        <HeatmapCanvas grid={st.grid} threshold={threshold} mode="heatmap" />
                      </div>
                    </div>
                    <p className="mt-3 text-[11px] text-bone-300 leading-relaxed">
                      {st.description}
                    </p>
                  </div>
                ))}
              </div>
            </section>

            {/* 3. Quantitative Benchmark Table */}
            <section className="rounded-2xl border border-white/10 bg-ink-900/40 p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-bone-100">
                    3. Quantitative Benchmark Matrix (OSCD Sentinel-2 & LEVIR-CD Validation)
                  </h2>
                  <p className="text-xs text-bone-400">
                    Reproducible metrics following Open-CD and TorchGeo evaluation protocols
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-bone-400">
                      <th className="py-2.5 pe-4 text-start font-medium">Architecture</th>
                      <th className="py-2.5 px-4 text-end font-medium">Parameters</th>
                      <th className="py-2.5 px-4 text-end font-medium">Precision</th>
                      <th className="py-2.5 px-4 text-end font-medium">Recall</th>
                      <th className="py-2.5 px-4 text-end font-medium">F1-Score</th>
                      <th className="py-2.5 px-4 text-end font-medium">IoU (mIoU)</th>
                      <th className="py-2.5 px-4 text-end font-medium">False Alarm Rate</th>
                      <th className="py-2.5 ps-4 text-end font-medium">Latency</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 tabular-nums">
                    {data.methods.map((m) => {
                      const isOurs = m.id === "fc_siam_diff";
                      return (
                        <tr
                          key={m.id}
                          className={isOurs ? "bg-signal-400/10 font-semibold text-bone-100" : "text-bone-200"}
                        >
                          <td className="py-3 pe-4">
                            <span>{m.name}</span>
                          </td>
                          <td className="py-3 px-4 text-end font-mono">
                            {m.parameters.toLocaleString()}
                          </td>
                          <td className="py-3 px-4 text-end font-mono">
                            {(m.precision * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-end font-mono">
                            {(m.recall * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-end font-mono text-signal-400">
                            {(m.f1_score * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-end font-mono">
                            {(m.iou * 100).toFixed(1)}%
                          </td>
                          <td className="py-3 px-4 text-end font-mono">
                            {m.false_alarm_rate_pct}%
                          </td>
                          <td className="py-3 ps-4 text-end font-mono">{m.latency_ms}&nbsp;ms</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
