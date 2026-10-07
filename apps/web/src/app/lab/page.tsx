"use client";

import { useEffect, useState, useCallback, type ChangeEvent } from "react";
import { StudioNav } from "@/components/studio-nav";
import { OrbitalLoupe } from "@/components/ui/orbital-loupe";

interface LabBlob {
  id: number;
  pixel_area: number;
  scene_pct: number;
  confidence: number;
  class_label: string;
  ndvi_delta: number;
  ndbi_delta: number;
}

interface GroundTruthEval {
  has_ground_truth: boolean;
  precision: number;
  recall: number;
  f1_score: number;
  iou: number;
  confusion_map_base64: string;
}

interface LabResponse {
  meta: {
    title: string;
    dataset: string;
    resolution: string;
  };
  changed_pixels: number;
  changed_pct: number;
  blob_count: number;
  blobs: LabBlob[];
  image_t1_base64: string;
  image_t2_base64: string;
  heatmap_base64: string;
  overlay_base64: string;
  ground_truth_eval: GroundTruthEval | null;
}

const BENCHMARK_SAMPLES = [
  {
    id: "levir_urban_1",
    label: "LEVIR-CD #1 · Urban Residential",
    subtitle: "0.5m Building Footprint Ground-Truth",
  },
  {
    id: "levir_industrial_2",
    label: "LEVIR-CD #2 · Industrial Logistics",
    subtitle: "0.5m Warehouse Expansion Ground-Truth",
  },
  {
    id: "oscd_deforestation_3",
    label: "OSCD #3 · Tropical Forest Clearing",
    subtitle: "10m Sentinel-2 Canopy Ground-Truth",
  },
  {
    id: "saudi_neom_4",
    label: "Vision 2030 #4 · Desert Corridor",
    subtitle: "2.5m Linear Infrastructure Ground-Truth",
  },
] as const;

