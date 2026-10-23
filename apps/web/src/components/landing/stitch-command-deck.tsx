"use client";

import React, { useState, useRef } from "react";
import dynamic from "next/dynamic";
import { StudioShell, MapCanvasOverlay, type StudioViewMode } from "@/components/studio-nav";
import { useAoi, CORRIDOR_PROFILES, type CorridorId } from "@/lib/aoi-context";

const MapCanvas = dynamic(() => import("@/components/map/map-canvas").then((m) => m.MapCanvas), {
  ssr: false,
  loading: () => (
    <div className="flex size-full items-center justify-center bg-[#0B0F17] font-mono text-xs tracking-wider text-white/50 uppercase">
      Initializing Orbital Map Engine...
    </div>
  ),
});

const CITY_EFFECTS = [
  {
    id: "split",
    label: "Bi-Temporal Split (2018 / 2024)",
  },
  {
    id: "magma",
    label: "Siamese Attention Posterior",
  },
  {
    id: "ndbi",
    label: "SWIR Built-Up Shift (ΔNDBI)",
  },
  {
    id: "nir",
    label: "NIR Chlorophyll Composite",
  },
  {
    id: "confusion",
    label: "Ground-Truth Pixel Audit",
  },
] as const;

function formatComma(num: number, decimals = 3): string {
  return num.toFixed(decimals).replace(".", ",");
}

