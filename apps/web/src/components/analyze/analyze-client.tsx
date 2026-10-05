"use client";

import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useCallback, useState, useRef } from "react";
import { MapCanvas, type MapFeature } from "@/components/map/map-canvas";
import { LocationSearch } from "@/components/search/location-search";
import {
  HOTSPOT_PRESETS,
  type HotspotPreset,
  calculatePolygonAreaKm2,
  formatArea,
  MAX_AOI_KM2,
} from "@/lib/tiles";
import type { GeocodeLocation } from "@/app/api/geocode/route";

interface ModelBenchmark {
  dataset: string;
  f1_score: number;
  iou: number;
  precision: number;
  recall: number;
}

interface ModelMetadata {
  architecture: string;
  parameter_count: number;
  input_channels: string[];
  loss_formulation: string;
  benchmark_accuracy: ModelBenchmark;
}

interface AnalysisMetadata {
  bbox: [number, number, number, number];
  year_t1: number;
  year_t2: number;
  date_t1: string;
  date_t2: string;
  aoi_km2: number;
  changed_pct: number;
  total_changed_km2: number;
  total_changed_m2: number;
  polygon_count: number;
  resolution_m?: number | undefined;
  threshold?: number | undefined;
  provenance: string;
  model?: ModelMetadata | undefined;
  generated_at?: string | undefined;
}

interface AnalysisResult {
  type: "FeatureCollection";
  metadata: AnalysisMetadata;
  features: MapFeature[];
  provenance: string;
}

type AnalysisStatus = "idle" | "running" | "done" | "error";

