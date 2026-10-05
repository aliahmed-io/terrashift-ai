"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useCallback, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { RegionOverlay } from "@/components/region-overlay";
import { SceneCanvas } from "@/components/scene-canvas";
import { PRESETS, toGeoJson, type AoiPreset } from "@/lib/geo";
import { getScene } from "@/lib/scene";
import { motion as motionTokens } from "@/tokens";

type Phase = "idle" | "running" | "done" | "error";

const STEPS = [
  "Searching Sentinel-2 scenes",
  "Compositing & cloud gating",
  "Computing NDVI / NDBI stack",
  "Siamese U-Net inference",
  "Vectorising polygons",
] as const;

const FIELD =
  "w-full rounded-lg border border-bone-100/15 bg-ink-900 px-4 py-3 font-mono text-sm text-bone-100 transition-colors focus:border-signal-400";

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
      className="border-bone-100/10 bg-ink-900 relative aspect-[8/5] w-full max-w-[calc((100dvh-14rem)*1.6)] touch-none overflow-hidden rounded-2xl border select-none"
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
      <span className="bg-ink-950/70 pointer-events-none absolute start-4 top-4 rounded px-2 py-1 font-mono text-[11px] tracking-widest uppercase backdrop-blur">
        T₁ · {dateT1}
      </span>
      <span className="bg-ink-950/70 pointer-events-none absolute end-4 top-4 rounded px-2 py-1 font-mono text-[11px] tracking-widest uppercase backdrop-blur">
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
        <span className="bg-signal-400 absolute inset-y-0 start-1/2 w-px shadow-[0_0_20px_3px_rgba(255,176,32,0.5)]" />
        <span className="border-signal-400 bg-ink-950/80 text-signal-400 absolute start-1/2 top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border font-mono text-xs backdrop-blur">
          ⇄
        </span>
      </div>
    </div>
  );
}

