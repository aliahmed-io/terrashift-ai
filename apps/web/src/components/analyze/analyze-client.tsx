"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import { MapCanvas, type MapFeature } from "@/components/map/map-canvas";
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
  provenance: string;
}

interface AnalysisResult {
  type: "FeatureCollection";
  metadata: AnalysisMetadata;
  features: MapFeature[];
  provenance: string;
}

type AnalysisStatus = "idle" | "running" | "done" | "error";

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
  const [panelOpen, setPanelOpen] = useState(true);

  const [status, setStatus] = useState<AnalysisStatus>("idle");
  const [stepLabel, setStepLabel] = useState<string>("");
  const [progress, setProgress] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

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
  const polygonInView = isPolygonNearCamera(polygon, cameraCenter);

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
    setProgress(10);
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
          setStepLabel("Complete");
          completed = true;
          return;
        }

        if (parsed.type === "FeatureCollection" && parsed.metadata) {
          setResult(parsed as AnalysisResult);
          setStatus("done");
          setProgress(100);
          setStepLabel("Complete");
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
      setErrorMessage("Failed to generate PDF audit report.");
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

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ink-950 text-bone-100">
      <StudioNav
        rightSlot={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-bone-100/15 bg-ink-900 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setBasemapSource("s2")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  basemapSource === "s2"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                Sentinel-2
              </button>
              <button
                type="button"
                onClick={() => setBasemapSource("mapbox")}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  basemapSource === "mapbox"
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "text-bone-300 hover:text-bone-100"
                }`}
              >
                High-Res Aerial
              </button>
            </div>

            <button
              type="button"
              onClick={() => setCompareMode((v) => !v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                compareMode
                  ? "border-signal-400/50 bg-signal-400/15 text-signal-400 font-semibold"
                  : "border-bone-100/15 bg-ink-900 text-bone-200 hover:text-bone-100"
              }`}
            >
              {compareMode ? "Split View: On" : "Split View"}
            </button>
          </div>
        }
      />

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

        {/* Floating Minimal Studio Control Panel */}
        <aside
          aria-label="Change Detection Controls"
          className="pointer-events-auto absolute top-4 start-4 z-20 flex max-h-[calc(100vh-5.5rem)] w-[calc(100vw-2rem)] max-w-88 flex-col overflow-hidden rounded-2xl orbital-panel backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-bone-100/10 px-4 py-3">
            <span className="text-xs font-semibold text-bone-100">Change Detection Studio</span>
            <button
              type="button"
              onClick={() => setPanelOpen((v) => !v)}
              className="rounded-md px-2 py-0.5 text-xs text-bone-300 hover:bg-bone-100/10 hover:text-bone-100 transition-colors"
              aria-label={panelOpen ? "Collapse controls" : "Expand controls"}
            >
              {panelOpen ? "Hide" : "Show"}
            </button>
          </div>

          {panelOpen ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Location Search */}
              <LocationSearch onSelectLocation={handleSelectLocation} />

              {/* Hotspot Preset Selector */}
              <div>
                <label
                  htmlFor="preset-select"
                  className="block font-mono text-[10px] uppercase tracking-wider text-bone-400"
                >
                  Region Preset
                </label>
                <select
                  id="preset-select"
                  value={selectedPreset?.id ?? "custom"}
                  onChange={(e) => {
                    const found = HOTSPOT_PRESETS.find((p) => p.id === e.target.value);
                    if (found) selectPreset(found);
                  }}
                  className="mt-1 w-full rounded-lg border border-bone-100/15 bg-ink-950 px-3 py-2 text-xs font-medium text-bone-100 focus:border-signal-400 focus-visible:outline-none"
                >
                  {HOTSPOT_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                  {!selectedPreset ? <option value="custom">Custom Viewport Area</option> : null}
                </select>
              </div>

              {/* Epoch Selectors */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label
                    htmlFor="year-t1"
                    className="block font-mono text-[10px] uppercase tracking-wider text-bone-400"
                  >
                    Baseline (T₁)
                  </label>
                  <select
                    id="year-t1"
                    value={yearT1}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setYearT1(v);
                      if (v >= yearT2) setYearT2(v + 1);
                    }}
                    className="mt-1 w-full rounded-lg border border-bone-100/15 bg-ink-950 px-2.5 py-2 text-xs font-medium text-bone-100 focus:border-signal-400 focus-visible:outline-none tabular-nums"
                  >
                    {[2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="year-t2"
                    className="block font-mono text-[10px] uppercase tracking-wider text-bone-400"
                  >
                    Target (T₂)
                  </label>
                  <select
                    id="year-t2"
                    value={yearT2}
                    onChange={(e) => setYearT2(Number(e.target.value))}
                    className="mt-1 w-full rounded-lg border border-bone-100/15 bg-ink-950 px-2.5 py-2 text-xs font-medium text-signal-400 focus:border-signal-400 focus-visible:outline-none tabular-nums"
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

              {/* Area of Interest Tools */}
              <div className="flex items-center justify-between rounded-xl border border-bone-100/10 bg-ink-950 p-3">
                <div>
                  <span className="block font-mono text-[10px] uppercase tracking-wider text-bone-400">
                    Selected Area
                  </span>
                  <span
                    className={`font-mono text-sm font-semibold tabular-nums ${
                      isOversized ? "text-crimson-400" : "text-bone-100"
                    }`}
                  >
                    {aoiAreaKm2.toFixed(2)} km²
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {!polygonInView ? (
                    <button
                      type="button"
                      onClick={frameCurrentView}
                      className="rounded-lg border border-bone-100/15 bg-ink-900 px-2.5 py-1.5 text-xs font-medium text-bone-200 hover:text-bone-100 transition-colors"
                    >
                      Frame View
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setIsDrawing((v) => !v)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      isDrawing
                        ? "bg-signal-400 text-ink-950 font-semibold"
                        : "border border-bone-100/15 bg-ink-900 text-bone-200 hover:text-bone-100"
                    }`}
                  >
                    {isDrawing ? "Drawing…" : "Draw Area"}
                  </button>
                </div>
              </div>

              {/* Error Alert */}
              {errorMessage ? (
                <div
                  role="alert"
                  className="flex items-center justify-between gap-2 rounded-xl border border-crimson-400/40 bg-crimson-400/10 px-3 py-2 text-xs text-crimson-400"
                >
                  <span>{errorMessage}</span>
                  <button
                    type="button"
                    onClick={() => setErrorMessage(null)}
                    className="text-bone-300 hover:text-bone-100"
                    aria-label="Dismiss error"
                  >
                    ×
                  </button>
                </div>
              ) : null}

              {/* Run Change Detection Primary CTA */}
              <button
                type="button"
                onClick={runAnalysis}
                disabled={status === "running" || isOversized}
                className="w-full rounded-xl bg-signal-400 py-2.5 text-xs font-semibold text-ink-950 hover:bg-signal-400/90 disabled:opacity-50 transition-colors cursor-pointer"
              >
                {status === "running" ? `${stepLabel} (${progress}%)` : "Run Change Detection"}
              </button>

              {/* Results Inspector (shown after inference) */}
              {result ? (
                <div className="border-t border-bone-100/10 pt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                        Total Changed
                      </span>
                      <p className="mt-1 font-mono text-base font-bold text-signal-400 tabular-nums">
                        {formatArea(result.metadata.total_changed_m2)}
                      </p>
                      <span className="text-[11px] text-bone-300 tabular-nums">
                        {result.metadata.changed_pct}% of AOI
                      </span>
                    </div>

                    <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                        Polygons
                      </span>
                      <p className="mt-1 font-mono text-base font-bold text-bone-100 tabular-nums">
                        {result.metadata.polygon_count}
                      </p>
                      <span className="text-[11px] text-bone-300">Siamese U-Net</span>
                    </div>
                  </div>

                  {result.features.length > 0 ? (
                    <div className="max-h-40 space-y-1.5 overflow-y-auto">
                      {result.features.slice(0, 15).map((f) => (
                        <button
                          key={f.properties.id}
                          type="button"
                          onClick={() => setSelectedFeatureId(f.properties.id)}
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                            selectedFeatureId === f.properties.id
                              ? "border border-signal-400/60 bg-signal-400/15 text-bone-100"
                              : "border border-bone-100/5 bg-ink-950 text-bone-200 hover:bg-bone-100/5"
                          }`}
                        >
                          <span className="truncate">
                            #{f.properties.id} · {f.properties.label}
                          </span>
                          <span className="ms-2 shrink-0 font-mono text-[11px] text-signal-400 tabular-nums">
                            {formatArea(f.properties.area_m2)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={downloadGeoJson}
                      className="rounded-lg border border-bone-100/15 bg-ink-950 py-2 text-xs font-medium text-bone-100 hover:border-signal-400/40 transition-colors"
                    >
                      Export GeoJSON
                    </button>
                    <button
                      type="button"
                      onClick={downloadPdfReport}
                      disabled={generatingPdf}
                      className="rounded-lg border border-bone-100/15 bg-ink-950 py-2 text-xs font-medium text-bone-100 hover:border-signal-400/40 transition-colors"
                    >
                      {generatingPdf ? "Building PDF…" : "Audit PDF"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>
      </main>
    </div>
  );
}
