"use client";

import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import { useCallback, useState, useRef, useEffect } from "react";
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
type Locale = "en" | "ar";

const UI_STRINGS: Record<
  Locale,
  {
    studio: string;
    selectHotspot: string;
    globalHotspots: string;
    sentinel2: string;
    highRes: string;
    splitActive: string;
    splitView: string;
    siameseModel: string;
    baseline: string;
    target: string;
    drawArea: string;
    drawingActive: string;
    frameView: string;
    analyzeChanges: string;
    hideInspector: string;
    inspector: string;
    auditReport: string;
    inspect: string;
    totalChanged: string;
    ofTotalAoi: string;
    polygonsDetected: string;
    classDistribution: string;
    detectedPolygons: string;
    clickToFly: string;
    confidence: string;
    compilingPdf: string;
    downloadPdf: string;
    exportGeoJson: string;
    close: string;
  }
> = {
  en: {
    studio: "Studio",
    selectHotspot: "Select Hotspot",
    globalHotspots: "Global Change Hotspots",
    sentinel2: "Sentinel-2",
    highRes: "High-Res Aerial",
    splitActive: "Split Active",
    splitView: "Split View",
    siameseModel: "Siamese U-Net",
    baseline: "Baseline",
    target: "Target",
    drawArea: "Draw Area",
    drawingActive: "Drawing Active",
    frameView: "Frame View",
    analyzeChanges: "Analyze Changes",
    hideInspector: "Hide Inspector",
    inspector: "Inspector",
    auditReport: "Bi-Temporal Audit Report",
    inspect: "Inspect",
    totalChanged: "Total Changed",
    ofTotalAoi: "of total AOI",
    polygonsDetected: "Polygons Detected",
    classDistribution: "Class Distribution",
    detectedPolygons: "Detected Polygons",
    clickToFly: "Click to fly to",
    confidence: "Confidence",
    compilingPdf: "Compiling PDF…",
    downloadPdf: "Download Audit Report (PDF)",
    exportGeoJson: "Export GeoJSON Layer",
    close: "Close",
  },
  ar: {
    studio: "المرصد",
    selectHotspot: "اختر منطقة رصد",
    globalHotspots: "بؤر التغير العالمية",
    sentinel2: "سنتينل-2",
    highRes: "تصوير جوي فائق",
    splitActive: "مقارنة مزدوجة",
    splitView: "عرض مزدوج",
    siameseModel: "الشبكة السيامية",
    baseline: "الأساس",
    target: "الهدف",
    drawArea: "رسم نطاق",
    drawingActive: "جاري الرسم",
    frameView: "تحديد المشهد",
    analyzeChanges: "تحليل التغيرات",
    hideInspector: "إخفاء التقرير",
    inspector: "النتائج",
    auditReport: "تقرير التدقيق الزمني المزدوج",
    inspect: "فحص النموذج",
    totalChanged: "إجمالي المساحة المتغيرة",
    ofTotalAoi: "من إجمالي النطاق",
    polygonsDetected: "المضلعات المكتشفة",
    classDistribution: "توزيع فئات التغير",
    detectedPolygons: "المضلعات المرصودة",
    clickToFly: "انقر للانتقال للموقع",
    confidence: "درجة الثقة",
    compilingPdf: "جاري إعداد التقرير…",
    downloadPdf: "تحميل تقرير التدقيق (PDF)",
    exportGeoJson: "تصدير طبقة GeoJSON",
    close: "إغلاق",
  },
};

