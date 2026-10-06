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
  telemetryTag = "10m GSD · MSI",
  defaultMode = "loupe",
  accentColor = "amber",
}: OrbitalLoupeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<"loupe" | "curtain">(defaultMode);
  const [scanning, setScanning] = useState<boolean>(true);
  const [hovering, setHovering] = useState<boolean>(false);
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 52, y: 48 });

  const handlePointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100));
    const y = Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100));
    setPos({ x, y });
  }, []);

  const ringStroke =
    accentColor === "phosphor"
      ? "#00F5A0"
      : accentColor === "cyan"
        ? "#38E8FF"
        : "#FFB020";

  const pxX = Math.round((pos.x / 100) * 256);
  const pxY = Math.round((pos.y / 100) * 256);

  return (
    <div className="orbital-panel rounded-xl p-3.5 flex flex-col gap-3">
      {/* Instrument Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: ringStroke, boxShadow: `0 0 10px ${ringStroke}` }}
          />
          <span className="font-mono text-[11px] tracking-wider uppercase text-bone-100 font-medium">
            {baseLabel} <span className="text-bone-400">⇄</span> {overlayLabel}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="hidden sm:inline-block px-2 py-0.5 rounded bg-ink-950/90 border border-bone-100/10 font-mono text-[10px] text-bone-300 tabular-nums">
            {telemetryTag}
          </span>
          <div className="flex items-center rounded-lg bg-ink-950/90 border border-bone-100/10 p-0.5 font-mono text-[10px]">
            <button
              type="button"
              onClick={() => setMode("loupe")}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === "loupe"
                  ? "bg-signal-400 text-ink-950 font-semibold"
                  : "text-bone-300 hover:text-bone-100"
              }`}
            >
              X-Ray Loupe
            </button>
            <button
              type="button"
              onClick={() => setMode("curtain")}
              className={`px-2 py-0.5 rounded transition-colors ${
                mode === "curtain"
                  ? "bg-signal-400 text-ink-950 font-semibold"
                  : "text-bone-300 hover:text-bone-100"
              }`}
            >
              Split Curtain
            </button>
            <button
              type="button"
              onClick={() => setScanning((s) => !s)}
              className={`px-2 py-0.5 rounded transition-colors ${
                scanning ? "text-phosphor-400" : "text-bone-400 hover:text-bone-200"
              }`}
              title="Toggle orbital laser scan sweep"
            >
              Scan
            </button>
          </div>
        </div>
      </div>

      {/* Interactive Optical / X-Ray Viewport */}
      <div
        ref={containerRef}
        onPointerEnter={() => setHovering(true)}
        onPointerLeave={() => setHovering(false)}
        onPointerMove={handlePointerMove}
        className="relative aspect-square w-full overflow-hidden rounded-lg border border-bone-100/15 bg-ink-950 cursor-crosshair select-none touch-none"
      >
        {/* Base Layer */}
        <img
          src={baseImage}
          alt={baseLabel}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
        />

        {/* Overlay Layer (Clipped by X-Ray Loupe Circle or Split Curtain) */}
        <img
          src={overlayImage}
          alt={overlayLabel}
          style={{
            clipPath:
              mode === "loupe"
                ? `circle(${hovering ? "28%" : "22%"} at ${pos.x}% ${pos.y}%)`
                : `inset(0 ${100 - pos.x}% 0 0)`,
          }}
          className="absolute inset-0 h-full w-full object-cover pointer-events-none transition-[clip-path] duration-75"
        />

        {/* Laser Scan Sweep Beam */}
        {scanning && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-14 animate-orbital-scan"
            style={{
              background: `linear-gradient(180deg, transparent 0%, ${ringStroke}22 85%, ${ringStroke}88 100%)`,
              borderBottom: `1px solid ${ringStroke}`,
            }}
          />
        )}

        {/* Corner Reticle Ticks */}
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 h-full w-full text-bone-100/35"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <path d="M 3 9 L 3 3 L 9 3" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <path d="M 91 3 L 97 3 L 97 9" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <path d="M 3 91 L 3 97 L 9 97" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <path d="M 91 97 L 97 97 L 97 91" fill="none" stroke="currentColor" strokeWidth="0.6" />
        </svg>

        {/* Mode 1: X-Ray Loupe Reticle Ring */}
        {mode === "loupe" ? (
          <div
            aria-hidden="true"
            style={{
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              width: hovering ? "56%" : "44%",
              height: hovering ? "56%" : "44%",
              borderColor: ringStroke,
              boxShadow: `0 0 24px -4px ${ringStroke}66, inset 0 0 18px -4px ${ringStroke}44`,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-[width,height] duration-150"
          >
            {/* Crosshair ticks on the loupe ring */}
            <span
              className="absolute left-1/2 -top-1.5 h-2.5 w-0.5 -translate-x-1/2"
              style={{ backgroundColor: ringStroke }}
            />
            <span
              className="absolute left-1/2 -bottom-1.5 h-2.5 w-0.5 -translate-x-1/2"
              style={{ backgroundColor: ringStroke }}
            />
            <span
              className="absolute top-1/2 -left-1.5 h-0.5 w-2.5 -translate-y-1/2"
              style={{ backgroundColor: ringStroke }}
            />
            <span
              className="absolute top-1/2 -right-1.5 h-0.5 w-2.5 -translate-y-1/2"
              style={{ backgroundColor: ringStroke }}
            />
            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-ink-950/90 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider text-bone-100 border border-bone-100/15">
              {overlayLabel}
            </span>
          </div>
        ) : (
          /* Mode 2: Split Curtain Divider Line */
          <div
            aria-hidden="true"
            style={{ left: `${pos.x}%`, backgroundColor: ringStroke }}
            className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 shadow-[0_0_12px_#FFB020]"
          >
            <div
              style={{ borderColor: ringStroke }}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex size-7 items-center justify-center rounded-full border bg-ink-950/90 text-bone-100 shadow-lg"
            >
              <svg className="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18-6-6 6-6" />
                <path d="m15 6 6 6-6 6" />
              </svg>
            </div>
          </div>
        )}

        {/* Bottom Telemetry Coordinate Readout HUD */}
        <div className="pointer-events-none absolute inset-x-2.5 bottom-2.5 flex items-center justify-between rounded-md bg-ink-950/85 px-2.5 py-1 font-mono text-[10px] text-bone-200 backdrop-blur-md border border-bone-100/10 tabular-nums">
          <span>Base: {baseLabel}</span>
          <span className="text-signal-400">
            PX [{String(pxX).padStart(3, "0")}, {String(pxY).padStart(3, "0")}]
          </span>
        </div>
      </div>
    </div>
  );
}
