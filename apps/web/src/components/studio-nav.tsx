"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import React, { useState, type ReactNode } from "react";
import {
  useAoi,
  CORRIDOR_PROFILES,
  TIMELINE_MONTHS,
  TIMELINE_YEARS,
  type CorridorId,
} from "@/lib/aoi-context";

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

export function StudioNav({ rightSlot }: StudioNavProps = {}) {
  const pathname = usePathname();
  const { activeCorridorId, setActiveCorridorId, activeCorridor } = useAoi();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const corridors = Object.values(CORRIDOR_PROFILES).filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      c.coordsLabel.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <header className="relative z-40 h-[60px] shrink-0 bg-white px-5 flex items-center justify-between border-b border-[#f0f2f5]">
      {/* Left: Hamburger + Outlined Isometric Icon + Brand */}
      <div className="flex items-center gap-4 min-w-[200px]">
        <button
          type="button"
          aria-label="Select Corridor"
          onClick={() => {
            setDrawerOpen((v) => !v);
            setSearchOpen(false);
          }}
          className="w-8 h-8 flex flex-col items-center justify-center gap-[4px] text-[#22252a] hover:opacity-75 transition-opacity cursor-pointer"
        >
          <span className="w-[18px] h-[1.8px] bg-[#22252a] rounded-full" />
          <span className="w-[18px] h-[1.8px] bg-[#22252a] rounded-full" />
          <span className="w-[18px] h-[1.8px] bg-[#22252a] rounded-full" />
        </button>

        <Link href="/" className="flex items-center gap-2 hover:opacity-85 transition-opacity">
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
          <span className="text-[13px] font-bold tracking-[-0.01em] text-[#1c1f23]">
            TerraShift
          </span>
        </Link>
      </div>

      {/* Center: Wide Segmented Grey Pill Track (#edeff2) with White Active Pill */}
      <nav
        aria-label="Primary Modes"
        className="flex items-center bg-[#edeff2] p-[3px] rounded-xl w-full max-w-[760px]"
      >
        {STUDIO_LINKS.map((tab) => {
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname === tab.href || pathname?.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex-1 py-[7px] px-3 rounded-[9px] text-[12.5px] transition-all text-center whitespace-nowrap ${
                active
                  ? "bg-white text-[#1c1f23] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-[#636973] font-medium hover:text-[#1c1f23]"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Right: Active Corridor Pill + Search Icon + Soft Avatar Circle */}
      <div className="flex items-center justify-end gap-3.5 min-w-[200px]">
        {rightSlot ? (
          rightSlot
        ) : (
          <button
            type="button"
            onClick={() => {
              setDrawerOpen((v) => !v);
              setSearchOpen(false);
            }}
            className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#f6f7f9] hover:bg-[#edeff2] text-[11.5px] font-medium text-[#3b4048] transition-colors cursor-pointer"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#22b567]" />
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
          className="text-[#5c626b] hover:text-[#1c1f23] transition-colors cursor-pointer"
        >
          <IconSearch />
        </button>

        <div
          title={`${activeCorridor.name} (${activeCorridor.tileId})`}
          className="w-8 h-8 rounded-full bg-[#e6ebe8] overflow-hidden flex items-center justify-center"
        >
          <svg viewBox="0 0 32 32" className="w-full h-full">
            <circle cx="16" cy="12" r="5" fill="#7a9987" />
            <path d="M6 29c1.8-5.5 5.4-8 10-8s8.2 2.5 10 8" fill="#7a9987" />
          </svg>
        </div>
      </div>

      {/* Left Hamburger Corridor Switcher Popover */}
      {drawerOpen && (
        <div className="absolute top-[64px] left-5 w-[310px] bg-white rounded-[18px] shadow-[0_16px_48px_rgba(0,0,0,0.14)] border border-[#edeff2] p-3 z-50">
          <div className="px-2.5 py-1.5 text-[11px] font-semibold text-[#8c929c] uppercase tracking-wider">
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
                  className={`w-full text-left px-3 py-2.5 rounded-xl transition-colors flex items-center justify-between cursor-pointer ${
                    isSelected
                      ? "bg-[#f4f5f7] text-[#1c1f23] font-semibold"
                      : "text-[#3b4048] hover:bg-[#f8f9fb]"
                  }`}
                >
                  <div>
                    <div className="text-[12.5px]">{item.name}</div>
                    <div className="text-[11px] text-[#8c929c]">{item.coordsLabel}</div>
                  </div>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#22b567]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Right Search Popover */}
      {searchOpen && (
        <div className="absolute top-[64px] right-5 w-[320px] bg-white rounded-[18px] shadow-[0_16px_48px_rgba(0,0,0,0.14)] border border-[#edeff2] p-3.5 z-50">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter Sentinel-2 corridors..."
            className="w-full px-3 py-2 rounded-xl bg-[#f6f7f9] text-[12.5px] text-[#1c1f23] placeholder:text-[#8c929c] focus:outline-none"
          />
          <div className="mt-2 max-h-56 overflow-y-auto space-y-1">
            {corridors.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setActiveCorridorId(c.id);
                  setSearchOpen(false);
                  setQuery("");
                }}
                className="w-full text-left px-3 py-2 rounded-xl hover:bg-[#f6f7f9] transition-colors cursor-pointer"
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
    <footer className="relative z-30 h-[58px] shrink-0 bg-white px-5 flex items-center gap-4 border-t border-[#f0f2f5]">
      {/* Year Pill Selector */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setYearMenuOpen((v) => !v)}
          className="h-[36px] px-4 rounded-xl border border-[#e4e7ec] bg-white flex items-center gap-2.5 text-[12.5px] font-semibold text-[#1c1f23] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-[#f8f9fb] transition-colors cursor-pointer"
        >
          <span>{activeYear}</span>
          <IconChevronDown />
        </button>

        {yearMenuOpen && (
          <div className="absolute bottom-[44px] left-0 w-[110px] bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.14)] border border-[#edeff2] p-1.5 z-50">
            {TIMELINE_YEARS.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => {
                  setActiveYear(yr);
                  setYearMenuOpen(false);
                }}
                className={`w-full text-left px-3 py-1.5 rounded-xl text-[12.5px] tabular-nums transition-colors cursor-pointer ${
                  yr === activeYear
                    ? "bg-[#edeff2] text-[#1c1f23] font-semibold"
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
      <div className="flex-1 bg-[#edeff2] p-[3px] rounded-xl flex items-center">
        {TIMELINE_MONTHS.map((m) => {
          const active = m === activeMonth;
          return (
            <button
              key={m}
              type="button"
              onClick={() => setActiveMonth(m)}
              className={`flex-1 py-[6px] rounded-[9px] text-[12px] transition-all text-center cursor-pointer ${
                active
                  ? "bg-white text-[#1c1f23] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                  : "text-[#636973] font-medium hover:text-[#1c1f23]"
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
}: {
  readonly children: ReactNode;
  readonly rightSlot?: ReactNode;
}) {
  return (
    <div className="h-dvh w-full flex flex-col bg-white text-[#1c1f23] select-none font-sans antialiased overflow-hidden">
      <StudioNav rightSlot={rightSlot} />
      <main className="relative flex-1 overflow-hidden bg-[#f6f7f9]">{children}</main>
      <StudioTimelineBar />
    </div>
  );
}

export function MapCanvasOverlay({
  onZoomIn,
  onZoomOut,
  activeEffectLabel,
  onCycleEffect,
}: {
  readonly onZoomIn?: () => void;
  readonly onZoomOut?: () => void;
  readonly activeEffectLabel?: string;
  readonly onCycleEffect?: () => void;
} = {}) {
  return (
    <>
      {/* Top-Left Dark Translucent Pill Zoom Button Pair */}
      <div className="absolute top-6 left-5 z-10 flex flex-col bg-[#1b1e23]/85 backdrop-blur-md rounded-2xl p-1 shadow-md">
        <button
          type="button"
          onClick={onZoomIn}
          aria-label="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-white/90 hover:text-white transition-colors cursor-pointer"
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
          className="w-8 h-8 flex items-center justify-center text-white/90 hover:text-white transition-colors cursor-pointer"
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

      {/* Optional subtle layer badge bottom-left for switching real city effects */}
      {activeEffectLabel && onCycleEffect && (
        <button
          type="button"
          onClick={onCycleEffect}
          className="absolute bottom-5 left-5 z-10 px-3.5 py-2 rounded-xl bg-white/95 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.1)] text-[12px] font-medium text-[#1c1f23] flex items-center gap-2 hover:bg-white transition-colors cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[#22b567]" />
          <span>{activeEffectLabel}</span>
        </button>
      )}

      {/* Subtle Coordinate Grid Indices matching reference */}
      <div className="pointer-events-none absolute top-11 left-24 right-24 flex justify-between text-[10px] font-medium text-[#1c1f23]/45">
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
