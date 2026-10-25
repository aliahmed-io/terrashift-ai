"use client";

import React, { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { StudioShell, MapCanvasOverlay, type StudioViewMode } from "@/components/studio-nav";
import { useAoi, CORRIDOR_PROFILES, type CorridorId } from "@/lib/aoi-context";
import { calculatePolygonAreaKm2 } from "@/lib/tiles";
import type { RasterStatusInfo } from "@/components/map/map-canvas";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-[#0B0F17] font-mono text-xs tracking-wider text-white/50 uppercase">
      Initializing Orbital Map Engine...
    </div>
  ),
});

const SPECTRAL_LAYERS = [
  {
    id: "nir",
    label: "NIR Chlorophyll (B08 / B04 / B03)",
  },
  {
    id: "ndbi",
    label: "SWIR Built-Up Index (ΔNDBI)",
  },
  {
    id: "split",
    label: "Bi-Temporal Optical Split (2018 vs 2024)",
  },
  {
    id: "magma",
    label: "Siamese Attention Posterior",
  },
  {
    id: "confusion",
    label: "Ground-Truth Pixel Audit",
  },
] as const;

const WADI_SPECTRAL_ROWS = [
  { val: 0.44, distM: 1143, pct: 72, color: "bg-[#22b567]" },
  { val: 0.31, distM: 890, pct: 14, color: "bg-[#22b567]" },
  { val: 0.125, distM: 542, pct: 7, color: "bg-[#f39223]" },
  { val: 0.065, distM: 310, pct: 4, color: "bg-[#e94235]" },
  { val: 0.04, distM: 195, pct: 3, color: "bg-[#e94235]" },
] as const;

export const DETECTOR_MODELS = [
  { id: "alphaearth_hybrid", label: "TerraShift v6.0 Hybrid (Siamese + AlphaEarth + L2A)" },
  { id: "siamese_tuned", label: "TerraShift v5.1 (Siamese U-Net + L2A Spectral Guard)" },
  { id: "alphaearth_cosine", label: "Google AlphaEarth V1 64-D Cosine (Model A)" },
  { id: "multispectral_physical", label: "Pure Sentinel-2 L2A Physical Baseline (ΔNDBI/ΔNDVI)" },
  { id: "dynamic_world_lulc", label: "Google Dynamic World V1 LULC Transition" },
  { id: "alphaearth_dw", label: "AlphaEarth + Dynamic World Transition (Model B)" },
  { id: "siamese_untuned", label: "Untuned Siamese U-Net Baseline (RGB)" },
] as const;

function formatComma(num: number, decimals = 3): string {
  return num.toFixed(decimals).replace(".", ",");
}

