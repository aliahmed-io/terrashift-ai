"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { MapCanvas } from "@/components/map/map-canvas";
import { LocationSearch } from "@/components/search/location-search";
import { RegionOverlay } from "@/components/region-overlay";
import { SceneCanvas } from "@/components/scene-canvas";
import { PRESETS, type AoiPreset } from "@/lib/geo";
import { getScene } from "@/lib/scene";
import { motion as motionTokens } from "@/tokens";
import type { GeocodeLocation } from "@/app/api/geocode/route";

type Phase = "idle" | "running" | "done" | "error";
type ViewMode = "map" | "swipe";

const STEPS = [
  "Querying Element84 AWS Earth Search STAC",
  "SCL / QA60 cloud & shadow gating",
  "Computing 5-channel NDVI/NDBI tensor",
  "Executing Siamese U-Net inference",
  "Vectorising polygons & computing metric area",
] as const;

const FIELD =
  "w-full rounded-lg border border-bone-100/15 bg-ink-900 px-4 py-3 font-mono text-sm text-bone-100 transition-colors focus:border-signal-400";

interface ChangeFeature {
  type: "Feature";
  geometry: { type: "Polygon"; coordinates: number[][][] };
  properties: {
    id: number;
    class: string;
    label: string;
    area_m2: number;
    confidence: number;
    ndvi_delta?: number;
    ndbi_delta?: number;
  };
}

interface AnalysisResult {
  type: "FeatureCollection";
  metadata: {
    bbox: [number, number, number, number];
    date_t1: string;
    date_t2: string;
    total_changed_km2: number;
    total_changed_m2: number;
    polygon_count: number;
    provenance: string;
  };
  features: ChangeFeature[];
  cloud_fraction_t1: number;
  cloud_fraction_t2: number;
  provenance: string;
}

function SwipeCompare({
  seed,
  dateT1,
  dateT2,
  showChange,
}: {
  seed: number;
  dateT1: string;
  dateT2: string;
  showChange: boolean;
}) {
  const scene = getScene(seed);
  const frame = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const dragging = useRef(false);

  const move = useCallback((clientX: number) => {
    const el = frame.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos(Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)));
  }, []);

  const onDown = (e: PointerEvent<HTMLDivElement>): void => {
    dragging.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    move(e.clientX);
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    const step = e.shiftKey ? 10 : 2;
    if (e.key === "ArrowLeft") setPos((p) => Math.max(0, p - step));
    else if (e.key === "ArrowRight") setPos((p) => Math.min(100, p + step));
    else if (e.key === "Home") setPos(0);
    else if (e.key === "End") setPos(100);
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={frame}
      dir="ltr"
      className="relative aspect-[8/5] w-full max-w-[calc((100dvh-14rem)*1.6)] touch-none overflow-hidden rounded-2xl border border-bone-100/10 bg-ink-900 select-none"
      onPointerDown={onDown}
      onPointerMove={(e) => {
        if (dragging.current) move(e.clientX);
      }}
      onPointerUp={() => {
        dragging.current = false;
      }}
    >
      <SceneCanvas scene={scene} mode="before" className="absolute inset-0 size-full object-cover" />
      <div className="absolute inset-0" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
        <SceneCanvas scene={scene} mode="after" className="absolute inset-0 size-full object-cover" />
        {showChange ? <RegionOverlay scene={scene} fill className="absolute inset-0 size-full" /> : null}
      </div>
      <span className="pointer-events-none absolute start-4 top-4 rounded bg-ink-950/70 px-2 py-1 font-mono text-[11px] tracking-widest uppercase backdrop-blur">
        T₁ · {dateT1}
      </span>
      <span className="pointer-events-none absolute end-4 top-4 rounded bg-ink-950/70 px-2 py-1 font-mono text-[11px] tracking-widest uppercase backdrop-blur">
        T₂ · {dateT2}
      </span>
      <div
        role="slider"
        tabIndex={0}
        aria-label="Compare T1 and T2 imagery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos)}
        onKeyDown={onKey}
        className="absolute inset-y-0 w-8 -translate-x-1/2 cursor-ew-resize"
        style={{ left: `${pos}%` }}
      >
        <span className="absolute inset-y-0 start-1/2 w-px bg-signal-400 shadow-[0_0_20px_3px_rgba(255,176,32,0.5)]" />
        <span className="absolute start-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-signal-400 bg-ink-950/80 font-mono text-xs text-signal-400 backdrop-blur">
          ⇄
        </span>
      </div>
    </div>
  );
}