export default function LabPage() {
  const [activeSampleId, setActiveSampleId] = useState<string>("levir_urban_1");
  const [customT1, setCustomT1] = useState<string | null>(null);
  const [customT2, setCustomT2] = useState<string | null>(null);
  const [data, setData] = useState<LabResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSample = useCallback(async (sampleId: string) => {
    setLoading(true);
    setError(null);
    setActiveSampleId(sampleId);
    try {
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sample_id: sampleId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Lab inference failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as LabResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to run image pair inference");
    } finally {
      setLoading(false);
    }
  }, []);

  const runCustomPair = async () => {
    if (!customT1 || !customT2) return;
    setLoading(true);
    setError(null);
    setActiveSampleId("custom");
    try {
      const res = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_t1_base64: customT1,
          image_t2_base64: customT2,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Custom pair inference failed" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as LabResponse;
      setData(json);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to process custom image pair");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSample("levir_urban_1");
  }, [runSample]);

  const handleFileUpload = (
    e: ChangeEvent<HTMLInputElement>,
    setter: (val: string | null) => void,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setter(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="min-h-screen bg-orbital-canvas text-bone-100 flex flex-col">
      <StudioNav />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-6 space-y-6">
        {/* Top Control Bar */}
        <section className="orbital-panel rounded-xl p-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-bone-100">
            Pair Upload Lab
          </h1>

          {data ? (
            <a
              href={data.overlay_base64}
              download="terrashift-segmentation-overlay.png"
              className="inline-flex items-center gap-2 rounded-lg bg-signal-400 hover:bg-signal-500 px-3.5 py-2 text-xs font-semibold text-ink-950 transition-colors"
            >
              Export Overlay (.png)
            </a>
          ) : null}
        </section>

        {/* Benchmark Samples vs Custom Upload Grid */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 cols: 1-Click Ground-Truth Samples */}
          <div className="lg:col-span-7 orbital-panel rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-semibold text-bone-100">
              Benchmark Patches
            </h2>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {BENCHMARK_SAMPLES.map((s) => {
                const active = activeSampleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={loading}
                    onClick={() => void runSample(s.id)}
                    className={`rounded-xl p-3.5 text-start transition-all ${
                      active ? "orbital-panel-active" : "orbital-panel hover:border-bone-100/25"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-bone-100">{s.label}</span>
                    <span className="mt-0.5 block font-mono text-[10px] text-bone-400">{s.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 5 cols: Custom Before/After File Uploader */}
          <div className="lg:col-span-5 orbital-panel rounded-xl p-5 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-bone-100">
                Custom Pair Upload
              </h2>

              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-bone-100/20 bg-ink-950/60 p-3 text-center cursor-pointer hover:border-signal-400/60 transition-colors">
                  <span className="text-xs font-medium text-bone-200">
                    {customT1 ? "Loaded T₁ (Before)" : "Select T₁ (Before)"}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] text-bone-400">PNG / JPG / WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setCustomT1)}
                    className="hidden"
                  />
                </label>

                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-bone-100/20 bg-ink-950/60 p-3 text-center cursor-pointer hover:border-signal-400/60 transition-colors">
                  <span className="text-xs font-medium text-bone-200">
                    {customT2 ? "Loaded T₂ (After)" : "Select T₂ (After)"}
                  </span>
                  <span className="mt-0.5 font-mono text-[10px] text-bone-400">PNG / JPG / WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setCustomT2)}
                    className="hidden"
                  />
                </label>
              </div>
            </div>

            <button
              type="button"
              onClick={runCustomPair}
              disabled={!customT1 || !customT2 || loading}
              className={`w-full rounded-lg py-2.5 text-xs font-semibold transition-all ${
                customT1 && customT2 && !loading
                  ? "bg-signal-400 text-ink-950 hover:bg-signal-500"
                  : "cursor-not-allowed bg-ink-950 text-bone-400 border border-bone-100/10"
              }`}
            >
              Run Inference
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-crimson-400/50 bg-crimson-400/10 p-4 text-xs text-crimson-400">
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            {/* Interactive Dual Loupe Inspection Row */}
            <section className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-base font-semibold text-bone-100">{data.meta.title}</h2>
                  <p className="font-mono text-xs text-bone-400">
                    {data.meta.dataset} · {data.meta.resolution} · {data.blob_count} Objects ({data.changed_pct}%)
                  </p>
                </div>

                {data.ground_truth_eval ? (
                  <div className="flex items-center gap-3 orbital-panel rounded-lg px-3.5 py-2 text-xs tabular-nums">
                    <span>
                      F1:{" "}
                      <strong className="font-mono text-signal-400">
                        {(data.ground_truth_eval.f1_score * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span className="text-bone-400">·</span>
                    <span>
                      IoU:{" "}
                      <strong className="font-mono text-bone-100">
                        {(data.ground_truth_eval.iou * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span className="text-bone-400">·</span>
                    <span>
                      Precision:{" "}
                      <strong className="font-mono text-bone-100">
                        {(data.ground_truth_eval.precision * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span className="text-bone-400">·</span>
                    <span>
                      Recall:{" "}
                      <strong className="font-mono text-bone-100">
                        {(data.ground_truth_eval.recall * 100).toFixed(1)}%
                      </strong>
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Dual Interactive Orbital Loupes */}
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <OrbitalLoupe
                  baseImage={data.image_t1_base64}
                  overlayImage={data.heatmap_base64}
                  baseLabel="T₁ (Before)"
                  overlayLabel="Probability Field"
                />
                <OrbitalLoupe
                  baseImage={data.image_t2_base64}
                  overlayImage={
                    data.ground_truth_eval
                      ? data.ground_truth_eval.confusion_map_base64
                      : data.overlay_base64
                  }
                  baseLabel="T₂ (After)"
                  overlayLabel={
                    data.ground_truth_eval ? "TP / FP / FN Confusion Map" : "Segmented Mask"
                  }
                />
              </div>
            </section>

            {/* Detected Objects / Blobs Table */}
            <section className="orbital-panel rounded-xl p-5 space-y-3">
              <h2 className="text-sm font-semibold text-bone-100">
                Detected Objects ({data.blobs.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-bone-100/10 text-bone-400">
                      <th className="py-2 pe-4 text-start font-medium">ID</th>
                      <th className="py-2 px-4 text-start font-medium">Class</th>
                      <th className="py-2 px-4 text-end font-medium">Area (px²)</th>
                      <th className="py-2 px-4 text-end font-medium">Share</th>
                      <th className="py-2 px-4 text-end font-medium">ΔNDVI</th>
                      <th className="py-2 px-4 text-end font-medium">ΔNDBI</th>
                      <th className="py-2 ps-4 text-end font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bone-100/5 tabular-nums">
                    {data.blobs.map((b) => (
                      <tr key={b.id} className="text-bone-200">
                        <td className="py-2.5 pe-4 font-mono">#{b.id}</td>
                        <td className="py-2.5 px-4 font-medium text-bone-100">{b.class_label}</td>
                        <td className="py-2.5 px-4 text-end font-mono">{b.pixel_area}</td>
                        <td className="py-2.5 px-4 text-end font-mono">{b.scene_pct}%</td>
                        <td className="py-2.5 px-4 text-end font-mono">{b.ndvi_delta}</td>
                        <td className="py-2.5 px-4 text-end font-mono">{b.ndbi_delta}</td>
                        <td className="py-2.5 ps-4 text-end font-mono text-signal-400">
                          {(b.confidence * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
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
