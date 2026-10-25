"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, type ReactNode } from "react";
import { useAoi, CORRIDOR_PROFILES, TIMELINE_MONTHS, TIMELINE_YEARS, type CorridorId } from "@/lib/aoi-context";
import type { RasterStatusInfo } from "@/components/map/map-canvas";

const STUDIO_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/analyze", label: "NDVI & Spectral" },
  { href: "/benchmarks", label: "Anomaly" },
  { href: "/timeline", label: "Trajectory" },
  { href: "/lab", label: "Pair Lab" },
  { href: "/carbon", label: "Carbon" },
  { href: "/watchlist", label: "Watchlist" },
] as const;

export interface StudioNavProps {
  readonly rightSlot?: ReactNode;
}

function IconChevronDown() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconSatellite({ className }: { readonly className?: string } = {}) {
  return (
    <svg
      width="12.5"
      height="12.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M13 7 9 3 5 7l4 4" />
      <path d="m17 11 4 4-4 4-4-4" />
      <path d="m8 12 4 4 6-6-4-4Z" />
      <path d="m16 8 3-3" />
      <path d="M9 21a6 6 0 0 0-6-6" />
    </svg>
  );
}

function IconDiagnostic({ className }: { readonly className?: string } = {}) {
  return (
    <svg
      width="12.5"
      height="12.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    </svg>
  );
}

function IconBiTemporal({ className }: { readonly className?: string } = {}) {
  return (
    <svg
      width="12.5"
      height="12.5"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
    </svg>
  );
}

