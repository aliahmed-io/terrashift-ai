"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { paintChannel } from "@/lib/paint";
import { getScene } from "@/lib/scene";
import { motion as motionTokens } from "@/tokens";

type Channel = "r" | "g" | "b" | "ndvi" | "ndbi";

const CHANNELS: ReadonlyArray<{ id: Channel; label: string; formula: string }> = [
  { id: "r", label: "Red", formula: "B04" },
  { id: "g", label: "Green", formula: "B03" },
  { id: "b", label: "Blue", formula: "B02" },
  { id: "ndvi", label: "NDVI", formula: "(B08 − B04) / (B08 + B04)" },
  { id: "ndbi", label: "NDBI", formula: "(B11 − B08) / (B11 + B08)" },
];

function ChannelTile({ channel, index }: { channel: (typeof CHANNELS)[number]; index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) paintChannel(ref.current, getScene(7), channel.id);
  }, [channel.id]);
  return (
    <motion.li
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: motionTokens.slow, delay: index * 0.08, ease: motionTokens.easeOutExpo }}
      className="group"
    >
      <div className="border-bone-100/10 bg-ink-900 ease-expo overflow-hidden rounded-xl border transition-transform duration-500 group-hover:-translate-y-2">
        <canvas ref={ref} aria-hidden="true" className="aspect-[8/5] w-full object-cover" />
      </div>
      <p className="mt-4 font-mono text-xs tracking-widest uppercase">
        <span className="text-signal-400">0{index + 1}</span> {channel.label}
      </p>
      <p className="text-ink-400 mt-1 font-mono text-[11px]">{channel.formula}</p>
    </motion.li>
  );
}

export function Pipeline() {
  return (
    <section id="pipeline" aria-labelledby="pipeline-title" className="px-6 py-32 lg:px-16 lg:py-48">
      <div className="mx-auto max-w-7xl">
        <p className="text-signal-400 mb-4 font-mono text-xs tracking-[0.3em] uppercase">The input tensor</p>
        <h2 id="pipeline-title" className="font-display max-w-3xl text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.95]">
          Five channels. <em className="text-signal-400">One truth.</em>
        </h2>
        <p className="text-bone-300 mt-8 max-w-xl text-lg leading-relaxed">
          Most change detectors only see colour. TerraShift also feeds the network the physics of vegetation and built
          surfaces — and refuses to run at all when clouds exceed 20% of your area.
        </p>
        <ul className="mt-16 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
          {CHANNELS.map((c, i) => (
            <ChannelTile key={c.id} channel={c} index={i} />
          ))}
        </ul>

        <ol className="border-bone-100/10 bg-bone-100/10 mt-24 grid gap-px overflow-hidden rounded-2xl border md:grid-cols-4">
          {[
            ["Acquire", "STAC search, windowed COG reads, median composite per date."],
            ["Gate", "SCL / QA60 cloud and shadow mask. Reject above 20%."],
            ["Compare", "Siamese U-Net, BCE + Dice loss, tiled inference."],
            ["Measure", "Polygons, class, confidence, area in m² (UTM)."],
          ].map(([title, text], i) => (
            <li key={title} className="bg-ink-950 p-8">
              <p className="text-signal-400 font-mono text-xs">0{i + 1}</p>
              <h3 className="font-display mt-6 text-3xl">{title}</h3>
              <p className="text-bone-300 mt-3 text-sm leading-relaxed">{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function Closing() {
  return (
    <section aria-labelledby="closing-title" className="relative overflow-hidden px-6 py-40 lg:px-16 lg:py-56">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(255,176,32,0.18),transparent_60%)]" />
      <div className="relative mx-auto max-w-7xl text-center">
        <h2 id="closing-title" className="font-display text-[clamp(3rem,10vw,9rem)] leading-[0.92] tracking-tight">
          Draw a polygon.
          <br />
          <em className="text-signal-400">Watch the planet change.</em>
        </h2>
        <Link
          href="/analyze"
          className="bg-signal-400 text-ink-950 mt-16 inline-block rounded-full px-12 py-6 font-mono text-sm tracking-widest uppercase transition-transform hover:scale-[1.04] active:scale-95"
        >
          Launch analysis
        </Link>
      </div>
      <footer className="border-bone-100/10 text-ink-400 relative mx-auto mt-40 flex max-w-7xl flex-col gap-4 border-t pt-8 font-mono text-[11px] tracking-widest uppercase md:flex-row md:justify-between">
        <span>TerraShift · Geospatial change intelligence</span>
        <span>Sentinel-2 L2A · Siamese U-Net · Demo scenes are synthetic</span>
      </footer>
    </section>
  );
}