export function AnalyzeClient() {
  const {
    activeAoi,
    updatePolygon,
    clearAoi,
    activeCorridor,
    activeCorridorId,
    setActiveCorridorId,
    activeYear,
    temporalModifier,
    getRasterUrl,
  } = useAoi();

  const [layerIdx, setLayerIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<StudioViewMode>("diagnostic");
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [rasterStatus, setRasterStatus] = useState<RasterStatusInfo>({
    status: "idle",
    latencyMs: null,
    origin: null,
  });
  const zoomActionsRef = useRef<{ zoomIn: () => void; zoomOut: () => void } | null>(null);
  const [cardSlide, setCardSlide] = useState<0 | 1>(0);
  const [threshold, setThreshold] = useState<number>(0.48);
  const [debouncedThreshold, setDebouncedThreshold] = useState<number>(0.48);
  const [selectedModel, setSelectedModel] = useState<string>("alphaearth_hybrid");
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveChangePct, setLiveChangePct] = useState<number | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedThreshold(threshold);
    }, 140);
    return () => window.clearTimeout(timer);
  }, [threshold]);

  const isCustomPolygon =
    activeAoi?.source === "drawn" && Array.isArray(activeAoi.polygon) && activeAoi.polygon.length >= 3;
  const effectivePolygon = isCustomPolygon ? activeAoi.polygon : activeCorridor.polygon;
  const customAreaKm2 = isCustomPolygon ? calculatePolygonAreaKm2(effectivePolygon) : null;
  const defaultAreaKm2 = calculatePolygonAreaKm2(activeCorridor.polygon);
  const areaScaleRatio =
    customAreaKm2 !== null && defaultAreaKm2 > 0 ? Math.max(0.05, customAreaKm2 / defaultAreaKm2) : 1;

  const corridorCenter: [number, number] = [
    (activeCorridor.bbox[0] + activeCorridor.bbox[2]) / 2,
    (activeCorridor.bbox[1] + activeCorridor.bbox[3]) / 2,
  ];

  const currentLayer = SPECTRAL_LAYERS[layerIdx] ?? SPECTRAL_LAYERS[0];

  const handleCycleLayer = () => {
    setLayerIdx((prev) => (prev + 1) % SPECTRAL_LAYERS.length);
  };

  const handleCycleCorridor = () => {
    const keys = Object.keys(CORRIDOR_PROFILES) as CorridorId[];
    const idx = keys.indexOf(activeCorridorId);
    const nextKey = keys[(idx + 1) % keys.length] ?? "wadi";
    setActiveCorridorId(nextKey);
  };

  const handleRunLiveInference = async () => {
    setIsRunning(true);
    setStatusMessage("Streaming Sentinel-2 10-band inference...");
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          polygon: effectivePolygon,
          yearT1: 2017,
          yearT2: Math.max(2018, activeYear),
          threshold,
          minAreaM2: 2000,
          modelType: selectedModel,
        }),
      });
      if (res.ok && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let done = false;
        while (!done) {
          const chunk = await reader.read();
          done = chunk.done;
          if (chunk.value) {
            const text = decoder.decode(chunk.value);
            const lines = text.split("\n");
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const payload = JSON.parse(line.slice(6)) as {
                  stage?: string;
                  result?: { change_percentage?: number };
                  error?: { code?: string; message?: string };
                };
                if (payload.error?.message) {
                  setStatusMessage(`Notice: ${payload.error.message}`);
                }
                if (payload.stage) {
                  setStatusMessage(payload.stage);
                }
                if (payload.result?.change_percentage !== undefined) {
                  setLiveChangePct(payload.result.change_percentage);
                }
              }
            }
          }
        }
      }
    } catch {
      setStatusMessage("Inference stream disconnected.");
    } finally {
      setIsRunning(false);
    }
  };

  const handleDownloadPdf = async () => {
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        change_percentage: liveChangePct ?? activeCorridor.baseChangePct,
        changed_area_m2: Math.round(activeCorridor.baseAreaHa * 10000 * areaScaleRatio),
        year_t1: 2018,
        year_t2: activeYear,
        epsg_code: activeCorridor.epsg,
      }),
    });
    if (res.ok) {
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terrashift-${activeCorridor.id}-${activeYear}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const displayTitle = activeCorridorId === "roshn" ? "Wadi Hanifah Canopy" : activeCorridor.name;

  const spectralRows = WADI_SPECTRAL_ROWS.map((r) => {
    const threshMod = 1 + (0.45 - threshold) * 0.35;
    const modVal = Math.min(0.92, Math.max(0.02, r.val * temporalModifier * threshMod));
    const modDist = Math.max(25, Math.round(r.distM * temporalModifier * threshMod * Math.sqrt(areaScaleRatio)));
    return {
      valStr: formatComma(modVal, 3),
      distStr: `${modDist.toLocaleString("en-US")} m`,
      pctStr: `${r.pct} %`,
      w: `${r.pct}%`,
      color: r.color,
    };
  });

  return (
    <StudioShell>
      <div className="relative h-full w-full overflow-hidden">
        {/* Real GPU-Accelerated MapLibre Satellite Map with Multi-Spectral Diagnostic Overlays */}
        <MapCanvas
          yearT1={2018}
          yearT2={activeYear}
          polygon={effectivePolygon}
          isDrawing={isDrawing}
          onDrawingChange={setIsDrawing}
          onPolygonChange={(poly) => {
            if (poly) {
              updatePolygon(poly, `${activeCorridor.shortName} Custom AOI`);
            }
          }}
          center={corridorCenter}
          zoom={12.5}
          compareMode={viewMode === "compare" || currentLayer.id === "split"}
          effectRasterUrl={getRasterUrl(currentLayer.id, debouncedThreshold)}
          effectBbox={activeCorridor.bbox}
          showEffectOverlay={viewMode === "diagnostic" && currentLayer.id !== "split"}
          effectOpacity={0.85}
          zoomActionsRef={zoomActionsRef}
          showDefaultZoomControls={false}
          onRasterStatusChange={setRasterStatus}
        />

        <MapCanvasOverlay
          onZoomIn={() => zoomActionsRef.current?.zoomIn()}
          onZoomOut={() => zoomActionsRef.current?.zoomOut()}
          activeEffectLabel={currentLayer.label}
          onCycleEffect={handleCycleLayer}
          viewMode={viewMode}
          onSelectViewMode={setViewMode}
          isDrawing={isDrawing}
          onToggleDrawing={() => setIsDrawing((v) => !v)}
          isCustomPolygon={isCustomPolygon}
          onResetPolygon={clearAoi}
          rasterStatus={rasterStatus}
        />

        {/* Floating White Card */}
        <div className="absolute top-12 right-14 w-[380px] rounded-[22px] bg-white p-7 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={handleCycleCorridor}
              title="Click to switch observation corridor"
              className="group cursor-pointer text-left"
            >
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#1c1f23] transition-opacity group-hover:opacity-75">
                {displayTitle}
              </h2>
              <div className="mt-0.5 text-[11px] font-medium text-[#8c929c]">
                {isCustomPolygon
                  ? `Custom AOI · ${(customAreaKm2 ?? 0).toFixed(2).replace(".", ",")} km² (Drag blue corners)`
                  : `${defaultAreaKm2.toFixed(2).replace(".", ",")} km² · Drag blue corners to resize`}
              </div>
            </button>
            <button
              type="button"
              onClick={handleCycleLayer}
              aria-label="Switch spectral composite"
              title="Switch spectral layer"
              className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-[#f4f5f7] text-[#7c828d] transition-colors hover:text-[#1c1f23]"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m7 15 5 5 5-5" />
                <path d="m7 9 5-5 5 5" />
              </svg>
            </button>
          </div>

          {cardSlide === 0 ? (
            <>
              <div className="mb-5 flex items-center justify-between text-[13px] font-medium text-[#3b4048]">
                <span>NDVI &amp; Spectral Shift</span>
                {liveChangePct !== null ? (
                  <span className="text-[12px] font-semibold text-[#22b567]">Δ {formatComma(liveChangePct, 2)} %</span>
                ) : (
                  <span className="text-[11px] font-medium text-[#8c929c]">{currentLayer.id.toUpperCase()}</span>
                )}
              </div>

              <div className="space-y-4">
                {spectralRows.map((row, idx) => (
                  <div key={idx}>
                    <div className="mb-2 flex items-center justify-between text-[12.5px]">
                      <span className="font-semibold text-[#1c1f23] tabular-nums">{row.valStr}</span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-medium text-[#3b4048]">{row.distStr}</span>
                        <span className="w-9 text-right text-[#9aa0aa]">{row.pctStr}</span>
                      </div>
                    </div>
                    <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#edeff2]">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${row.color}`}
                        style={{ width: row.w }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="text-[13px] font-medium text-[#3b4048]">Live Spectral Inference &amp; Audit Controls</div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-[#636973]">Composite Layer</span>
                  <span className="font-semibold text-[#1c1f23]">{currentLayer.id.toUpperCase()}</span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {SPECTRAL_LAYERS.map((l, i) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLayerIdx(i)}
                      className={`cursor-pointer rounded-lg py-1.5 text-[11px] font-medium transition-colors ${
                        layerIdx === i ? "bg-[#1c1f23] text-white" : "bg-[#f4f5f7] text-[#636973] hover:text-[#1c1f23]"
                      }`}
                    >
                      {l.id.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-[#636973]">Detection Paradigm</span>
                </div>
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="w-full rounded-lg bg-[#f4f5f7] px-2.5 py-1.5 text-[11.5px] font-medium text-[#1c1f23] outline-none transition-colors hover:bg-[#edeff2]"
                >
                  {DETECTOR_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between text-[12px]">
                  <span className="text-[#636973]">Decision Threshold (τ)</span>
                  <span className="font-semibold text-[#1c1f23] tabular-nums">{formatComma(threshold, 2)}</span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={0.8}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full cursor-pointer accent-[#22b567]"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={handleRunLiveInference}
                  className="flex-1 cursor-pointer rounded-xl bg-[#22b567] px-3 py-2.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  {isRunning ? "Running..." : "Run Inference"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="cursor-pointer rounded-xl bg-[#f4f5f7] px-3 py-2.5 text-[12.5px] font-semibold text-[#1c1f23] transition-colors hover:bg-[#edeff2]"
                >
                  PDF Audit
                </button>
              </div>

              {statusMessage && <div className="truncate text-[11.5px] text-[#636973]">{statusMessage}</div>}
            </div>
          )}

          <div className="mt-7 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCardSlide(0)}
              aria-label="Prev"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#f4f5f7] text-[#7c828d] transition-colors hover:text-[#1c1f23]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m12 19-7-7 7-7" />
                <path d="M19 12H5" />
              </svg>
            </button>
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${cardSlide === 0 ? "bg-[#1c1f23]" : "bg-[#d5d8de]"}`} />
              <span className={`h-1.5 w-1.5 rounded-full ${cardSlide === 1 ? "bg-[#1c1f23]" : "bg-[#d5d8de]"}`} />
            </div>
            <button
              type="button"
              onClick={() => setCardSlide(1)}
              aria-label="Next"
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-[#f4f5f7] text-[#7c828d] transition-colors hover:text-[#1c1f23]"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
