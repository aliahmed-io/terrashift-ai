"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, type ReactNode } from "react";
import { useAoi, CORRIDOR_PROFILES, TIMELINE_MONTHS, TIMELINE_YEARS, type CorridorId } from "@/lib/aoi-context";

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

function IconSearch() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const corridors = Object.values(CORRIDOR_PROFILES).filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) || c.coordsLabel.toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <header className="relative z-40 flex h-[60px] shrink-0 items-center justify-between border-b border-[#f0f2f5] bg-white px-5">
      {/* Left: Hamburger + Outlined Isometric Icon + Brand */}
      <div className="flex min-w-[200px] items-center gap-4">
        <button
          type="button"
          aria-label="Select Corridor"
          onClick={() => {
            setDrawerOpen((v) => !v);
            setSearchOpen(false);
          }}
          className="flex h-8 w-8 cursor-pointer flex-col items-center justify-center gap-[4px] text-[#22252a] transition-opacity hover:opacity-75"
        >
          <span className="h-[1.8px] w-[18px] rounded-full bg-[#22252a]" />
          <span className="h-[1.8px] w-[18px] rounded-full bg-[#22252a]" />
          <span className="h-[1.8px] w-[18px] rounded-full bg-[#22252a]" />
        </button>

        <Link href="/" className="flex items-center gap-2 transition-opacity hover:opacity-85">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5c626b"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 3L3 7.5v9L12 21l9-4.5v-9L12 3z" />
            <path d="M12 12l9-4.5" />
            <path d="M12 12v9" />
            <path d="M12 12L3 7.5" />
          </svg>
          <span className="text-[13px] font-bold tracking-[-0.01em] text-[#1c1f23]">TerraShift</span>
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

      {/* Right: Active Corridor Pill + Search Icon + Soft Avatar Circle */}
      <div className="flex min-w-[200px] items-center justify-end gap-3.5">
        {rightSlot ? (
          rightSlot
        ) : (
          <button
            type="button"
            onClick={() => {
              setDrawerOpen((v) => !v);
              setSearchOpen(false);
            }}
            className="hidden cursor-pointer items-center gap-2 rounded-lg bg-[#f6f7f9] px-3 py-1.5 text-[11.5px] font-medium text-[#3b4048] transition-colors hover:bg-[#edeff2] xl:flex"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-[#22b567]" />
            <span>{activeCorridor.shortName}</span>
          </button>
        )}

        <button
          type="button"
          aria-label="Search Corridors"
          onClick={() => {
            setSearchOpen((v) => !v);
            setDrawerOpen(false);
          }}
          className="cursor-pointer text-[#5c626b] transition-colors hover:text-[#1c1f23]"
        >
          <IconSearch />
        </button>

        <div
          title={`${activeCorridor.name} (${activeCorridor.tileId})`}
          className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#e6ebe8]"
        >
          <svg viewBox="0 0 32 32" className="h-full w-full">
            <circle cx="16" cy="12" r="5" fill="#7a9987" />
            <path d="M6 29c1.8-5.5 5.4-8 10-8s8.2 2.5 10 8" fill="#7a9987" />
          </svg>
        </div>
      </div>

      {/* Left Hamburger Corridor Switcher Popover */}
      {drawerOpen && (
        <div className="absolute top-[64px] left-5 z-50 w-[310px] rounded-[18px] border border-[#edeff2] bg-white p-3 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold tracking-wider text-[#8c929c] uppercase">
            Active Observation Corridor
          </div>
          <div className="mt-1 space-y-1">
            {(Object.keys(CORRIDOR_PROFILES) as CorridorId[]).map((id) => {
              const item = CORRIDOR_PROFILES[id];
              const isSelected = id === activeCorridorId;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => {
                    setActiveCorridorId(id);
                    setDrawerOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-[#f4f5f7] font-semibold text-[#1c1f23]" : "text-[#3b4048] hover:bg-[#f8f9fb]"
                  }`}
                >
                  <div>
                    <div className="text-[12.5px]">{item.name}</div>
                    <div className="text-[11px] text-[#8c929c]">{item.coordsLabel}</div>
                  </div>
                  {isSelected && <span className="h-2 w-2 rounded-full bg-[#22b567]" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Right Search Popover */}
      {searchOpen && (
        <div className="absolute top-[64px] right-5 z-50 w-[320px] rounded-[18px] border border-[#edeff2] bg-white p-3.5 shadow-[0_16px_48px_rgba(0,0,0,0.14)]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter Sentinel-2 corridors..."
            className="w-full rounded-xl bg-[#f6f7f9] px-3 py-2 text-[12.5px] text-[#1c1f23] placeholder:text-[#8c929c] focus:outline-none"
          />
          <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
            {corridors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCorridorId(c.id);
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="w-full cursor-pointer rounded-xl px-3 py-2 text-left transition-colors hover:bg-[#f6f7f9]"
              >
                <div className="text-[12.5px] font-semibold text-[#1c1f23]">{c.name}</div>
                <div className="text-[11px] text-[#8c929c]">
                  {c.tileId} · {c.coordsLabel}
                </div>
              </button>
            ))}
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
    <footer className="relative z-30 flex h-[58px] shrink-0 items-center gap-4 border-t border-[#f0f2f5] bg-white px-5">
      {/* Year Pill Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setYearMenuOpen((v) => !v)}
          className="flex h-[36px] cursor-pointer items-center gap-2.5 rounded-xl border border-[#e4e7ec] bg-white px-4 text-[12.5px] font-semibold text-[#1c1f23] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-colors hover:bg-[#f8f9fb]"
        >
          <span>{activeYear}</span>
          <IconChevronDown />
        </button>

        {yearMenuOpen && (
          <div className="absolute bottom-[44px] left-0 z-50 w-[110px] rounded-2xl border border-[#edeff2] bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,0.14)]">
            {TIMELINE_YEARS.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setActiveYear(yr);
                  setYearMenuOpen(false);
                }}
                className={`w-full cursor-pointer rounded-xl px-3 py-1.5 text-left text-[12.5px] tabular-nums transition-colors ${
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

      {/* Full-Width Segmented Month Track (#edeff2) */}
      <div className="flex flex-1 items-center rounded-xl bg-[#edeff2] p-[3px]">
        {TIMELINE_MONTHS.map((m) => {
          const active = m === activeMonth;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMonth(m)}
              className={`flex-1 cursor-pointer rounded-[9px] py-[6px] text-center text-[12px] transition-all ${
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

export function StudioShell({ children, rightSlot }: { readonly children: ReactNode; readonly rightSlot?: ReactNode }) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white font-sans text-[#1c1f23] antialiased select-none">
      <StudioNav rightSlot={rightSlot} />
      <main className="relative flex-1 overflow-hidden bg-[#f6f7f9]">{children}</main>
      <StudioTimelineBar />
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
}

export function MapCanvasOverlay({
  onZoomIn,
  onZoomOut,
  activeEffectLabel,
  onCycleEffect,
  viewMode = "diagnostic",
  onSelectViewMode,
}: MapCanvasOverlayProps = {}) {
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

      {/* Bottom-left View Mode Switcher + Layer Badge */}
      <div className="absolute bottom-5 left-5 z-10 flex flex-col items-start gap-2 sm:flex-row sm:items-center">
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

        {viewMode !== "satellite" && activeEffectLabel && onCycleEffect && (
          <button
            type="button"
            onClick={onCycleEffect}
            title="Click to cycle neural diagnostic layer"
            className="flex cursor-pointer items-center gap-2 rounded-xl border border-[#edeff2] bg-white/95 px-3 py-1.5 text-[11.5px] font-medium text-[#1c1f23] shadow-[0_4px_16px_rgba(0,0,0,0.1)] backdrop-blur-md transition-colors hover:bg-white"
          >
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#22b567]" />
            <span>{activeEffectLabel}</span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#8c929c"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="ml-0.5 opacity-60"
              aria-hidden="true"
            >
              <path d="m7 15 5 5 5-5" />
              <path d="m7 9 5-5 5 5" />
            </svg>
          </button>
        )}
      </div>

      {/* Subtle Coordinate Grid Indices matching reference */}
      <div className="pointer-events-none absolute top-11 right-24 left-24 flex justify-between text-[10px] font-medium text-[#1c1f23]/45">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
      <div className="pointer-events-none absolute top-24 bottom-12 left-20 flex flex-col justify-between text-[10px] font-medium text-[#1c1f23]/45">
        {[7, 6, 5, 4, 3, 2, 1, 0].map((n) => (
          <span key={n}>{n}</span>
        ))}
      </div>
    </>
  );
}
