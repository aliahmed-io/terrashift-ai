"use client";

import Link from "next/link";
import { useState } from "react";
import { StudioNav } from "@/components/studio-nav";
import { OrbitalSwathHud } from "@/components/map/orbital-swath-hud";
import { KSA_MISSION_SITES, type KsaMissionSite } from "@/data/ksaMissionData";

interface ShowcaseLayerState {
  titles: boolean;
  indicators: boolean;
  aoi: boolean;
  protectedAreas: boolean;
  restrictedAreas: boolean;
}

export function StitchCommandDeck() {
  const [siteIdx, setSiteIdx] = useState<number>(0);
  const site: KsaMissionSite = KSA_MISSION_SITES[siteIdx] ?? KSA_MISSION_SITES[0]!;

  const [activeYear, setActiveYear] = useState<number>(2024);
  const [basemapMode, setBasemapMode] = useState<"s2" | "mapbox">("s2");
  const [swathZoom, setSwathZoom] = useState<number>(1);
  const [swathOpacity, setSwathOpacity] = useState<number>(1.0);
  const [showMgrs, setShowMgrs] = useState<boolean>(false);
  const [activePinIndex, setActivePinIndex] = useState<number>(0);
  const [cardMinimized, setCardMinimized] = useState<boolean>(false);

  const [layers, setLayers] = useState<ShowcaseLayerState>({
    titles: true,
    indicators: true,
    aoi: true,
    protectedAreas: false,
    restrictedAreas: false,
  });

  const toggleLayer = (key: keyof ShowcaseLayerState) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const cycleSite = () => {
    setSiteIdx((prev) => (prev + 1) % KSA_MISSION_SITES.length);
  };

  const cycleYear = () => {
    setActiveYear((y) => (y === 2024 ? 2018 : 2024));
  };

  // Warm-Sand Indicator Pins on the Showcase Canvas (Ref 1)
  const showcasePins = [
    {
      code: "JJV-16541",
      xPct: 58,
      yPct: 56,
      probability: 75,
      subtitle: "Probability of mining / grading happening",
      area: site.pillBadge,
    },
    {
      code: "KSA-24819",
      xPct: 28,
      yPct: 34,
      probability: 89,
      subtitle: "Probability of structural change happening",
      area: "14.2 km²",
    },
    {
      code: "SRD-19042",
      xPct: 34,
      yPct: 68,
      probability: 82,
      subtitle: "Probability of corridor excavation",
      area: "8.6 km²",
    },
    {
      code: "ORB-30911",
      xPct: 86,
      yPct: 24,
      probability: 68,
      subtitle: "Probability of surface / canopy shift",
      area: "5.1 km²",
    },
  ];

  const selectedPin = showcasePins[activePinIndex] ?? showcasePins[0]!;
  const radius = 25;
  const circumference = 2 * Math.PI * radius;
  const probOffset = circumference - (selectedPin.probability / 100) * circumference;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-[#0C1014] text-white select-none">
      {/* 1. Reference 1 Petrol-Blue Command Header */}
      <StudioNav
        rightSlot={
          <Link
            href="/analyze"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-[#00875A] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-[#006E49] transition-colors"
          >
            <span>Open Map Studio</span>
          </Link>
        }
      />

      {/* 2. Full-Bleed Satellite Canvas combining Reference 1, 2, and 3 */}
      <main className="relative flex-1 w-full overflow-hidden bg-[#0C1014]">
        {/* Full-Viewport High-Resolution Satellite Backdrop */}
        <div
          style={{
            transform: `scale(${swathZoom})`,
          }}
          className="absolute inset-0 transition-transform duration-500 ease-out"
        >
          <img
            src={activeYear === 2018 ? site.baseImage : site.overlayImage}
            alt={`${site.pillTitle} orbital satellite pass`}
            className="size-full object-cover brightness-[0.82] contrast-[1.08]"
          />
          <div className="absolute inset-0 bg-radial from-transparent via-[#0C1014]/20 to-[#0C1014]/70" />
        </div>

        {/* ===================================================================
            CENTER-LEFT: ANGLED ORBITAL SWATH FOOTPRINT + 1px LEADER-LINE HUD (Exact Reference 3)
           =================================================================== */}
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center lg:pl-64">
          <div className="relative flex items-center">
            {/* Angled Cyan Swath Capture Frame with 4-Corner LAT/LON Readouts (Ref 3) */}
            {layers.aoi ? (
              <div className="relative flex flex-col items-center">
                {/* Top Floating Area Pill + Home Button (Ref 2) */}
                <div className="pointer-events-auto mb-4 flex items-center gap-1.5 z-20">
                  <button
                    type="button"
                    onClick={() => setSwathZoom(1)}
                    className="flex size-7 items-center justify-center rounded-md bg-white text-[#111827] shadow-md hover:bg-[#F3F5F7]"
                    aria-label="Reset swath zoom"
                  >
                    <svg
                      className="size-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                      <polyline points="9 22 9 12 15 12 15 22" />
                    </svg>
                  </button>
                  <span className="rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-[#111827] shadow-md tabular-nums">
                    {site.pillBadge}
                  </span>
                  {showMgrs ? (
                    <span className="rounded-md bg-[#0F4C6C] px-2 py-1 font-mono text-[11px] font-semibold text-white shadow-md">
                      {site.mgrs}
                    </span>
                  ) : null}
                </div>

                {/* Tilted Satellite Swath Square (Exact Reference 3 Geometry) */}
                <div className="relative size-60 sm:size-76 md:size-84 flex items-center justify-center">
                  {/* Subtle Diagonal Orbital Track Lines (Ref 3) */}
                  <div
                    className="pointer-events-none absolute -top-48 -bottom-48 left-1/2 w-px -rotate-11 bg-white/15"
                    aria-hidden="true"
                  />

                  <div
                    style={{ opacity: swathOpacity }}
                    className="relative size-56 sm:size-68 -rotate-11 border border-white/75 bg-[#36C5D8]/24 shadow-[0_0_50px_rgba(54,197,216,0.22)] backdrop-blur-[1px] transition-opacity"
                  >
                    {/* Internal Swath Atmospheric Texture */}
                    <img
                      src={site.overlayImage}
                      alt=""
                      aria-hidden="true"
                      className="size-full object-cover mix-blend-screen opacity-55 contrast-125"
                    />
                    <div className="absolute inset-0 bg-linear-to-br from-[#36C5D8]/35 via-transparent to-[#0F4C6C]/40" />

                    {/* 4 Glowing White Corner Nodes + LAT/LON Readouts (Exact Ref 3) */}
                    {/* Top-Left Vertex */}
                    <span className="absolute -top-1.5 -left-1.5 size-2.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                    {layers.titles ? (
                      <span className="absolute -top-6 -left-24 rotate-11 font-mono text-[10px] tracking-wider text-white/65 tabular-nums">
                        LAT {(site.lat + 0.02).toFixed(4)} LON {(site.lon - 0.03).toFixed(4)}
                      </span>
                    ) : null}

                    {/* Top-Right Vertex */}
                    <span className="absolute -top-1.5 -right-1.5 size-2.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                    {layers.titles ? (
                      <span className="absolute -top-6 -right-16 rotate-11 font-mono text-[10px] tracking-wider text-white/65 tabular-nums">
                        LAT {(site.lat + 0.02).toFixed(4)} LON {(site.lon + 0.03).toFixed(4)}
                      </span>
                    ) : null}

                    {/* Bottom-Left Vertex */}
                    <span className="absolute -bottom-1.5 -left-1.5 size-2.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                    {layers.titles ? (
                      <span className="absolute -bottom-6 -left-20 rotate-11 font-mono text-[10px] tracking-wider text-white/65 tabular-nums">
                        LAT {(site.lat - 0.02).toFixed(4)} LON {(site.lon - 0.03).toFixed(4)}
                      </span>
                    ) : null}

                    {/* Bottom-Right Vertex */}
                    <span className="absolute -bottom-1.5 -right-1.5 size-2.5 rounded-full bg-white shadow-[0_0_8px_#fff]" />
                    {layers.titles ? (
                      <span className="absolute -bottom-6 -right-24 rotate-11 font-mono text-[10px] tracking-wider text-white/65 tabular-nums">
                        LAT {(site.lat - 0.02).toFixed(4)} LON {(site.lon + 0.03).toFixed(4)}
                      </span>
                    ) : null}
                  </div>
                </div>

                {/* Bottom Floating Parameter Pills (Exact Ref 2 Pattern) */}
                <div className="pointer-events-auto mt-5 flex items-center gap-1.5 z-20">
                  <button
                    type="button"
                    onClick={() =>
                      setSwathOpacity((o) => (o === 1.0 ? 0.65 : o === 0.65 ? 0.35 : 1.0))
                    }
                    className="flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#111827] shadow-md hover:bg-white tabular-nums"
                  >
                    <span>Opacity: {swathOpacity.toFixed(1)}</span>
                    <span className="text-[9px] text-[#64707D]">↕</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSwathZoom((z) => (z === 1 ? 1.18 : 1))}
                    className="flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#111827] shadow-md hover:bg-white"
                  >
                    <span>Zoom: {swathZoom > 1 ? "1:1" : "2:1"}</span>
                    <span className="text-[9px] text-[#64707D]">↕</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowMgrs((v) => !v)}
                    className="flex items-center gap-1 rounded-md bg-white/95 px-2.5 py-1 text-[11px] font-medium text-[#111827] shadow-md hover:bg-white"
                  >
                    <span>Show MGRS: {showMgrs ? "On" : "Off"}</span>
                    <span className="text-[9px] text-[#64707D]">↕</span>
                  </button>
                </div>
              </div>
            ) : null}

            {/* 1px Leader-Line Connected Orbital Swath HUD (Exact Reference 3) */}
            <div className="hidden md:block">
              <OrbitalSwathHud
                locationLabel={`${site.pillTitle.toUpperCase()}, KSA`}
                year={activeYear}
                basemapSource={basemapMode}
                onToggleBasemap={() => setBasemapMode((m) => (m === "s2" ? "mapbox" : "s2"))}
                onCyclePreset={cycleSite}
                onCycleYear={cycleYear}
              />
            </div>
          </div>
        </div>

        {/* ===================================================================
            WARM-SAND INDICATOR PINS & PETROL-BLUE RADIAL POPOVER (Exact Reference 1)
           =================================================================== */}
        {layers.indicators ? (
          <div className="pointer-events-none absolute inset-0 z-10">
            {showcasePins.map((pin, idx) => {
              const active = idx === activePinIndex;
              return (
                <button
                  key={pin.code}
                  type="button"
                  onClick={() => setActivePinIndex(idx)}
                  style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
                  className={`pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2 flex size-7.5 items-center justify-center rounded-full bg-[#F4C396] text-[#432810] shadow-[0_4px_14px_rgba(0,0,0,0.65)] transition-transform hover:scale-115 ${
                    active ? "ring-2 ring-white scale-110" : ""
                  }`}
                  aria-label={`Select indicator ${pin.code}`}
                >
                  <svg
                    className="size-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M14.5 3.5c2.5 1 4.5 3 5.5 5.5" />
                    <path d="M9.5 3.5c-2.5 1-4.5 3-5.5 5.5" />
                    <path d="m14 10-9.5 9.5" />
                    <path d="m10 10 9.5 9.5" />
                  </svg>
                </button>
              );
            })}

            {/* Floating Petrol-Blue Radial Probability Callout Card (Exact Ref 1) */}
            <div
              style={{
                left: `min(calc(100vw - 240px), calc(${selectedPin.xPct}% + 18px))`,
                top: `min(calc(100vh - 220px), calc(${selectedPin.yPct}% + 6px))`,
              }}
              className="pointer-events-auto hidden sm:block absolute z-20 w-54 bg-[#0F4C6C] px-4 py-3.5 text-center text-white shadow-[0_20px_44px_rgba(0,0,0,0.75)] border border-white/15 transition-all duration-300"
            >
              <p className="font-sans text-sm font-bold tracking-wide text-white">
                {selectedPin.code}
              </p>

              <div className="my-2 flex items-center justify-center">
                <div className="relative flex size-15 items-center justify-center">
                  <svg className="size-15 -rotate-90" viewBox="0 0 64 64">
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      fill="none"
                      stroke="rgba(255,255,255,0.85)"
                      strokeWidth="4.5"
                    />
                    <circle
                      cx="32"
                      cy="32"
                      r={radius}
                      fill="none"
                      stroke="#36C5D8"
                      strokeWidth="4.5"
                      strokeDasharray={circumference}
                      strokeDashoffset={probOffset}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute font-sans text-xs font-bold text-white tabular-nums">
                    {selectedPin.probability}%
                  </span>
                </div>
              </div>

              <p className="text-[11px] font-medium text-white/90 leading-snug">
                {selectedPin.subtitle}
              </p>
            </div>
          </div>
        ) : null}

        {/* ===================================================================
            LEFT FLOATING PORCELAIN TASKING & DEEP RESOLUTION CARD (Exact Reference 2)
           =================================================================== */}
        <aside
          aria-label="Mission Tasking and Deep Resolution Catalog"
          className="pointer-events-auto absolute top-4 start-4 z-20 w-[calc(100vw-2rem)] max-w-[348px]"
        >
          <div className="overflow-hidden rounded-2xl bg-white text-[#111827] shadow-[0_24px_48px_-12px_rgba(8,47,68,0.55)] border border-[#E6EAEE]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E6EAEE] px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#111827]">Deep Resolution Imagery</span>
                <span className="rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-semibold text-[#0284C7]">
                  Active
                </span>
              </div>
              <button
                type="button"
                onClick={() => setCardMinimized((v) => !v)}
                className="flex size-6 items-center justify-center rounded-full bg-[#F3F5F7] text-xs font-bold text-[#3A4450] hover:bg-[#E6EAEE]"
                aria-label={cardMinimized ? "Expand panel" : "Minimize panel"}
              >
                {cardMinimized ? "+" : "−"}
              </button>
            </div>

            {!cardMinimized ? (
              <div className="p-4 space-y-3.5">
                {/* Mission Selector Box */}
                <div className="rounded-xl bg-[#F3F5F7] px-3.5 py-2.5">
                  <span className="block text-[10px] font-medium text-[#64707D]">
                    Vision 2030 & Global Coverage Order
                  </span>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {KSA_MISSION_SITES.map((m, idx) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setSiteIdx(idx)}
                        className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                          siteIdx === idx
                            ? "bg-[#111827] text-white"
                            : "bg-white text-[#3A4450] hover:bg-[#E6EAEE]"
                        }`}
                      >
                        {m.pillTitle}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Scene List Items with Real Satellite Thumbnails (Ref 2 Right Screen) */}
                <div className="divide-y divide-[#E6EAEE]">
                  <div className="flex items-start gap-3 pb-3">
                    <img
                      src={site.overlayImage}
                      alt={`${site.pillTitle} 2024 pass`}
                      className="h-14 w-20 shrink-0 rounded-lg object-cover border border-[#E6EAEE]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Oct 07, 2024</span>
                        <span className="flex size-4.5 items-center justify-center rounded-full bg-[#DCFCE7] text-[10px] font-bold text-[#00875A]">
                          ✓
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64707D] tabular-nums">
                        {site.pillBadge} · ☁ {site.cloudCover}
                      </p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Link
                          href="/analyze"
                          className="rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-semibold text-[#0284C7] hover:brightness-95"
                        >
                          Raw Files (24MB)
                        </Link>
                        <Link
                          href="/analyze"
                          className="rounded-md bg-[#EDE9FE] px-2 py-0.5 text-[10px] font-semibold text-[#6D28D9] hover:brightness-95"
                        >
                          S2 (1,3MB)
                        </Link>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 pt-3">
                    <img
                      src={site.baseImage}
                      alt={`${site.pillTitle} 2018 baseline pass`}
                      className="h-14 w-20 shrink-0 rounded-lg object-cover border border-[#E6EAEE]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#111827]">Feb 19, 2018</span>
                        <span className="flex size-4.5 items-center justify-center rounded-full bg-[#FEF3C7] text-[10px] text-[#D97706]">
                          ◷
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64707D] tabular-nums">
                        Baseline Reference · ☁ 0%
                      </p>
                      <div className="mt-1">
                        <span className="inline-block rounded-md bg-[#FEF3C7] px-2 py-0.5 text-[10px] font-semibold text-[#D97706]">
                          Siamese F1: {site.benchmarks.f1}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Emerald Green Primary CTA (Exact Ref 2 Footer) */}
                <div className="border-t border-[#E6EAEE] pt-3">
                  <div className="mb-2 flex items-center justify-between text-xs">
                    <span className="text-[#64707D]">Detected footprint:</span>
                    <span className="font-bold text-[#111827] tabular-nums">
                      {site.pillBadge} ({site.bfast.breakMagnitude})
                    </span>
                  </div>
                  <Link
                    href="/analyze"
                    className="flex w-full items-center justify-center rounded-xl bg-[#00875A] py-3 text-xs font-bold text-white shadow-md hover:bg-[#006E49] transition-colors"
                  >
                    Launch Interactive Map Studio
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </aside>

        {/* ===================================================================
            RIGHT-EDGE WIREFRAME [ + | − ] ZOOM CONTROL (Exact Reference 1)
           =================================================================== */}
        <div className="pointer-events-auto absolute right-5 top-1/2 -translate-y-1/2 z-20 flex flex-col border border-white/85 bg-[#0C1014]/35 backdrop-blur-xs shadow-lg">
          <button
            type="button"
            onClick={() => setSwathZoom((z) => Math.min(1.4, Number((z + 0.12).toFixed(2))))}
            className="flex size-8 items-center justify-center border-b border-white/75 text-lg font-light text-white hover:bg-white/20 transition-colors"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => setSwathZoom((z) => Math.max(1.0, Number((z - 0.12).toFixed(2))))}
            className="flex size-8 items-center justify-center text-lg font-light text-white hover:bg-white/20 transition-colors"
            aria-label="Zoom out"
          >
            −
          </button>
        </div>

        {/* ===================================================================
            BOTTOM HORIZONTAL LAYER CHECKLIST BAR (Exact Reference 1)
           =================================================================== */}
        <div className="pointer-events-none absolute bottom-5 inset-x-0 z-20 flex justify-center px-4">
          <div
            role="group"
            aria-label="Showcase map layers"
            className="pointer-events-auto flex flex-wrap items-center justify-center shadow-[0_16px_40px_rgba(0,0,0,0.75)]"
          >
            {(
              [
                { key: "titles", label: "Titles" },
                { key: "indicators", label: "Mining & Change Indicators" },
                { key: "aoi", label: "Areas of Interest" },
                { key: "protectedAreas", label: "Protected areas" },
                { key: "restrictedAreas", label: "Restricted areas" },
              ] as const
            ).map(({ key, label }) => {
              const checked = layers[key];
              return (
                <button
                  key={key}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  onClick={() => toggleLayer(key)}
                  className={`flex items-center gap-2.5 px-5 py-2.5 text-xs font-medium transition-all cursor-pointer focus-visible:outline-none ${
                    checked
                      ? "z-10 -my-1 border-2 border-white bg-white/35 py-3.5 font-semibold text-white backdrop-blur-md shadow-lg"
                      : "border border-white/70 bg-[#0C1014]/55 text-white/90 hover:bg-white/15 backdrop-blur-xs"
                  }`}
                >
                  <span
                    className={`flex size-4 items-center justify-center border ${
                      checked
                        ? "border-white bg-white text-[#0F4C6C]"
                        : "border-white/85 bg-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    {checked ? (
                      <svg
                        className="size-3"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : null}
                  </span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
