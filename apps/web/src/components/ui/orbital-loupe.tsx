"use client";

import { useState, useRef, useCallback, type PointerEvent } from "react";

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

  const ringStroke = "#38BDF8";

  return (
    <div className="orbital-panel rounded-xl p-3.5 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-bone-100">
          {baseLabel} <span className="text-bone-400">→</span> {overlayLabel}
        </span>

        <div className="flex items-center rounded-lg bg-ink-950 border border-bone-100/10 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("curtain")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mode === "curtain"
                ? "bg-signal-400 text-ink-950 font-semibold"
                : "text-bone-300 hover:text-bone-100"
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() => setMode("loupe")}
            className={`px-2.5 py-1 rounded-md transition-colors ${
              mode === "loupe"
                ? "bg-signal-400 text-ink-950 font-semibold"
                : "text-bone-300 hover:text-bone-100"
            }`}
          >
            Loupe
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        className="relative aspect-square w-full overflow-hidden rounded-lg border border-bone-100/10 bg-ink-950 cursor-ew-resize select-none touch-none"
      >
        <img
          src={baseImage}
          alt={baseLabel}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
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
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

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
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2"
          />
        ) : (
          <div
            aria-hidden="true"
            style={{ left: `${pos.x}%`, backgroundColor: ringStroke }}
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2"
          >
            <div
              style={{ borderColor: ringStroke }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full border bg-ink-950 text-bone-100 shadow-lg"
            >
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
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
