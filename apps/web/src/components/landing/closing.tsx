"use client";

import Link from "next/link";

export function Closing() {
  return (
    <section
      aria-labelledby="closing-title"
      className="relative overflow-hidden bg-ink-950 px-6 py-32 lg:px-16 lg:py-48"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,176,32,0.14),transparent_65%)]" />

      <div className="relative mx-auto max-w-5xl text-center">
        <span className="font-mono text-xs tracking-[0.3em] text-signal-400 uppercase">
          Zero Setup Required
        </span>
        <h2
          id="closing-title"
          className="font-display mt-4 text-[clamp(2.5rem,7vw,6.5rem)] leading-[0.94] tracking-tight text-bone-100"
        >
          Draw any boundary.
          <br />
          <em className="text-signal-400 not-italic font-italic">Uncover planetary shift.</em>
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-base text-bone-300">
          Analyze deforestation in the Amazon, coastal building in Dubai, or wetland recession across Central Asia with open Copernicus Sentinel-2 composites.
        </p>

        <div className="mt-12 flex justify-center">
          <Link
            href="/analyze"
            className="flex items-center gap-2 rounded-full bg-signal-400 px-10 py-5 font-mono text-xs font-bold tracking-widest text-ink-950 uppercase transition-transform hover:scale-[1.04] active:scale-95 shadow-[0_0_32px_rgba(255,176,32,0.4)]"
          >
            <span>Launch Studio</span>
            <span>→</span>
          </Link>
        </div>
      </div>

      <footer className="relative mx-auto mt-32 flex max-w-7xl flex-col items-center justify-between gap-4 border-t border-bone-100/10 pt-8 font-mono text-[11px] tracking-widest text-bone-400 uppercase md:flex-row">
        <span>TerraShift · Geospatial Change Intelligence</span>
        <div className="flex items-center gap-6">
          <span>Sentinel-2 Cloudless (EOX)</span>
          <span>·</span>
          <span>FastAPI Microservice</span>
        </div>
      </footer>
    </section>
  );
}
