"use client";

import { useState } from "react";

export interface OrbitalSwathHudProps {
  readonly locationLabel: string;
  readonly year: number;
  readonly basemapSource: "s2" | "mapbox";
  readonly onToggleBasemap?: (() => void) | undefined;
  readonly onCyclePreset?: (() => void) | undefined;
  readonly onCycleYear?: (() => void) | undefined;
  readonly compact?: boolean | undefined;
}

const RESOLUTION_STEPS = [
  { arcsec: '38"', meters: "10.0m S2", mode: "s2" as const },
  { arcsec: '24"', meters: "1.5m SPOT", mode: "mapbox" as const },
  { arcsec: '19"', meters: "0.5m Aerial", mode: "mapbox" as const },
] as const;

export function OrbitalSwathHud({
  locationLabel,
  year,
  basemapSource,
  onToggleBasemap,
  onCyclePreset,
  onCycleYear,
  compact = false,
}: OrbitalSwathHudProps) {
  const [incidenceAngle, setIncidenceAngle] = useState<number>(32);
  const [resIndex, setResIndex] = useState<number>(basemapSource === "mapbox" ? 2 : 0);
  const [infoTip, setInfoTip] = useState<"angle" | "res" | null>(null);

  const activeRes = RESOLUTION_STEPS[resIndex] ?? RESOLUTION_STEPS[0];

  // Normalize incidence angle [14..45] to SVG geometry
  const ratio = (incidenceAngle - 14) / (45 - 14);
  const coneRightX = Math.round(52 + ratio * 58); // 52..110
  const tickX = Math.round(36 + ratio * 74); // 36..110

  const stepResolution = (dir: 1 | -1) => {
    const next = (resIndex + dir + RESOLUTION_STEPS.length) % RESOLUTION_STEPS.length;
    setResIndex(next);
    const targetMode = RESOLUTION_STEPS[next]?.mode ?? "s2";
    if (targetMode !== basemapSource && onToggleBasemap) {
      onToggleBasemap();
    }
  };

  return (
    <div className="pointer-events-auto flex items-center select-none">
      {/* 1px Horizontal White Leader Line + Vertical Spine (Exact Reference 3 Geometry) */}
      <div className="hidden sm:flex items-center" aria-hidden="true">
        <div className="h-px w-10 lg:w-14 bg-white/75 shadow-[0_0_8px_rgba(255,255,255,0.5)]" />
        <div className="h-52 w-px bg-white/75" />
      </div>

      {/* Translucent Obsidian Glass Telemetry Card */}
      <div
        className={`relative bg-[#0C1014]/88 backdrop-blur-xl border border-white/12 text-white shadow-[0_28px_60px_rgba(0,0,0,0.82)] ${
          compact ? "w-64 p-4" : "w-72 sm:w-76 px-6 py-5"
        }`}
      >
        {/* 1. Location Row */}
        <div className="flex items-center gap-3">
          <svg
            className="size-4 shrink-0 text-white/65"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
          <div className="flex flex-1 items-center justify-between border-b border-dotted border-white/30 pb-1">
            <span className="truncate font-mono text-xs tracking-[0.14em] text-white/90 uppercase">
              {locationLabel}
            </span>
            {onCyclePreset ? (
              <button
                type="button"
                onClick={onCyclePreset}
                title="Switch target site"
                className="ms-2 text-white/60 hover:text-white transition-colors focus-visible:outline-none"
                aria-label="Switch target site"
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {/* 2. Capture Timestamp Row */}
        <div className="mt-4 flex items-center gap-3">
          <svg
            className="size-4 shrink-0 text-white/65"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <div className="flex flex-1 items-center justify-between border-b border-dotted border-white/30 pb-1">
            <span className="font-mono text-xs tracking-[0.14em] text-white/90 tabular-nums">
              19 FEB {year} 18:43:21
            </span>
            {onCycleYear ? (
              <button
                type="button"
                onClick={onCycleYear}
                title="Cycle acquisition year"
                className="ms-2 text-white/60 hover:text-white transition-colors focus-visible:outline-none"
                aria-label="Cycle acquisition year"
              >
                <svg
                  className="size-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {/* 3. Incidence Angle + Interactive Right-Triangle Cone Diagram */}
        <div className="mt-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg
                className="size-4 text-white/65"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 4l10 10" />
                <polygon points="16 12 18 18 12 16 16 12" />
              </svg>
              <span className="font-mono text-[11px] tracking-[0.18em] text-white/80 uppercase">
                INCIDENCE ANGLE
              </span>
            </div>
            <button
              type="button"
              onClick={() => setInfoTip(infoTip === "angle" ? null : "angle")}
              className="flex size-4 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold text-[#0C1014] hover:bg-white transition-colors"
              aria-label="Incidence angle explanation"
            >
              i
            </button>
          </div>

          {infoTip === "angle" ? (
            <p className="mt-1.5 text-[11px] text-white/70 leading-snug">
              Off-nadir sensor look angle (14°–45°). Click the baseline or numbers to adjust swath geometry.
            </p>
          ) : null}

          <div className="mt-2 flex items-center justify-between">
            {/* SVG Right-Triangle Orbital Cone */}
            <svg
              className="h-24 w-36 overflow-visible cursor-pointer"
              viewBox="0 0 135 96"
              onClick={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                const nextAngle = Math.round(14 + relX * (45 - 14));
                setIncidenceAngle(nextAngle);
              }}
              role="slider"
              aria-label="Sensor incidence angle"
              aria-valuemin={14}
              aria-valuemax={45}
              aria-valuenow={incidenceAngle}
            >
              {/* Shaded Coral-Red Beam Triangle */}
              <polygon
                points={`26,14 34,76 ${coneRightX},76`}
                fill="rgba(200, 85, 61, 0.28)"
                stroke="#C8553D"
                strokeWidth="1.25"
              />
              {/* Glowing White Satellite Vertex */}
              <circle
                cx="26"
                cy="14"
                r="4.5"
                fill="#FFFFFF"
                className="drop-shadow-[0_0_6px_rgba(255,255,255,0.9)]"
              />
              {/* Horizontal Ground Axis */}
              <line
                x1="22"
                y1="76"
                x2="118"
                y2="76"
                stroke="rgba(255,255,255,0.85)"
                strokeWidth="1.25"
              />
              {/* Interactive Tick Handle */}
              <line
                x1={tickX}
                y1="71"
                x2={tickX}
                y2="81"
                stroke="#FFFFFF"
                strokeWidth="2"
              />
              {/* Axis Labels */}
              <text
                x="24"
                y="91"
                fill="rgba(255,255,255,0.45)"
                fontSize="10"
                fontFamily="var(--font-jetbrains), monospace"
              >
                14°
              </text>
              <text
                x="100"
                y="91"
                fill="rgba(255,255,255,0.45)"
                fontSize="10"
                fontFamily="var(--font-jetbrains), monospace"
              >
                45°
              </text>
            </svg>

            {/* Large Thin Angle Numeral (Ref 3) */}
            <div className="pe-2 text-right">
              <span className="font-mono text-4xl font-light tracking-tight text-white/95 tabular-nums">
                {incidenceAngle}
              </span>
              <span className="ms-1 align-top text-xl font-light text-white/80">°</span>
            </div>
          </div>
        </div>

        {/* 4. Ground Resolution + Wireframe Stepper */}
        <div className="mt-4 pt-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <svg
                className="size-4 text-white/65"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="13" height="13" rx="1" />
                <path d="M8 21h13V8" />
              </svg>
              <span className="font-mono text-[11px] tracking-[0.18em] text-white/80 uppercase">
                GROUND RESOLUTION
              </span>
            </div>
            <button
              type="button"
              onClick={() => setInfoTip(infoTip === "res" ? null : "res")}
              className="flex size-4 items-center justify-center rounded-full bg-white/80 text-[10px] font-bold text-[#0C1014] hover:bg-white transition-colors"
              aria-label="Ground resolution explanation"
            >
              i
            </button>
          </div>

          {infoTip === "res" ? (
            <p className="mt-1.5 text-[11px] text-white/70 leading-snug">
              Current sensor GSD: {activeRes.meters}. Step up/down to switch between Sentinel-2 and High-Res Aerial.
            </p>
          ) : null}

          <div className="mt-2.5 flex items-center justify-center gap-3">
            <div className="border-b border-dotted border-white/35 pb-0.5">
              <span className="font-mono text-3xl font-light tracking-tight text-white/95 tabular-nums">
                {activeRes.arcsec}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                onClick={() => stepResolution(1)}
                className="flex h-3.5 w-5 items-center justify-center border border-white/70 text-[8px] text-white hover:bg-white/20 transition-colors"
                aria-label="Increase ground resolution"
              >
                ▲
              </button>
              <button
                type="button"
                onClick={() => stepResolution(-1)}
                className="flex h-3.5 w-5 items-center justify-center border border-white/70 text-[8px] text-white hover:bg-white/20 transition-colors"
                aria-label="Decrease ground resolution"
              >
                ▼
              </button>
            </div>
            <span className="font-mono text-[10px] text-[#36C5D8]">{activeRes.meters}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
