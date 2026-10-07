"use client";

import Link from "next/link";
import { useState } from "react";
import { StudioNav } from "@/components/studio-nav";
import { OrbitalLoupe } from "@/components/ui/orbital-loupe";
import { KSA_MISSION_SITES, type KsaMissionSite } from "@/data/ksaMissionData";

const PLATFORM_MODULES = [
  {
    href: "/analyze",
    title: "Interactive Map Studio",
    metric: "10m S2 + 0.5m Aerial",
    description:
      "Select any global region or draw a custom polygon to run live Siamese U-Net change detection and export GeoJSON or PDF audit reports.",
  },
  {
    href: "/benchmarks",
    title: "Model Benchmarks & XAI",
    metric: "89.1% LEVIR-CD F1",
    description:
      "Compare FC-Siam-diff head-to-head against Early Fusion, Spectral Otsu, and Naive RGB differencing across encoder feature stages.",
  },
  {
    href: "/timeline",
    title: "BFAST Multi-Year Timeline",
    metric: "2017 → 2025 Stack",
    description:
      "Decompose multi-year NDVI, NDBI, and NDWI trajectories to separate seasonal phenology from structural disturbance breakpoints.",
  },
  {
    href: "/lab",
    title: "Custom Image Pair Lab",
    metric: "IoU & Confusion Matrix",
    description:
      "Upload or select any bi-temporal satellite pair and ground-truth mask to evaluate pixel-level precision, recall, and false alarms.",
  },
  {
    href: "/carbon",
    title: "Biomass Carbon & Urban Heat",
    metric: "IPCC Tier-1 + ΔLST",
    description:
      "Estimate above-ground carbon stock deltas (tCO₂e) and Impervious Surface Urban Heat Island temperature shifts (°C).",
  },
  {
    href: "/watchlist",
    title: "Live STAC Scene Watchlist",
    metric: "Element84 Earth Search",
    description:
      "Query live Sentinel-2 L2A Cloud-Optimized GeoTIFF catalogs with real-time cloud cover metadata across global hotspots.",
  },
] as const;

