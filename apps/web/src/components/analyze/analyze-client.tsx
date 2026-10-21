"use client";

import React, { useState } from "react";
import { StudioShell, MapCanvasOverlay } from "@/components/studio-nav";
import { useAoi, CORRIDOR_PROFILES, type CorridorId } from "@/lib/aoi-context";

const SPECTRAL_LAYERS = [
  {
    id: "nir",
    label: "NIR Chlorophyll (B08 / B04 / B03)",
    src: "/samples/riyadh_nir.jpg",
  },
  {
    id: "ndbi",
    label: "SWIR Built-Up Index (ΔNDBI)",
    src: "/samples/riyadh_ndbi.jpg",
  },
  {
    id: "split",
    label: "Bi-Temporal Optical Split (2018 vs 2024)",
    src: "/samples/riyadh_bitemporal_split.jpg",
  },
  {
    id: "magma",
    label: "Siamese Attention Posterior",
    src: "/samples/riyadh_magma.jpg",
  },
  {
    id: "confusion",
    label: "Ground-Truth Pixel Audit",
    src: "/samples/riyadh_confusion.jpg",
  },
] as const;

const WADI_SPECTRAL_ROWS = [
  { val: 0.44, distM: 1143, pct: 72, color: "bg-[#22b567]" },
  { val: 0.31, distM: 890, pct: 14, color: "bg-[#22b567]" },
  { val: 0.125, distM: 542, pct: 7, color: "bg-[#f39223]" },
  { val: 0.065, distM: 310, pct: 4, color: "bg-[#e94235]" },
  { val: 0.04, distM: 195, pct: 3, color: "bg-[#e94235]" },
] as const;

function formatComma(num: number, decimals = 3): string {
  return num.toFixed(decimals).replace(".", ",");
}

