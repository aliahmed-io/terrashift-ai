"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StudioNav } from "@/components/studio-nav";
import { KSA_MISSION_SITES, type KsaMissionSite } from "@/data/ksaMissionData";

type SpectralBandMode = "ndvi" | "rgb" | "ndbi" | "gradcam";

const SPECTRAL_BANDS: readonly { id: SpectralBandMode; label: string; isCyan?: boolean }[] = [
  { id: "ndvi", label: "NDVI & Urban Heat" },
  { id: "rgb", label: "True Color (B04-03-02)" },
  { id: "ndbi", label: "NDBI Built-Up" },
  { id: "gradcam", label: "Grad-CAM++ Saliency", isCyan: true },
] as const;

function getSpectralFilterStyle(mode: SpectralBandMode): string {
  switch (mode) {
    case "ndvi":
      return "brightness-105 contrast-115 saturate-125";
    case "rgb":
      return "brightness-100 contrast-105 saturate-95 hue-rotate-[-12deg]";
    case "ndbi":
      return "brightness-105 contrast-125 saturate-150 hue-rotate-[32deg]";
    case "gradcam":
      return "brightness-110 contrast-135 saturate-160 hue-rotate-[175deg]";
  }
}

export function StitchCommandDeck() {
  const [selectedSiteId, setSelectedSiteId] = useState<string>(KSA_MISSION_SITES[0]!.id);
  const [spectralMode, setSpectralMode] = useState<SpectralBandMode>("ndvi");
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [countdownStr, setCountdownStr] = useState<string>("04h : 18m : 22s");

  const activeSite: KsaMissionSite =
    KSA_MISSION_SITES.find((s) => s.id === selectedSiteId) ?? KSA_MISSION_SITES[0]!;

  useEffect(() => {
    let totalSeconds = 4 * 3600 + 18 * 60 + 22;
    const id = setInterval(() => {
      if (totalSeconds > 0) {
        totalSeconds -= 1;
        const h = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
        const m = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
        const s = String(totalSeconds % 60).padStart(2, "0");
        setCountdownStr(`${h}h : ${m}m : ${s}s`);
      }
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const studioAnalyzeHref = `/analyze?lat=${activeSite.lat}&lon=${activeSite.lon}&t1=2018&t2=2024`;

  return (
    <div className="min-h-screen bg-[#04070B] text-[#F0F4F8] hud-grid flex flex-col selection:bg-[#FFB020] selection:text-[#04070B]">
      {/* 1. Top Orbital Telemetry HUD Navbar */}
      <StudioNav />

      {/* 2. Sub-Header KSA AOI Selector & Geodetic Ribbon */}
      <section className="border-b border-[#334155]/30 bg-[#090E17]/80 backdrop-blur-md px-4 py-2.5 z-30">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Quick-Switcher Horizontal Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#FFB020] font-bold flex items-center gap-1 me-1 shrink-0">
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polygon points="3 11 22 2 13 21 11 13 3 11" />
              </svg>
              AOI:
            </span>

            {KSA_MISSION_SITES.map((site) => {
              const isSelected = site.id === activeSite.id;
              return (
                <button
                  key={site.id}
                  type="button"
                  onClick={() => setSelectedSiteId(site.id)}
                  className={`px-3 py-1.5 rounded font-mono text-[11px] whitespace-nowrap flex items-center gap-2 transition-all ${
                    isSelected
                      ? "bg-[#FFB020]/15 text-[#FFB020] border border-[#FFB020]/50 font-semibold shadow-[0_0_12px_rgba(255,176,32,0.2)]"
                      : "bg-[#0D1424]/50 hover:bg-[#0D1424] text-[#94A3B8] hover:text-[#F0F4F8] border border-[#334155]/30"
                  }`}
                >
                  {isSelected ? (
                    <span className="size-1.5 rounded-full bg-[#FFB020]" aria-hidden="true" />
                  ) : null}
                  <span>{site.pillTitle}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      isSelected
                        ? "bg-[#FFB020] text-[#04070B]"
                        : site.pillBadgeTone === "cyan"
                          ? "text-[#38E8FF]"
                          : site.pillBadgeTone === "emerald"
                            ? "text-[#00F5A0]"
                            : "text-[#94A3B8]"
                    }`}
                  >
                    {site.pillBadge}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Telemetry Coordinates Ribbon */}
          <div className="hidden md:flex items-center gap-3 font-mono text-[11px] text-[#94A3B8]">
            <span className="bg-[#04070B]/70 border border-[#334155]/30 px-2.5 py-1 rounded">
              <span className="text-[#94A3B8]">CRS:</span>{" "}
              <span className="text-[#38E8FF] font-bold">{activeSite.crs}</span>
            </span>
            <span className="bg-[#04070B]/70 border border-[#334155]/30 px-2.5 py-1 rounded">
              <span className="text-[#94A3B8]">CLOUD:</span>{" "}
              <span className="text-[#00F5A0] font-bold">{activeSite.cloudCover}</span>
            </span>
            <span className="bg-[#04070B]/70 border border-[#334155]/30 px-2.5 py-1 rounded">
              <span className="text-[#94A3B8]">DEPTH:</span>{" "}
              <span className="text-[#FFB020] font-bold">{activeSite.depth}</span>
            </span>
          </div>
        </div>
      </section>

      {/* Main Mission Workspace */}
      <main className="max-w-[1920px] w-full mx-auto px-4 py-4 space-y-4 flex-1">
        {/* 3. Hero Multi-Spectral Split-Curtain Viewport */}
        <section
          id="viewport-hero"
          className="relative rounded-xl border border-[#334155]/40 bg-[#090E17] overflow-hidden shadow-2xl"
        >
          {/* Top Viewport Control Bar Overlay */}
          <div className="absolute top-0 inset-x-0 z-20 flex flex-wrap items-center justify-between gap-3 p-3.5 bg-gradient-to-b from-[#04070B]/95 via-[#04070B]/70 to-transparent backdrop-blur-sm">
            {/* AOI Target Header */}
            <div className="flex items-center gap-2.5">
              <span className="p-1.5 rounded bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/35">
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-[#F0F4F8]">
                    {activeSite.targetHeader}
                  </h1>
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#00F5A0]/15 text-[#00F5A0] border border-[#00F5A0]/35">
                    {activeSite.mgrs}
                  </span>
                </div>
                <p className="text-[10px] font-mono text-[#94A3B8]">
                  {activeSite.acquisitionSubtitle}
                </p>
              </div>
            </div>

            {/* Spectral Layer Switcher */}
            <div className="flex flex-wrap items-center gap-1.5 bg-[#0D1424]/90 border border-[#334155]/40 p-1 rounded-lg backdrop-blur-md">
              {SPECTRAL_BANDS.map((band) => {
                const active = spectralMode === band.id;
                return (
                  <button
                    key={band.id}
                    type="button"
                    onClick={() => setSpectralMode(band.id)}
                    className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors flex items-center gap-1.5 ${
                      active
                        ? "bg-[#FFB020] text-[#04070B] font-bold shadow-[0_0_10px_rgba(255,176,32,0.3)]"
                        : band.isCyan
                          ? "text-[#38E8FF] hover:bg-[#38E8FF]/10 font-medium"
                          : "text-[#94A3B8] hover:text-[#F0F4F8] font-medium"
                    }`}
                  >
                    {band.isCyan ? (
                      <span
                        className={`size-1.5 rounded-full ${
                          active ? "bg-[#04070B]" : "bg-[#38E8FF]"
                        }`}
                        aria-hidden="true"
                      />
                    ) : null}
                    {band.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Corner HUD Reticle Graphics */}
          <div className="pointer-events-none absolute inset-x-0 top-16 bottom-14 z-10 px-4 py-2 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <div className="text-[10px] font-mono text-[#94A3B8]/80 border-t border-s border-[#FFB020]/50 pt-1 ps-1.5">
                FRAME: 1024x1024 TILED // {spectralMode.toUpperCase()}
              </div>
              <div className="text-[10px] font-mono text-[#94A3B8]/80 border-t border-e border-[#FFB020]/50 pt-1 pe-1.5 text-end">
                {activeSite.frameCoords}
              </div>
            </div>
            <div className="flex justify-between items-end">
              <div className="flex items-center gap-3 bg-[#04070B]/85 border border-[#334155]/40 px-2.5 py-1 rounded text-[10px] font-mono">
                <span>SCALE BAR:</span>
                <div className="w-24 h-1.5 bg-[#334155]/60 flex">
                  <div className="w-1/2 bg-[#F0F4F8]" />
                  <div className="w-1/2 bg-[#04070B]" />
                </div>
                <span>0 — 5.0 KM</span>
              </div>
              <div className="flex items-center gap-2 bg-[#04070B]/85 border border-[#334155]/40 px-2.5 py-1 rounded text-[10px] font-mono text-[#FFB020]">
                <span>▲ ORBIT PASS: ASCENDING</span>
              </div>
            </div>
          </div>

          {/* Split Curtain Viewport Canvas Container */}
          <div className="relative w-full h-[500px] md:h-[600px] overflow-hidden select-none bg-[#04070B]">
            {/* Left Side: Temporal Anchor T0 (2018 Pre-Development Baseline) */}
            <div className="absolute inset-0 size-full">
              <img
                src={activeSite.baseImage}
                alt={`${activeSite.pillTitle} 2018 Sentinel-2 baseline`}
                className="size-full object-cover object-center brightness-95 contrast-105"
              />
              <div className="absolute bottom-14 start-6 z-10 bg-[#04070B]/90 backdrop-blur-md border border-[#334155]/50 px-3 py-1.5 rounded">
                <span className="text-[10px] font-mono text-[#94A3B8] uppercase tracking-wider block">
                  Temporal Anchor T₀
                </span>
                <span className="text-xs font-mono font-bold text-[#F0F4F8]">
                  {activeSite.anchorT0Label}
                </span>
              </div>
            </div>

            {/* Right Side: Neural Inferred T1 (2024 Multispectral Change Overlay clipped via clipPath) */}
            <div
              className="absolute inset-0 size-full"
              style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            >
              <img
                src={activeSite.overlayImage}
                alt={`${activeSite.pillTitle} 2024 AI Multispectral Change Detection`}
                className={`size-full object-cover object-center transition-all duration-300 ${getSpectralFilterStyle(
                  spectralMode,
                )}`}
              />
              <div className="absolute bottom-14 end-6 z-10 bg-[#04070B]/90 backdrop-blur-md border border-[#FFB020]/50 px-3 py-1.5 rounded shadow-[0_0_15px_rgba(255,176,32,0.2)]">
                <span className="text-[10px] font-mono text-[#FFB020] uppercase tracking-wider block">
                  Neural Inferred T₁ · {spectralMode.toUpperCase()}
                </span>
                <span className="text-xs font-mono font-bold text-[#FFB020]">
                  {activeSite.inferredT1Label}
                </span>
              </div>
            </div>

            {/* Interactive Split Laser Divider Line & Central Drag Handle */}
            <div
              className="absolute top-0 bottom-0 z-20 pointer-events-none flex items-center justify-center -translate-x-1/2"
              style={{ left: `${sliderPos}%` }}
            >
              <div className="w-[2px] h-full bg-gradient-to-b from-[#FFB020] via-[#38E8FF] to-[#FFB020] shadow-[0_0_12px_#FFB020]" />
              <div className="absolute size-12 rounded-full bg-[#090E17] border-2 border-[#FFB020] flex items-center justify-center text-[#FFB020] shadow-[0_0_20px_rgba(255,176,32,0.6)]">
                <span className="text-[10px] font-mono font-bold tracking-tighter">◄ │ ►</span>
              </div>
            </div>

            {/* Range Slider Input Overlaid (Seamless touch/mouse dragging across viewport) */}
            <input
              aria-label="Split-Curtain Slider 2018 vs 2024"
              type="range"
              min={5}
              max={95}
              value={sliderPos}
              onChange={(e) => setSliderPos(Number(e.target.value))}
              className="absolute inset-0 size-full opacity-0 cursor-ew-resize z-30"
            />
          </div>

          {/* Bottom Floating Telemetry & Controls Strip */}
          <div className="border-t border-[#334155]/30 bg-[#0D1424]/50 backdrop-blur-md p-3 flex flex-wrap items-center justify-between gap-4">
            {/* Legend Pill Indicators */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-[#00F5A0] shadow-[0_0_8px_#00F5A0]" />
                <span className="text-[#F0F4F8]">Green Infrastructure (+ΔNDVI &gt; 0.35)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-[#FFB020] shadow-[0_0_8px_#FFB020]" />
                <span className="text-[#F0F4F8]">Urban Expansion (+ΔNDBI Built-Up)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded bg-[#FF3B5C] shadow-[0_0_8px_#FF3B5C]" />
                <span className="text-[#F0F4F8]">Thermal Heat Concentration (+ΔLST &gt; 3.2°C)</span>
              </div>
            </div>

            {/* Tactical Viewport Action Buttons */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setSliderPos(50)}
                className="px-2.5 py-1.5 rounded bg-[#04070B]/80 border border-[#334155]/40 hover:border-[#FFB020]/50 text-[#94A3B8] hover:text-[#F0F4F8] transition-colors"
              >
                Recenter Curtain (50%)
              </button>
              <Link
                href="/lab"
                className="px-2.5 py-1.5 rounded bg-[#04070B]/80 border border-[#334155]/40 hover:border-[#FFB020]/50 text-[#94A3B8] hover:text-[#F0F4F8] transition-colors"
              >
                Open Image Pair Lab
              </Link>
              <Link
                href={studioAnalyzeHref}
                className="px-3 py-1.5 rounded bg-[#04070B]/90 border border-[#38E8FF]/45 hover:bg-[#38E8FF]/15 text-[#38E8FF] font-semibold flex items-center gap-1.5 transition-colors"
              >
                <span>Open Live GIS Map Studio ({activeSite.pillTitle.split(" ")[0]}) →</span>
              </Link>
            </div>
          </div>
        </section>

        {/* 4. Bento Command Grid (Deep Analytical Telemetry) */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* PANEL A: SIAMESE U-NET AI INFERENCE BENCHMARKS (4 cols) */}
          <div
            id="benchmarks"
            className="lg:col-span-4 rounded-xl border border-[#334155]/35 bg-[#090E17] p-4 backdrop-blur-xl relative overflow-hidden flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#334155]/25 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/30">
                    <svg
                      className="size-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <rect x="4" y="4" width="16" height="16" rx="2" />
                      <rect x="9" y="9" width="6" height="6" />
                      <path d="M15 2v2M9 2v2M20 15h2M20 9h2M15 20v2M9 20v2M2 15h2M2 9h2" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="font-bold text-xs uppercase tracking-wider text-[#F0F4F8]">
                      SIAMESE NEURAL BACKBONE
                    </h2>
                    <p className="text-[10px] font-mono text-[#94A3B8]">
                      FC-Siam-diff vs STANet vs BIT-CD
                    </p>
                  </div>
                </div>
                <Link
                  href="/benchmarks"
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00F5A0]/15 text-[#00F5A0] border border-[#00F5A0]/30 font-semibold hover:bg-[#00F5A0]/25 transition-colors"
                >
                  OPEN XAI LAB →
                </Link>
              </div>

              {/* Primary KPI Metric Cards */}
              <div className="grid grid-cols-2 gap-2.5 mb-4">
                <div className="p-3 rounded-lg bg-[#0D1424]/50 border border-[#334155]/25">
                  <div className="text-[10px] font-mono text-[#94A3B8]">CHANGE IOU</div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-mono font-bold text-[#00F5A0] tabular-nums">
                      {activeSite.benchmarks.iou}
                    </span>
                    <span className="text-[10px] font-mono text-[#00F5A0]">
                      {activeSite.benchmarks.iouDelta}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#0D1424] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-[#00F5A0] rounded-full transition-all duration-500"
                      style={{ width: activeSite.benchmarks.iou }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0D1424]/50 border border-[#334155]/25">
                  <div className="text-[10px] font-mono text-[#94A3B8]">F1-SCORE</div>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    <span className="text-2xl font-mono font-bold text-[#38E8FF] tabular-nums">
                      {activeSite.benchmarks.f1}
                    </span>
                    <span className="text-[10px] font-mono text-[#38E8FF]">
                      {activeSite.benchmarks.f1Delta}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-[#0D1424] rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-[#38E8FF] rounded-full transition-all duration-500"
                      style={{ width: activeSite.benchmarks.f1 }}
                    />
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0D1424]/50 border border-[#334155]/25">
                  <div className="text-[10px] font-mono text-[#94A3B8]">PRECISION</div>
                  <div className="text-xl font-mono font-bold text-[#F0F4F8] mt-1 tabular-nums">
                    {activeSite.benchmarks.precision}
                  </div>
                  <div className="text-[9px] font-mono text-[#94A3B8] mt-0.5">
                    Low False Positives
                  </div>
                </div>

                <div className="p-3 rounded-lg bg-[#0D1424]/50 border border-[#334155]/25">
                  <div className="text-[10px] font-mono text-[#94A3B8]">RECALL</div>
                  <div className="text-xl font-mono font-bold text-[#F0F4F8] mt-1 tabular-nums">
                    {activeSite.benchmarks.recall}
                  </div>
                  <div className="text-[9px] font-mono text-[#94A3B8] mt-0.5">
                    Ground Truth Align
                  </div>
                </div>
              </div>

              {/* 4-Stage Encoder Feature Difference Heatmaps preview bars */}
              <div className="space-y-2 bg-[#04070B]/60 p-3 rounded-lg border border-[#334155]/25 font-mono text-[11px]">
                <div className="flex justify-between items-center text-[10px] text-[#94A3B8] mb-1">
                  <span>SIAMESE ENCODER DIFF ATTENTION</span>
                  <span className="text-[#FFB020] font-bold">L4 PYRAMID</span>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span>Stage 1 (Conv2_x / Edge Gradients)</span>
                    <span className="text-[#F0F4F8]">{activeSite.benchmarks.stage1Pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0D1424] rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FFB020] to-amber-300 rounded"
                      style={{ width: `${activeSite.benchmarks.stage1Pct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span>Stage 2 (Conv3_x / Spectral Textures)</span>
                    <span className="text-[#F0F4F8]">{activeSite.benchmarks.stage2Pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0D1424] rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#FFB020] to-[#38E8FF] rounded"
                      style={{ width: `${activeSite.benchmarks.stage2Pct}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] mb-0.5">
                    <span>Stage 3 &amp; 4 (High Semantic / Structural Shift)</span>
                    <span className="text-[#F0F4F8]">{activeSite.benchmarks.stage34Pct}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-[#0D1424] rounded overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#38E8FF] to-[#00F5A0] rounded"
                      style={{ width: `${activeSite.benchmarks.stage34Pct}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-[10px] font-mono text-[#94A3B8]">
              <span>BATCH SIZE: 16 TILES</span>
              <span>CHIP: 1024x1024</span>
              <span className="text-[#00F5A0]">INFERENCE: {activeSite.benchmarks.latencyMs}</span>
            </div>
          </div>

          {/* PANEL B: BFAST STRUCTURAL BREAKPOINT & URBANIZATION (5 cols) */}
          <div
            id="bfast"
            className="lg:col-span-5 rounded-xl border border-[#334155]/35 bg-[#090E17] p-4 backdrop-blur-xl relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#334155]/25 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded bg-[#38E8FF]/20 text-[#38E8FF] border border-[#38E8FF]/30">
                    <svg
                      className="size-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M3 3v18h18" />
                      <path d="m19 9-5 5-4-4-3 3" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="font-bold text-xs uppercase tracking-wider text-[#F0F4F8]">
                      BFAST TEMPORAL BREAKPOINT ANALYSIS
                    </h2>
                    <p className="text-[10px] font-mono text-[#94A3B8]">
                      {activeSite.bfast.subtitle}
                    </p>
                  </div>
                </div>
                <Link
                  href="/timeline"
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#FFB020]/20 text-[#FFB020] border border-[#FFB020]/30 font-semibold hover:bg-[#FFB020]/30 transition-colors"
                >
                  2030 FORECAST →
                </Link>
              </div>

              {/* Temporal SVG Visualization */}
              <div className="relative w-full h-48 bg-[#04070B]/70 rounded-lg border border-[#334155]/25 p-3 overflow-hidden flex flex-col justify-end">
                {/* Background Grid lines */}
                <div className="absolute inset-0 flex flex-col justify-between p-3 pointer-events-none opacity-20">
                  <div className="border-b border-dashed border-[#334155] w-full" />
                  <div className="border-b border-dashed border-[#334155] w-full" />
                  <div className="border-b border-dashed border-[#334155] w-full" />
                </div>

                {/* SVG Trajectory Line */}
                <svg
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                  viewBox="0 0 500 120"
                  aria-label="BFAST temporal trajectory chart"
                >
                  <path
                    d={activeSite.bfast.svgPathBaseline}
                    fill="none"
                    stroke="#FFB020"
                    strokeLinecap="round"
                    strokeWidth="2.5"
                  />
                  <path
                    d={activeSite.bfast.svgPathUpperCi}
                    fill="none"
                    opacity="0.6"
                    stroke="#38E8FF"
                    strokeDasharray="3,3"
                    strokeWidth="1"
                  />
                  {activeSite.bfast.markers.map((m, idx) => (
                    <circle key={idx} cx={m.cx} cy={m.cy} fill={m.color} r="4.5" />
                  ))}
                </svg>

                {/* Temporal Timeline Annotations */}
                <div className="relative z-10 grid grid-cols-4 gap-2 text-[9px] font-mono text-[#94A3B8] pt-2 border-t border-[#334155]/25">
                  {activeSite.bfast.timelineLabels.map((item, idx) => (
                    <div
                      key={item.year}
                      className={
                        idx === 0
                          ? "text-start"
                          : idx === activeSite.bfast.timelineLabels.length - 1
                            ? "text-end"
                            : "text-center"
                      }
                    >
                      <span
                        className={`font-semibold block ${
                          item.tone === "crimson"
                            ? "text-[#FF3B5C]"
                            : item.tone === "emerald"
                              ? "text-[#00F5A0]"
                              : item.tone === "cyan"
                                ? "text-[#38E8FF]"
                                : "text-[#F0F4F8]"
                        }`}
                      >
                        {item.year}
                      </span>
                      <span>{item.subtitle}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Trajectory Stats & Annotations */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[#334155]/25 text-center font-mono">
              <div className="p-2 rounded bg-[#0D1424]/40 border border-[#334155]/20">
                <span className="text-[9px] text-[#94A3B8] block">BREAK MAGNITUDE</span>
                <span className="text-xs font-bold text-[#FFB020]">
                  {activeSite.bfast.breakMagnitude}
                </span>
              </div>
              <div className="p-2 rounded bg-[#0D1424]/40 border border-[#334155]/20">
                <span className="text-[9px] text-[#94A3B8] block">CONFIDENCE</span>
                <span className="text-xs font-bold text-[#00F5A0]">
                  {activeSite.bfast.confidence}
                </span>
              </div>
              <div className="p-2 rounded bg-[#0D1424]/40 border border-[#334155]/20">
                <span className="text-[9px] text-[#94A3B8] block">CYCLE FREQUENCY</span>
                <span className="text-xs font-bold text-[#38E8FF]">
                  {activeSite.bfast.cycleFrequency}
                </span>
              </div>
            </div>
          </div>

          {/* PANEL C: IPCC 4-POOL CARBON & URBAN HEAT ISLAND (3 cols) */}
          <div
            id="carbon-uhi"
            className="lg:col-span-3 rounded-xl border border-[#334155]/35 bg-[#090E17] p-4 backdrop-blur-xl relative flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between border-b border-[#334155]/25 pb-3 mb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1.5 rounded bg-[#00F5A0]/20 text-[#00F5A0] border border-[#00F5A0]/30">
                    <svg
                      className="size-3.5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                  </span>
                  <div>
                    <h2 className="font-bold text-xs uppercase tracking-wider text-[#F0F4F8]">
                      CARBON &amp; UHI TELEMETRY
                    </h2>
                    <p className="text-[10px] font-mono text-[#94A3B8]">
                      IPCC Tier-1 4-Pool Modeling
                    </p>
                  </div>
                </div>
                <Link
                  href="/carbon"
                  className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#00F5A0]/20 text-[#00F5A0] border border-[#00F5A0]/30 font-semibold hover:bg-[#00F5A0]/30 transition-colors"
                >
                  {activeSite.carbonUhi.badge} →
                </Link>
              </div>

              {/* Carbon Delta */}
              <div className="p-3 rounded-lg bg-[#0D1424]/50 border border-[#334155]/25 mb-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-[#94A3B8]">
                  <span>PROJECTED SEQUESTRATION</span>
                  <span className="text-[#00F5A0] font-bold">
                    {activeSite.carbonUhi.sequestrationYoy}
                  </span>
                </div>
                <div className="text-2xl font-mono font-black text-[#00F5A0] mt-1 tabular-nums">
                  {activeSite.carbonUhi.sequestrationDelta}{" "}
                  <span className="text-xs font-normal text-[#94A3B8]">tCO₂e</span>
                </div>
                <p className="text-[9px] font-mono text-[#94A3B8] mt-1">
                  {activeSite.carbonUhi.sequestrationNote}
                </p>
              </div>

              {/* UHI Microclimate Cooling */}
              <div className="p-3 rounded-lg bg-[#0D1424]/50 border border-[#334155]/25 mb-3">
                <div className="flex justify-between items-center text-[10px] font-mono text-[#94A3B8]">
                  <span>LAND SURFACE TEMP (ΔLST)</span>
                  <span className="text-[#38E8FF] font-bold">
                    {activeSite.carbonUhi.deltaLstZoneLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-mono font-black text-[#38E8FF] tabular-nums">
                    {activeSite.carbonUhi.deltaLst}
                  </span>
                  <span className="text-[10px] font-mono text-[#94A3B8]">
                    {activeSite.carbonUhi.deltaLstCompare}
                  </span>
                </div>
                <div className="w-full bg-[#04070B] h-1.5 rounded-full mt-2 overflow-hidden flex">
                  <div className="bg-[#38E8FF] h-full" style={{ width: "48%" }} />
                  <div className="bg-[#FF3B5C] h-full" style={{ width: "52%" }} />
                </div>
              </div>
            </div>

            {/* Water Stress Telemetry Gauges */}
            <div className="p-2.5 rounded bg-[#04070B]/70 border border-[#334155]/25 font-mono text-[10px]">
              <div className="flex justify-between mb-1">
                <span className="text-[#94A3B8]">NDWI Moisture Index:</span>
                <span className="text-[#38E8FF] font-bold">{activeSite.carbonUhi.ndwi}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#94A3B8]">NDRE Chlorophyll:</span>
                <span className="text-[#00F5A0] font-bold">{activeSite.carbonUhi.ndre}</span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. Panel D: Live Orbital Tasking & STAC Ingestion Pipeline */}
        <section
          id="stac"
          className="rounded-xl border border-[#334155]/35 bg-[#090E17] p-4 backdrop-blur-xl"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#334155]/25 pb-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="size-9 rounded-lg bg-[#0D1424] border border-[#FFB020]/35 flex items-center justify-center text-[#FFB020]">
                <svg
                  className="size-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <ellipse cx="12" cy="5" rx="9" ry="3" />
                  <path d="M3 5V19A9 3 0 0 0 21 19V5" />
                  <path d="M3 12A9 3 0 0 0 21 12" />
                </svg>
              </div>
              <div>
                <h2 className="font-bold text-xs uppercase tracking-wider text-[#F0F4F8]">
                  LEO TASKING &amp; STAC INGESTION STATUS
                </h2>
                <p className="text-[10px] font-mono text-[#94A3B8]">
                  Sentinel-2B Overpass Vector // Element84 AWS SpatioTemporal Asset Catalog API v1.0
                </p>
              </div>
            </div>

            {/* Overpass Countdown Counter */}
            <div className="flex flex-wrap items-center gap-3 font-mono">
              <div className="bg-[#04070B]/80 border border-[#334155]/35 px-3 py-1.5 rounded text-xs flex items-center gap-2">
                <span className="size-2 rounded-full bg-[#FFB020] animate-ping" aria-hidden="true" />
                <span className="text-[#94A3B8]">NEXT PASS:</span>
                <span className="text-[#FFB020] font-bold tabular-nums">{countdownStr}</span>
              </div>
              <div className="hidden sm:block text-[11px] text-[#94A3B8]">
                AWS S3 BUCKET: <span className="text-[#38E8FF] font-bold">14.8 TB</span>
              </div>
              <Link
                href="/watchlist"
                className="px-3 py-1.5 rounded bg-[#FFB020]/15 border border-[#FFB020]/40 text-[#FFB020] text-xs font-bold hover:bg-[#FFB020] hover:text-[#04070B] transition-colors"
              >
                QUERY LIVE STAC CATALOG →
              </Link>
            </div>
          </div>

          {/* Live Stream Steps Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
            <Link
              href="/watchlist"
              className="p-3 rounded-lg bg-[#0D1424]/40 border border-[#334155]/25 hover:border-[#00F5A0]/50 flex items-center justify-between transition-colors"
            >
              <div>
                <span className="text-[#F0F4F8] block font-semibold text-[11px]">
                  ESA Copernicus Hub
                </span>
                <span className="text-[10px] text-[#94A3B8]">B02..B12 L2A STAC Feed</span>
              </div>
              <span className="text-[10px] text-[#00F5A0] bg-[#00F5A0]/10 border border-[#00F5A0]/25 px-2 py-0.5 rounded">
                SYNCED
              </span>
            </Link>

            <Link
              href="/lab"
              className="p-3 rounded-lg bg-[#0D1424]/40 border border-[#334155]/25 hover:border-[#38E8FF]/50 flex items-center justify-between transition-colors"
            >
              <div>
                <span className="text-[#F0F4F8] block font-semibold text-[11px]">
                  Sen2Cor Radiometry &amp; Pair Lab
                </span>
                <span className="text-[10px] text-[#94A3B8]">BOA L2A + Custom Pair Sandbox</span>
              </div>
              <span className="text-[10px] text-[#38E8FF] bg-[#38E8FF]/10 border border-[#38E8FF]/25 px-2 py-0.5 rounded">
                ACTIVE
              </span>
            </Link>

            <Link
              href="/benchmarks"
              className="p-3 rounded-lg bg-[#0D1424]/40 border border-[#334155]/25 hover:border-[#FFB020]/50 flex items-center justify-between transition-colors"
            >
              <div>
                <span className="text-[#F0F4F8] block font-semibold text-[11px]">
                  Siamese U-Net (FC-Siam-diff)
                </span>
                <span className="text-[10px] text-[#94A3B8]">5-Channel + Grad-CAM++ XAI</span>
              </div>
              <span className="text-[10px] text-[#FFB020] bg-[#FFB020]/10 border border-[#FFB020]/25 px-2 py-0.5 rounded">
                {activeSite.benchmarks.latencyMs}
              </span>
            </Link>

            <Link
              href={studioAnalyzeHref}
              className="p-3 rounded-lg bg-[#0D1424]/40 border border-[#334155]/25 hover:border-[#F0F4F8]/50 flex items-center justify-between transition-colors"
            >
              <div>
                <span className="text-[#F0F4F8] block font-semibold text-[11px]">
                  Cloud-COG &amp; GeoJSON Vector
                </span>
                <span className="text-[10px] text-[#94A3B8]">RFC 7946 + Executive PDF</span>
              </div>
              <span className="text-[10px] text-[#F0F4F8] bg-[#04070B] border border-[#334155]/40 px-2 py-0.5 rounded">
                READY
              </span>
            </Link>
          </div>
        </section>
      </main>

      {/* Cockpit Footer */}
      <footer className="border-t border-[#334155]/25 bg-[#04070B]/90 backdrop-blur-xl px-4 py-3 mt-4 text-[#94A3B8] text-[11px] font-mono">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-[#FFB020] font-bold">TERRASHIFT AI // ORBITAL</span>
            <span className="text-[#334155]">|</span>
            <span>Kingdom of Saudi Arabia Vision 2030 Earth Observation</span>
          </div>
          <div className="flex items-center gap-4">
            <span>PyTorch 2.14 · Siamese U-Net · STAC v1.0.0</span>
            <span className="text-[#334155]">|</span>
            <span className="text-[#00F5A0] flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-[#00F5A0]" aria-hidden="true" />
              All Sensor Feeds Nominal
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
