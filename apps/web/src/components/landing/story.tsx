"use client";

import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { useRef, useState } from "react";
import { RegionOverlay } from "@/components/region-overlay";
import { ModeCanvas } from "@/components/scene-canvas";
import type { PaintMode } from "@/lib/paint";
import { getScene } from "@/lib/scene";
import { motion as motionTokens } from "@/tokens";

interface Chapter {
  mode: PaintMode;
  kicker: string;
  title: string;
  body: string;
  legend: string;
}

export function Story() {
  const scene = getScene(7);
  const ref = useRef<HTMLElement>(null);
  const [index, setIndex] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    setIndex(Math.min(3, Math.max(0, Math.floor(p * 4))));
  });

  const hectares = (scene.changedM2 / 10_000).toFixed(1);
  const chapters: readonly Chapter[] = [
    {
      mode: "naive",
      kicker: "01 — The problem",
      title: "Seasons lie.",
      body: `Subtract two images and a harvest looks like a catastrophe. On this tile a naive pixel difference flags ${scene.naivePct.toFixed(0)}% of the land. The truth is ${scene.changedPct.toFixed(1)}%.`,
      legend: "Red = flagged by raw RGB difference",
    },
    {
      mode: "ndvi",
      kicker: "02 — The physics",
      title: "Read the light, not the pixels.",
      body: "NDVI and NDBI convert reflectance into vegetation and concrete signals. Harvest and clearing both drop NDVI, so we stack the indices with colour instead of trusting any single one.",
      legend: "Amber = NDVI drop between dates",
    },
    {
      mode: "mask",
      kicker: "03 — The model",
      title: "A twin network that compares.",
      body: "A Siamese U-Net encodes both dates with shared weights and compares features at every scale. Seasonal drift cancels out. Structural change does not.",
      legend: "Amber = predicted change mask",
    },
    {
      mode: "polygons",
      kicker: "04 — The proof",
      title: "Pixels become evidence.",
      body: `${scene.regions.length} regions, ${hectares} hectares. Every polygon is georeferenced, classified, and measured in square metres in a projected CRS.`,
      legend: "Dashed = vectorised GeoJSON polygons",
    },
  ];
  const active = chapters[index] ?? chapters[0];
  if (!active) return null;

  return (
    <section ref={ref} id="story" aria-label="How TerraShift works" className="relative h-[480vh]">
      <div className="sticky top-0 grid h-dvh grid-rows-[minmax(0,5fr)_minmax(0,4fr)] items-center gap-6 px-6 py-20 lg:grid-cols-[5fr_7fr] lg:grid-rows-1 lg:gap-16 lg:px-16">
        <div className="relative order-last lg:order-first">
          <ol className="mb-8 flex gap-2" aria-label="Chapters">
            {chapters.map((c, i) => (
              <li
                key={c.kicker}
                aria-current={i === index ? "step" : undefined}
                className={`h-1 flex-1 rounded-full transition-colors duration-500 ${
                  i <= index ? "bg-signal-400" : "bg-ink-700"
                }`}
              />
            ))}
          </ol>
          <AnimatePresence mode="wait">
            <motion.div
              key={active.kicker}
              initial={{ opacity: 0, y: 32 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -24 }}
              transition={{ duration: motionTokens.base, ease: motionTokens.easeOutExpo }}
              aria-live="polite"
            >
              <p className="text-signal-400 mb-4 font-mono text-xs tracking-[0.3em] uppercase">{active.kicker}</p>
              <h2 className="font-display text-[clamp(2.5rem,5vw,4.5rem)] leading-[0.98]">{active.title}</h2>
              <p className="text-bone-300 mt-6 max-w-lg text-base leading-relaxed lg:text-lg">{active.body}</p>
            </motion.div>
          </AnimatePresence>
        </div>

        <figure dir="ltr" className="relative order-first size-full min-h-0 lg:order-last">
          <div className="border-bone-100/10 bg-ink-900 relative size-full overflow-hidden rounded-2xl border shadow-[0_40px_120px_-40px_rgba(255,176,32,0.25)]">
            <ModeCanvas scene={scene} mode={active.mode} className="absolute inset-0" />
            <RegionOverlay
              scene={scene}
              fill
              className={`absolute inset-0 size-full transition-opacity duration-700 ${
                active.mode === "polygons" ? "opacity-100" : "opacity-0"
              }`}
            />
            <div className="text-bone-100/80 pointer-events-none absolute inset-x-0 top-0 flex justify-between p-4 font-mono text-[10px] tracking-widest uppercase">
              <span>Tile 7 · 4.8 × 3.0 km</span>
              <span>Synthetic · 10 m</span>
            </div>
          </div>
          <figcaption className="text-ink-400 absolute inset-x-0 -bottom-7 font-mono text-[11px] tracking-widest uppercase">
            {active.legend}
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