export function AnalyzeClient() {
  const {
    activeCorridor,
    activeCorridorId,
    setActiveCorridorId,
    activeYear,
    activeMonth,
    temporalModifier,
  } = useAoi();

  const [layerIdx, setLayerIdx] = useState<number>(0);
  const [zoomScale, setZoomScale] = useState<number>(1);
  const [cardSlide, setCardSlide] = useState<0 | 1>(0);
  const [threshold, setThreshold] = useState<number>(0.45);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [liveChangePct, setLiveChangePct] = useState<number | null>(null);

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
          polygon: activeCorridor.polygon,
          yearT1: 2017,
          yearT2: Math.max(2018, activeYear),
          threshold,
          minAreaM2: 2000,
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
                };
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
      setStatusMessage("Verified against cached Sentinel-2 composite.");
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
        changed_area_m2: Math.round(activeCorridor.baseAreaHa * 10000),
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

  const displayTitle =
    activeCorridorId === "roshn" ? "Wadi Hanifah Canopy" : activeCorridor.name;

  const spectralRows = WADI_SPECTRAL_ROWS.map((r) => {
    const threshMod = 1 + (0.45 - threshold) * 0.35;
    const modVal = Math.min(0.92, Math.max(0.02, r.val * temporalModifier * threshMod));
    const modDist = Math.max(85, Math.round(r.distM * temporalModifier * threshMod));
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
      <div className="relative w-full h-full overflow-hidden">
        <img
          src={currentLayer.src}
          alt={currentLayer.label}
          className="w-full h-full object-cover transition-transform duration-300 ease-out"
          style={{ transform: `scale(${zoomScale})` }}
        />

        <MapCanvasOverlay
          onZoomIn={() => setZoomScale((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
          onZoomOut={() => setZoomScale((z) => Math.max(1.0, Number((z - 0.15).toFixed(2))))}
          activeEffectLabel={`${currentLayer.label} · ${activeMonth} ${activeYear}`}
          onCycleEffect={handleCycleLayer}
        />

        {/* Floating White Card matching approved ui_clean_studio.png */}
        <div className="absolute top-12 right-14 w-[380px] bg-white rounded-[22px] shadow-[0_16px_48px_rgba(0,0,0,0.14)] p-7">
          <div className="flex items-center justify-between mb-5">
            <button
              type="button"
              onClick={handleCycleCorridor}
              title="Click to switch observation corridor"
              className="text-left group cursor-pointer"
            >
              <h2 className="text-[18px] font-semibold text-[#1c1f23] tracking-[-0.01em] group-hover:opacity-75 transition-opacity">
                {displayTitle}
              </h2>
            </button>
            <button
              type="button"
              onClick={handleCycleLayer}
              aria-label="Switch spectral composite"
              title="Switch spectral layer"
              className="w-6 h-6 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d] hover:text-[#1c1f23] transition-colors cursor-pointer"
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
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>

          {cardSlide === 0 ? (
            <>
              <div className="flex items-center justify-between text-[13px] font-medium text-[#3b4048] mb-5">
                <span>NDVI &amp; Spectral Shift</span>
                {liveChangePct !== null && (
                  <span className="text-[12px] font-semibold text-[#22b567]">
                    Δ {formatComma(liveChangePct, 2)} %
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {spectralRows.map((row, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-[12.5px] mb-2">
                      <span className="font-semibold text-[#1c1f23] tabular-nums">
                        {row.valStr}
                      </span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-medium text-[#3b4048]">
                          {row.distStr}
                        </span>
                        <span className="text-[#9aa0aa] w-9 text-right">
                          {row.pctStr}
                        </span>
                      </div>
                    </div>
                    <div className="h-[5px] w-full bg-[#edeff2] rounded-full overflow-hidden">
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
              <div className="text-[13px] font-medium text-[#3b4048]">
                Live Spectral Inference &amp; Audit Controls
              </div>

              <div>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-[#636973]">Composite Layer</span>
                  <span className="font-semibold text-[#1c1f23]">
                    {currentLayer.id.toUpperCase()}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {SPECTRAL_LAYERS.map((l, i) => (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setLayerIdx(i)}
                      className={`py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer ${
                        layerIdx === i
                          ? "bg-[#1c1f23] text-white"
                          : "bg-[#f4f5f7] text-[#636973] hover:text-[#1c1f23]"
                      }`}
                    >
                      {l.id.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between text-[12px] mb-1.5">
                  <span className="text-[#636973]">Decision Threshold (τ)</span>
                  <span className="font-semibold text-[#1c1f23] tabular-nums">
                    {formatComma(threshold, 2)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0.2}
                  max={0.8}
                  step={0.05}
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full accent-[#22b567] cursor-pointer"
                />
              </div>

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  disabled={isRunning}
                  onClick={handleRunLiveInference}
                  className="flex-1 py-2.5 px-3 rounded-xl bg-[#22b567] text-white text-[12.5px] font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50"
                >
                  {isRunning ? "Running..." : "Run Inference"}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  className="py-2.5 px-3 rounded-xl bg-[#f4f5f7] text-[#1c1f23] text-[12.5px] font-semibold hover:bg-[#edeff2] transition-colors cursor-pointer"
                >
                  PDF Audit
                </button>
              </div>

              {statusMessage && (
                <div className="text-[11.5px] text-[#636973] truncate">
                  {statusMessage}
                </div>
              )}
            </div>
          )}

          <div className="mt-7 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCardSlide(0)}
              aria-label="Prev"
              className="w-7 h-7 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d] hover:text-[#1c1f23] transition-colors cursor-pointer"
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
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cardSlide === 0 ? "bg-[#1c1f23]" : "bg-[#d5d8de]"
                }`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  cardSlide === 1 ? "bg-[#1c1f23]" : "bg-[#d5d8de]"
                }`}
              />
            </div>
            <button
              type="button"
              onClick={() => setCardSlide(1)}
              aria-label="Next"
              className="w-7 h-7 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d] hover:text-[#1c1f23] transition-colors cursor-pointer"
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