export function AnalyzeClient() {
  const [yearT1, setYearT1] = useState(2018);
  const [yearT2, setYearT2] = useState(2024);
  const [polygon, setPolygon] = useState<[number, number][] | null>(() => {
    const preset = HOTSPOT_PRESETS[0];
    return preset ? [...preset.polygon] : null;
  });
  const [isDrawing, setIsDrawing] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);

  // Status & Telemetry
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [stepLabel, setStepLabel] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Map viewport control
  const [mapCenter, setMapCenter] = useState<[number, number]>([-62.905, -9.702]);
  const [mapZoom, setMapZoom] = useState<number>(12.5);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const aoiAreaKm2 = polygon && polygon.length >= 3 ? calculatePolygonAreaKm2(polygon) : 0;
  const isOversized = aoiAreaKm2 > MAX_AOI_KM2;

  // Handle Preset selection
  const selectPreset = useCallback((preset: HotspotPreset) => {
    setPolygon([...preset.polygon]);
    setYearT1(preset.yearT1);
    setYearT2(preset.yearT2);
    setMapCenter(preset.center);
    setMapZoom(preset.zoom);
    setResult(null);
    setStatus("idle");
    setErrorMessage(null);
    setDrawerOpen(false);
    setSelectedFeatureId(null);
  }, []);

  // Handle Geocoding location selection
  const handleSelectLocation = useCallback((loc: GeocodeLocation) => {
    setMapCenter([loc.lon, loc.lat]);
    setMapZoom(12);
    const deltaLon = 0.04;
    const deltaLat = 0.03;
    setPolygon([
      [loc.lon - deltaLon, loc.lat - deltaLat],
      [loc.lon + deltaLon, loc.lat - deltaLat],
      [loc.lon + deltaLon, loc.lat + deltaLat],
      [loc.lon - deltaLon, loc.lat + deltaLat],
      [loc.lon - deltaLon, loc.lat - deltaLat],
    ]);
    setResult(null);
    setStatus("idle");
  }, []);

  // Stream analysis execution
  const runAnalysis = async () => {
    if (!polygon || polygon.length < 3 || isOversized || status === "running") return;

    setStatus("running");
    setProgress(5);
    setStepLabel("Connecting to satellite pipeline...");
    setErrorMessage(null);
    setResult(null);
    setSelectedFeatureId(null);

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygon,
          yearT1,
          yearT2,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        throw new Error(`Server returned HTTP ${res.status}`);
      }

      if (!res.body) {
        throw new Error("No response stream available");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);

          try {
            const data = JSON.parse(jsonStr) as {
              step?: number;
              label?: string;
              progress?: number;
              done?: boolean;
              result?: AnalysisResult;
              error?: { code: string; message: string };
            };

            if (data.error) {
              setErrorMessage(data.error.message);
              setStatus("error");
              return;
            }

            if (data.step && data.label && data.progress != null) {
              setStepLabel(data.label);
              setProgress(data.progress);
            }

            if (data.done && data.result) {
              setResult(data.result);
              setProgress(100);
              setStatus("done");
              setDrawerOpen(true);
            }
          } catch {
            // Ignore partial splits
          }
        }
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setErrorMessage(
          err instanceof Error ? err.message : "Analysis stream interrupted",
        );
        setStatus("error");
      }
    }
  };

  // Export GeoJSON
  const downloadGeoJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrashift-${yearT1}-${yearT2}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export PDF Report
  const downloadPdfReport = async () => {
    if (!result) return;
    setGeneratingPdf(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: result.metadata,
          feature_count: result.features.length,
          top_features: result.features.slice(0, 10).map((f) => ({
            id: f.properties.id,
            class_name: f.properties.class,
            label: f.properties.label,
            area_m2: f.properties.area_m2,
            confidence: f.properties.confidence,
          })),
        }),
      });

      if (!res.ok) throw new Error("PDF generation failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terrashift-audit-${result.metadata.year_t1}-${result.metadata.year_t2}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Failed to generate PDF audit report. Verify ML backend service is running.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handlePolygonChange = useCallback((newPoly: [number, number][] | null) => {
    setPolygon(newPoly);
    setResult(null);
    setStatus("idle");
  }, []);

  const handleSelectFeature = useCallback((id: number | null) => {
    setSelectedFeatureId(id);
    if (id != null) setDrawerOpen(true);
  }, []);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-ink-950 text-bone-100">
      {/* 1. Full-bleed Map Viewport */}
      <MapCanvas
        yearT1={yearT1}
        yearT2={yearT2}
        polygon={polygon}
        features={result?.features ?? []}
        isDrawing={isDrawing}
        onDrawingChange={setIsDrawing}
        onPolygonChange={handlePolygonChange}
        selectedFeatureId={selectedFeatureId}
        onSelectFeature={handleSelectFeature}
        compareMode={compareMode}
        center={mapCenter}
        zoom={mapZoom}
      />

      {/* 2. Top Header Bar (No Overlapping Collisions) */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 lg:p-6">
        {/* Brand Link */}
        <div className="pointer-events-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full border border-bone-100/15 bg-ink-950/85 px-4 py-2 font-mono text-xs tracking-widest text-bone-200 uppercase backdrop-blur transition-colors hover:border-signal-400 hover:text-signal-400 shadow-xl"
          >
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span>TerraShift</span>
          </Link>
        </div>

        {/* Global Location Search */}
        <div className="pointer-events-auto flex max-w-md flex-1 items-center px-4">
          <div className="w-full">
            <LocationSearch onSelectLocation={handleSelectLocation} />
          </div>
        </div>

        {/* Top Control Actions: AI Architecture & Dual View (Positioned safely away from zoom buttons) */}
        <div className="pointer-events-auto me-14 flex items-center gap-2">
          {/* AI Architecture & Model Inspector Button */}
          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            className="flex items-center gap-2 rounded-full border border-bone-100/15 bg-ink-950/85 px-4 py-2 font-mono text-xs tracking-wider text-bone-200 uppercase backdrop-blur hover:border-signal-400 hover:text-signal-400 shadow-xl transition-all"
          >
            <svg
              className="size-3.5 text-signal-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7h10v10H7z" />
              <path d="M4 12h3" />
              <path d="M17 12h3" />
              <path d="M12 4v3" />
              <path d="M12 17v3" />
            </svg>
            <span className="hidden sm:inline">AI Siamese Model</span>
          </button>

          {/* Side-by-Side Dual Synchronized Comparison Button */}
          <button
            type="button"
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs tracking-wider uppercase backdrop-blur shadow-xl transition-all ${
              compareMode
                ? "border-signal-400 bg-signal-400 text-ink-950 font-bold shadow-[0_0_20px_rgba(255,176,32,0.4)]"
                : "border-bone-100/15 bg-ink-950/85 text-bone-200 hover:border-signal-400 hover:text-signal-400"
            }`}
          >
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M12 3v18" />
            </svg>
            <span>{compareMode ? "Single View" : "Side-by-Side Dual View"}</span>
          </button>
        </div>
      </header>

      {/* 3. Hotspot Preset Pills */}
      <div className="pointer-events-none absolute top-20 inset-x-0 z-10 hidden justify-center md:flex">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-bone-100/10 bg-ink-950/85 p-1 backdrop-blur shadow-xl">
          <span className="px-3 py-1 font-mono text-[10px] tracking-widest text-bone-400 uppercase">
            Hotspots:
          </span>
          {HOTSPOT_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => selectPreset(p)}
              className="rounded-full px-3 py-1 font-mono text-[11px] text-bone-300 transition-colors hover:bg-bone-100/10 hover:text-signal-400"
            >
              {p.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Bottom Control Dock */}
      <div className="pointer-events-none absolute bottom-8 inset-x-0 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex max-w-3xl flex-col items-center gap-3">
          {/* Error Notice */}
          <AnimatePresence>
            {errorMessage ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="flex items-center gap-2 rounded-full border border-alert-500/80 bg-alert-500/20 px-4 py-2 font-mono text-xs text-alert-400 shadow-xl backdrop-blur-md"
              >
                <svg
                  className="size-4 shrink-0 text-alert-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="ms-2 underline hover:text-bone-100"
                >
                  Dismiss
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Main Control Pill */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-bone-100/15 bg-ink-950/90 p-2 shadow-2xl backdrop-blur-xl">
            {/* Year T1 */}
            <div className="flex items-center gap-1.5 px-2">
              <span className="font-mono text-[10px] tracking-widest text-bone-400 uppercase">
                T₁
              </span>
              <select
                aria-label="Year T1 baseline"
                value={yearT1}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setYearT1(val);
                  if (val >= yearT2) setYearT2(val + 1);
                }}
                disabled={status === "running"}
                className="rounded-lg border border-bone-100/15 bg-ink-900 px-2.5 py-1.5 font-mono text-xs text-bone-100 focus:border-signal-400 focus:outline-none"
              >
                {[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <span className="font-mono text-xs text-bone-400">→</span>

            {/* Year T2 */}
            <div className="flex items-center gap-1.5 px-2">
              <span className="font-mono text-[10px] tracking-widest text-signal-400 uppercase">
                T₂
              </span>
              <select
                aria-label="Year T2 target"
                value={yearT2}
                onChange={(e) => setYearT2(Number(e.target.value))}
                disabled={status === "running"}
                className="rounded-lg border border-bone-100/15 bg-ink-900 px-2.5 py-1.5 font-mono text-xs text-signal-400 focus:border-signal-400 focus:outline-none"
              >
                {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
                  .filter((y) => y > yearT1)
                  .map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
              </select>
            </div>

            <div className="h-6 w-px bg-bone-100/15" />

            {/* Draw Polygon Toggle */}
            <button
              type="button"
              onClick={() => setIsDrawing(!isDrawing)}
              disabled={status === "running"}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 font-mono text-xs tracking-wider uppercase transition-all ${
                isDrawing
                  ? "border border-signal-400 bg-signal-400 text-ink-950 font-bold"
                  : "border border-bone-100/15 bg-ink-900/60 text-bone-200 hover:border-signal-400/50 hover:text-signal-400"
              }`}
            >
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              <span>{isDrawing ? "Click Points" : "Draw AOI"}</span>
            </button>

            {/* Area Badge & Clear */}
            {polygon ? (
              <div className="flex items-center gap-2 px-2">
                <span
                  className={`font-mono text-xs ${
                    isOversized ? "text-alert-400 font-bold" : "text-bone-300"
                  }`}
                >
                  {formatArea(aoiAreaKm2 * 1_000_000)}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setPolygon(null);
                    setResult(null);
                    setStatus("idle");
                  }}
                  className="rounded p-1 text-bone-400 hover:bg-bone-100/10 hover:text-alert-400"
                  title="Clear AOI polygon"
                >
                  <svg
                    className="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>
            ) : null}

            <div className="h-6 w-px bg-bone-100/15" />

            {/* Run Analysis CTA / Telemetry Morph */}
            {status === "running" ? (
              <div className="flex min-w-[260px] flex-col gap-1.5 px-3 py-1">
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="text-signal-400 truncate max-w-[200px]">{stepLabel}</span>
                  <span className="text-bone-300">{progress}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full bg-signal-400 transition-all duration-300 ease-out shadow-[0_0_12px_rgba(255,176,32,0.8)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={runAnalysis}
                disabled={!polygon || polygon.length < 3 || isOversized}
                className={`flex items-center gap-2 rounded-xl px-6 py-2.5 font-mono text-xs tracking-widest uppercase transition-all ${
                  !polygon || polygon.length < 3 || isOversized
                    ? "cursor-not-allowed bg-ink-800 text-bone-400"
                    : "bg-signal-400 text-ink-950 font-bold hover:scale-[1.02] active:scale-95 shadow-[0_0_24px_rgba(255,176,32,0.4)]"
                }`}
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
                <span>Run Siamese AI</span>
              </button>
            )}

            {/* Results Drawer Toggle Button (if result exists) */}
            {result ? (
              <button
                type="button"
                onClick={() => setDrawerOpen(!drawerOpen)}
                className="rounded-xl border border-bone-100/15 bg-ink-900 px-3 py-2 font-mono text-xs text-signal-400 hover:border-signal-400"
              >
                {drawerOpen ? "Hide Metrics" : "View Metrics"}
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* 5. Results Slide-out Drawer */}
      <AnimatePresence>
        {drawerOpen && result ? (
          <motion.aside
            initial={{ opacity: 0, x: 380 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 380 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-0 end-0 z-30 h-full w-full max-w-md border-s border-bone-100/10 bg-ink-950/95 p-6 shadow-2xl backdrop-blur-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-bone-100/10 pb-4">
              <div>
                <span className="font-mono text-[10px] tracking-widest text-signal-400 uppercase">
                  Bi-Temporal Audit Report
                </span>
                <h2 className="font-display text-2xl text-bone-100">
                  {result.metadata.year_t1} → {result.metadata.year_t2}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-full border border-bone-100/10 p-2 text-bone-400 hover:border-bone-100/30 hover:text-bone-100"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {/* AI Model Architecture Badge */}
            <div className="mt-4 rounded-xl border border-signal-400/30 bg-signal-400/10 p-3 flex items-center justify-between">
              <div>
                <span className="font-mono text-[10px] uppercase text-signal-400 tracking-wider font-semibold">
                  Deep Model: Siamese U-Net (PyTorch)
                </span>
                <p className="font-mono text-[11px] text-bone-300">
                  2,102,145 weights · BCE + Soft Dice Loss
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                className="rounded px-2.5 py-1 text-xs font-mono text-signal-400 underline hover:text-bone-100"
              >
                Inspect
              </button>
            </div>

            {/* Key KPI Stats */}
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-bone-100/10 bg-ink-900/60 p-4">
                <span className="font-mono text-[10px] tracking-wider text-bone-400 uppercase">
                  Total Changed
                </span>
                <p className="mt-1 font-display text-2xl text-signal-400">
                  {formatArea(result.metadata.total_changed_m2)}
                </p>
                <span className="font-mono text-[10px] text-bone-300">
                  {result.metadata.changed_pct}% of total AOI
                </span>
              </div>

              <div className="rounded-xl border border-bone-100/10 bg-ink-900/60 p-4">
                <span className="font-mono text-[10px] tracking-wider text-bone-400 uppercase">
                  Polygons Detected
                </span>
                <p className="mt-1 font-display text-2xl text-bone-100">
                  {result.metadata.polygon_count}
                </p>
                <span className="font-mono text-[10px] text-bone-300">
                  AOI: {result.metadata.aoi_km2.toFixed(1)} km²
                </span>
              </div>
            </div>

            {/* Change Categories Breakdown */}
            <div className="mt-6">
              <h3 className="font-mono text-xs tracking-widest text-bone-400 uppercase">
                Change Class Distribution
              </h3>
              <div className="mt-3 space-y-2">
                {[
                  {
                    key: "vegetation_loss",
                    label: "Vegetation Loss / Clearing",
                    color: "bg-[#FF5240]",
                  },
                  {
                    key: "new_built_or_bare",
                    label: "New Built / Soil Exposure",
                    color: "bg-[#FFB020]",
                  },
                  {
                    key: "surface_change",
                    label: "Surface / Hydrology Shift",
                    color: "bg-[#3DD6C3]",
                  },
                ].map(({ key, label, color }) => {
                  const matching = result.features.filter(
                    (f) => f.properties.class.includes(key) || f.properties.class === key,
                  );
                  const count = matching.length;
                  const totalArea = matching.reduce((acc, f) => acc + f.properties.area_m2, 0);
                  if (count === 0) return null;

                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-lg border border-bone-100/5 bg-ink-900/40 p-3"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`size-2.5 rounded-full ${color}`} />
                        <span className="text-xs text-bone-200">{label}</span>
                      </div>
                      <div className="text-right font-mono text-xs">
                        <span className="text-bone-100 font-medium">{formatArea(totalArea)}</span>
                        <span className="ms-2 text-bone-400">({count})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual Feature Inspector */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-xs tracking-widest text-bone-400 uppercase">
                  Top Changed Polygons
                </h3>
                <span className="font-mono text-[10px] text-bone-400">Click to fly to</span>
              </div>
              <div className="mt-3 max-h-52 space-y-1.5 overflow-y-auto pe-1">
                {result.features.slice(0, 15).map((f) => (
                  <button
                    key={f.properties.id}
                    type="button"
                    onClick={() => setSelectedFeatureId(f.properties.id)}
                    className={`w-full flex items-center justify-between rounded-lg p-2.5 text-start transition-colors ${
                      selectedFeatureId === f.properties.id
                        ? "border border-signal-400/80 bg-signal-400/15"
                        : "border border-bone-100/5 bg-ink-900/30 hover:bg-bone-100/10"
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-medium text-bone-200">
                        Polygon #{f.properties.id} · {f.properties.label}
                      </span>
                      <span className="font-mono text-[10px] text-bone-400">
                        Confidence: {(f.properties.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="font-mono text-xs text-signal-400 font-medium">
                      {formatArea(f.properties.area_m2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Export Actions with SVG Icons */}
            <div className="mt-8 space-y-2.5 border-t border-bone-100/10 pt-6">
              <button
                type="button"
                onClick={downloadPdfReport}
                disabled={generatingPdf}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-signal-400 py-3 font-mono text-xs font-bold tracking-widest text-ink-950 uppercase transition-transform hover:scale-[1.01] active:scale-95 shadow-[0_0_20px_rgba(255,176,32,0.3)] disabled:opacity-50"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <span>{generatingPdf ? "Compiling PDF..." : "Download Audit Report (PDF)"}</span>
              </button>

              <button
                type="button"
                onClick={downloadGeoJson}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-bone-100/20 bg-ink-900 py-3 font-mono text-xs tracking-widest text-bone-200 uppercase transition-colors hover:border-signal-400 hover:text-signal-400"
              >
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  <polyline points="2 17 12 22 22 17" />
                  <polyline points="2 12 12 17 22 12" />
                </svg>
                <span>Export GeoJSON Layer</span>
              </button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* 6. AI Siamese Model Architecture & Tensor Inspector Modal */}
      <AnimatePresence>
        {aiModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border border-bone-100/15 bg-ink-950 p-6 sm:p-8 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-bone-100/10 pb-6">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="size-2 rounded-full bg-signal-400 animate-ping" />
                    <span className="font-mono text-xs uppercase text-signal-400 tracking-widest">
                      Deep Vision Senior Project Architecture
                    </span>
                  </div>
                  <h2 className="font-display mt-2 text-3xl sm:text-4xl text-bone-100">
                    PyTorch Siamese U-Net & Remote Sensing Physics
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="rounded-full border border-bone-100/15 p-2 text-bone-400 hover:text-bone-100 hover:border-bone-100/40"
                >
                  <svg
                    className="size-5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18" />
                    <path d="m6 6 12 12" />
                  </svg>
                </button>
              </div>

              {/* Technical Specifications Grid */}
              <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-bone-100/10 bg-ink-900/60 p-4">
                  <span className="font-mono text-[10px] text-bone-400 uppercase tracking-wider">
                    Model Weights
                  </span>
                  <p className="mt-1 font-display text-2xl text-signal-400">2,102,145</p>
                  <span className="font-mono text-[10px] text-bone-300">Trainable Params</span>
                </div>
                <div className="rounded-2xl border border-bone-100/10 bg-ink-900/60 p-4">
                  <span className="font-mono text-[10px] text-bone-400 uppercase tracking-wider">
                    Tensor Channels
                  </span>
                  <p className="mt-1 font-display text-2xl text-bone-100">5 Channels</p>
                  <span className="font-mono text-[10px] text-bone-300">[R, G, B, NDVI, NDBI]</span>
                </div>
                <div className="rounded-2xl border border-bone-100/10 bg-ink-900/60 p-4">
                  <span className="font-mono text-[10px] text-bone-400 uppercase tracking-wider">
                    F1-Score
                  </span>
                  <p className="mt-1 font-display text-2xl text-teal-400">89.1%</p>
                  <span className="font-mono text-[10px] text-bone-300">LEVIR-CD Benchmark</span>
                </div>
                <div className="rounded-2xl border border-bone-100/10 bg-ink-900/60 p-4">
                  <span className="font-mono text-[10px] text-bone-400 uppercase tracking-wider">
                    IoU Accuracy
                  </span>
                  <p className="mt-1 font-display text-2xl text-teal-400">82.4%</p>
                  <span className="font-mono text-[10px] text-bone-300">OSCD Sentinel-2</span>
                </div>
              </div>

              {/* Deep Architecture Pipeline Breakdown */}
              <div className="mt-8 space-y-4">
                <h3 className="font-mono text-xs uppercase tracking-widest text-signal-400">
                  How The Deep Siamese Network Neutralizes Seasonal Noise
                </h3>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-bone-100/10 bg-ink-900/40 p-4">
                    <span className="font-mono text-xs text-signal-400 font-bold">01 · Shared Weights Encoder</span>
                    <h4 className="mt-2 text-sm font-semibold text-bone-100">Symmetric Invariance</h4>
                    <p className="mt-2 text-xs text-bone-300 leading-relaxed">
                      Both date tensors T₁ and T₂ pass through the identical feature extraction backbone. This mathematical symmetry ensures identical response to vegetation seasons.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-bone-100/10 bg-ink-900/40 p-4">
                    <span className="font-mono text-xs text-signal-400 font-bold">02 · Multi-Scale Skip Fusion</span>
                    <h4 className="mt-2 text-sm font-semibold text-bone-100">Feature Difference Layers</h4>
                    <p className="mt-2 text-xs text-bone-300 leading-relaxed">
                      At each spatial resolution, feature maps are fused via absolute subtraction |f₁ - f₂| and 1x1 convolutions to highlight genuine structural changes.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-bone-100/10 bg-ink-900/40 p-4">
                    <span className="font-mono text-xs text-signal-400 font-bold">03 · BCE + Soft Dice Loss</span>
                    <h4 className="mt-2 text-sm font-semibold text-bone-100">Sparse Target Handling</h4>
                    <p className="mt-2 text-xs text-bone-300 leading-relaxed">
                      Physical land changes usually occupy less than 5% of a satellite scene. Combining Binary Cross-Entropy with Dice Loss prevents background class bias.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions: Download PyTorch Checkpoint */}
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-bone-100/10 pt-6">
                <div className="font-mono text-xs text-bone-300">
                  File: <code className="text-signal-400">siamese_unet_checkpoint.pt</code> (8.45 MB)
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href="/api/model/weights"
                    download="siamese_unet_checkpoint.pt"
                    className="flex items-center gap-2 rounded-full bg-signal-400 px-6 py-3 font-mono text-xs font-bold uppercase text-ink-950 transition-transform hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(255,176,32,0.4)]"
                  >
                    <svg
                      className="size-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" x2="12" y1="15" y2="3" />
                    </svg>
                    <span>Download PyTorch Weights (.pt)</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => setAiModalOpen(false)}
                    className="rounded-full border border-bone-100/20 px-6 py-3 font-mono text-xs uppercase text-bone-200 hover:text-bone-100"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