export function StitchCommandDeck() {
  const {
    activeCorridor,
    activeCorridorId,
    setActiveCorridorId,
    activeYear,
    activeMonth,
    temporalModifier,
    getRasterUrl,
  } = useAoi();

  const [cardSlide, setCardSlide] = useState<0 | 1>(0);
  const [effectIdx, setEffectIdx] = useState<number>(0);
  const [viewMode, setViewMode] = useState<StudioViewMode>("diagnostic");
  const zoomActionsRef = useRef<{ zoomIn: () => void; zoomOut: () => void } | null>(null);
  const [cardCollapsed, setCardCollapsed] = useState<boolean>(false);

  const currentEffect = CITY_EFFECTS[effectIdx] ?? CITY_EFFECTS[0];

  const corridorCenter: [number, number] = [
    (activeCorridor.bbox[0] + activeCorridor.bbox[2]) / 2,
    (activeCorridor.bbox[1] + activeCorridor.bbox[3]) / 2,
  ];

  const handleCycleEffect = () => {
    setEffectIdx((prev) => (prev + 1) % CITY_EFFECTS.length);
  };

  const handleCycleCorridor = () => {
    const keys = Object.keys(CORRIDOR_PROFILES) as CorridorId[];
    const idx = keys.indexOf(activeCorridorId);
    const nextKey = keys[(idx + 1) % keys.length] ?? "roshn";
    setActiveCorridorId(nextKey);
  };

  // Compute live rows modulated by activeYear & activeMonth from bottom timeline bar
  const computedRows = activeCorridor.anomalyRows.map((row) => {
    const val = Math.min(0.95, Math.max(0.02, row.baseVal * temporalModifier));
    const areaHa = Math.max(12, Math.round(row.baseAreaHa * temporalModifier));
    const colorClass = row.tone === "emerald" ? "bg-[#22b567]" : row.tone === "amber" ? "bg-[#f39223]" : "bg-[#e94235]";
    return {
      label: row.label,
      valStr: formatComma(val, 3),
      distStr: `${areaHa.toLocaleString("en-US")} ha`,
      pctStr: `${row.pct} %`,
      widthStr: `${row.pct}%`,
      colorClass,
    };
  });

  // Compute live 10-band reflectance points for Slide 2
  const bandLabels = ["B02", "B03", "B04", "B05", "B06", "B07", "B08", "B8A", "B11", "B12"];
  const xCoords = [36, 66, 96, 126, 156, 186, 216, 246, 276, 304];
  const baselinePoints = activeCorridor.spectralBands2018
    .map((v, i) => {
      const x = xCoords[i] ?? 36;
      const y = Math.round(155 - v * 240);
      return `${x},${y}`;
    })
    .join(" ");

  const activePointsList = activeCorridor.spectralBands2024.map((v, i) => {
    const x = xCoords[i] ?? 36;
    const modV = Math.min(0.58, v * (0.85 + temporalModifier * 0.15));
    const y = Math.round(155 - modV * 240);
    return { band: bandLabels[i] ?? "B02", x, y };
  });
  const activePoints = activePointsList.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <StudioShell>
      <div className="relative h-full w-full overflow-hidden">
        {/* Real GPU-Accelerated MapLibre Satellite Map with Multi-Spectral Diagnostic Overlays */}
        <MapCanvas
          yearT1={2018}
          yearT2={activeYear}
          polygon={activeCorridor.polygon}
          isDrawing={false}
          onDrawingChange={() => {}}
          onPolygonChange={() => {}}
          center={corridorCenter}
          zoom={12.5}
          compareMode={viewMode === "compare" || currentEffect.id === "split"}
          effectRasterUrl={getRasterUrl(currentEffect.id)}
          effectBbox={activeCorridor.bbox}
          showEffectOverlay={viewMode === "diagnostic" && currentEffect.id !== "split"}
          effectOpacity={0.85}
          zoomActionsRef={zoomActionsRef}
          showDefaultZoomControls={false}
        />

        {/* Top-left dark pill zoom controls + subtle coordinate grid numbers + bottom-left effect switcher */}
        <MapCanvasOverlay
          onZoomIn={() => zoomActionsRef.current?.zoomIn()}
          onZoomOut={() => zoomActionsRef.current?.zoomOut()}
          activeEffectLabel={`${currentEffect.label} · ${activeMonth} ${activeYear}`}
          onCycleEffect={handleCycleEffect}
          viewMode={viewMode}
          onSelectViewMode={setViewMode}
        />

        {/* Re-open button if card was collapsed */}
        {cardCollapsed ? (
          <button
            type="button"
            onClick={() => setCardCollapsed(false)}
            className="absolute top-12 right-14 cursor-pointer rounded-2xl bg-white px-4 py-2.5 text-[13px] font-semibold text-[#1c1f23] shadow-[0_12px_36px_rgba(0,0,0,0.14)] transition-colors hover:bg-[#f8f9fb]"
          >
            {activeCorridor.name}
          </button>
        ) : (
          /* Floating White Card (Exact Golf Field proportion, spacing & footer arrows) */
          <div className="absolute top-12 right-14 w-[380px] rounded-[22px] bg-white p-7 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={handleCycleCorridor}
                title="Click to cycle observation corridor"
                className="group cursor-pointer text-left"
              >
                <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-[#1c1f23] transition-opacity group-hover:opacity-75">
                  {activeCorridor.name}
                </h2>
              </button>
              <button
                type="button"
                onClick={() => setCardCollapsed(true)}
                aria-label="Minimize card"
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
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </svg>
              </button>
            </div>

            {cardSlide === 0 ? (
              <>
                <div className="mb-5 flex items-center justify-between text-[13px] font-medium text-[#3b4048]">
                  <span>Anomaly</span>
                  <button
                    type="button"
                    onClick={handleCycleEffect}
                    className="cursor-pointer text-[11.5px] text-[#8c929c] transition-colors hover:text-[#1c1f23]"
                  >
                    {activeMonth} {activeYear}
                  </button>
                </div>

                <div className="space-y-4">
                  {computedRows.map((row, idx) => (
                    <div key={idx} title={row.label}>
                      <div className="mb-2 flex items-center justify-between text-[12.5px]">
                        <span className="font-semibold text-[#1c1f23] tabular-nums">{row.valStr}</span>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="font-medium text-[#3b4048]">{row.distStr}</span>
                          <span className="w-9 text-right text-[#9aa0aa]">{row.pctStr}</span>
                        </div>
                      </div>
                      <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#edeff2]">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${row.colorClass}`}
                          style={{ width: row.widthStr }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="mb-4 text-[13px] font-medium text-[#3b4048]">
                  10-Band Reflectance Profile (2018 vs {activeYear})
                </div>
                <svg viewBox="0 0 320 175" className="h-[185px] w-full">
                  {[30, 75, 120, 155].map((y) => (
                    <line key={y} x1="28" y1={y} x2="310" y2={y} stroke="#f0f2f5" strokeWidth="1" />
                  ))}
                  <text x="2" y="34" fill="#9aa0aa" fontSize="9">
                    0,45
                  </text>
                  <text x="2" y="79" fill="#9aa0aa" fontSize="9">
                    0,30
                  </text>
                  <text x="2" y="124" fill="#9aa0aa" fontSize="9">
                    0,15
                  </text>
                  <polyline
                    fill="none"
                    stroke="#c5cad3"
                    strokeWidth="2"
                    strokeDasharray="3 3"
                    points={baselinePoints}
                  />
                  <polyline fill="none" stroke="#22b567" strokeWidth="2.5" points={activePoints} />
                  {activePointsList.map((pt) => (
                    <g key={pt.band}>
                      <circle cx={pt.x} cy={pt.y} r="3" fill="#22b567" />
                      <text x={pt.x} y="170" textAnchor="middle" fill="#8c929c" fontSize="8.5">
                        {pt.band}
                      </text>
                    </g>
                  ))}
                </svg>
              </>
            )}

            {/* Bottom Card Carousel Footer (Exact Left Arrow + Dots + Right Arrow) */}
            <div className="mt-7 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCardSlide(0)}
                aria-label="Previous slide"
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
                aria-label="Next slide"
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
        )}
      </div>
    </StudioShell>
  );
}
