"use client";

import Link from "next/link";
import { useState } from "react";
import { StudioNav } from "@/components/studio-nav";
import { OrbitalLoupe } from "@/components/ui/orbital-loupe";
import { KSA_MISSION_SITES, type KsaMissionSite } from "@/data/ksaMissionData";

const PLATFORM_MODULES = [
  { href: "/analyze", title: "Map Studio" },
  { href: "/benchmarks", title: "Model Benchmarks" },
  { href: "/timeline", title: "BFAST Timeline" },
  { href: "/lab", title: "Image Pair Lab" },
  { href: "/carbon", title: "Carbon & UHI" },
  { href: "/watchlist", title: "STAC Atlas" },
] as const;

export function StitchCommandDeck() {
  const [siteIdx, setSiteIdx] = useState<number>(0);
  const site: KsaMissionSite = KSA_MISSION_SITES[siteIdx] ?? KSA_MISSION_SITES[0]!;

  return (
    <div className="min-h-screen bg-orbital-canvas text-bone-100 flex flex-col">
      <StudioNav />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8 space-y-6">
        {/* Top Bar: Site Switcher & Direct Action */}
        <section className="orbital-panel rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {KSA_MISSION_SITES.map((m, idx) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSiteIdx(idx)}
                className={`rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                  siteIdx === idx
                    ? "bg-signal-400 text-ink-950 font-semibold"
                    : "bg-ink-950 border border-bone-100/10 text-bone-300 hover:text-bone-100"
                }`}
              >
                {m.pillTitle}
              </button>
            ))}
          </div>

          <Link
            href={`/analyze?lat=${site.lat}&lon=${site.lon}&t1=2018&t2=2024`}
            className="rounded-xl bg-signal-400 px-4 py-2 text-xs font-semibold text-ink-950 hover:bg-signal-400/90 transition-colors"
          >
            Open in Map Studio →
          </Link>
        </section>

        {/* Main Workspace Preview: Interactive Split View + Metrics */}
        <section className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-7">
            <OrbitalLoupe
              baseImage={site.baseImage}
              overlayImage={site.overlayImage}
              baseLabel="2018"
              overlayLabel="2024"
            />
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="orbital-panel rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-bone-100/10 pb-3">
                <h1 className="text-base font-semibold text-bone-100">{site.pillTitle}</h1>
                <span className="font-mono text-sm font-semibold text-signal-400 tabular-nums">
                  {site.pillBadge}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="text-xs text-bone-400">F1 Score</span>
                  <p className="mt-1 font-mono text-xl font-bold text-teal-400 tabular-nums">
                    {site.benchmarks.f1}
                  </p>
                </div>

                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="text-xs text-bone-400">IoU</span>
                  <p className="mt-1 font-mono text-xl font-bold text-signal-400 tabular-nums">
                    {site.benchmarks.iou}
                  </p>
                </div>

                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="text-xs text-bone-400">Spectral Shift</span>
                  <p className="mt-1 font-mono text-lg font-bold text-bone-100 tabular-nums">
                    {site.bfast.breakMagnitude}
                  </p>
                </div>

                <div className="rounded-xl border border-bone-100/10 bg-ink-950 p-3.5">
                  <span className="text-xs text-bone-400">Thermal ΔLST</span>
                  <p className="mt-1 font-mono text-lg font-bold text-teal-400 tabular-nums">
                    {site.carbonUhi.deltaLst}
                  </p>
                </div>
              </div>
            </div>

            {/* Minimal Module Links */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PLATFORM_MODULES.map((mod) => (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="orbital-panel rounded-xl px-4 py-3.5 text-xs font-medium text-bone-200 hover:border-signal-400/40 hover:text-signal-400 transition-colors flex items-center justify-between"
                >
                  <span>{mod.title}</span>
                  <span>→</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
