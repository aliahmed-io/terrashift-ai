"use client";

import { motion, AnimatePresence } from "motion/react";
import { useCallback, useState, useRef, useEffect } from "react";
import {
  MapCanvas,
  type MapFeature,
  type LayerVisibilityState,
} from "@/components/map/map-canvas";
import { LocationSearch } from "@/components/search/location-search";
import { StudioNav } from "@/components/studio-nav";
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
type SheetTab = "order" | "catalog";

function buildBoxAroundCenter(center: [number, number]): [number, number][] {
  const [lon, lat] = center;
  const dLon = 0.025;
  const dLat = 0.02;
  return [
    [Number((lon - dLon).toFixed(6)), Number((lat - dLat).toFixed(6))],
    [Number((lon + dLon).toFixed(6)), Number((lat - dLat).toFixed(6))],
    [Number((lon + dLon).toFixed(6)), Number((lat + dLat).toFixed(6))],
    [Number((lon - dLon).toFixed(6)), Number((lat + dLat).toFixed(6))],
    [Number((lon - dLon).toFixed(6)), Number((lat - dLat).toFixed(6))],
  ];
}

function isPolygonNearCamera(
  polygon: [number, number][] | null,
  camera: [number, number],
): boolean {
  if (!polygon || polygon.length < 3) return false;
  const lons = polygon.map((p) => p[0]);
  const lats = polygon.map((p) => p[1]);
  const polyLon = (Math.min(...lons) + Math.max(...lons)) / 2;
  const polyLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dist = Math.hypot(polyLon - camera[0], polyLat - camera[1]);
  return dist < 0.25;
}