export function AnalyzeClient() {
  const uid = useId();
  const [viewMode, setViewMode] = useState<ViewMode>("map");
  const [preset, setPreset] = useState<AoiPreset>(PRESETS[0] ?? { id: "", name: "", region: "", seed: 7, bbox: [0, 0, 0, 0] });
  const [currentBbox, setCurrentBbox] = useState<[number, number, number, number]>([
    PRESETS[0]?.bbox[0] ?? -63.2,
    PRESETS[0]?.bbox[1] ?? -9.9,
    PRESETS[0]?.bbox[2] ?? -63.12,
    PRESETS[0]?.bbox[3] ?? -9.84,
  ]);
  const [dateT1, setDateT1] = useState("2024-06-14");
  const [dateT2, setDateT2] = useState("2025-01-22");
  const [showChange, setShowChange] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [selectedPolygonId, setSelectedPolygonId] = useState<number | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const done = phase === "done" && analysisResult !== null;

  const handleSelectLocation = (loc: GeocodeLocation) => {
    setCurrentBbox(loc.bbox);
    setPhase("idle");
    setAnalysisResult(null);
  };

  const run = async (): Promise<void> => {
    setPhase("running");
    setStep(0);
    setMessage("");
    setAnalysisResult(null);

    const ticker = window.setInterval(() => {
      setStep((s) => Math.min(STEPS.length - 1, s + 1));
    }, 650);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bbox: currentBbox,
          dateT1,
          dateT2,
        }),
      });

      await new Promise((r) => window.setTimeout(r, STEPS.length * 600));

      if (!res.ok) {
        if (res.status === 429) {
          setMessage("Rate limit exceeded. Please wait a moment and retry.");
        } else if (res.status === 422) {
          const errData = await res.json().catch(() => ({}));
          setMessage(errData.detail || "Validation error: Check that T1 precedes T2 and AOI is <= 100 km².");
        } else {
          setMessage("Unable to process satellite imagery for requested window.");
        }
        setPhase("error");
        return;
      }

      const data = (await res.json()) as AnalysisResult;
      setAnalysisResult(data);
      setPhase("done");
    } catch {
      setMessage("Network communication failure. Please check connection and retry.");
      setPhase("error");
    } finally {
      window.clearInterval(ticker);
    }
  };

  const downloadGeoJson = (): void => {
    if (!analysisResult) return;
    const blob = new Blob([JSON.stringify(analysisResult, null, 2)], { type: "application/geo+json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrashift-audit-${dateT1}-to-${dateT2}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadPdfReport = async (): Promise<void> => {
    if (!analysisResult) return;
    setDownloadingPdf(true);
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metadata: analysisResult.metadata,
          features: analysisResult.features,
        }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `terrashift-executive-audit-${dateT1}-to-${dateT2}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("Unable to generate PDF report from server. Please retry.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="grid h-dvh grid-rows-[auto_1fr] bg-ink-950">
      {/* Top Navbar */}
      <header className="flex items-center justify-between border-b border-bone-100/10 px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-mono text-xs tracking-[0.24em] uppercase">
          <span className="text-signal-400">←</span> TerraShift
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex rounded-full border border-bone-100/15 p-0.5 bg-ink-900 font-mono text-[11px] uppercase">
            <button
              type="button"
              onClick={() => setViewMode("map")}
              className={`rounded-full px-3 py-1 transition-colors ${
                viewMode === "map" ? "bg-signal-400 text-ink-950 font-semibold" : "text-bone-300 hover:text-bone-100"
              }`}
            >
              Interactive GIS Map
            </button>
            <button
              type="button"
              onClick={() => setViewMode("swipe")}
              className={`rounded-full px-3 py-1 transition-colors ${
                viewMode === "swipe" ? "bg-signal-400 text-ink-950 font-semibold" : "text-bone-300 hover:text-bone-100"
              }`}
            >
              Bi-Temporal Swipe
            </button>
          </div>
          <span className="hidden font-mono text-[10px] tracking-widest text-ink-400 uppercase sm:inline">
            Zero-Key Open Geospatial Engine
          </span>
        </div>
      </header>

      {/* Main 3-Column Studio */}
      <div className="grid min-h-0 gap-px overflow-y-auto bg-bone-100/10 lg:grid-cols-[340px_1fr_360px] lg:overflow-hidden">
        {/* Left Column: Acquisition & Controls */}
        <aside className="space-y-6 bg-ink-950 p-6 lg:overflow-y-auto" aria-label="Controls">
          <div>
            <label className="mb-2 block font-mono text-[11px] tracking-widest text-signal-400 uppercase">
              Global Location Search
            </label>
            <LocationSearch onSelectLocation={handleSelectLocation} />
          </div>

          <fieldset>
            <legend className="mb-3 font-mono text-[11px] tracking-widest text-bone-300 uppercase">
              Curated Sentinel-2 Presets
            </legend>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-colors ${
                    preset.id === p.id && currentBbox[0] === p.bbox[0]
                      ? "border-signal-400 bg-signal-400/10"
                      : "border-bone-100/10 hover:border-bone-100/30"
                  }`}
                >
                  <span>
                    <span className="block text-xs font-medium">{p.name}</span>
                    <span className="font-mono text-[10px] text-ink-400">{p.region}</span>
                  </span>
                  <input
                    type="radio"
                    name={`${uid}-aoi`}
                    className="size-3.5 accent-signal-400"
                    checked={preset.id === p.id && currentBbox[0] === p.bbox[0]}
                    onChange={() => {
                      setPreset(p);
                      setCurrentBbox([p.bbox[0], p.bbox[1], p.bbox[2], p.bbox[3]]);
                      setPhase("idle");
                      setAnalysisResult(null);
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-t1`} className="mb-1.5 block font-mono text-[10px] tracking-widest text-ink-400 uppercase">
                Date T₁ (Baseline)
              </label>
              <input id={`${uid}-t1`} type="date" value={dateT1} onChange={(e) => setDateT1(e.target.value)} className={FIELD} />
            </div>
            <div>
              <label htmlFor={`${uid}-t2`} className="mb-1.5 block font-mono text-[10px] tracking-widest text-ink-400 uppercase">
                Date T₂ (Comparison)
              </label>
              <input id={`${uid}-t2`} type="date" value={dateT2} onChange={(e) => setDateT2(e.target.value)} className={FIELD} />
            </div>
          </div>

          <button
            type="button"
            onClick={() => void run()}
            disabled={phase === "running"}
            className="w-full rounded-full bg-signal-400 px-6 py-4 font-mono text-xs tracking-widest text-ink-950 uppercase transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-wait disabled:opacity-60 font-semibold"
          >
            {phase === "running" ? "Running STAC & Siamese Model…" : done ? "Re-run Analysis" : "Run Change Analysis"}
          </button>

          {/* Staged pipeline feedback */}
          <ol aria-live="polite" className="space-y-1.5 font-mono text-[11px] tracking-wide">
            {STEPS.map((label, i) => {
              const state =
                phase === "done" || (phase === "running" && i < step)
                  ? "done"
                  : phase === "running" && i === step
                    ? "active"
                    : "wait";
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 ${
                    state === "wait" ? "text-ink-400" : state === "active" ? "text-signal-400" : "text-lagoon-400"
                  }`}
                >
                  <span>{state === "done" ? "✓" : state === "active" ? "›" : "·"}</span>
                  <span className="truncate">{label}</span>
                </li>
              );
            })}
          </ol>

          {phase === "error" && (
            <p role="alert" className="rounded-lg border border-[#FF5240]/50 bg-[#FF5240]/10 p-3 text-xs text-[#FF8A7A]">
              {message}
            </p>
          )}
        </aside>

        {/* Center Column: GIS Viewer */}
        <main className="relative flex size-full items-center justify-center bg-ink-950 p-4">
          {viewMode === "map" ? (
            <MapCanvas
              bbox={currentBbox}
              features={analysisResult ? analysisResult.features : []}
              onBboxChange={(b) => {
                setCurrentBbox(b);
                setPhase("idle");
                setAnalysisResult(null);
              }}
              onSelectPolygon={(id) => setSelectedPolygonId(id)}
              selectedPolygonId={selectedPolygonId}
            />
          ) : (
            <SwipeCompare seed={preset.seed} dateT1={dateT1} dateT2={dateT2} showChange={showChange && done} />
          )}
        </main>

        {/* Right Column: Quantitative Quantification & Audit Report */}
        <aside className="space-y-6 bg-ink-950 p-6 lg:overflow-y-auto" aria-label="Results">
          <p className="font-mono text-[11px] tracking-widest text-signal-400 uppercase">Quantification & Audit</p>

          {done && analysisResult ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.base, ease: motionTokens.easeOutExpo }}
              className="space-y-6"
            >
              <div>
                <p className="font-display text-6xl leading-none">
                  {analysisResult.metadata.total_changed_km2.toFixed(3)}
                  <span className="ms-2 text-xl text-ink-400">km²</span>
                </p>
                <p className="mt-1 font-mono text-xs text-bone-300">
                  {analysisResult.metadata.total_changed_m2.toLocaleString()} m² confirmed physical ground shift
                </p>
              </div>

              {/* Polygon Inventory */}
              <div>
                <h3 className="mb-2 font-mono text-[10px] tracking-widest uppercase text-ink-400">
                  Detected Polygons ({analysisResult.features.length})
                </h3>
                <ul className="max-h-56 divide-y divide-bone-100/10 overflow-y-auto rounded-lg border border-bone-100/10 bg-ink-900/40 p-1">
                  {analysisResult.features.map((f) => (
                    <li
                      key={f.properties.id}
                      onClick={() => setSelectedPolygonId(f.properties.id)}
                      className={`flex cursor-pointer items-center justify-between p-2.5 text-xs rounded transition-colors ${
                        selectedPolygonId === f.properties.id
                          ? "bg-signal-400/20 text-signal-400"
                          : "hover:bg-ink-800"
                      }`}
                    >
                      <span>
                        <span className="me-2 font-mono text-[10px] text-signal-400">#{f.properties.id}</span>
                        {f.properties.label}
                      </span>
                      <span className="text-end font-mono text-[11px]">
                        {(f.properties.area_m2 / 10000.0).toFixed(2)} ha
                        <span className="block text-[10px] text-ink-400">
                          {Math.round(f.properties.confidence * 100)}% conf
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Data Provenance & Cloud Specs */}
              <dl className="space-y-1.5 rounded-lg border border-bone-100/10 bg-ink-900/60 p-3 font-mono text-[10px] text-ink-400">
                <div className="flex justify-between">
                  <dt>Cloud T₁ / T₂:</dt>
                  <dd className="text-bone-100">{analysisResult.cloud_fraction_t1}% / {analysisResult.cloud_fraction_t2}% (Passed)</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Data Provider:</dt>
                  <dd className="text-bone-100">Copernicus Sentinel-2 L2A</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Engine:</dt>
                  <dd className="text-signal-400 truncate max-w-[170px]">{analysisResult.provenance}</dd>
                </div>
              </dl>

              {/* Export Buttons */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={downloadPdfReport}
                  disabled={downloadingPdf}
                  className="w-full rounded-full border border-signal-400 bg-signal-400/10 px-4 py-3 font-mono text-xs tracking-wider text-signal-400 uppercase transition-colors hover:bg-signal-400 hover:text-ink-950 disabled:opacity-50"
                >
                  {downloadingPdf ? "Generating PDF…" : "Download Audit Report (PDF)"}
                </button>

                <button
                  type="button"
                  onClick={downloadGeoJson}
                  className="w-full rounded-full border border-bone-100/20 px-4 py-3 font-mono text-xs tracking-wider uppercase transition-colors hover:border-bone-100 hover:text-bone-100"
                >
                  Download GeoJSON (RFC 7946)
                </button>
              </div>
            </motion.div>
          ) : (
            <div className="rounded-lg border border-bone-100/10 bg-ink-900/40 p-4 text-xs leading-relaxed text-bone-300">
              <p className="mb-2 font-medium text-bone-100">Ready for Global Analysis</p>
              <p>
                1. Search any coordinates globally or choose a preset.
                <br />
                2. Use the <strong className="text-signal-400">Draw custom AOI</strong> tool to bound your area.
                <br />
                3. Click <strong className="text-signal-400">Run Change Analysis</strong> to trigger the Sentinel-2 STAC
                cloud-filtered Siamese pipeline.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
