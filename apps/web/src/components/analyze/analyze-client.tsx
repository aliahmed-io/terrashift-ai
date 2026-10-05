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
    // Default to Rondônia hotspot polygon
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
    // Construct default 4km box around target
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
            // Ignore incomplete chunk splits
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

      {/* 2. Top Header Bar */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between p-4 lg:p-6">
        {/* Brand Link */}
        <div className="pointer-events-auto flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-full border border-bone-100/15 bg-ink-950/80 px-4 py-2 font-mono text-xs tracking-widest text-bone-200 uppercase backdrop-blur transition-colors hover:border-signal-400 hover:text-signal-400"
          >
            <span>←</span>
            <span>TerraShift</span>
          </Link>
        </div>

        {/* Global Location Search & Hotspots */}
        <div className="pointer-events-auto flex max-w-lg flex-1 items-center gap-2 px-3">
          <div className="w-full">
            <LocationSearch onSelectLocation={handleSelectLocation} />
          </div>
        </div>

        {/* Compare & Preset Toolbar */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 font-mono text-xs tracking-wider uppercase backdrop-blur transition-all ${
              compareMode
                ? "border-signal-400 bg-signal-400 text-ink-950 font-bold shadow-[0_0_20px_rgba(255,176,32,0.4)]"
                : "border-bone-100/15 bg-ink-950/80 text-bone-200 hover:border-bone-100/40"
            }`}
          >
            <span>⇄</span>
            <span>Swipe Mode</span>
          </button>
        </div>
      </header>

      {/* 3. Hotspot Preset Pills */}
      <div className="pointer-events-none absolute top-20 inset-x-0 z-10 hidden justify-center md:flex">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-bone-100/10 bg-ink-950/80 p-1 backdrop-blur">
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

      {/* 4. Bottom Floating Control Dock */}
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
                <span>⚠️</span>
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
            <div className="flex items-center gap-1 px-2">
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
            <div className="flex items-center gap-1 px-2">
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
              <span>✏️</span>
              <span>{isDrawing ? "Click points on map" : "Draw AOI"}</span>
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
                  className="text-xs text-bone-400 hover:text-alert-400"
                  title="Clear AOI polygon"
                >
                  ✕
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
                <span>⚡</span>
                <span>Detect Change</span>
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
                ✕
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
              <div className="mt-3 max-h-60 space-y-1.5 overflow-y-auto pe-1">
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

            {/* Export Actions */}
            <div className="mt-8 space-y-2.5 border-t border-bone-100/10 pt-6">
              <button
                type="button"
                onClick={downloadPdfReport}
                disabled={generatingPdf}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-signal-400 py-3 font-mono text-xs font-bold tracking-widest text-ink-950 uppercase transition-transform hover:scale-[1.01] active:scale-95 shadow-[0_0_20px_rgba(255,176,32,0.3)] disabled:opacity-50"
              >
                <span>📄</span>
                <span>{generatingPdf ? "Compiling PDF..." : "Download Official Audit PDF"}</span>
              </button>

              <button
                type="button"
                onClick={downloadGeoJson}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-bone-100/20 bg-ink-900 py-3 font-mono text-xs tracking-widest text-bone-200 uppercase transition-colors hover:border-signal-400 hover:text-signal-400"
              >
                <span>🗺️</span>
                <span>Download GeoJSON Polygons</span>
              </button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