export function AnalyzeClient() {
  const [yearT1, setYearT1] = useState(2018);
  const [yearT2, setYearT2] = useState(2024);
  const [polygon, setPolygon] = useState<[number, number][] | null>(() => {
    const preset = HOTSPOT_PRESETS[0];
    return preset ? [...preset.polygon] : null;
  });
  const [selectedPreset, setSelectedPreset] = useState<HotspotPreset | null>(
    () => HOTSPOT_PRESETS[0] ?? null,
  );
  const [basemapSource, setBasemapSource] = useState<"s2" | "mapbox">("s2");
  const [isDrawing, setIsDrawing] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [selectedFeatureId, setSelectedFeatureId] = useState<number | null>(null);

  // Porcelain Sheet State (Ref 2)
  const [sheetOpen, setSheetOpen] = useState(true);
  const [sheetTab, setSheetTab] = useState<SheetTab>("order");
  const [passMode, setPassMode] = useState<"single" | "bitemporal">("bitemporal");
  const [cloudFilter, setCloudFilter] = useState<"<5%" | "<10%" | "All">("<5%");

  // Bottom Layer Checklist Bar State (Ref 1)
  const [visibleLayers, setVisibleLayers] = useState<LayerVisibilityState>({
    titles: true,
    indicators: true,
    aoi: true,
    protectedAreas: false,
    restrictedAreas: false,
  });

  // Status & Telemetry
  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [stepLabel, setStepLabel] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [aiModalOpen, setAiModalOpen] = useState(false);

  // Map viewport control (Default to New Riyadh Vision 2030)
  const [mapCenter, setMapCenter] = useState<[number, number]>(
    () => HOTSPOT_PRESETS[0]?.center ?? [46.745, 24.835],
  );
  const [mapZoom, setMapZoom] = useState<number>(() => HOTSPOT_PRESETS[0]?.zoom ?? 12.5);
  const [cameraCenter, setCameraCenter] = useState<[number, number]>(
    () => HOTSPOT_PRESETS[0]?.center ?? [46.745, 24.835],
  );
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const aoiAreaKm2 = polygon && polygon.length >= 3 ? calculatePolygonAreaKm2(polygon) : 0;
  const isOversized = aoiAreaKm2 > MAX_AOI_KM2;

  // Support deep linking (?lat=...&lon=...&t1=...&t2=...)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const latStr = params.get("lat");
    const lonStr = params.get("lon");
    const t1Str = params.get("t1");
    const t2Str = params.get("t2");
    if (latStr && lonStr) {
      const lat = Number(latStr);
      const lon = Number(lonStr);
      if (Number.isFinite(lat) && Number.isFinite(lon)) {
        const c: [number, number] = [lon, lat];
        setMapCenter(c);
        setCameraCenter(c);
        setMapZoom(12.5);
        setPolygon(buildBoxAroundCenter(c));
        setSelectedPreset(null);
      }
    }
    if (t1Str && Number.isFinite(Number(t1Str))) {
      setYearT1(Number(t1Str));
    }
    if (t2Str && Number.isFinite(Number(t2Str))) {
      setYearT2(Number(t2Str));
    }
  }, []);

  const selectPreset = useCallback((preset: HotspotPreset) => {
    setPolygon([...preset.polygon]);
    setSelectedPreset(preset);
    setYearT1(preset.yearT1);
    setYearT2(preset.yearT2);
    setMapCenter(preset.center);
    setCameraCenter(preset.center);
    setMapZoom(preset.zoom);
    setResult(null);
    setStatus("idle");
    setErrorMessage(null);
    setSelectedFeatureId(null);
  }, []);

  const cyclePreset = useCallback(() => {
    const idx = HOTSPOT_PRESETS.findIndex((p) => p.id === selectedPreset?.id);
    const next = HOTSPOT_PRESETS[(idx + 1) % HOTSPOT_PRESETS.length];
    if (next) selectPreset(next);
  }, [selectedPreset, selectPreset]);

  const cycleYear = useCallback(() => {
    setYearT2((prev) => {
      const next = prev >= 2025 ? 2019 : prev + 1;
      if (yearT1 >= next) setYearT1(next - 1);
      return next;
    });
  }, [yearT1]);

  const handleSelectLocation = useCallback((loc: GeocodeLocation) => {
    const newCenter: [number, number] = [loc.lon, loc.lat];
    setMapCenter(newCenter);
    setCameraCenter(newCenter);
    setMapZoom(12.5);
    setSelectedPreset(null);
    setPolygon(buildBoxAroundCenter(newCenter));
    setResult(null);
    setStatus("idle");
    setErrorMessage(null);
  }, []);

  const handleCameraMove = useCallback((c: [number, number]) => {
    setCameraCenter(c);
  }, []);

  // Stream analysis execution
  const runAnalysis = async () => {
    if (status === "running") return;

    let activePolygon = polygon;
    if (
      !activePolygon ||
      activePolygon.length < 3 ||
      !isPolygonNearCamera(activePolygon, cameraCenter)
    ) {
      activePolygon = buildBoxAroundCenter(cameraCenter);
      setPolygon(activePolygon);
      setSelectedPreset(null);
    }

    const activeAreaKm2 = calculatePolygonAreaKm2(activePolygon);
    if (activeAreaKm2 > MAX_AOI_KM2) {
      setErrorMessage(`Selected area (${activeAreaKm2.toFixed(1)} km²) exceeds the 100 km² limit.`);
      return;
    }

    setStatus("running");
    setProgress(8);
    setStepLabel("Aligning Sentinel-2 passes…");
    setErrorMessage(null);
    setResult(null);
    setSelectedFeatureId(null);

    abortControllerRef.current?.abort();
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let completed = false;

    const processSseBlock = (block: string) => {
      const dataLines = block
        .split(/\r?\n/)
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) return;
      const dataRaw = dataLines.join("\n");

      try {
        const parsed = JSON.parse(dataRaw);
        if (parsed.error) {
          const msg =
            typeof parsed.error === "string"
              ? parsed.error
              : parsed.error.message ?? "Analysis pipeline failed";
          setErrorMessage(msg);
          setStatus("error");
          completed = true;
          return;
        }

        if (parsed.done && parsed.result) {
          setResult(parsed.result as AnalysisResult);
          setStatus("done");
          setProgress(100);
          setStepLabel("Inference complete");
          setSheetTab("catalog");
          setSheetOpen(true);
          completed = true;
          return;
        }

        if (parsed.type === "FeatureCollection" && parsed.metadata) {
          setResult(parsed as AnalysisResult);
          setStatus("done");
          setProgress(100);
          setStepLabel("Inference complete");
          setSheetTab("catalog");
          setSheetOpen(true);
          completed = true;
          return;
        }

        if (typeof parsed.progress === "number" || typeof parsed.pct === "number") {
          const pct = Number(parsed.progress ?? parsed.pct ?? 15);
          const label = parsed.label ?? parsed.step ?? "Running Siamese U-Net";
          setProgress(pct);
          setStepLabel(typeof label === "string" ? `${label}…` : "Running Siamese U-Net…");
        }
      } catch {
        // Ignore partial chunk
      }
    };

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygon: activePolygon,
          yearT1,
          yearT2,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        processSseBlock(text);
        if (!completed) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        return;
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
        const blocks = buffer.split(/\r?\n\r?\n/);
        buffer = blocks.pop() ?? "";

        for (const block of blocks) {
          if (block.trim()) {
            processSseBlock(block);
          }
        }
      }

      if (buffer.trim()) {
        processSseBlock(buffer);
      }

      if (!completed) {
        setErrorMessage("Analysis stream ended before completion. Please try again.");
        setStatus("error");
      }
    } catch (err: unknown) {
      if ((err as Error)?.name !== "AbortError") {
        setErrorMessage(
          (err as Error)?.message ||
            "Failed to contact analysis service. Verify ML backend is running.",
        );
        setStatus("error");
      }
    }
  };

  const downloadGeoJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrashift-changes-${result.metadata.year_t1}-${result.metadata.year_t2}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdfReport = async () => {
    if (!result) return;
    setGeneratingPdf(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(result),
      });

      if (!res.ok) {
        throw new Error("Report generation failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terrashift-audit-${result.metadata.year_t1}-${result.metadata.year_t2}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setErrorMessage("Failed to generate PDF audit report. Verify ML backend service is running.");
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
  }, []);

  const toggleLayer = (key: keyof LayerVisibilityState) => {
    setVisibleLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Format bbox string for the Porcelain Order Card (Ref 2)
  const bboxString =
    polygon && polygon.length >= 3
      ? (() => {
          const lons = polygon.map((p) => p[0]);
          const lats = polygon.map((p) => p[1]);
          return `${Math.min(...lons).toFixed(3)}, ${Math.min(...lats).toFixed(3)}, ${Math.max(...lons).toFixed(3)}, ${Math.max(...lats).toFixed(3)}`;
        })()
      : "46.715, 24.815, 46.775, 24.855";

  // Pre-built Scene Acquisitions for the Deep Resolution Imagery tab (Ref 2 Right Screen)
  const catalogScenes = [
    {
      id: "scene-1",
      date: `May 27, ${yearT2}`,
      areaHa: `${(aoiAreaKm2 * 100 * 0.42).toFixed(1)}ha`,
      clouds: "3%",
      status: "ready" as const,
      thumb: "/ksa/riyadh-stitch-t2.jpg",
      rawSize: "24MB",
      s2Size: "1,3MB",
    },
    {
      id: "scene-2",
      date: `May 20, ${yearT2}`,
      areaHa: `${(aoiAreaKm2 * 100 * 0.31).toFixed(1)}ha`,
      clouds: "0%",
      status: "ready" as const,
      thumb: "/ksa/riyadh-stitch-t1.jpg",
      rawSize: "25MB",
      s2Size: "1,2MB",
    },
    {
      id: "scene-3",
      date: `May 03, ${yearT1}`,
      areaHa: `${(aoiAreaKm2 * 100 * 0.55).toFixed(1)}ha`,
      clouds: "1%",
      status: status === "running" ? ("processing" as const) : ("ready" as const),
      thumb: "/ksa/riyadh-stitch-t2.jpg",
      rawSize: "22MB",
      s2Size: "1,1MB",
    },
  ];

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0C1014] text-white">
      {/* 1. Reference 1 Petrol-Blue Navigation Header */}
      <StudioNav
        rightSlot={
          <div className="hidden md:flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBasemapSource(basemapSource === "s2" ? "mapbox" : "s2")}
              className="rounded-md bg-white/12 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors"
            >
              {basemapSource === "s2" ? "10m Sentinel-2" : "0.5m High-Res Aerial"}
            </button>
            <button
              type="button"
              onClick={() => setCompareMode((v) => !v)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                compareMode
                  ? "bg-[#36C5D8] text-[#082F44] font-semibold"
                  : "bg-white/12 text-white hover:bg-white/20"
              }`}
            >
              {compareMode ? "Split View: On" : "Split View"}
            </button>
            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              className="rounded-md bg-white/12 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/20 transition-colors"
            >
              Siamese U-Net
            </button>
          </div>
        }
      />

      {/* 2. Full-Bleed Satellite Map Workspace */}
      <main className="relative flex-1 w-full overflow-hidden">
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
          onToggleCompareMode={() => setCompareMode((v) => !v)}
          basemapSource={basemapSource}
          onToggleBasemapSource={() => setBasemapSource((s) => (s === "s2" ? "mapbox" : "s2"))}
          center={mapCenter}
          zoom={mapZoom}
          onCameraMove={handleCameraMove}
          locationLabel={
            selectedPreset ? selectedPreset.location.toUpperCase() : "RIYADH SEDRA, KSA"
          }
          onCyclePreset={cyclePreset}
          onCycleYear={cycleYear}
          visibleLayers={visibleLayers}
        />

        {/* =====================================================================
            FLOATING PORCELAIN TASKING & SCENE CATALOG SHEET (Exact Reference 2 UI)
           ===================================================================== */}
        <div className="pointer-events-none absolute top-4 start-4 z-20 flex w-[calc(100vw-2rem)] max-w-[368px] flex-col gap-2.5">
          {/* Top Floating Porcelain Search Bar + Filter Button (Ref 2 Top Row) */}
          <div className="pointer-events-auto flex items-center gap-2">
            <div className="flex-1">
              <LocationSearch onSelectLocation={handleSelectLocation} />
            </div>
            <button
              type="button"
              onClick={() => setSheetOpen((v) => !v)}
              title={sheetOpen ? "Minimize tasking sheet" : "Open tasking sheet"}
              className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#111827] shadow-[0_8px_24px_rgba(8,47,68,0.22)] border border-[#E6EAEE] hover:bg-[#F3F5F7] transition-colors"
              aria-label="Toggle tasking and imagery sheet"
              aria-expanded={sheetOpen}
            >
              {/* Sliders Icon (Exact Ref 2 Top-Right Button) */}
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
                <line x1="4" y1="21" x2="4" y2="14" />
                <line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" />
                <line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" />
                <line x1="9" y1="8" x2="15" y2="8" />
                <line x1="17" y1="16" x2="23" y2="16" />
              </svg>
            </button>
          </div>

          {/* Error Toast */}
          <AnimatePresence>
            {errorMessage ? (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                role="alert"
                className="pointer-events-auto flex items-center justify-between gap-2 rounded-xl bg-[#C2312B] px-3.5 py-2.5 text-xs font-medium text-white shadow-lg"
              >
                <span>{errorMessage}</span>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="rounded p-0.5 text-white/80 hover:text-white"
                  aria-label="Dismiss error"
                >
                  ×
                </button>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {/* Main Porcelain Sheet Card (Ref 2) */}
          <AnimatePresence>
            {sheetOpen ? (
              <motion.aside
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.22 }}
                aria-label="Satellite Tasking and Deep Resolution Imagery Sheet"
                className="pointer-events-auto flex max-h-[calc(100vh-11.5rem)] flex-col overflow-hidden rounded-2xl bg-white text-[#111827] shadow-[0_24px_48px_-12px_rgba(8,47,68,0.5)] border border-[#E6EAEE]"
              >
                {/* Sheet Mode Switcher Header */}
                <div className="flex items-center justify-between border-b border-[#E6EAEE] px-4 pt-3.5 pb-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSheetTab("order")}
                      className={`text-sm font-bold transition-colors ${
                        sheetTab === "order"
                          ? "text-[#111827]"
                          : "text-[#64707D] hover:text-[#111827]"
                      }`}
                    >
                      New Order
                    </button>
                    <span className="rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-semibold text-[#0284C7]">
                      Subscription
                    </span>
                    <span className="text-[#E6EAEE]">|</span>
                    <button
                      type="button"
                      onClick={() => setSheetTab("catalog")}
                      className={`flex items-center gap-1 text-xs font-semibold transition-colors ${
                        sheetTab === "catalog"
                          ? "text-[#0F4C6C] underline underline-offset-4"
                          : "text-[#64707D] hover:text-[#111827]"
                      }`}
                    >
                      <span>Imagery Catalog</span>
                      {result ? (
                        <span className="rounded-full bg-[#DCFCE7] px-1.5 py-0.2 text-[10px] font-bold text-[#00875A]">
                          {result.metadata.polygon_count}
                        </span>
                      ) : null}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setSheetOpen(false)}
                    className="flex size-6 items-center justify-center rounded-full bg-[#F3F5F7] text-xs font-bold text-[#3A4450] hover:bg-[#E6EAEE] transition-colors"
                    aria-label="Close sheet"
                  >
                    ×
                  </button>
                </div>

                {sheetTab === "order" ? (
                  /* =========================================================
                     TAB 1: NEW ORDER / TASKING SHEET (Exact Ref 2 Left/Center Screen)
                     ========================================================= */
                  <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-4">
                    {/* Order Name / Mission Preset Selector */}
                    <div className="rounded-xl bg-[#F3F5F7] px-3.5 py-2.5">
                      <label
                        htmlFor="mission-order-select"
                        className="block text-[10px] font-medium text-[#64707D]"
                      >
                        Order Name
                      </label>
                      <select
                        id="mission-order-select"
                        value={selectedPreset?.id ?? "custom"}
                        onChange={(e) => {
                          const found = HOTSPOT_PRESETS.find((p) => p.id === e.target.value);
                          if (found) selectPreset(found);
                        }}
                        className="mt-0.5 w-full bg-transparent text-xs font-bold text-[#111827] focus:outline-none cursor-pointer"
                      >
                        {HOTSPOT_PRESETS.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.location.split(",")[0]} ({p.id.toUpperCase()}) Satellite Coverage
                          </option>
                        ))}
                        {!selectedPreset ? (
                          <option value="custom">Custom Coordinates Satellite Coverage</option>
                        ) : null}
                      </select>
                    </div>

                    {/* Images per Month / Pass Mode Segmented Control */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Images per Month</span>
                        <div className="flex rounded-lg bg-[#F3F5F7] p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setPassMode("single")}
                            className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                              passMode === "single"
                                ? "bg-[#111827] text-white shadow-2xs"
                                : "text-[#64707D] hover:text-[#111827]"
                            }`}
                          >
                            1 Image
                          </button>
                          <button
                            type="button"
                            onClick={() => setPassMode("bitemporal")}
                            className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                              passMode === "bitemporal"
                                ? "bg-[#111827] text-white shadow-2xs"
                                : "text-[#64707D] hover:text-[#111827]"
                            }`}
                          >
                            Up to 6
                          </button>
                        </div>
                      </div>
                      <p className="mt-1.5 text-[11px] leading-relaxed text-[#64707D]">
                        All S2 cloudless scenes within the criteria will be aligned, up to 6 passes
                        per window. Bi-temporal Siamese U-Net isolates structural ground change.
                      </p>
                    </div>

                    {/* Start Date / Temporal Window Selector */}
                    <div className="flex items-center justify-between rounded-xl bg-[#F3F5F7] px-3.5 py-2.5">
                      <div>
                        <span className="block text-[10px] font-medium text-[#64707D]">
                          Acquisition Window (Baseline → Target)
                        </span>
                        <div className="mt-0.5 flex items-center gap-2 text-xs font-bold text-[#111827]">
                          <select
                            aria-label="Baseline year"
                            value={yearT1}
                            onChange={(e) => {
                              const v = Number(e.target.value);
                              setYearT1(v);
                              if (v >= yearT2) setYearT2(v + 1);
                            }}
                            className="bg-transparent font-bold text-[#111827] focus:outline-none cursor-pointer tabular-nums"
                          >
                            {[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((y) => (
                              <option key={y} value={y}>
                                Apr 10, {y}
                              </option>
                            ))}
                          </select>
                          <span className="text-[#64707D]">→</span>
                          <select
                            aria-label="Target year"
                            value={yearT2}
                            onChange={(e) => setYearT2(Number(e.target.value))}
                            className="bg-transparent font-bold text-[#0F4C6C] focus:outline-none cursor-pointer tabular-nums"
                          >
                            {[2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
                              .filter((y) => y > yearT1)
                              .map((y) => (
                                <option key={y} value={y}>
                                  Oct 07, {y}
                                </option>
                              ))}
                          </select>
                        </div>
                      </div>
                      <svg
                        className="size-4 text-[#111827]"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                        <line x1="16" y1="2" x2="16" y2="6" />
                        <line x1="8" y1="2" x2="8" y2="6" />
                        <line x1="3" y1="10" x2="21" y2="10" />
                      </svg>
                    </div>

                    {/* AOI Selection (Bounding Box vs Vector File/Polygon) */}
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">AOI Selection</span>
                        <div className="flex rounded-lg bg-[#F3F5F7] p-0.5 text-[11px]">
                          <button
                            type="button"
                            onClick={() => setIsDrawing(false)}
                            className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                              !isDrawing
                                ? "bg-[#111827] text-white shadow-2xs"
                                : "text-[#64707D] hover:text-[#111827]"
                            }`}
                          >
                            Bounding Box
                          </button>
                          <button
                            type="button"
                            onClick={() => setIsDrawing((v) => !v)}
                            className={`rounded-md px-2.5 py-1 font-semibold transition-colors ${
                              isDrawing
                                ? "bg-[#111827] text-white shadow-2xs"
                                : "text-[#64707D] hover:text-[#111827]"
                            }`}
                          >
                            Vector Polygon
                          </button>
                        </div>
                      </div>

                      <div className="mt-2 rounded-xl bg-[#F3F5F7] px-3 py-2.5">
                        <p className="truncate font-mono text-[10px] text-[#64707D] tabular-nums">
                          bbox: {bboxString}
                        </p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-md bg-[#6D28D9] px-2 py-0.5 text-[11px] font-semibold text-white">
                            <span>
                              {selectedPreset ? selectedPreset.location : "Custom AOI"} (pre-made)
                            </span>
                            <button
                              type="button"
                              onClick={() => setIsDrawing(true)}
                              className="text-white/80 hover:text-white"
                              aria-label="Redraw AOI"
                            >
                              ×
                            </button>
                          </span>
                          <span className="rounded-md bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-[#111827] border border-[#E6EAEE]">
                            {aoiAreaKm2.toFixed(2)} km²
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Sticky Footer with Cost/Area & Emerald-Green Primary CTA (Ref 2) */}
                    <div className="border-t border-[#E6EAEE] pt-3">
                      <div className="mb-2.5 flex items-center justify-between text-xs">
                        <span className="text-[#64707D]">Estimated coverage:</span>
                        <span className="font-bold text-[#111827] tabular-nums">
                          {aoiAreaKm2.toFixed(2)} km² / 10m S2
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={runAnalysis}
                        disabled={status === "running" || isOversized}
                        className="w-full rounded-xl bg-[#00875A] py-3 text-xs font-bold text-white shadow-md hover:bg-[#006E49] active:scale-[0.99] disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {status === "running"
                          ? `${stepLabel} (${progress}%)`
                          : "Run Change Analysis"}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* =========================================================
                     TAB 2: DEEP RESOLUTION IMAGERY & SCENE CATALOG (Exact Ref 2 Right Screen)
                     ========================================================= */
                  <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-bold text-[#111827]">
                          Project 24-1A. {selectedPreset?.location ?? "Riyadh (KSA)"}
                        </h3>
                        <span className="rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-semibold text-[#0284C7]">
                          Active
                        </span>
                      </div>

                      {/* Filter Pills Row (Ref 2 Right Screen) */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={cycleYear}
                          className="flex items-center gap-1 rounded-md border border-[#E6EAEE] bg-[#F3F5F7] px-2 py-1 text-[11px] font-semibold text-[#111827] hover:bg-[#E6EAEE]"
                        >
                          <span>Season {yearT2}</span>
                          <span className="text-[9px] text-[#64707D]">⌄</span>
                        </button>
                        <button
                          type="button"
                          onClick={cyclePreset}
                          className="flex items-center gap-1 rounded-md border border-[#E6EAEE] bg-[#F3F5F7] px-2 py-1 text-[11px] font-semibold text-[#111827] hover:bg-[#E6EAEE]"
                        >
                          <span>AOI: Show All</span>
                          <span className="text-[9px] text-[#64707D]">⌄</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setCloudFilter((c) =>
                              c === "<5%" ? "<10%" : c === "<10%" ? "All" : "<5%",
                            )
                          }
                          className="flex items-center gap-1 rounded-md border border-[#E6EAEE] bg-[#F3F5F7] px-2 py-1 text-[11px] font-semibold text-[#111827] hover:bg-[#E6EAEE]"
                        >
                          <span>Clouds: {cloudFilter}</span>
                          <span className="text-[9px] text-[#64707D]">⌄</span>
                        </button>
                      </div>
                    </div>

                    {/* Summary Banner if ML Result is Ready */}
                    {result ? (
                      <div className="rounded-xl bg-[#F3F5F7] p-3 border border-[#E6EAEE]">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-[#111827]">
                            Detected Change ({result.metadata.year_t1} → {result.metadata.year_t2})
                          </span>
                          <span className="font-mono font-bold text-[#00875A]">
                            {formatArea(result.metadata.total_changed_m2)} (
                            {result.metadata.changed_pct}%)
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={downloadGeoJson}
                            className="rounded-md bg-[#E0F2FE] px-2.5 py-1 text-[11px] font-semibold text-[#0284C7] hover:brightness-95"
                          >
                            Export GeoJSON ({result.metadata.polygon_count} polygons)
                          </button>
                          <button
                            type="button"
                            onClick={downloadPdfReport}
                            disabled={generatingPdf}
                            className="rounded-md bg-[#EDE9FE] px-2.5 py-1 text-[11px] font-semibold text-[#6D28D9] hover:brightness-95"
                          >
                            {generatingPdf ? "Compiling PDF…" : "Audit Report (PDF)"}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Scene Acquisition Cards with Thumbnail Previews (Ref 2 Right Screen) */}
                    <div className="divide-y divide-[#E6EAEE]">
                      {catalogScenes.map((scene) => (
                        <div key={scene.id} className="flex items-start gap-3 py-3 first:pt-1">
                          {/* Satellite Thumbnail with Bookmark Overlay */}
                          <div className="relative h-15 w-22 shrink-0 overflow-hidden rounded-lg bg-[#0C1014] border border-[#E6EAEE]">
                            <img
                              src={scene.thumb}
                              alt={`Satellite acquisition ${scene.date}`}
                              className="size-full object-cover"
                            />
                            <span className="absolute top-1 right-1 flex size-4.5 items-center justify-center rounded-full bg-black/55 text-[9px] text-white">
                              🔖
                            </span>
                          </div>

                          {/* Scene Metadata & Download Chips */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-[#111827]">{scene.date}</span>
                              {scene.status === "processing" ? (
                                <span className="flex size-5 items-center justify-center rounded-full bg-[#FEF3C7] text-[11px] text-[#D97706]">
                                  ◷
                                </span>
                              ) : (
                                <span className="flex size-5 items-center justify-center rounded-full bg-[#DCFCE7] text-[10px] font-bold text-[#00875A]">
                                  ✓
                                </span>
                              )}
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#64707D] tabular-nums">
                              <span>{scene.areaHa}</span>
                              <span>☁ {scene.clouds}</span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              {scene.status === "processing" ? (
                                <span className="rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#D97706]">
                                  Processing: 2,4 sec
                                </span>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (result) {
                                        downloadGeoJson();
                                      } else {
                                        runAnalysis();
                                      }
                                    }}
                                    className="rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-semibold text-[#0284C7] hover:brightness-95"
                                  >
                                    Raw Files ({scene.rawSize})
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (result) {
                                        downloadPdfReport();
                                      } else {
                                        runAnalysis();
                                      }
                                    }}
                                    className="rounded-md bg-[#EDE9FE] px-2 py-0.5 text-[10px] font-semibold text-[#6D28D9] hover:brightness-95"
                                  >
                                    S2 ({scene.s2Size})
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Individual Detected Polygons (when ML inference completes) */}
                    {result && result.features.length > 0 ? (
                      <div className="border-t border-[#E6EAEE] pt-3">
                        <span className="block text-[11px] font-bold text-[#111827]">
                          Detected Change Clusters (Click to fly)
                        </span>
                        <div className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                          {result.features.slice(0, 12).map((f) => (
                            <button
                              key={f.properties.id}
                              type="button"
                              onClick={() => setSelectedFeatureId(f.properties.id)}
                              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors ${
                                selectedFeatureId === f.properties.id
                                  ? "bg-[#0F4C6C] text-white font-semibold"
                                  : "bg-[#F3F5F7] text-[#111827] hover:bg-[#E6EAEE]"
                              }`}
                            >
                              <span>
                                JJV-{16500 + f.properties.id} · {f.properties.label}
                              </span>
                              <span className="font-mono text-[11px] tabular-nums">
                                {formatArea(f.properties.area_m2)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </motion.aside>
            ) : null}
          </AnimatePresence>
        </div>

        {/* =====================================================================
            BOTTOM HORIZONTAL LAYER CHECKLIST BAR (Exact Reference 1 Architecture)
           ===================================================================== */}
        <div className="pointer-events-none absolute bottom-5 inset-x-0 z-20 flex justify-center px-4">
          <div
            role="group"
            aria-label="Map overlay layers"
            className="pointer-events-auto flex flex-wrap items-center justify-center shadow-[0_16px_40px_rgba(0,0,0,0.75)]"
          >
            {(
              [
                { key: "titles", label: "Titles" },
                { key: "indicators", label: "Change Indicators" },
                { key: "aoi", label: "Areas of Interest" },
                { key: "protectedAreas", label: "Protected areas" },
                { key: "restrictedAreas", label: "Restricted areas" },
              ] as const
            ).map(({ key, label }) => {
              const checked = visibleLayers[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleLayer(key)}
                  className={`flex items-center gap-2.5 px-5 py-2.5 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none ${
                    checked
                      ? "z-10 -my-1 border-2 border-white bg-white/35 py-3.5 font-semibold text-white backdrop-blur-md shadow-lg"
                      : "border border-white/70 bg-[#0C1014]/55 text-white/90 hover:bg-white/15 backdrop-blur-xs"
                  }`}
                >
                  {/* Crisp Checkbox Square (Exact Ref 1 Match) */}
                  <span
                    className={`flex size-4 items-center justify-center border ${
                      checked
                        ? "border-white bg-white text-[#0F4C6C]"
                        : "border-white/85 bg-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    {checked ? (
                      <svg
                        className="size-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Siamese U-Net Architecture Modal */}
      <AnimatePresence>
        {aiModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 text-[#111827] shadow-2xl sm:p-8"
            >
              <div className="flex items-center justify-between border-b border-[#E6EAEE] pb-4">
                <div>
                  <span className="rounded-md bg-[#E0F2FE] px-2.5 py-1 text-xs font-semibold text-[#0284C7]">
                    PyTorch 2.14 Remote Sensing Pipeline
                  </span>
                  <h2 id="modal-title" className="mt-2 text-2xl font-bold text-[#111827]">
                    Siamese U-Net Bi-Temporal Architecture
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="flex size-8 items-center justify-center rounded-full bg-[#F3F5F7] text-sm font-bold text-[#3A4450] hover:bg-[#E6EAEE]"
                  aria-label="Close modal"
                >
                  ×
                </button>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-xl bg-[#F3F5F7] p-3.5">
                  <span className="text-[11px] font-medium text-[#64707D]">Parameters</span>
                  <p className="mt-1 font-mono text-xl font-bold text-[#0F4C6C]">2,102,145</p>
                </div>
                <div className="rounded-xl bg-[#F3F5F7] p-3.5">
                  <span className="text-[11px] font-medium text-[#64707D]">Input Bands</span>
                  <p className="mt-1 font-mono text-xl font-bold text-[#111827]">5 Channels</p>
                </div>
                <div className="rounded-xl bg-[#F3F5F7] p-3.5">
                  <span className="text-[11px] font-medium text-[#64707D]">LEVIR-CD F1</span>
                  <p className="mt-1 font-mono text-xl font-bold text-[#00875A]">89.1%</p>
                </div>
                <div className="rounded-xl bg-[#F3F5F7] p-3.5">
                  <span className="text-[11px] font-medium text-[#64707D]">OSCD IoU</span>
                  <p className="mt-1 font-mono text-xl font-bold text-[#00875A]">82.4%</p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#E6EAEE] pt-4">
                <span className="text-xs text-[#64707D]">
                  Checkpoint: <code className="font-mono text-[#0F4C6C]">siamese_unet_checkpoint.pt</code>
                </span>
                <div className="flex items-center gap-2.5">
                  <a
                    href="/api/model/weights"
                    download="siamese_unet_checkpoint.pt"
                    className="rounded-xl bg-[#00875A] px-4 py-2 text-xs font-bold text-white hover:bg-[#006E49]"
                  >
                    Download Weights (.pt)
                  </a>
                  <button
                    type="button"
                    onClick={() => setAiModalOpen(false)}
                    className="rounded-xl bg-[#F3F5F7] px-4 py-2 text-xs font-semibold text-[#111827] hover:bg-[#E6EAEE]"
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