export function StudioNav({ rightSlot }: StudioNavProps = {}) {
  const pathname = usePathname();
  const { activeCorridorId, setActiveCorridorId, activeCorridor } = useAoi();
  const [corridorMenuOpen, setCorridorMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const corridors = Object.values(CORRIDOR_PROFILES).filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) || c.coordsLabel.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <header className="relative z-40 flex h-[60px] shrink-0 items-center justify-between border-b border-[#f0f2f5] bg-white px-5">
      {/* Left: Brand Identity */}
      <div className="flex min-w-[160px] items-center gap-3">
        <Link href="/" className="flex items-center gap-2.5 transition-opacity hover:opacity-85">
          <svg
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#1c1f23"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3L3 7.5v9L12 21l9-4.5v-9L12 3z" />
            <path d="M12 12l9-4.5" />
            <path d="M12 12v9" />
            <path d="M12 12L3 7.5" />
          </svg>
          <span className="text-[13.5px] font-bold tracking-[-0.01em] text-[#1c1f23]">TerraShift</span>
        </Link>
      </div>

      {/* Center: Wide Segmented Grey Pill Track (#edeff2) with White Active Pill */}
      <nav
        aria-label="Primary Modes"
        className="flex w-full max-w-[760px] items-center rounded-xl bg-[#edeff2] p-[3px]"
      >
        {STUDIO_LINKS.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 rounded-[9px] px-3 py-[7px] text-center text-[12.5px] whitespace-nowrap transition-all ${
                active
                  ? "bg-white font-semibold text-[#1c1f23] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "font-medium text-[#636973] hover:text-[#1c1f23]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: Single Clean Corridor Selector Pill (no fake auth avatar or redundant icons) */}
      <div className="flex min-w-[160px] items-center justify-end gap-2.5">
        {rightSlot ? (
          rightSlot
        ) : (
          <button
            type="button"
            onClick={() => setCorridorMenuOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#e4e7ec] bg-[#f8f9fb] px-3.5 py-1.5 text-[12px] font-semibold text-[#1c1f23] transition-colors hover:bg-[#edeff2]"
          >
            <span className="h-2 w-2 rounded-full bg-[#22b567]" />
            <span>{activeCorridor.shortName}</span>
            <IconChevronDown />
          </button>
        )}
      </div>

      {/* Unified Corridor Switcher Popover */}
      {corridorMenuOpen && (
        <div className="absolute top-[64px] right-5 z-50 w-[320px] rounded-[18px] border border-[#edeff2] bg-white p-3.5 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
          <div className="mb-2 px-1 text-[11px] font-semibold tracking-wider text-[#8c929c] uppercase">
            Select Observation Corridor
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter corridors..."
            className="mb-2 w-full rounded-xl bg-[#f6f7f9] px-3 py-2 text-[12px] text-[#1c1f23] placeholder:text-[#8c929c] focus:outline-none"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {corridors.map((c) => {
              const isSelected = c.id === activeCorridorId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setActiveCorridorId(c.id as CorridorId);
                    setCorridorMenuOpen(false);
                    setQuery("");
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-[#f0f3f1] font-semibold text-[#1c1f23]" : "text-[#3b4048] hover:bg-[#f6f7f9]"
                  }`}
                >
                  <div>
                    <div className="text-[12.5px] font-semibold text-[#1c1f23]">{c.name}</div>
                    <div className="text-[11px] text-[#8c929c]">
                      {c.tileId} · {c.coordsLabel}
                    </div>
                  </div>
                  {isSelected && <span className="h-2 w-2 rounded-full bg-[#22b567]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

export function StudioTimelineBar() {
  const { activeYear, setActiveYear, activeMonth, setActiveMonth } = useAoi();
  const [yearMenuOpen, setYearMenuOpen] = useState(false);

  return (
    <footer className="relative z-30 flex h-[54px] shrink-0 items-center gap-4 border-t border-[#f0f2f5] bg-white px-5">
      <div className="relative">
        <button
          type="button"
          onClick={() => setYearMenuOpen((v) => !v)}
          className="flex h-[34px] cursor-pointer items-center gap-2.5 rounded-xl border border-[#e4e7ec] bg-white px-4 text-[12px] font-semibold text-[#1c1f23] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:bg-[#f8f9fb]"
        >
          <span>{activeYear}</span>
          <IconChevronDown />
        </button>

        {yearMenuOpen && (
          <div className="absolute bottom-[42px] left-0 z-50 w-[110px] rounded-2xl border border-[#edeff2] bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
            {TIMELINE_YEARS.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setActiveYear(yr);
                  setYearMenuOpen(false);
                }}
                className={`w-full cursor-pointer rounded-xl px-3 py-1.5 text-left text-[12px] tabular-nums transition-colors ${
                  yr === activeYear
                    ? "bg-[#edeff2] font-semibold text-[#1c1f23]"
                    : "text-[#636973] hover:bg-[#f6f7f9] hover:text-[#1c1f23]"
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 items-center rounded-xl bg-[#edeff2] p-[3px]">
        {TIMELINE_MONTHS.map((m) => {
          const active = m === activeMonth;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMonth(m)}
              className={`flex-1 cursor-pointer rounded-[9px] py-[5px] text-center text-[11.5px] transition-all ${
                active
                  ? "bg-white font-semibold text-[#1c1f23] shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "font-medium text-[#636973] hover:text-[#1c1f23]"
              }`}
            >
              {m}
            </button>
          );
        })}
      </div>
    </footer>
  );
}

export function StudioShell({
  children,
  rightSlot,
  showTimelineBar = false,
}: {
  readonly children: ReactNode;
  readonly rightSlot?: ReactNode;
  readonly showTimelineBar?: boolean;
}) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white font-sans text-[#1c1f23] antialiased select-none">
      <StudioNav rightSlot={rightSlot} />
      <main className="relative flex-1 overflow-hidden bg-[#f6f7f9]">{children}</main>
      {showTimelineBar && <StudioTimelineBar />}
    </div>
  );
}

export type StudioViewMode = "satellite" | "diagnostic" | "compare";

export interface MapCanvasOverlayProps {
  readonly onZoomIn?: () => void;
  readonly onZoomOut?: () => void;
  readonly activeEffectLabel?: string;
  readonly onCycleEffect?: () => void;
  readonly viewMode?: StudioViewMode;
  readonly onSelectViewMode?: (mode: StudioViewMode) => void;
  readonly isDrawing?: boolean;
  readonly onToggleDrawing?: () => void;
  readonly isCustomPolygon?: boolean;
  readonly onResetPolygon?: () => void;
  readonly rasterStatus?: RasterStatusInfo;
}

export function MapCanvasOverlay({
  onZoomIn,
  onZoomOut,
  activeEffectLabel,
  onCycleEffect,
  viewMode = "diagnostic",
  onSelectViewMode,
  isDrawing = false,
  onToggleDrawing,
  isCustomPolygon = false,
  onResetPolygon,
  rasterStatus,
}: MapCanvasOverlayProps = {}) {
  const isLoading = rasterStatus?.status === "loading" || rasterStatus?.status === "slow";
  const isError = rasterStatus?.status === "error";

  return (
    <>
      {/* Top-Left Dark Translucent Pill Zoom Button Pair */}
      <div className="absolute top-6 left-5 z-10 flex flex-col rounded-2xl bg-[#1b1e23]/85 p-1 shadow-md backdrop-blur-md">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="flex h-8 w-8 cursor-pointer items-center justify-center text-white/90 transition-colors hover:text-white"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M11 8v6" />
            <path d="M8 11h6" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onZoomOut}
          aria-label="Zoom out"
          className="flex h-8 w-8 cursor-pointer items-center justify-center text-white/90 transition-colors hover:text-white"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
            <path d="M8 11h6" />
          </svg>
        </button>
      </div>

      {/* Bottom-left View Mode Switcher + AOI Shape Controls + Layer & AI Status Badge */}
      <div className="absolute bottom-5 left-5 z-10 flex flex-wrap items-center gap-2">
        {onSelectViewMode && (
          <div className="flex items-center rounded-xl border border-white/10 bg-[#1b1e23]/90 p-1 text-[11px] font-medium text-white/70 shadow-md backdrop-blur-md">
            <button
              type="button"
              onClick={() => onSelectViewMode("satellite")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                viewMode === "satellite" ? "bg-white font-semibold text-[#1c1f23] shadow-sm" : "hover:text-white"
              }`}
            >
              <IconSatellite />
              <span>Satellite</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectViewMode("diagnostic")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                viewMode === "diagnostic" ? "bg-white font-semibold text-[#1c1f23] shadow-sm" : "hover:text-white"
              }`}
            >
              <IconDiagnostic />
              <span>AI Diagnostic</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectViewMode("compare")}
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                viewMode === "compare" ? "bg-white font-semibold text-[#1c1f23] shadow-sm" : "hover:text-white"
              }`}
            >
              <IconBiTemporal />
              <span>Bi-Temporal</span>
            </button>
          </div>
        )}

        {/* Interactive Blue AOI Box Edit / Redraw / Reset Controls */}
        {onToggleDrawing && (
          <div className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-[#1b1e23]/90 p-1 text-[11px] font-medium text-white shadow-md backdrop-blur-md">
            <button
              type="button"
              onClick={onToggleDrawing}
              title="Draw a new blue AOI polygon or drag the white/blue corner handles on the map"
              className={`flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1 transition-colors ${
                isDrawing
                  ? "bg-[#38BDF8] font-semibold text-[#0B0F17]"
                  : "text-white/85 hover:bg-white/10 hover:text-white"
              }`}
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
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="3" cy="3" r="2" />
                <circle cx="21" cy="3" r="2" />
                <circle cx="21" cy="21" r="2" />
                <circle cx="3" cy="21" r="2" />
              </svg>
              <span>{isDrawing ? "Cancel Draw" : "Redraw AOI Box"}</span>
            </button>
            {isCustomPolygon && onResetPolygon && (
              <button
                type="button"
                onClick={onResetPolygon}
                title="Reset blue AOI shape to default corridor bounds"
                className="cursor-pointer rounded-lg bg-white/10 px-2 py-1 text-[10.5px] font-semibold text-[#38BDF8] transition-colors hover:bg-white/20"
              >
                Reset AOI
              </button>
            )}
          </div>
        )}

        {viewMode !== "satellite" && activeEffectLabel && onCycleEffect && (
          <button
            type="button"
            onClick={onCycleEffect}
            title="Click to cycle neural diagnostic layer"
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#edeff2] bg-white/95 px-3 py-1.5 text-[11.5px] font-medium text-[#1c1f23] shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md transition-colors hover:bg-white"
          >
            {isLoading ? (
              <svg
                className="h-3 w-3 animate-spin text-[#38BDF8]"
                viewBox="0 0 24 24"
                fill="none"
                aria-hidden="true"
              >
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span
                className={`h-2 w-2 rounded-full ${
                  isError
                    ? "bg-[#e94235]"
                    : rasterStatus?.status === "fallback"
                      ? "bg-[#f39223]"
                      : "bg-[#22b567]"
                }`}
              />
            )}
            <span>{activeEffectLabel}</span>
            {rasterStatus && rasterStatus.status !== "idle" && (
              <span
                className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
                  isLoading
                    ? "bg-[#38BDF8]/15 text-[#0284C7]"
                    : isError
                      ? "bg-[#e94235]/15 text-[#e94235]"
                      : "bg-[#22b567]/12 text-[#18864b]"
                }`}
              >
                {isLoading
                  ? "Loading..."
                  : isError
                    ? "Offline"
                    : `${rasterStatus.latencyMs ?? 1}ms`}
              </span>
            )}
          </button>
        )}
      </div>
    </>
  );
}