export function AnalyzeClient() {
  const uid = useId();
  const [preset, setPreset] = useState<AoiPreset>(
    PRESETS[0] ?? { id: "", name: "", region: "", seed: 7, bbox: [0, 0, 0, 0] },
  );
  const [dateT1, setDateT1] = useState("2024-06-14");
  const [dateT2, setDateT2] = useState("2025-01-22");
  const [showChange, setShowChange] = useState(true);
  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("");
  const [provenance, setProvenance] = useState("");

  const scene = getScene(preset.seed);
  const done = phase === "done";

  const run = async (): Promise<void> => {
    setPhase("running");
    setStep(0);
    setMessage("");
    const ticker = window.setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 650);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ presetId: preset.id, dateT1, dateT2 }),
      });
      await new Promise((r) => window.setTimeout(r, STEPS.length * 650));
      if (!res.ok) {
        setMessage(
          res.status === 429 ? "Too many requests. Try again in a minute." : "Check that T1 is earlier than T2.",
        );
        setPhase("error");
        return;
      }
      const data = (await res.json()) as { provenance: string };
      setProvenance(data.provenance);
      setPhase("done");
    } catch {
      setMessage("Network error. Please retry.");
      setPhase("error");
    } finally {
      window.clearInterval(ticker);
    }
  };

  const download = (): void => {
    const geo = toGeoJson(scene, preset, dateT1, dateT2, provenance);
    const url = URL.createObjectURL(new Blob([JSON.stringify(geo, null, 2)], { type: "application/geo+json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrashift-${preset.id}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-ink-950 grid h-dvh grid-rows-[auto_1fr]">
      <header className="border-bone-100/10 flex items-center justify-between border-b px-6 py-4">
        <Link href="/" className="font-mono text-xs tracking-[0.24em] uppercase">
          ← TerraShift
        </Link>
        <span className="text-ink-400 font-mono text-[11px] tracking-widest uppercase">Analysis console</span>
      </header>

      <div className="bg-bone-100/10 grid min-h-0 gap-px overflow-y-auto lg:grid-cols-[320px_1fr_340px] lg:overflow-hidden">
        <aside className="bg-ink-950 space-y-8 p-6 lg:overflow-y-auto" aria-label="Controls">
          <fieldset>
            <legend className="text-signal-400 mb-4 font-mono text-[11px] tracking-widest uppercase">
              Area of interest
            </legend>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <label
                  key={p.id}
                  className={`flex cursor-pointer items-center justify-between rounded-lg border px-4 py-3 transition-colors ${
                    preset.id === p.id
                      ? "border-signal-400 bg-signal-400/10"
                      : "border-bone-100/10 hover:border-bone-100/30"
                  }`}
                >
                  <span>
                    <span className="block text-sm">{p.name}</span>
                    <span className="text-ink-400 font-mono text-[11px]">{p.region}</span>
                  </span>
                  <input
                    type="radio"
                    name={`${uid}-aoi`}
                    className="accent-signal-400 size-4"
                    checked={preset.id === p.id}
                    onChange={() => {
                      setPreset(p);
                      setPhase("idle");
                    }}
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-4">
            <div>
              <label
                htmlFor={`${uid}-t1`}
                className="text-ink-400 mb-2 block font-mono text-[11px] tracking-widest uppercase"
              >
                Date T₁
              </label>
              <input
                id={`${uid}-t1`}
                type="date"
                value={dateT1}
                onChange={(e) => setDateT1(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label
                htmlFor={`${uid}-t2`}
                className="text-ink-400 mb-2 block font-mono text-[11px] tracking-widest uppercase"
              >
                Date T₂
              </label>
              <input
                id={`${uid}-t2`}
                type="date"
                value={dateT2}
                onChange={(e) => setDateT2(e.target.value)}
                className={FIELD}
              />
            </div>
          </div>

          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="accent-signal-400 size-4"
              checked={showChange}
              onChange={(e) => setShowChange(e.target.checked)}
            />
            Show change overlay
          </label>

          <button
            type="button"
            onClick={() => void run()}
            disabled={phase === "running"}
            className="bg-signal-400 text-ink-950 w-full rounded-full px-6 py-4 font-mono text-xs tracking-widest uppercase transition-transform hover:scale-[1.02] active:scale-95 disabled:cursor-wait disabled:opacity-60"
          >
            {phase === "running" ? "Analysing…" : done ? "Run again" : "Run analysis"}
          </button>

          <ol aria-live="polite" className="space-y-2 font-mono text-[11px] tracking-wide">
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
                  className={
                    state === "wait" ? "text-ink-400" : state === "active" ? "text-signal-400" : "text-lagoon-400"
                  }
                >
                  {state === "done" ? "✓" : state === "active" ? "›" : "·"} {label}
                </li>
              );
            })}
          </ol>
          {phase === "error" ? (
            <p role="alert" className="rounded-lg border border-[#FF5240]/50 p-4 text-sm text-[#FF8A7A]">
              {message}
            </p>
          ) : null}
        </aside>

        <main className="bg-ink-950 grid place-items-center p-6">
          <SwipeCompare seed={preset.seed} dateT1={dateT1} dateT2={dateT2} showChange={showChange && done} />
        </main>

        <aside className="bg-ink-950 space-y-8 p-6 lg:overflow-y-auto" aria-label="Results">
          <p className="text-signal-400 font-mono text-[11px] tracking-widest uppercase">Results</p>
          {done ? (
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: motionTokens.base, ease: motionTokens.easeOutExpo }}
              className="space-y-8"
            >
              <div>
                <p className="font-display text-7xl leading-none">
                  {(scene.changedM2 / 1e6).toFixed(2)}
                  <span className="text-ink-400 ms-2 text-2xl">km²</span>
                </p>
                <p className="text-bone-300 mt-2 text-sm">
                  {scene.changedPct.toFixed(1)}% of the area changed. A naive RGB diff would have flagged{" "}
                  {scene.naivePct.toFixed(0)}%.
                </p>
              </div>
              <ul className="divide-bone-100/10 border-bone-100/10 divide-y border-y">
                {scene.regions.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span>
                      <span className="text-signal-400 me-3 font-mono text-xs">{String(r.id).padStart(2, "0")}</span>
                      {r.label}
                    </span>
                    <span className="text-end font-mono text-xs">
                      {(r.areaM2 / 10_000).toFixed(1)} ha
                      <span className="text-ink-400 block">{Math.round(r.confidence * 100)}% conf.</span>
                    </span>
                  </li>
                ))}
              </ul>
              <dl className="text-ink-400 space-y-1 font-mono text-[11px]">
                <div className="flex justify-between">
                  <dt>Cloud T₁ / T₂</dt>
                  <dd>4% / 7%</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Provenance</dt>
                  <dd>{provenance}</dd>
                </div>
              </dl>
              <button
                type="button"
                onClick={download}
                className="border-bone-100/30 hover:border-signal-400 hover:text-signal-400 w-full rounded-full border px-6 py-4 font-mono text-xs tracking-widest uppercase transition-colors"
              >
                Download GeoJSON
              </button>
            </motion.div>
          ) : (
            <p className="text-bone-300 text-sm leading-relaxed">
              Pick an area and two dates, then run the analysis. Drag the handle on the map — or use the arrow keys — to
              compare dates.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}