function buildBoxAroundCenter(center: [number, number]): [number, number][] {
  const [lon, lat] = center;
  const dLon = 0.022;
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
  const [locale, setLocale] = useState<Locale>("en");
  const t = UI_STRINGS[locale];

  const [yearT1, setYearT1] = useState(2018);
  const [yearT2, setYearT2] = useState(2024);
  const [polygon, setPolygon] = useState<[number, number][] | null>(() => {
    const preset = HOTSPOT_PRESETS[0];
    return preset ? [...preset.polygon] : null;
  });
  const [selectedPreset, setSelectedPreset] = useState<HotspotPreset | null>(
    () => HOTSPOT_PRESETS[0] ?? null,
  );
  const [hotspotMenuOpen, setHotspotMenuOpen] = useState(false);
  const [basemapSource, setBasemapSource] = useState<"s2" | "mapbox">("s2");

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
  const [cameraCenter, setCameraCenter] = useState<[number, number]>([-62.905, -9.702]);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hotspotDropdownRef = useRef<HTMLDivElement>(null);

  const aoiAreaKm2 = polygon && polygon.length >= 3 ? calculatePolygonAreaKm2(polygon) : 0;
  const isOversized = aoiAreaKm2 > MAX_AOI_KM2;
  const polygonInView = isPolygonNearCamera(polygon, cameraCenter);

  // Sync document directionality for Arabic RTL support (Rule #17)
  useEffect(() => {
    document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = locale;
    return () => {
      document.documentElement.dir = "ltr";
      document.documentElement.lang = "en";
    };
  }, [locale]);

  // Close hotspot dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        hotspotDropdownRef.current &&
        !hotspotDropdownRef.current.contains(e.target as Node)
      ) {
        setHotspotMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Handle Preset selection
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
    setDrawerOpen(false);
    setSelectedFeatureId(null);
    setHotspotMenuOpen(false);
  }, []);

  // Handle Geocoding location selection
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

  // Snap AOI box to current camera viewport
  const frameCurrentView = useCallback(() => {
    const newPoly = buildBoxAroundCenter(cameraCenter);
    setPolygon(newPoly);
    setSelectedPreset(null);
    setResult(null);
    setStatus("idle");
    setErrorMessage(null);
  }, [cameraCenter]);

  const handleCameraMove = useCallback((c: [number, number]) => {
    setCameraCenter(c);
  }, []);

  // Stream analysis execution
  const runAnalysis = async () => {
    if (status === "running") return;

    // If user panned to a new area on Earth away from the old polygon (or cleared the polygon),
    // automatically frame the current viewport so we analyze what is actually on screen!
    let activePolygon = polygon;
    if (!activePolygon || activePolygon.length < 3 || !isPolygonNearCamera(activePolygon, cameraCenter)) {
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
    setProgress(5);
    setStepLabel("Connecting to satellite pipeline…");
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
          setDrawerOpen(true);
          completed = true;
          return;
        }

        if (parsed.type === "FeatureCollection" && parsed.metadata) {
          setResult(parsed as AnalysisResult);
          setStatus("done");
          setProgress(100);
          setStepLabel("Inference complete");
          setDrawerOpen(true);
          completed = true;
          return;
        }

        if (typeof parsed.progress === "number" || typeof parsed.pct === "number") {
          const pct = Number(parsed.progress ?? parsed.pct ?? 10);
          const label = parsed.label ?? parsed.step ?? "Processing satellite imagery";
          setProgress(pct);
          setStepLabel(typeof label === "string" ? `${label}…` : "Processing satellite imagery…");
        }
      } catch {
        // Ignore malformed JSON chunk
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
    if (id != null) setDrawerOpen(true);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 text-bone-100">
      {/* 1. Unified Application Header */}
      <header className="z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-white/10 bg-ink-950/95 px-4 backdrop-blur-md">
        {/* Left Section: Brand & Hotspot Selector */}
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg p-1 text-bone-200 transition-colors hover:text-signal-400 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
            aria-label="Back to TerraShift Home"
          >
            <svg
              className="size-4 shrink-0 rtl:rotate-180"
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
            <span className="font-semibold tracking-tight text-bone-100 text-sm">TerraShift</span>
            <span className="hidden rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-bone-300 sm:inline-block">
              {t.studio}
            </span>
          </Link>

          <div className="h-4 w-px bg-white/10" aria-hidden="true" />

          {/* Hotspot Preset Selector Menu */}
          <div ref={hotspotDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => setHotspotMenuOpen(!hotspotMenuOpen)}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/80 px-2.5 py-1.5 text-xs font-medium text-bone-200 transition-colors hover:border-signal-400/40 hover:text-signal-400 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
              aria-expanded={hotspotMenuOpen}
              aria-haspopup="listbox"
              aria-label="Select benchmark hotspot location"
            >
              <svg
                className="size-3.5 text-signal-400 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              <span className="max-w-[130px] truncate sm:max-w-[180px]">
                {selectedPreset ? selectedPreset.name : t.selectHotspot}
              </span>
              <svg
                className="size-3 text-bone-400 shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {hotspotMenuOpen && (
              <ul
                role="listbox"
                className="absolute start-0 top-full mt-1.5 z-40 w-72 rounded-xl border border-white/10 bg-ink-900/95 p-1.5 shadow-2xl backdrop-blur-xl"
              >
                <li className="px-2.5 py-1 text-[10px] font-medium tracking-wider text-bone-400 uppercase">
                  {t.globalHotspots}
                </li>
                {HOTSPOT_PRESETS.map((p) => (
                  <li key={p.id} role="option" aria-selected={selectedPreset?.id === p.id}>
                    <button
                      type="button"
                      onClick={() => selectPreset(p)}
                      className={`w-full rounded-lg px-2.5 py-2 text-start transition-colors ${
                        selectedPreset?.id === p.id
                          ? "bg-signal-400/15 text-signal-400 font-medium"
                          : "text-bone-200 hover:bg-white/5 hover:text-bone-100"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium">{p.name}</span>
                        <span className="font-mono text-[10px] text-bone-400 tabular-nums">
                          {p.yearT1}→{p.yearT2}
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11px] text-bone-400 line-clamp-1">
                        {p.description}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Center Section: Global Location Search */}
        <div className="mx-4 hidden max-w-sm flex-1 md:block">
          <LocationSearch onSelectLocation={handleSelectLocation} />
        </div>

        {/* Right Section: View Controls, Basemap, AI Architecture, Language */}
        <div className="flex items-center gap-2">
          {/* Basemap Segmented Toggle */}
          <div className="hidden sm:flex items-center rounded-lg border border-white/10 bg-ink-900/80 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setBasemapSource("s2")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                basemapSource === "s2"
                  ? "bg-white/10 text-bone-100"
                  : "text-bone-400 hover:text-bone-200"
              }`}
            >
              {t.sentinel2}
            </button>
            <button
              type="button"
              onClick={() => setBasemapSource("mapbox")}
              className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                basemapSource === "mapbox"
                  ? "bg-white/10 text-bone-100"
                  : "text-bone-400 hover:text-bone-200"
              }`}
            >
              {t.highRes}
            </button>
          </div>

          {/* Single vs Split View Toggle */}
          <button
            type="button"
            onClick={() => setCompareMode(!compareMode)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none ${
              compareMode
                ? "border-signal-400/50 bg-signal-400/15 text-signal-400"
                : "border-white/10 bg-ink-900/80 text-bone-200 hover:border-signal-400/40 hover:text-signal-400"
            }`}
            aria-pressed={compareMode}
            aria-label={
              compareMode ? "Switch to single view" : "Switch to side-by-side split compare"
            }
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
            <span className="hidden sm:inline">{compareMode ? t.splitActive : t.splitView}</span>
          </button>

          {/* AI Architecture Modal Trigger */}
          <button
            type="button"
            onClick={() => setAiModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-ink-900/80 px-2.5 py-1.5 text-xs font-medium text-bone-200 transition-colors hover:border-signal-400/50 hover:text-signal-400 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
            aria-label="Inspect AI Siamese U-Net Model Architecture"
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
            <span className="hidden sm:inline">{t.siameseModel}</span>
          </button>

          {/* Bilingual EN / AR Switcher (Rule #17) */}
          <button
            type="button"
            onClick={() => setLocale(locale === "en" ? "ar" : "en")}
            className="rounded-lg border border-white/10 bg-ink-900/80 px-2.5 py-1.5 text-xs font-medium text-bone-200 transition-colors hover:border-signal-400/40 hover:text-signal-400 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
            aria-label={locale === "en" ? "Switch to Arabic" : "Switch to English"}
          >
            {locale === "en" ? "عربي" : "EN"}
          </button>
        </div>
      </header>

      {/* 2. Main Full-Height Geospatial Canvas */}
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
          basemapSource={basemapSource}
          center={mapCenter}
          zoom={mapZoom}
          onCameraMove={handleCameraMove}
        />

        {/* 3. Bottom Control Dock */}
        <div className="pointer-events-none absolute bottom-6 inset-x-0 z-20 flex justify-center px-4">
          <div className="pointer-events-auto flex max-w-4xl w-full flex-col items-center gap-2">
            {/* Error Notification */}
            <AnimatePresence>
              {errorMessage && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  role="alert"
                  aria-live="polite"
                  className="flex items-center gap-2 rounded-lg border border-alert-500/60 bg-ink-950/95 px-4 py-2 text-xs text-alert-400 shadow-xl backdrop-blur-md"
                >
                  <svg
                    className="size-4 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="flex-1">{errorMessage}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="p-1 text-bone-400 hover:text-bone-100 transition-colors focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none"
                    aria-label="Dismiss error notification"
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
                </motion.div>
              )}
            </AnimatePresence>

            {/* Primary Dock Surface */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-ink-950/95 px-4 py-2.5 shadow-2xl backdrop-blur-xl">
              {/* Temporal Selectors */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="year-t1"
                    className="text-[11px] font-medium text-bone-400 uppercase tracking-wider"
                  >
                    {t.baseline}
                  </label>
                  <select
                    id="year-t1"
                    aria-label="Baseline imagery year"
                    value={yearT1}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setYearT1(val);
                      if (val >= yearT2) setYearT2(val + 1);
                    }}
                    disabled={status === "running"}
                    className="rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1 text-xs font-medium text-bone-100 focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none tabular-nums"
                  >
                    {[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <svg
                  className="size-3.5 text-bone-400 rtl:rotate-180"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M5 12h14" />
                  <path d="m12 5 7 7-7 7" />
                </svg>

                <div className="flex items-center gap-1.5">
                  <label
                    htmlFor="year-t2"
                    className="text-[11px] font-medium text-signal-400 uppercase tracking-wider"
                  >
                    {t.target}
                  </label>
                  <select
                    id="year-t2"
                    aria-label="Target imagery year"
                    value={yearT2}
                    onChange={(e) => setYearT2(Number(e.target.value))}
                    disabled={status === "running"}
                    className="rounded-lg border border-white/10 bg-ink-900 px-2.5 py-1 text-xs font-medium text-signal-400 focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none tabular-nums"
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
              </div>

              <div className="h-6 w-px bg-white/10" aria-hidden="true" />

              {/* AOI Drawing & Viewport Framing Tools */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDrawing(!isDrawing)}
                  disabled={status === "running"}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none ${
                    isDrawing
                      ? "border border-signal-400 bg-signal-400 text-ink-950 font-semibold shadow-sm"
                      : "border border-white/10 bg-ink-900 text-bone-200 hover:border-signal-400/40 hover:text-signal-400"
                  }`}
                  aria-pressed={isDrawing}
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
                    <path d="m18 5-3-3L6 11l-3 7 7-3Z" />
                    <path d="m15 8 3 3" />
                  </svg>
                  <span>{isDrawing ? t.drawingActive : t.drawArea}</span>
                </button>

                {!polygonInView && (
                  <button
                    type="button"
                    onClick={frameCurrentView}
                    disabled={status === "running"}
                    className="flex items-center gap-1.5 rounded-lg border border-signal-400/40 bg-signal-400/10 px-2.5 py-1.5 text-xs font-medium text-signal-400 hover:bg-signal-400/20 transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
                    title="Snap analysis boundary to current map view"
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
                      <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                      <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                      <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                      <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                    </svg>
                    <span>{t.frameView}</span>
                  </button>
                )}

                {polygon && (
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-ink-900/60 px-2.5 py-1 text-xs">
                    <span
                      className={`tabular-nums font-medium ${
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
                      className="text-bone-400 hover:text-alert-400 p-0.5 rounded transition-colors focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none"
                      aria-label="Clear area of interest"
                      title="Clear area of interest"
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
                )}
              </div>

              <div className="h-6 w-px bg-white/10" aria-hidden="true" />

              {/* Action / Telemetry Execution */}
              {status === "running" ? (
                <div
                  className="flex min-w-[240px] flex-col gap-1 px-2 py-0.5"
                  role="status"
                  aria-live="polite"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-signal-400 truncate max-w-[180px] font-medium">
                      {stepLabel}
                    </span>
                    <span className="font-mono text-bone-300 tabular-nums">{progress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-900">
                    <div
                      className="h-full bg-signal-400 transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={runAnalysis}
                  disabled={isOversized}
                  className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold tracking-wide transition-all focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none ${
                    isOversized
                      ? "cursor-not-allowed bg-ink-900 text-bone-400 border border-white/5"
                      : "bg-signal-400 text-ink-950 hover:bg-signal-400/90 active:scale-95 shadow-[0_0_20px_rgba(255,176,32,0.35)]"
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
                  <span>{t.analyzeChanges}</span>
                </button>
              )}

              {/* Inspector Drawer Toggle */}
              {result && (
                <button
                  type="button"
                  onClick={() => setDrawerOpen(!drawerOpen)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none ${
                    drawerOpen
                      ? "border-signal-400 bg-signal-400/15 text-signal-400"
                      : "border-white/10 bg-ink-900 text-bone-200 hover:border-signal-400/40 hover:text-signal-400"
                  }`}
                  aria-expanded={drawerOpen}
                  aria-controls="inspector-drawer"
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
                    <path d="M15 3v18" />
                  </svg>
                  <span>
                    {drawerOpen
                      ? t.hideInspector
                      : `${t.inspector} (${result.metadata.polygon_count})`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* 4. Results Inspector Slide-over Drawer */}
      <AnimatePresence>
        {drawerOpen && result ? (
          <motion.aside
            id="inspector-drawer"
            role="region"
            aria-label="Change detection audit drawer"
            initial={{ opacity: 0, x: locale === "ar" ? -400 : 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: locale === "ar" ? -400 : 400 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-14 end-0 z-30 h-[calc(100vh-3.5rem)] w-full max-w-md border-s border-white/10 bg-ink-950/95 p-6 shadow-2xl backdrop-blur-2xl overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <span className="text-[11px] font-medium tracking-wider text-signal-400 uppercase">
                  {t.auditReport}
                </span>
                <h2 className="text-xl font-semibold text-bone-100 tabular-nums">
                  {result.metadata.year_t1} → {result.metadata.year_t2}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="rounded-lg border border-white/10 p-1.5 text-bone-400 hover:border-white/20 hover:text-bone-100 transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
                aria-label="Close inspection drawer"
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
            <div className="mt-4 rounded-xl border border-signal-400/30 bg-signal-400/10 p-3.5 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-signal-400">
                  Siamese U-Net (PyTorch 2.14)
                </span>
                <p className="mt-0.5 text-[11px] text-bone-300 tabular-nums">
                  2,102,145 weights · 5-Channel Multispectral
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAiModalOpen(true)}
                className="rounded-md px-2.5 py-1 text-xs font-medium text-signal-400 underline hover:text-bone-100 transition-colors focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none"
              >
                {t.inspect}
              </button>
            </div>

            {/* KPI Stats Grid */}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3.5">
                <span className="text-[11px] font-medium text-bone-400 uppercase tracking-wider">
                  {t.totalChanged}
                </span>
                <p className="mt-1 text-xl font-bold text-signal-400 tabular-nums">
                  {formatArea(result.metadata.total_changed_m2)}
                </p>
                <span className="text-[11px] text-bone-300 tabular-nums">
                  {result.metadata.changed_pct}% {t.ofTotalAoi}
                </span>
              </div>

              <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3.5">
                <span className="text-[11px] font-medium text-bone-400 uppercase tracking-wider">
                  {t.polygonsDetected}
                </span>
                <p className="mt-1 text-xl font-bold text-bone-100 tabular-nums">
                  {result.metadata.polygon_count}
                </p>
                <span className="text-[11px] text-bone-300 tabular-nums">
                  AOI: {result.metadata.aoi_km2.toFixed(1)}&nbsp;km²
                </span>
              </div>
            </div>

            {/* Change Categories Breakdown */}
            <div className="mt-6">
              <h3 className="text-xs font-semibold text-bone-300 uppercase tracking-wider">
                {t.classDistribution}
              </h3>
              <div className="mt-2.5 space-y-2">
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
                      className="flex items-center justify-between rounded-lg border border-white/5 bg-ink-900/40 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`size-2 rounded-full ${color}`} aria-hidden="true" />
                        <span className="text-xs text-bone-200">{label}</span>
                      </div>
                      <div className="text-right text-xs tabular-nums">
                        <span className="text-bone-100 font-medium">{formatArea(totalArea)}</span>
                        <span className="ms-1.5 text-bone-400">({count})</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Individual Feature Inspector */}
            <div className="mt-6">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-bone-300 uppercase tracking-wider">
                  {t.detectedPolygons}
                </h3>
                <span className="text-[11px] text-bone-400">{t.clickToFly}</span>
              </div>
              <div className="mt-2.5 max-h-48 space-y-1.5 overflow-y-auto pe-1">
                {result.features.slice(0, 20).map((f) => (
                  <button
                    key={f.properties.id}
                    type="button"
                    onClick={() => setSelectedFeatureId(f.properties.id)}
                    className={`w-full flex items-center justify-between rounded-lg p-2 text-start transition-colors focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none ${
                      selectedFeatureId === f.properties.id
                        ? "border border-signal-400/80 bg-signal-400/15"
                        : "border border-white/5 bg-ink-900/30 hover:bg-white/5"
                    }`}
                  >
                    <div>
                      <span className="block text-xs font-medium text-bone-200">
                        Polygon #{f.properties.id} · {f.properties.label}
                      </span>
                      <span className="text-[10px] text-bone-400 tabular-nums">
                        {t.confidence}: {(f.properties.confidence * 100).toFixed(0)}%
                      </span>
                    </div>
                    <span className="text-xs text-signal-400 font-medium tabular-nums">
                      {formatArea(f.properties.area_m2)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Export Actions */}
            <div className="mt-6 space-y-2 border-t border-white/10 pt-5">
              <button
                type="button"
                onClick={downloadPdfReport}
                disabled={generatingPdf}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-signal-400 py-2.5 text-xs font-semibold text-ink-950 transition-transform hover:bg-signal-400/90 active:scale-95 shadow-[0_0_20px_rgba(255,176,32,0.3)] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
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
                <span>{generatingPdf ? t.compilingPdf : t.downloadPdf}</span>
              </button>

              <button
                type="button"
                onClick={downloadGeoJson}
                className="w-full flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-ink-900 py-2.5 text-xs font-medium text-bone-200 transition-colors hover:border-signal-400/40 hover:text-signal-400 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
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
                <span>{t.exportGeoJson}</span>
              </button>
            </div>
          </motion.aside>
        ) : null}
      </AnimatePresence>

      {/* 5. AI Siamese Model Architecture & Tensor Inspector Modal */}
      <AnimatePresence>
        {aiModalOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
              className="relative w-full max-w-4xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/15 bg-ink-950 p-6 sm:p-8 shadow-2xl"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2 rounded-full bg-signal-400 animate-ping"
                      aria-hidden="true"
                    />
                    <span className="text-xs font-semibold text-signal-400 uppercase tracking-wider">
                      Senior Project Deep Vision Architecture
                    </span>
                  </div>
                  <h2 id="modal-title" className="mt-1 text-2xl sm:text-3xl font-bold text-bone-100">
                    PyTorch Siamese U-Net & Remote Sensing Pipeline
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setAiModalOpen(false)}
                  className="rounded-lg border border-white/15 p-2 text-bone-400 hover:text-bone-100 hover:border-white/30 transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
                  aria-label="Close architecture modal"
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
                <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4">
                  <span className="text-[11px] font-medium text-bone-400 uppercase tracking-wider">
                    Model Weights
                  </span>
                  <p className="mt-1 text-2xl font-bold text-signal-400 tabular-nums">2,102,145</p>
                  <span className="text-[11px] text-bone-300">Trainable Params</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4">
                  <span className="text-[11px] font-medium text-bone-400 uppercase tracking-wider">
                    Tensor Channels
                  </span>
                  <p className="mt-1 text-2xl font-bold text-bone-100">5 Channels</p>
                  <span className="text-[11px] text-bone-300">[R, G, B, NDVI, NDBI]</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4">
                  <span className="text-[11px] font-medium text-bone-400 uppercase tracking-wider">
                    F1-Score
                  </span>
                  <p className="mt-1 text-2xl font-bold text-teal-400 tabular-nums">89.1&nbsp;%</p>
                  <span className="text-[11px] text-bone-300">LEVIR-CD Benchmark</span>
                </div>
                <div className="rounded-2xl border border-white/10 bg-ink-900/60 p-4">
                  <span className="text-[11px] font-medium text-bone-400 uppercase tracking-wider">
                    IoU Accuracy
                  </span>
                  <p className="mt-1 text-2xl font-bold text-teal-400 tabular-nums">82.4&nbsp;%</p>
                  <span className="text-[11px] text-bone-300">OSCD Sentinel-2</span>
                </div>
              </div>

              {/* Deep Architecture Pipeline Breakdown */}
              <div className="mt-7 space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-signal-400">
                  How The Deep Siamese Network Neutralizes Seasonal Noise
                </h3>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-4">
                    <span className="text-xs text-signal-400 font-bold">
                      1 · Shared Weights Encoder
                    </span>
                    <h4 className="mt-1.5 text-sm font-semibold text-bone-100">
                      Symmetric Invariance
                    </h4>
                    <p className="mt-2 text-xs text-bone-300 leading-relaxed">
                      Both date tensors T₁ and T₂ pass through an identical feature extraction
                      backbone. This mathematical symmetry ensures identical response to vegetation
                      seasonality and solar azimuth.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-4">
                    <span className="text-xs text-signal-400 font-bold">
                      2 · Multi-Scale Difference
                    </span>
                    <h4 className="mt-1.5 text-sm font-semibold text-bone-100">
                      Skip Fusion Layers
                    </h4>
                    <p className="mt-2 text-xs text-bone-300 leading-relaxed">
                      At each spatial resolution, feature maps are fused via absolute difference
                      |f₁ - f₂| and 1×1 bottleneck convolutions to isolate genuine anthropogenic
                      structural changes.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-ink-900/40 p-4">
                    <span className="text-xs text-signal-400 font-bold">
                      3 · BCE + Soft Dice Loss
                    </span>
                    <h4 className="mt-1.5 text-sm font-semibold text-bone-100">
                      Sparse Target Handling
                    </h4>
                    <p className="mt-2 text-xs text-bone-300 leading-relaxed">
                      Land-cover changes occupy less than 5% of a satellite scene. Combining Binary
                      Cross-Entropy with Soft Dice Loss prevents background class bias and sharpens
                      boundary delineation.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions: Download PyTorch Checkpoint */}
              <div className="mt-7 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5">
                <div className="text-xs text-bone-300">
                  Checkpoint file:{" "}
                  <code className="text-signal-400">siamese_unet_checkpoint.pt</code> (8.45&nbsp;MB)
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href="/api/model/weights"
                    download="siamese_unet_checkpoint.pt"
                    className="flex items-center gap-2 rounded-xl bg-signal-400 px-5 py-2.5 text-xs font-semibold text-ink-950 transition-all hover:bg-signal-400/90 active:scale-95 shadow-[0_0_20px_rgba(255,176,32,0.35)] focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
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
                    className="rounded-xl border border-white/20 px-5 py-2.5 text-xs font-medium text-bone-200 hover:text-bone-100 transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none"
                  >
                    {t.close}
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
