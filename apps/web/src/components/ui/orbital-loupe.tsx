"use client";

import { useState, useRef, useCallback, type PointerEvent, type KeyboardEvent } from "react";

interface OrbitalLoupeProps {
  baseImage: string;
  overlayImage: string;
  baseLabel: string;
  overlayLabel: string;
  telemetryTag?: string | undefined;
  defaultMode?: "loupe" | "curtain" | undefined;
  accentColor?: "amber" | "phosphor" | "cyan" | undefined;
}

export function OrbitalLoupe({
  baseImage,
  overlayImage,
  baseLabel,
  overlayLabel,
  telemetryTag,
  defaultMode = "curtain",
}: OrbitalLoupeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loupe" | "curtain">(defaultMode);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setPos({ x, y });
  }, []);

  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setPos((p) => ({ ...p, x: Math.max(0, p.x - 5) }));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setPos((p) => ({ ...p, x: Math.min(100, p.x + 5) }));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPos((p) => ({ ...p, y: Math.max(0, p.y - 5) }));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setPos((p) => ({ ...p, y: Math.min(100, p.y + 5) }));
    }
  }, []);

  const ringStroke = "#38BDF8";

  return (
    <div className="orbital-panel flex flex-col gap-3 rounded-lg p-3.5">
      <div className="border-bone-100/10 flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
        <div className="flex items-center gap-2 text-xs">
          <span className="bg-ink-950 text-bone-300 border-bone-100/10 rounded border px-2 py-0.5 font-mono text-[11px] font-medium">
            {baseLabel}
          </span>
          <span className="text-bone-400 font-mono">vs</span>
          <span className="bg-signal-400/12 text-signal-400 border-signal-400/30 rounded border px-2 py-0.5 font-mono text-[11px] font-semibold">
            {overlayLabel}
          </span>
          {telemetryTag ? (
            <span className="text-bone-400 ms-1 hidden font-mono text-[10px] sm:inline">[{telemetryTag}]</span>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-bone-400 hidden font-mono text-[10px] tabular-nums sm:inline">
            {pos.x.toFixed(0)}% / {pos.y.toFixed(0)}%
          </span>
          <div className="bg-ink-950 border-bone-100/12 flex items-center rounded-md border p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setMode("curtain")}
              className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                mode === "curtain" ? "bg-signal-400 text-ink-950 font-semibold" : "text-bone-300 hover:text-bone-100"
              }`}
            >
              Curtain
            </button>
            <button
              type="button"
              onClick={() => setMode("loupe")}
              className={`rounded px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                mode === "loupe" ? "bg-signal-400 text-ink-950 font-semibold" : "text-bone-300 hover:text-bone-100"
              }`}
            >
              Aperture
            </button>
          </div>
        </div>
      </div>

      <div
        ref={containerRef}
        tabIndex={0}
        role="slider"
        aria-label={`Optical comparator between ${baseLabel} and ${overlayLabel}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pos.x)}
        onPointerMove={handlePointerMove}
        onKeyDown={handleKeyDown}
        className="border-bone-100/15 bg-ink-950 focus-visible:ring-signal-400 relative aspect-square w-full cursor-crosshair touch-none overflow-hidden rounded-md border select-none focus-visible:ring-2"
      >
        <img
          src={baseImage}
          alt={baseLabel}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        <img
          src={overlayImage}
          alt={overlayLabel}
          style={{
            clipPath:
              mode === "loupe"
                ? `circle(24% at ${pos.x}% ${pos.y}%)`
                : `polygon(${pos.x}% 0%, 100% 0%, 100% 100%, ${pos.x}% 100%)`,
          }}
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
        />

        {/* Corner Photogrammetric Fiducial Marks */}
        <span className="border-bone-100/50 pointer-events-none absolute top-2 left-2 size-2.5 border-t border-l" />
        <span className="border-bone-100/50 pointer-events-none absolute top-2 right-2 size-2.5 border-t border-r" />
        <span className="border-bone-100/50 pointer-events-none absolute bottom-2 left-2 size-2.5 border-b border-l" />
        <span className="border-bone-100/50 pointer-events-none absolute right-2 bottom-2 size-2.5 border-r border-b" />

        {/* Epoch Corner Watermarks */}
        <span className="bg-ink-950/85 text-bone-300 border-bone-100/15 pointer-events-none absolute bottom-2.5 left-3 rounded border px-1.5 py-0.5 font-mono text-[10px]">
          {baseLabel}
        </span>
        <span className="bg-ink-950/85 text-signal-400 border-signal-400/30 pointer-events-none absolute right-3 bottom-2.5 rounded border px-1.5 py-0.5 font-mono text-[10px]">
          {overlayLabel}
        </span>

        {mode === "loupe" ? (
          <div
            aria-hidden="true"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: "48%",
              height: "48%",
              borderColor: ringStroke,
            }}
            className="border-signal-400 pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border shadow-[0_0_0_1px_rgba(7,10,15,0.8)]"
          >
            <span className="bg-signal-400 absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" />
          </div>
        ) : (
          <div
            aria-hidden="true"
            style={{ left: `${pos.x}%`, backgroundColor: ringStroke }}
            className="pointer-events-none absolute inset-y-0 w-px -translate-x-1/2"
          >
            <div
              style={{ borderColor: ringStroke }}
              className="bg-ink-950 text-signal-400 absolute top-1/2 left-1/2 flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded border shadow-lg"
            >
              <svg className="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                <path d="m9 18-6-6 6-6" />
                <path d="m15 6 6 6-6 6" />
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
