"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function IconZoomIn() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M11 8v6" />
      <path d="M8 11h6" />
    </svg>
  );
}

function IconZoomOut() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
      <path d="M8 11h6" />
    </svg>
  );
}

function IconClose() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function IconChevronDown() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconArrowLeft() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function IconArrowRight() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

type ScreenId =
  | "dossier"
  | "studio"
  | "benchmarks"
  | "timeline"
  | "lab"
  | "carbon"
  | "watchlist";

const NAV_TABS: { id: ScreenId; label: string }[] = [
  { id: "dossier", label: "Overview" },
  { id: "studio", label: "NDVI & Spectral" },
  { id: "benchmarks", label: "Anomaly" },
  { id: "timeline", label: "Trajectory" },
  { id: "lab", label: "Pair Lab" },
  { id: "carbon", label: "Carbon" },
  { id: "watchlist", label: "Watchlist" },
];

function TempDesignShowcaseInner() {
  const searchParams = useSearchParams();
  const initialScreen = (searchParams.get("screen") as ScreenId) || "dossier";
  const [screen, setScreen] = useState<ScreenId>(initialScreen);
  const [activeMonth, setActiveMonth] = useState<string>("Jul");
  const [cardSlide, setCardSlide] = useState<0 | 1>(0);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-white text-[#1c1f23] select-none font-sans antialiased overflow-hidden">
      {/* 1. EXACT TOP HEADER BAR FROM REFERENCE */}
      <header className="h-[60px] shrink-0 bg-white px-5 flex items-center justify-between">
        {/* Left: Hamburger + Outlined Icon + Brand */}
        <div className="flex items-center gap-4 min-w-[180px]">
          <button
            type="button"
            aria-label="Menu"
            className="w-8 h-8 flex flex-col items-center justify-center gap-[4px] text-[#22252a] hover:opacity-75 transition-opacity"
          >
            <span className="w-[18px] h-[1.8px] bg-[#22252a] rounded-full" />
            <span className="w-[18px] h-[1.8px] bg-[#22252a] rounded-full" />
            <span className="w-[18px] h-[1.8px] bg-[#22252a] rounded-full" />
          </button>

          <div className="flex items-center gap-2">
            {/* Minimal isometric map-box icon matching reference */}
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
          </div>
        </div>

        {/* Center: Wide Segmented Grey Pill Track (#edeff2) with White Active Pill */}
        <nav
          aria-label="Primary Modes"
          className="flex items-center bg-[#edeff2] p-[3px] rounded-xl w-full max-w-[760px]"
        >
          {NAV_TABS.map((tab) => {
            const active = screen === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setScreen(tab.id);
                  setCardSlide(0);
                }}
                className={`flex-1 py-[7px] px-3 rounded-[9px] text-[12.5px] transition-all text-center whitespace-nowrap ${
                  active
                    ? "bg-white text-[#1c1f23] font-semibold shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
                    : "text-[#636973] font-medium hover:text-[#1c1f23]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>

        {/* Right: Search Icon + Soft Avatar Circle */}
        <div className="flex items-center justify-end gap-3.5 min-w-[180px]">
          <button
            type="button"
            aria-label="Search"
            className="text-[#5c626b] hover:text-[#1c1f23] transition-colors"
          >
            <IconSearch />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#dce5f2] overflow-hidden flex items-center justify-center">
            <svg viewBox="0 0 32 32" className="w-full h-full">
              <circle cx="16" cy="12" r="5" fill="#9bb0ce" />
              <path
                d="M6 29c1.8-5.5 5.4-8 10-8s8.2 2.5 10 8"
                fill="#9bb0ce"
              />
            </svg>
          </div>
        </div>
      </header>

      {/* 2. MAIN VIEWPORT (Full-bleed map canvas + clean white floating card) */}
      <main className="relative flex-1 overflow-hidden bg-[#f6f7f9]">
        {/* =========================================================
            SCREEN 1: OVERVIEW (Full-bleed satellite + Golf Field style white card)
           ========================================================= */}
        {screen === "dossier" && (
          <div className="relative w-full h-full overflow-hidden">
            <img
              src="/api/raster/roshn/split"
              alt="North Riyadh & ROSHN Sedra Sentinel-2 Canvas"
              className="w-full h-full object-cover"
            />

            {/* Top-left dark pill zoom controls + subtle grid numbers */}
            <MapCanvasOverlay />

            {/* Floating White Card (Exact Golf Field proportion, spacing & footer arrows) */}
            <div className="absolute top-12 right-14 w-[380px] bg-white rounded-[22px] shadow-[0_16px_48px_rgba(0,0,0,0.14)] p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-semibold text-[#1c1f23] tracking-[-0.01em]">
                  ROSHN Sedra Corridor
                </h2>
                <button
                  type="button"
                  aria-label="Close card"
                  className="w-6 h-6 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d] hover:text-[#1c1f23]"
                >
                  <IconClose />
                </button>
              </div>

              {cardSlide === 0 ? (
                <>
                  <div className="text-[13px] font-medium text-[#3b4048] mb-5">
                    Anomaly
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        val: "0,380",
                        dist: "3,110 ha",
                        pct: "64 %",
                        w: "64%",
                        color: "bg-[#22b567]",
                      },
                      {
                        val: "0,195",
                        dist: "890 ha",
                        pct: "19 %",
                        w: "19%",
                        color: "bg-[#f39223]",
                      },
                      {
                        val: "0,085",
                        dist: "412 ha",
                        pct: "8 %",
                        w: "8%",
                        color: "bg-[#e94235]",
                      },
                      {
                        val: "0,050",
                        dist: "212 ha",
                        pct: "5 %",
                        w: "5%",
                        color: "bg-[#e94235]",
                      },
                      {
                        val: "0,240",
                        dist: "200 ha",
                        pct: "4 %",
                        w: "4%",
                        color: "bg-[#22b567]",
                      },
                    ].map((row, idx) => (
                      <div key={idx}>
                        <div className="flex items-center justify-between text-[12.5px] mb-2">
                          <span className="font-semibold text-[#1c1f23] tabular-nums">
                            {row.val}
                          </span>
                          <div className="flex items-center gap-3 tabular-nums">
                            <span className="font-medium text-[#3b4048]">
                              {row.dist}
                            </span>
                            <span className="text-[#9aa0aa] w-9 text-right">
                              {row.pct}
                            </span>
                          </div>
                        </div>
                        <div className="h-[5px] w-full bg-[#edeff2] rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${row.color}`}
                            style={{ width: row.w }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[13px] font-medium text-[#3b4048] mb-4">
                    10-Band Reflectance Profile (2018 vs 2024)
                  </div>
                  <svg viewBox="0 0 320 175" className="w-full h-[185px]">
                    {[30, 75, 120, 155].map((y) => (
                      <line
                        key={y}
                        x1="28"
                        y1={y}
                        x2="310"
                        y2={y}
                        stroke="#f0f2f5"
                        strokeWidth="1"
                      />
                    ))}
                    <text x="2" y="34" fill="#9aa0aa" fontSize="9">
                      0,45
                    </text>
                    <text x="2" y="79" fill="#9aa0aa" fontSize="9">
                      0,30
                    </text>
                    <text x="2" y="124" fill="#9aa0aa" fontSize="9">
                      0,15
                    </text>
                    <polyline
                      fill="none"
                      stroke="#c5cad3"
                      strokeWidth="2"
                      strokeDasharray="3 3"
                      points="36,135 66,126 96,112 126,105 156,96 186,88 216,80 246,74 276,60 304,68"
                    />
                    <polyline
                      fill="none"
                      stroke="#22b567"
                      strokeWidth="2.5"
                      points="36,120 66,108 96,90 126,80 156,68 186,54 216,46 246,40 276,26 304,34"
                    />
                    {[
                      ["B02", 36, 120],
                      ["B03", 66, 108],
                      ["B04", 96, 90],
                      ["B05", 126, 80],
                      ["B06", 156, 68],
                      ["B07", 186, 54],
                      ["B08", 216, 46],
                      ["B8A", 246, 40],
                      ["B11", 276, 26],
                      ["B12", 304, 34],
                    ].map(([b, cx, cy]) => (
                      <g key={String(b)}>
                        <circle
                          cx={Number(cx)}
                          cy={Number(cy)}
                          r="3"
                          fill="#22b567"
                        />
                        <text
                          x={Number(cx)}
                          y="170"
                          textAnchor="middle"
                          fill="#8c929c"
                          fontSize="8.5"
                        >
                          {b}
                        </text>
                      </g>
                    ))}
                  </svg>
                </>
              )}

              {/* Bottom Card Carousel Footer (Exact Left Arrow + Dots + Right Arrow) */}
              <div className="mt-7 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setCardSlide(0)}
                  aria-label="Previous slide"
                  className="w-7 h-7 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d] hover:text-[#1c1f23] transition-colors"
                >
                  <IconArrowLeft />
                </button>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cardSlide === 0 ? "bg-[#1c1f23]" : "bg-[#d5d8de]"
                    }`}
                  />
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      cardSlide === 1 ? "bg-[#1c1f23]" : "bg-[#d5d8de]"
                    }`}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setCardSlide(1)}
                  aria-label="Next slide"
                  className="w-7 h-7 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d] hover:text-[#1c1f23] transition-colors"
                >
                  <IconArrowRight />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 2: NDVI & SPECTRAL (Full-bleed NIR Chlorophyll map + floating white card)
           ========================================================= */}
        {screen === "studio" && (
          <div className="relative w-full h-full overflow-hidden">
            <img
              src="/api/raster/roshn/nir"
              alt="Riyadh NIR Chlorophyll Composite"
              className="w-full h-full object-cover"
            />
            <MapCanvasOverlay />

            <div className="absolute top-12 right-14 w-[380px] bg-white rounded-[22px] shadow-[0_16px_48px_rgba(0,0,0,0.14)] p-7">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[18px] font-semibold text-[#1c1f23] tracking-[-0.01em]">
                  Wadi Hanifah Canopy
                </h2>
                <button
                  type="button"
                  aria-label="Close"
                  className="w-6 h-6 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d]"
                >
                  <IconClose />
                </button>
              </div>

              <div className="text-[13px] font-medium text-[#3b4048] mb-5">
                NDVI &amp; Spectral Shift
              </div>

              <div className="space-y-4">
                {[
                  {
                    val: "0,440",
                    dist: "1,143 m",
                    pct: "72 %",
                    w: "72%",
                    color: "bg-[#22b567]",
                  },
                  {
                    val: "0,310",
                    dist: "890 m",
                    pct: "14 %",
                    w: "14%",
                    color: "bg-[#22b567]",
                  },
                  {
                    val: "0,125",
                    dist: "542 m",
                    pct: "7 %",
                    w: "7%",
                    color: "bg-[#f39223]",
                  },
                  {
                    val: "0,065",
                    dist: "310 m",
                    pct: "4 %",
                    w: "4%",
                    color: "bg-[#e94235]",
                  },
                  {
                    val: "0,040",
                    dist: "195 m",
                    pct: "3 %",
                    w: "3%",
                    color: "bg-[#e94235]",
                  },
                ].map((row, idx) => (
                  <div key={idx}>
                    <div className="flex items-center justify-between text-[12.5px] mb-2">
                      <span className="font-semibold text-[#1c1f23] tabular-nums">
                        {row.val}
                      </span>
                      <div className="flex items-center gap-3 tabular-nums">
                        <span className="font-medium text-[#3b4048]">
                          {row.dist}
                        </span>
                        <span className="text-[#9aa0aa] w-9 text-right">
                          {row.pct}
                        </span>
                      </div>
                    </div>
                    <div className="h-[5px] w-full bg-[#edeff2] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${row.color}`}
                        style={{ width: row.w }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-7 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Prev"
                  className="w-7 h-7 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d]"
                >
                  <IconArrowLeft />
                </button>
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#1c1f23]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#d5d8de]" />
                </div>
                <button
                  type="button"
                  aria-label="Next"
                  className="w-7 h-7 rounded-full bg-[#f4f5f7] flex items-center justify-center text-[#7c828d]"
                >
                  <IconArrowRight />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 3: ANOMALY & XAI (4 City Effects + PR Curve + Attribution)
           ========================================================= */}
        {screen === "benchmarks" && (
          <div className="w-full h-full p-6 grid grid-rows-[1.08fr_0.92fr] gap-5 overflow-hidden">
            {/* Top Row: 4 Clean White Cards with the 4 City Effects */}
            <div className="grid grid-cols-4 gap-5 min-h-0">
              {[
                {
                  title: "Siamese ResUNet-10ch",
                  sub: "Attention Posterior",
                  img: "/api/raster/roshn/magma",
                  left: "0,914 F1",
                  right: "84,2 %",
                },
                {
                  title: "Bi-Temporal ΔNDBI",
                  sub: "SWIR Built-Up Index",
                  img: "/api/raster/roshn/ndbi",
                  left: "0,861 F1",
                  right: "75,6 %",
                },
                {
                  title: "NIR Chlorophyll",
                  sub: "Vegetation Composite",
                  img: "/api/raster/roshn/nir",
                  left: "0,838 F1",
                  right: "72,1 %",
                },
                {
                  title: "Ground-Truth Audit",
                  sub: "Pixel Error Map",
                  img: "/api/raster/roshn/confusion",
                  left: "0,938 Prec",
                  right: "89,2 %",
                },
              ].map((card) => (
                <div
                  key={card.title}
                  className="bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-4 flex flex-col min-h-0"
                >
                  <div className="flex items-baseline justify-between mb-3">
                    <h3 className="text-[14px] font-semibold text-[#1c1f23]">
                      {card.title}
                    </h3>
                    <span className="text-[11.5px] text-[#8c929c]">
                      {card.sub}
                    </span>
                  </div>
                  <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                    <img
                      src={card.img}
                      alt={card.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[12.5px] tabular-nums">
                    <span className="font-semibold text-[#1c1f23]">
                      {card.left}
                    </span>
                    <span className="text-[#8c929c]">{card.right}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom Row: PR Operating Curve + 10-Band Attribution Bars */}
            <div className="grid grid-cols-12 gap-5 min-h-0">
              <div className="col-span-6 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                      Precision–Recall Curve
                    </h3>
                    <p className="text-[12px] text-[#8c929c] mt-0.5">
                      LEVIR-CD + OSCD + Riyadh Sentinel-2 Benchmark
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-[11.5px] font-medium text-[#5c626b]">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#22b567]" />
                      ResUNet (0,948)
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-[#f39223]" />
                      ΔNDBI (0,884)
                    </span>
                  </div>
                </div>

                <svg viewBox="0 0 540 165" className="w-full h-[145px]">
                  {[24, 68, 112, 146].map((y) => (
                    <line
                      key={y}
                      x1="36"
                      y1={y}
                      x2="520"
                      y2={y}
                      stroke="#f0f2f5"
                      strokeWidth="1"
                    />
                  ))}
                  <text x="4" y="28" fill="#9aa0aa" fontSize="10">
                    1,00
                  </text>
                  <text x="4" y="72" fill="#9aa0aa" fontSize="10">
                    0,85
                  </text>
                  <text x="4" y="116" fill="#9aa0aa" fontSize="10">
                    0,70
                  </text>
                  <text x="4" y="150" fill="#9aa0aa" fontSize="10">
                    0,55
                  </text>

                  <path
                    d="M 42 54 Q 200 72, 340 105 T 490 144"
                    fill="none"
                    stroke="#f39223"
                    strokeWidth="2.2"
                    strokeDasharray="4 4"
                  />
                  <path
                    d="M 42 28 Q 230 32, 375 46 L 455 78 L 502 122"
                    fill="none"
                    stroke="#22b567"
                    strokeWidth="3"
                  />
                  <circle
                    cx="375"
                    cy="46"
                    r="5.5"
                    fill="#ffffff"
                    stroke="#22b567"
                    strokeWidth="3"
                  />
                  <text
                    x="362"
                    y="34"
                    textAnchor="end"
                    fill="#1c1f23"
                    fontSize="10.5"
                    fontWeight="600"
                  >
                    τ* = 0,45 (F1 = 0,914)
                  </text>
                </svg>
              </div>

              <div className="col-span-6 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                      Spectral Attribution
                    </h3>
                    <p className="text-[12px] text-[#8c929c] mt-0.5">
                      Integrated Gradients contribution across 10 Sentinel-2
                      bands
                    </p>
                  </div>
                  <span className="text-[12px] font-medium text-[#3b4048]">
                    SHAP Verified
                  </span>
                </div>

                <div className="space-y-3.5 my-auto">
                  {[
                    {
                      val: "0,248",
                      label: "B11 · SWIR-1 (1610 nm)",
                      pct: "25 %",
                      w: "78%",
                      color: "bg-[#22b567]",
                    },
                    {
                      val: "0,214",
                      label: "B08 · NIR (842 nm)",
                      pct: "21 %",
                      w: "68%",
                      color: "bg-[#22b567]",
                    },
                    {
                      val: "0,192",
                      label: "B12 · SWIR-2 (2190 nm)",
                      pct: "19 %",
                      w: "60%",
                      color: "bg-[#f39223]",
                    },
                    {
                      val: "0,146",
                      label: "B04 · Red (665 nm)",
                      pct: "15 %",
                      w: "46%",
                      color: "bg-[#e94235]",
                    },
                  ].map((b) => (
                    <div key={b.label}>
                      <div className="flex items-center justify-between text-[12.5px] mb-1.5">
                        <span className="font-semibold text-[#1c1f23] tabular-nums">
                          {b.val}
                        </span>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="font-medium text-[#3b4048]">
                            {b.label}
                          </span>
                          <span className="text-[#9aa0aa] w-9 text-right">
                            {b.pct}
                          </span>
                        </div>
                      </div>
                      <div className="h-[5px] w-full bg-[#edeff2] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${b.color}`}
                          style={{ width: b.w }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 4: TRAJECTORY (BFAST 2017–2030 Chart + Spatial Contagion + Ledger)
           ========================================================= */}
        {screen === "timeline" && (
          <div className="w-full h-full p-6 grid grid-rows-[0.95fr_1.05fr] gap-5 overflow-hidden">
            <div className="bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#1c1f23]">
                    BFAST Structural Breakpoint &amp; 2030 Forecast
                  </h2>
                  <p className="text-[12px] text-[#8c929c] mt-0.5">
                    OLS-MOSUM Breakpoint at 2021-Q3 (p &lt; 0,0001) · ROSHN
                    Sedra Corridor
                  </p>
                </div>
                <div className="flex items-center gap-5 text-[12px] font-medium text-[#5c626b]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#22b567]" />
                    Observed Built-Up (ha)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#e94235]" />
                    2021-Q3 Breakpoint
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#f39223]" />
                    2024–2030 Forecast
                  </span>
                </div>
              </div>

              <svg viewBox="0 0 1100 185" className="w-full h-[165px]">
                {[28, 72, 116, 152].map((y, idx) => (
                  <g key={y}>
                    <line
                      x1="68"
                      y1={y}
                      x2="1065"
                      y2={y}
                      stroke="#f0f2f5"
                      strokeWidth="1"
                    />
                    <text x="8" y={y + 4} fill="#9aa0aa" fontSize="10.5">
                      {["8,000 ha", "5,500 ha", "3,000 ha", "500 ha"][idx]}
                    </text>
                  </g>
                ))}
                <polygon
                  points="620,86 765,58 910,36 1045,16 1045,54 910,70 765,86 620,86"
                  fill="#f39223"
                  fillOpacity="0.12"
                />
                <line
                  x1="400"
                  y1="16"
                  x2="400"
                  y2="156"
                  stroke="#e94235"
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                />
                <text
                  x="400"
                  y="30"
                  textAnchor="middle"
                  fill="#e94235"
                  fontSize="10.5"
                  fontWeight="600"
                >
                  2021-Q3 Break (+310% Slope)
                </text>
                <polyline
                  fill="none"
                  stroke="#22b567"
                  strokeWidth="3"
                  points="95,146 170,142 245,136 322,130 400,122 472,106 546,94 620,86"
                />
                <polyline
                  fill="none"
                  stroke="#f39223"
                  strokeWidth="2.8"
                  strokeDasharray="6 4"
                  points="620,86 765,68 910,50 1045,32"
                />
                {[
                  ["2017", 95, 146],
                  ["2018", 170, 142],
                  ["2019", 245, 136],
                  ["2020", 322, 130],
                  ["2021", 400, 122],
                  ["2022", 472, 106],
                  ["2023", 546, 94],
                  ["2024", 620, 86],
                  ["2026F", 765, 68],
                  ["2028F", 910, 50],
                  ["2030F", 1045, 32],
                ].map(([yr, cx, cy], idx) => (
                  <g key={String(yr)}>
                    <circle
                      cx={Number(cx)}
                      cy={Number(cy)}
                      r="4"
                      fill={idx <= 7 ? "#22b567" : "#f39223"}
                    />
                    <text
                      x={Number(cx)}
                      y="176"
                      textAnchor="middle"
                      fill="#8c929c"
                      fontSize="10.5"
                    >
                      {yr}
                    </text>
                  </g>
                ))}
              </svg>
            </div>

            <div className="grid grid-cols-12 gap-5 min-h-0">
              <div className="col-span-6 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-5 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                      2024–2030 Spatial Contagion Forecast
                    </h3>
                    <p className="text-[12px] text-[#8c929c]">
                      Morphological expansion rings across North Riyadh
                    </p>
                  </div>
                  <span className="text-[12px] font-medium text-[#22b567]">
                    104,2 % On-Target
                  </span>
                </div>
                <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                  <img
                    src="/api/raster/roshn/contagion"
                    alt="Spatial Contagion Forecast"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>

              <div className="col-span-6 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                    Multi-Epoch Acquisition Ledger
                  </h3>
                  <p className="text-[12px] text-[#8c929c] mt-0.5">
                    Cloud-free Sentinel-2 L2A milestone verification
                  </p>
                </div>

                <table className="w-full text-left border-collapse my-auto">
                  <thead>
                    <tr className="border-b border-[#edeff2] text-[11.5px] font-medium text-[#8c929c]">
                      <th className="pb-2.5">Epoch</th>
                      <th className="pb-2.5">Sentinel-2 Scene</th>
                      <th className="pb-2.5">Built-Up</th>
                      <th className="pb-2.5">ΔNDBI</th>
                      <th className="pb-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f4f5f7] text-[12.5px] tabular-nums">
                    {[
                      [
                        "2018-Q2",
                        "S2A_38RMV_20180614",
                        "1,120 ha",
                        "-0,04",
                        "Baseline",
                        "text-[#8c929c]",
                      ],
                      [
                        "2021-Q3",
                        "S2A_38RMV_20210918",
                        "2,180 ha",
                        "+0,14",
                        "Breakpoint",
                        "text-[#e94235] font-semibold",
                      ],
                      [
                        "2023-Q2",
                        "S2B_38RMV_20230609",
                        "3,890 ha",
                        "+0,26",
                        "Expansion",
                        "text-[#f39223] font-semibold",
                      ],
                      [
                        "2024-Q2",
                        "S2B_38RMV_20240614",
                        "4,824 ha",
                        "+0,34",
                        "Verified",
                        "text-[#22b567] font-semibold",
                      ],
                      [
                        "2026-Q4",
                        "FORECAST_CA_2026",
                        "6,140 ha",
                        "+0,39",
                        "Phase 2 Ring",
                        "text-[#3b4048]",
                      ],
                      [
                        "2030-Q1",
                        "VISION_2030_TARGET",
                        "7,890 ha",
                        "+0,44",
                        "Target",
                        "text-[#22b567] font-semibold",
                      ],
                    ].map(([ep, scene, ha, ndbi, st, cls]) => (
                      <tr key={String(ep)}>
                        <td className="py-2.5 font-semibold text-[#1c1f23]">
                          {ep}
                        </td>
                        <td className="py-2.5 text-[#8c929c]">{scene}</td>
                        <td className="py-2.5 font-medium text-[#1c1f23]">
                          {ha}
                        </td>
                        <td className="py-2.5 text-[#3b4048]">{ndbi}</td>
                        <td className={`py-2.5 text-right ${cls}`}>{st}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 5: PAIR LAB (3 Synchronized Rasters + Object Table)
           ========================================================= */}
        {screen === "lab" && (
          <div className="w-full h-full p-6 grid grid-rows-[1.12fr_0.88fr] gap-5 overflow-hidden">
            <div className="grid grid-cols-3 gap-5 min-h-0">
              {[
                {
                  title: "1. Bi-Temporal Input (T₁ / T₂)",
                  sub: "0,14 px RMSE",
                  img: "/api/raster/roshn/split",
                },
                {
                  title: "2. Siamese Posterior P(Δ)",
                  sub: "0,934 F1",
                  img: "/api/raster/roshn/magma",
                },
                {
                  title: "3. Ground-Truth Pixel Audit",
                  sub: "87,6 % IoU",
                  img: "/api/raster/roshn/confusion",
                },
              ].map((panel) => (
                <div
                  key={panel.title}
                  className="bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-4 flex flex-col min-h-0"
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[14.5px] font-semibold text-[#1c1f23]">
                      {panel.title}
                    </h3>
                    <span className="text-[12px] font-medium text-[#22b567] tabular-nums">
                      {panel.sub}
                    </span>
                  </div>
                  <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                    <img
                      src={panel.img}
                      alt={panel.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                    Connected-Component Segmented Footprints
                  </h3>
                  <p className="text-[12px] text-[#8c929c] mt-0.5">
                    8-Connectivity Labeling + Douglas-Peucker Polygon
                    Vectorization
                  </p>
                </div>
                <span className="text-[12.5px] font-semibold text-[#22b567]">
                  Precision 94,8 % · Recall 92,1 %
                </span>
              </div>

              <table className="w-full text-left border-collapse my-auto">
                <thead>
                  <tr className="border-b border-[#edeff2] text-[11.5px] font-medium text-[#8c929c]">
                    <th className="pb-2">Object ID</th>
                    <th className="pb-2">Semantic Structure</th>
                    <th className="pb-2">UTM Centroid</th>
                    <th className="pb-2">Area</th>
                    <th className="pb-2">ΔNDVI</th>
                    <th className="pb-2">ΔNDBI</th>
                    <th className="pb-2 text-right">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f4f5f7] text-[12.5px] tabular-nums">
                  {[
                    [
                      "OBJ-01",
                      "ROSHN Sedra Residential Superblock",
                      "673840E 2746120N",
                      "6,420 px²",
                      "-0,184",
                      "+0,442",
                      "98,4 %",
                    ],
                    [
                      "OBJ-02",
                      "King Salman Airbase Re-Grid Sector",
                      "671420E 2744890N",
                      "4,810 px²",
                      "-0,142",
                      "+0,389",
                      "97,1 %",
                    ],
                    [
                      "OBJ-03",
                      "Eastern Logistics & Commercial Pad",
                      "676910E 2745310N",
                      "3,290 px²",
                      "-0,095",
                      "+0,354",
                      "96,2 %",
                    ],
                    [
                      "OBJ-04",
                      "Northern Wadi Riparian Green Buffer",
                      "669540E 2747920N",
                      "2,640 px²",
                      "+0,382",
                      "-0,240",
                      "95,8 %",
                    ],
                    [
                      "OBJ-05",
                      "Princess Nourah Ring Road Interchange",
                      "672890E 2746800N",
                      "1,980 px²",
                      "-0,112",
                      "+0,318",
                      "94,9 %",
                    ],
                  ].map(([id, name, utm, area, ndvi, ndbi, conf]) => (
                    <tr key={String(id)}>
                      <td className="py-2 font-semibold text-[#1c1f23]">
                        {id}
                      </td>
                      <td className="py-2 font-medium text-[#1c1f23]">
                        {name}
                      </td>
                      <td className="py-2 text-[#8c929c]">{utm}</td>
                      <td className="py-2 text-[#3b4048]">{area}</td>
                      <td className="py-2 text-[#3b4048]">{ndvi}</td>
                      <td className="py-2 text-[#3b4048]">{ndbi}</td>
                      <td className="py-2 text-right font-semibold text-[#22b567]">
                        {conf}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 6: CARBON & UHI (Dual Rasters + Golf-Field Style Carbon Card)
           ========================================================= */}
        {screen === "carbon" && (
          <div className="w-full h-full p-6 grid grid-cols-12 gap-5 overflow-hidden">
            <div className="col-span-7 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-5 flex flex-col min-h-0">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#1c1f23]">
                    Spatial Carbon Flux &amp; Surface Thermal Shift (ΔLST)
                  </h2>
                  <p className="text-[12px] text-[#8c929c]">
                    Wadi Hanifah &amp; Green Riyadh Canopy Sinks vs Corridor
                    Grading
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-[#22b567]">
                  IPCC Tier-1 Verified
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between text-[12px] mb-2">
                    <span className="font-medium text-[#3b4048]">
                      Carbon Flux Density
                    </span>
                    <span className="font-semibold text-[#22b567]">
                      -49,4 Mg C / ha
                    </span>
                  </div>
                  <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                    <img
                      src="/api/raster/roshn/carbon"
                      alt="Carbon Flux Map"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                <div className="flex flex-col min-h-0">
                  <div className="flex items-center justify-between text-[12px] mb-2">
                    <span className="font-medium text-[#3b4048]">
                      Thermal Shift (ΔLST)
                    </span>
                    <span className="font-semibold text-[#f39223]">
                      -3,8 °C Canopy Cooling
                    </span>
                  </div>
                  <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                    <img
                      src="/api/raster/roshn/thermal"
                      alt="Thermal Shift Map"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-5 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-7 flex flex-col justify-between min-h-0">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-[18px] font-semibold text-[#1c1f23]">
                    IPCC 4-Pool Carbon Ledger
                  </h3>
                  <span className="text-[12px] text-[#8c929c]">
                    Verra VM0047
                  </span>
                </div>

                <div className="text-[13px] font-medium text-[#3b4048] mb-5">
                  Stoichiometric Pool Breakdown
                </div>

                <div className="space-y-4">
                  {[
                    {
                      val: "32,0 Mg",
                      dist: "-88,536 tCO2e",
                      pct: "62 %",
                      w: "62%",
                      color: "bg-[#22b567]",
                    },
                    {
                      val: "8,3 Mg",
                      dist: "-22,848 tCO2e",
                      pct: "16 %",
                      w: "16%",
                      color: "bg-[#22b567]",
                    },
                    {
                      val: "6,9 Mg",
                      dist: "-19,992 tCO2e",
                      pct: "14 %",
                      w: "14%",
                      color: "bg-[#f39223]",
                    },
                    {
                      val: "2,6 Mg",
                      dist: "-11,424 tCO2e",
                      pct: "8 %",
                      w: "8%",
                      color: "bg-[#e94235]",
                    },
                  ].map((p, idx) => (
                    <div key={idx}>
                      <div className="flex items-center justify-between text-[12.5px] mb-2">
                        <span className="font-semibold text-[#1c1f23] tabular-nums">
                          {p.val}
                        </span>
                        <div className="flex items-center gap-3 tabular-nums">
                          <span className="font-medium text-[#3b4048]">
                            {p.dist}
                          </span>
                          <span className="text-[#9aa0aa] w-9 text-right">
                            {p.pct}
                          </span>
                        </div>
                      </div>
                      <div className="h-[5px] w-full bg-[#edeff2] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.color}`}
                          style={{ width: p.w }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-5 border-t border-[#edeff2] grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[16px] font-semibold text-[#1c1f23] tabular-nums">
                    -142,8k
                  </div>
                  <div className="text-[11px] text-[#8c929c] mt-0.5">
                    Net tCO2e Sink
                  </div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[#22b567] tabular-nums">
                    $4,99M
                  </div>
                  <div className="text-[11px] text-[#8c929c] mt-0.5">
                    VCM Valuation
                  </div>
                </div>
                <div>
                  <div className="text-[16px] font-semibold text-[#1c1f23] tabular-nums">
                    31,043
                  </div>
                  <div className="text-[11px] text-[#8c929c] mt-0.5">
                    Vehicles / Yr
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================
            SCREEN 7: WATCHLIST & STAC ATLAS
           ========================================================= */}
        {screen === "watchlist" && (
          <div className="w-full h-full p-6 grid grid-cols-12 gap-5 overflow-hidden">
            <div className="col-span-7 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold text-[#1c1f23]">
                    Planetary Watchlist &amp; Automated STAC Rules
                  </h2>
                  <p className="text-[12px] text-[#8c929c] mt-0.5">
                    5-Day Sentinel-2 L2A revisit monitoring via Element84 Earth
                    Search
                  </p>
                </div>
                <span className="text-[12px] font-semibold text-[#22b567]">
                  5 Active Corridors
                </span>
              </div>

              <div className="space-y-3 my-auto">
                {[
                  {
                    name: "NEOM · The Line Spine Sector 1",
                    coords: "Tabuk Province · 28.12°N, 35.10°E",
                    delta: "0,380",
                    area: "1,420 ha",
                    pct: "18 %",
                    w: "68%",
                    color: "bg-[#e94235]",
                    thumb: "/api/raster/neom/magma",
                  },
                  {
                    name: "Green Riyadh · Wadi Hanifah Canopy",
                    coords: "Riyadh Province · 24.66°N, 46.68°E",
                    delta: "0,390",
                    area: "890 ha",
                    pct: "12 %",
                    w: "52%",
                    color: "bg-[#22b567]",
                    thumb: "/api/raster/wadi/carbon",
                  },
                  {
                    name: "Red Sea Global · Shura Lagoon",
                    coords: "Al Wajh Coast · 25.58°N, 36.93°E",
                    delta: "0,210",
                    area: "640 ha",
                    pct: "9 %",
                    w: "38%",
                    color: "bg-[#f39223]",
                    thumb: "/api/raster/redsea/ndbi",
                  },
                  {
                    name: "Rondônia · Primary Forest Loss",
                    coords: "Ariquemes, Brazil · 10.86°S, 61.93°W",
                    delta: "0,415",
                    area: "2,151 ha",
                    pct: "20 %",
                    w: "74%",
                    color: "bg-[#e94235]",
                    thumb: "/api/raster/rondonia/confusion",
                  },
                ].map((item) => (
                  <div
                    key={item.name}
                    className="p-3.5 rounded-[16px] bg-[#f8f9fb] flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3.5 min-w-[260px]">
                      <img
                        src={item.thumb}
                        alt={item.name}
                        className="w-14 h-11 rounded-[10px] object-cover shrink-0"
                      />
                      <div>
                        <div className="text-[13.5px] font-semibold text-[#1c1f23]">
                          {item.name}
                        </div>
                        <div className="text-[11.5px] text-[#8c929c] mt-0.5">
                          {item.coords}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 max-w-[220px]">
                      <div className="flex items-center justify-between text-[12px] mb-1.5 tabular-nums">
                        <span className="font-semibold text-[#1c1f23]">
                          {item.delta}
                        </span>
                        <span className="font-medium text-[#3b4048]">
                          {item.area}
                        </span>
                        <span className="text-[#9aa0aa]">{item.pct}</span>
                      </div>
                      <div className="h-[5px] w-full bg-[#e6e8ec] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${item.color}`}
                          style={{ width: item.w }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="col-span-5 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                      OGC STAC 1.0.0 Item Manifest
                    </h3>
                    <p className="text-[12px] text-[#8c929c] mt-0.5">
                      Standardized eo + proj + mlm metadata extensions
                    </p>
                  </div>
                  <span className="text-[12px] font-medium text-[#8c929c]">
                    GeoJSON
                  </span>
                </div>

                <pre className="p-4 rounded-[14px] bg-[#f8f9fb] text-[11.5px] font-mono text-[#3b4048] leading-relaxed overflow-hidden">
                  {`{
  "stac_version": "1.0.0",
  "id": "S2B_ROSHN_RIYADH_2018_2024",
  "collection": "terrashift-vision2030-v1",
  "bbox": [46.630, 24.750, 46.810, 24.870],
  "properties": {
    "datetime": "2024-06-14T07:36:12Z",
    "constellation": "sentinel-2",
    "gsd": 10.0,
    "eo:cloud_cover": 0.12,
    "proj:epsg": 32638,
    "terrashift:model": "SiameseResUNet-10ch",
    "terrashift:change_pct": 12.90,
    "terrashift:affected_area_ha": 4824.2,
    "terrashift:confidence": 0.962
  }
}`}
                </pre>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-[14px] bg-[#f8f9fb]">
                  <div className="text-[12.5px] font-semibold text-[#1c1f23]">
                    S2B_38RMV_20240614
                  </div>
                  <div className="text-[11.5px] text-[#22b567] font-medium mt-0.5">
                    Cloud 0,12 % · 10 m Optical
                  </div>
                </div>
                <div className="p-3.5 rounded-[14px] bg-[#f8f9fb]">
                  <div className="text-[12.5px] font-semibold text-[#1c1f23]">
                    S2A_38RMV_20240525
                  </div>
                  <div className="text-[11.5px] text-[#22b567] font-medium mt-0.5">
                    Cloud 0,04 % · 10 m Optical
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 3. EXACT BOTTOM TIMELINE BAR FROM REFERENCE */}
      <footer className="h-[58px] shrink-0 bg-white px-5 flex items-center gap-4">
        {/* Year Pill Selector */}
        <button
          type="button"
          className="h-[36px] px-4 rounded-xl border border-[#e4e7ec] bg-white flex items-center gap-2.5 text-[12.5px] font-semibold text-[#1c1f23] shadow-[0_1px_2px_rgba(0,0,0,0.03)]"
        >
          <span>2024</span>
          <IconChevronDown />
        </button>

        {/* Full-Width Segmented Month Track (#edeff2) */}
        <div className="flex-1 bg-[#edeff2] p-[3px] rounded-xl flex items-center">
          {MONTHS.map((m) => {
            const active = m === activeMonth;
            return (
              <button
                key={m}
                type="button"
                onClick={() => setActiveMonth(m)}
                className={`flex-1 py-[6px] rounded-[9px] text-[12px] transition-all text-center ${
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
    </div>
  );
}

function MapCanvasOverlay() {
  return (
    <>
      {/* Top-Left Dark Translucent Pill Zoom Button Pair */}
      <div className="absolute top-6 left-5 z-10 flex flex-col bg-[#1b1e23]/85 backdrop-blur-md rounded-2xl p-1 shadow-md">
        <button
          type="button"
          aria-label="Zoom in"
          className="w-8 h-8 flex items-center justify-center text-white/90 hover:text-white transition-colors"
        >
          <IconZoomIn />
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          className="w-8 h-8 flex items-center justify-center text-white/90 hover:text-white transition-colors"
        >
          <IconZoomOut />
        </button>
      </div>

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

export default function TempDesignShowcasePage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-white" />}>
      <TempDesignShowcaseInner />
    </Suspense>
  );
}
