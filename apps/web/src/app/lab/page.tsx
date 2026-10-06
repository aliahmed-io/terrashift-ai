"use client";

import { useEffect, useState, useCallback, type ChangeEvent } from "react";
import { StudioNav } from "@/components/studio-nav";

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
    <div className="min-h-screen bg-ink-950 text-bone-100 flex flex-col">
      <StudioNav
        rightSlot={
          data ? (
            <a
              href={data.overlay_base64}
              download="terrashift-segmentation-overlay.png"
              className="rounded-lg border border-white/15 bg-ink-900 px-3 py-1.5 text-xs font-medium text-bone-200 hover:border-signal-400/50 hover:text-signal-400 transition-colors"
            >
              Export Overlay (.png)
            </a>
          ) : null
        }
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header */}
        <section className="flex flex-col gap-6 rounded-2xl border border-white/10 bg-ink-900/50 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-signal-400" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-wider text-signal-400">
                Custom Image-Pair Sandbox & LEVIR-CD Ground-Truth Validator
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-bone-100">
              Optical / Drone Pair Upload & Ground-Truth Confusion Matrix
            </h1>
            <p className="text-xs sm:text-sm text-bone-300 leading-relaxed">
              Test the PyTorch Siamese U-Net on built-in{" "}
              <a
                href="https://github.com/justchenhao/BIT_CD"
                target="_blank"
                rel="noreferrer"
                className="text-signal-400 underline hover:text-bone-100"
              >
                LEVIR-CD (BIT_CD)
              </a>{" "}
              and{" "}
              <a
                href="https://github.com/microsoft/torchgeo"
                target="_blank"
                rel="noreferrer"
                className="text-signal-400 underline hover:text-bone-100"
              >
                TorchGeo OSCD
              </a>{" "}
              patches with live pixel-level Ground-Truth Confusion Matrices, or upload{" "}
              <strong className="text-bone-100">any custom Before/After images</strong> from your computer.
            </p>
          </div>
        </section>

        {/* Benchmark Samples vs Custom Upload Grid */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left 7 cols: 1-Click Ground-Truth Samples */}
          <div className="lg:col-span-7 rounded-2xl border border-white/10 bg-ink-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-bone-100">
                1. Select Benchmark Patch (with Known Ground-Truth Mask)
              </h2>
              <span className="text-[11px] text-bone-400">256×256 Co-Registered Patches</span>
            </div>

            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {BENCHMARK_SAMPLES.map((s) => {
                const active = activeSampleId === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    disabled={loading}
                    onClick={() => void runSample(s.id)}
                    className={`rounded-xl border p-3.5 text-start transition-all ${
                      active
                        ? "border-signal-400 bg-signal-400/15 shadow-sm"
                        : "border-white/10 bg-ink-950/60 hover:border-white/25"
                    }`}
                  >
                    <span className="block text-xs font-semibold text-bone-100">{s.label}</span>
                    <span className="mt-0.5 block text-[11px] text-bone-400">{s.subtitle}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right 5 cols: Custom Before/After File Uploader */}
          <div className="lg:col-span-5 rounded-2xl border border-white/10 bg-ink-900/40 p-5 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-bone-100">
                2. Or Upload Custom Before / After Pair (PNG / JPG)
              </h2>
              <p className="mt-0.5 text-[11px] text-bone-400">
                Automatically co-registers, normalizes histograms, and segments change blobs
              </p>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-ink-950/60 p-3 text-center cursor-pointer hover:border-signal-400/60 transition-colors">
                  <span className="text-xs font-medium text-bone-200">
                    {customT1 ? "✓ T₁ Before Loaded" : "Select T₁ (Before)"}
                  </span>
                  <span className="mt-0.5 text-[10px] text-bone-400">PNG / JPG / WEBP</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleFileUpload(e, setCustomT1)}
                    className="hidden"
                  />
                </label>

                <label className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-ink-950/60 p-3 text-center cursor-pointer hover:border-signal-400/60 transition-colors">
                  <span className="text-xs font-medium text-bone-200">
                    {customT2 ? "✓ T₂ After Loaded" : "Select T₂ (After)"}
                  </span>
                  <span className="mt-0.5 text-[10px] text-bone-400">PNG / JPG / WEBP</span>
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
              className={`w-full rounded-xl py-2.5 text-xs font-semibold transition-all ${
                customT1 && customT2 && !loading
                  ? "bg-signal-400 text-ink-950 hover:bg-signal-400/90"
                  : "cursor-not-allowed bg-ink-950 text-bone-400 border border-white/5"
              }`}
            >
              Run Siamese U-Net on Custom Pair
            </button>
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-alert-500/60 bg-alert-500/10 p-4 text-xs text-alert-400">
            {error}
          </div>
        ) : null}

        {data ? (
          <>
            {/* 4-Panel Visual Output Matrix */}
            <section className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-bone-100">{data.meta.title}</h2>
                  <p className="text-xs text-bone-400">
                    {data.meta.dataset} · {data.meta.resolution} · {data.blob_count} Discrete Change Objects ({data.changed_pct}% of scene)
                  </p>
                </div>

                {data.ground_truth_eval ? (
                  <div className="flex items-center gap-3 rounded-xl border border-teal-400/40 bg-teal-400/10 px-4 py-2 text-xs tabular-nums">
                    <span>
                      F1:{" "}
                      <strong className="font-mono text-teal-400">
                        {(data.ground_truth_eval.f1_score * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      IoU:{" "}
                      <strong className="font-mono text-bone-100">
                        {(data.ground_truth_eval.iou * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Precision:{" "}
                      <strong className="font-mono text-bone-100">
                        {(data.ground_truth_eval.precision * 100).toFixed(1)}%
                      </strong>
                    </span>
                    <span>·</span>
                    <span>
                      Recall:{" "}
                      <strong className="font-mono text-bone-100">
                        {(data.ground_truth_eval.recall * 100).toFixed(1)}%
                      </strong>
                    </span>
                  </div>
                ) : null}
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-3.5 space-y-2">
                  <span className="text-xs font-semibold text-bone-300">
                    1. Input Patch T₁ (Before)
                  </span>
                  <img
                    src={data.image_t1_base64}
                    alt="Input patch T1 before"
                    width={256}
                    height={256}
                    className="aspect-square w-full rounded-xl border border-white/10 object-cover"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-3.5 space-y-2">
                  <span className="text-xs font-semibold text-bone-300">
                    2. Input Patch T₂ (After)
                  </span>
                  <img
                    src={data.image_t2_base64}
                    alt="Input patch T2 after"
                    width={256}
                    height={256}
                    className="aspect-square w-full rounded-xl border border-white/10 object-cover"
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-3.5 space-y-2">
                  <span className="text-xs font-semibold text-signal-400">
                    3. Siamese Probability Field
                  </span>
                  <img
                    src={data.heatmap_base64}
                    alt="Continuous change probability heatmap"
                    width={256}
                    height={256}
                    className="aspect-square w-full rounded-xl border border-white/10 object-cover"
                  />
                </div>

                <div className="rounded-2xl border border-signal-400/50 bg-ink-900/60 p-3.5 space-y-2">
                  <span className="text-xs font-semibold text-teal-400">
                    {data.ground_truth_eval
                      ? "4. Ground-Truth Confusion Map"
                      : "4. Segmented Change Overlay"}
                  </span>
                  <img
                    src={
                      data.ground_truth_eval
                        ? data.ground_truth_eval.confusion_map_base64
                        : data.overlay_base64
                    }
                    alt="Segmented change output"
                    width={256}
                    height={256}
                    className="aspect-square w-full rounded-xl border border-white/10 object-cover"
                  />
                </div>
              </div>

              {data.ground_truth_eval ? (
                <div className="flex flex-wrap items-center gap-4 rounded-xl border border-white/10 bg-ink-900/30 px-4 py-2.5 text-xs text-bone-300">
                  <span className="font-semibold text-bone-100">Confusion Matrix Legend:</span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#10B981]" />
                    True Positive (Correct Hit)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#FF5240]" />
                    False Positive (False Alarm)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[#3DD6C3]" />
                    False Negative (Missed Edge)
                  </span>
                </div>
              ) : null}
            </section>

            {/* Detected Objects / Blobs Table */}
            <section className="rounded-2xl border border-white/10 bg-ink-900/40 p-6 space-y-4">
              <h2 className="text-base font-semibold text-bone-100">
                Detected Connected-Component Change Objects ({data.blobs.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-white/10 text-bone-400">
                      <th className="py-2 pe-4 text-start font-medium">Object ID</th>
                      <th className="py-2 px-4 text-start font-medium">Semantic Class</th>
                      <th className="py-2 px-4 text-end font-medium">Pixel Area (px²)</th>
                      <th className="py-2 px-4 text-end font-medium">Scene Share</th>
                      <th className="py-2 px-4 text-end font-medium">ΔNDVI</th>
                      <th className="py-2 px-4 text-end font-medium">ΔNDBI</th>
                      <th className="py-2 ps-4 text-end font-medium">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 tabular-nums">
                    {data.blobs.map((b) => (
                      <tr key={b.id} className="text-bone-200">
                        <td className="py-2.5 pe-4 font-mono">Blob #{b.id}</td>
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