export function StitchCommandDeck() {
  const [siteIdx, setSiteIdx] = useState<number>(0);
  const site: KsaMissionSite = KSA_MISSION_SITES[siteIdx] ?? KSA_MISSION_SITES[0]!;

  return (
    <div className="min-h-screen bg-orbital-canvas text-bone-100 flex flex-col">
      <StudioNav />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8 space-y-8">
        {/* 1. Hero Section */}
        <section className="orbital-panel rounded-2xl p-6 sm:p-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-md bg-signal-400/10 border border-signal-400/30 px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-signal-400">
              <span className="size-1.5 rounded-full bg-signal-400" aria-hidden="true" />
              <span>PyTorch 2.14 · 5-Channel Siamese U-Net</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold tracking-tight text-bone-100">
              Bi-Temporal Satellite Change Detection
            </h1>
            <p className="text-xs sm:text-sm text-bone-300 leading-relaxed">
              TerraShift aligns multi-year Sentinel-2 imagery and evaluates a shared-weight{" "}
              <strong className="text-bone-100">FC-Siam-diff</strong> network across{" "}
              <code className="font-mono text-xs text-signal-400">[R, G, B, NDVI, NDBI]</code> to
              suppress seasonal noise and quantify structural ground change in square meters.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={`/analyze?lat=${site.lat}&lon=${site.lon}&t1=2018&t2=2024`}
              className="rounded-xl bg-signal-400 px-5 py-2.5 text-xs font-semibold text-ink-950 hover:bg-signal-400/90 transition-colors"
            >
              Analyze {site.pillTitle.split(" ")[0]} in Map Studio
            </Link>
            <Link
              href="/benchmarks"
              className="rounded-xl border border-bone-100/15 bg-ink-950 px-4 py-2.5 text-xs font-medium text-bone-100 hover:border-signal-400/40 transition-colors"
            >
              View Model Benchmarks
            </Link>
          </div>
        </section>

        {/* 2. Interactive KSA Vision 2030 & Orbital Comparison Showcase */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          {/* Left: Interactive Before/After Satellite Loupe */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wider text-bone-300">
                Select Reference Site
              </span>
              <div className="flex flex-wrap gap-1.5">
                {KSA_MISSION_SITES.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSiteIdx(idx)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                      siteIdx === idx
                        ? "bg-signal-400 text-ink-950 font-semibold"
                        : "orbital-panel text-bone-300 hover:text-bone-100"
                    }`}
                  >
                    {m.pillTitle}
                  </button>
                ))}
              </div>
            </div>

            <OrbitalLoupe
              baseImage={site.baseImage}
              overlayImage={site.overlayImage}
              baseLabel="Sentinel-2 Baseline (2018)"
              overlayLabel="Target Pass (2024)"
              telemetryTag={site.crs}
              accentColor="cyan"
            />
          </div>

          {/* Right: Site Telemetry & Verified Metrics */}
          <div className="lg:col-span-5 space-y-4">
            <div className="orbital-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 border-b border-bone-100/10 pb-4">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-signal-400">
                    {site.mgrs}
                  </span>
                  <h2 className="mt-1 text-lg font-semibold text-bone-100">{site.pillTitle}</h2>
                  <p className="mt-0.5 text-xs text-bone-300">{site.acquisitionSubtitle}</p>
                </div>
                <span className="shrink-0 rounded-lg bg-signal-400/15 border border-signal-400/30 px-2.5 py-1 font-mono text-xs font-semibold text-signal-400">
                  {site.pillBadge}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                    F1 Accuracy
                  </span>
                  <p className="mt-1 font-mono text-xl font-bold text-teal-400 tabular-nums">
                    {site.benchmarks.f1}
                  </p>
                  <span className="text-[11px] text-bone-300">
                    {site.benchmarks.f1Delta} vs Early Fusion
                  </span>
                </div>

                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                    IoU Overlap
                  </span>
                  <p className="mt-1 font-mono text-xl font-bold text-signal-400 tabular-nums">
                    {site.benchmarks.iou}
                  </p>
                  <span className="text-[11px] text-bone-300">
                    Precision: {site.benchmarks.precision}
                  </span>
                </div>

                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                    Spectral Shift
                  </span>
                  <p className="mt-1 font-mono text-lg font-bold text-bone-100 tabular-nums">
                    {site.bfast.breakMagnitude}
                  </p>
                  <span className="text-[11px] text-bone-300">{site.bfast.confidence}</span>
                </div>

                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-bone-400">
                    Thermal / Carbon
                  </span>
                  <p className="mt-1 font-mono text-lg font-bold text-teal-400 tabular-nums">
                    {site.carbonUhi.deltaLst}
                  </p>
                  <span className="text-[11px] text-bone-300">
                    {site.carbonUhi.sequestrationDelta} tCO₂e
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="font-mono text-[11px] text-bone-400 tabular-nums">
                  {site.frameCoords}
                </span>
                <Link
                  href={`/analyze?lat=${site.lat}&lon=${site.lon}&t1=2018&t2=2024`}
                  className="text-xs font-semibold text-signal-400 hover:underline"
                >
                  Inspect Live Polygon on Map →
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Platform Modules Suite */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-bone-100">Platform Suite</h2>
            <span className="font-mono text-xs text-bone-400">6 Integrated Modules</span>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLATFORM_MODULES.map((mod) => (
              <Link
                key={mod.href}
                href={mod.href}
                className="group orbital-panel rounded-2xl p-5 transition-colors hover:border-signal-400/40 flex flex-col justify-between gap-4"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-bone-100 group-hover:text-signal-400 transition-colors">
                      {mod.title}
                    </h3>
                    <span className="rounded-md bg-ink-950 border border-bone-100/10 px-2 py-0.5 font-mono text-[10px] text-signal-400">
                      {mod.metric}
                    </span>
                  </div>
                  <p className="text-xs text-bone-300 leading-relaxed">{mod.description}</p>
                </div>

                <span className="text-xs font-medium text-signal-400">Open Module →</span>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
