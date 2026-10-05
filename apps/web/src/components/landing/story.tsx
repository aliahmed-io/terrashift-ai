"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import Link from "next/link";

interface StoryStep {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  description: string;
  badge: string;
  badgeColor: string;
  imageSrc: string;
  metricLabel: string;
  metricValue: string;
}

const STEPS: readonly StoryStep[] = [
  {
    id: "naive",
    number: "01",
    title: "Seasons deceive naive diffs.",
    subtitle: "Raw RGB comparison flags 42% false positive rate",
    description:
      "Direct pixel subtraction interprets normal crop rotations, rainfall moisture, and low sun angles as physical destruction. A simple differencing script marks healthy farmland as an environmental crisis.",
    badge: "Naive Difference Error",
    badgeColor: "text-alert-400 border-alert-500/40 bg-alert-500/10",
    imageSrc:
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/11/1079/666.jpg",
    metricLabel: "Spurious Change Flagged",
    metricValue: "42.8% of Area",
  },
  {
    id: "radiometry",
    number: "02",
    title: "Radiometric calibration restores truth.",
    subtitle: "Robust median & MAD matching per optical channel",
    description:
      "TerraShift fits cross-temporal optical distributions using robust statistics. Illumination drift and composite tint differences across years are neutralized without dampening authentic ground disruption.",
    badge: "Radiometric Equalization",
    badgeColor: "text-signal-400 border-signal-400/40 bg-signal-400/10",
    imageSrc:
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/11/1079/666.jpg",
    metricLabel: "Sensor Drift Variance",
    metricValue: "< 0.04 MAD",
  },
  {
    id: "masking",
    number: "03",
    title: "Statistical anomaly separation.",
    subtitle: "Dynamic outlier thresholding isolates physical scars",
    description:
      "Applying morphological opening and closing operators removes isolated pixel speckle and sensor noise, condensing contiguous disturbances into high-confidence change candidates.",
    badge: "Spatial Filtering",
    badgeColor: "text-teal-400 border-teal-500/40 bg-teal-500/10",
    imageSrc:
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/11/1079/666.jpg",
    metricLabel: "Speckle Noise Rejection",
    metricValue: "99.2%",
  },
  {
    id: "vector",
    number: "04",
    title: "Pixels transform into audit evidence.",
    subtitle: "Geodesic polygon vectorization in WGS84 CRS",
    description:
      "Raster masks are converted into discrete GeoJSON feature boundaries. Every scar is assigned a classification, confidence score, and physical surface area calculated using spherical geodesic projection.",
    badge: "Vector Polygon Extraction",
    badgeColor: "text-signal-400 border-signal-400/40 bg-signal-400/10",
    imageSrc:
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/11/1079/666.jpg",
    metricLabel: "Ground Measurement Unit",
    metricValue: "Square Meters (m²)",
  },
];

export function Story() {
  const [activeIdx, setActiveIdx] = useState(0);
  const active = STEPS[activeIdx] ?? STEPS[0]!;

  return (
    <section
      id="story"
      aria-label="How TerraShift change intelligence works"
      className="relative px-6 py-28 lg:px-16 lg:py-36 bg-ink-950"
    >
      <div className="mx-auto max-w-7xl">
        {/* Section Header */}
        <div className="max-w-2xl">
          <p className="font-mono text-xs tracking-[0.25em] text-signal-400 uppercase">
            The Physics of Change
          </p>
          <h2 className="font-display mt-3 text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.98] text-bone-100">
            From raw satellite tiles to <em className="text-signal-400 not-italic">quantified evidence</em>.
          </h2>
        </div>

        {/* Step Selector Tabs */}
        <div className="mt-12 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-4 border-b border-bone-100/10 pb-4">
          {STEPS.map((step, idx) => (
            <button
              key={step.id}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={`flex flex-col items-start rounded-xl p-3 text-start transition-all ${
                activeIdx === idx
                  ? "bg-ink-900 border border-signal-400/60"
                  : "hover:bg-ink-900/40 text-bone-400"
              }`}
            >
              <span
                className={`font-mono text-xs font-bold ${
                  activeIdx === idx ? "text-signal-400" : "text-bone-400"
                }`}
              >
                {step.number}
              </span>
              <span className="mt-1 font-medium text-xs text-bone-200 truncate w-full">
                {step.title.split(".")[0]}
              </span>
            </button>
          ))}
        </div>

        {/* Interactive Step Showcase */}
        <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:items-center">
          {/* Left Text Column */}
          <div className="lg:col-span-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 font-mono text-[10px] tracking-widest uppercase ${active.badgeColor}`}
                  >
                    {active.badge}
                  </span>
                </div>

                <h3 className="font-display mt-4 text-3xl sm:text-4xl text-bone-100 leading-tight">
                  {active.title}
                </h3>
                <p className="font-mono text-xs text-signal-400 mt-2">{active.subtitle}</p>

                <p className="mt-6 text-base leading-relaxed text-bone-300">
                  {active.description}
                </p>

                <div className="mt-8 flex items-center gap-8 border-t border-bone-100/10 pt-6">
                  <div>
                    <span className="font-mono text-[10px] tracking-wider text-bone-400 uppercase">
                      {active.metricLabel}
                    </span>
                    <p className="font-display text-2xl text-signal-400">{active.metricValue}</p>
                  </div>
                  <div>
                    <span className="font-mono text-[10px] tracking-wider text-bone-400 uppercase">
                      Imagery Baseline
                    </span>
                    <p className="font-display text-2xl text-bone-100">Sentinel-2 10m</p>
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    href="/analyze"
                    className="inline-flex items-center gap-2 rounded-full border border-signal-400/40 bg-ink-900/80 px-6 py-3 font-mono text-xs text-signal-400 uppercase transition-all hover:bg-signal-400 hover:text-ink-950 font-semibold"
                  >
                    <span>Test on Live Map</span>
                    <span>→</span>
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Right Visual Image Card */}
          <div className="lg:col-span-6">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl border border-bone-100/15 bg-ink-900 shadow-2xl">
              <img
                src={active.imageSrc}
                alt={active.title}
                className="size-full object-cover brightness-95"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-ink-950/20" />

              {/* Real Satellite Tag */}
              <div className="absolute bottom-4 start-4 flex items-center gap-2 rounded-full border border-bone-100/20 bg-ink-950/80 px-3.5 py-1 font-mono text-[10px] text-bone-200 uppercase backdrop-blur">
                <span className="size-2 rounded-full bg-signal-400" />
                <span>Rondônia Deforestation Frontier · 10m Ground Resolution</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
