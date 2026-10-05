"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { motion as motionTokens } from "@/tokens";

// Real Sentinel-2 Cloudless bi-temporal tile over Amazon deforestation hotspot (Rondônia, Brazil)
const T1_IMG = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2018_3857/default/g/11/1079/666.jpg";
const T2_IMG = "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2024_3857/default/g/11/1079/666.jpg";

export function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const [sliderPos, setSliderPos] = useState(50);
  const isDragging = useRef(false);

  // Smooth mouse move tracking over container
  const handleMove = useCallback((clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const percent = Math.min(95, Math.max(5, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(percent);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf = 0;
    let lastUserMove = -Infinity;
    let visible = true;

    const onPointerMove = (e: PointerEvent) => {
      handleMove(e.clientX);
      lastUserMove = performance.now();
    };

    const autoAnimate = (t: number) => {
      if (visible && t - lastUserMove > 3000) {
        // Gentle wave oscillation when idle
        const wave = 50 + Math.sin(t / 2200) * 22;
        setSliderPos(wave);
      }
      raf = requestAnimationFrame(autoAnimate);
    };

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });

    io.observe(el);
    el.addEventListener("pointermove", onPointerMove);
    raf = requestAnimationFrame(autoAnimate);

    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointermove", onPointerMove);
    };
  }, [handleMove]);

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: 36 },
    animate: { opacity: 1, y: 0 },
    transition: {
      duration: motionTokens.slow,
      delay,
      ease: [0.16, 1, 0.3, 1] as const,
    },
  });

  return (
    <section
      ref={containerRef}
      aria-label="Sentinel-2 bi-temporal change detection preview"
      className="relative isolate h-dvh min-h-[680px] w-full touch-pan-y overflow-hidden bg-ink-950 select-none"
    >
      {/* 1. Base Layer (2018 Sentinel-2 Cloudless Baseline) */}
      <div className="absolute inset-0 size-full">
        <img
          src={T1_IMG}
          alt="Sentinel-2 2018 cloudless satellite view of Amazon frontier"
          className="size-full object-cover brightness-90 filter"
        />
        <div className="absolute inset-0 bg-ink-950/25" />
      </div>

      {/* 2. Target Layer (2024 Sentinel-2 Cloudless Target) with interactive clip-path */}
      <div
        className="absolute inset-0 size-full"
        style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
      >
        <img
          src={T2_IMG}
          alt="Sentinel-2 2024 cloudless satellite view showing deforestation expansion"
          className="size-full object-cover brightness-95 filter"
        />
        {/* Synthetic amber scar highlight glow on 2024 changes */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-signal-400/10 via-transparent to-alert-500/15" />
      </div>

      {/* 3. Interactive Split Slider Divider */}
      <div
        role="slider"
        aria-label="Swipe between 2018 baseline and 2024 target"
        aria-valuemin={5}
        aria-valuemax={95}
        aria-valuenow={sliderPos}
        tabIndex={0}
        onPointerDown={(e) => {
          isDragging.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (isDragging.current) handleMove(e.clientX);
        }}
        onPointerUp={() => {
          isDragging.current = false;
        }}
        className="absolute inset-y-0 z-20 w-0.5 cursor-ew-resize bg-signal-400 touch-none shadow-[0_0_24px_rgba(255,176,32,0.9)]"
        style={{ left: `${sliderPos}%` }}
      >
        <div className="absolute top-1/2 -ms-4.5 grid size-9 -translate-y-1/2 place-items-center rounded-full border border-signal-400 bg-ink-950/90 text-signal-400 backdrop-blur shadow-2xl">
          <span className="font-mono text-[9px] font-bold tracking-tight">T₁|T₂</span>
        </div>

        {/* Floating Year Pills */}
        <div className="pointer-events-none absolute top-24 -translate-x-full pr-3 hidden sm:block">
          <span className="rounded-full border border-bone-100/15 bg-ink-950/85 px-3 py-1 font-mono text-[10px] tracking-widest text-bone-200 uppercase backdrop-blur">
            2018 · Baseline Canopy
          </span>
        </div>
        <div className="pointer-events-none absolute top-24 translate-x-full pl-3 hidden sm:block">
          <span className="rounded-full border border-signal-400/40 bg-ink-950/85 px-3 py-1 font-mono text-[10px] tracking-widest text-signal-400 uppercase backdrop-blur">
            2024 · Detected Scars
          </span>
        </div>
      </div>

      {/* 4. Cinematic Dark Vignette Gradients */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(5,8,12,0.85)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-950 via-ink-950/80 to-transparent" />

      {/* 5. Hero Content Typography */}
      <div className="relative z-20 flex h-full flex-col justify-end px-6 pb-14 lg:px-16 lg:pb-20">
        <motion.div {...reveal(0.1)} className="flex items-center gap-3">
          <span className="size-2 rounded-full bg-signal-400 animate-pulse shadow-[0_0_8px_#FFB020]" />
          <p className="font-mono text-xs tracking-[0.25em] text-signal-400 uppercase">
            Copernicus Sentinel-2 · Cloudless Intelligence
          </p>
        </motion.div>

        <motion.h1
          {...reveal(0.25)}
          className="font-display mt-4 max-w-5xl text-[clamp(3rem,8.5vw,7.5rem)] leading-[0.92] tracking-tight text-bone-100"
        >
          The ground never lies.
          <br />
          <em className="text-signal-400 not-italic font-italic">Seasons do.</em>
        </motion.h1>

        <motion.div
          {...reveal(0.4)}
          className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between"
        >
          <p className="max-w-xl text-base leading-relaxed text-bone-300 lg:text-lg">
            Drag across the planet. TerraShift neutralizes solar angles and seasonal moisture to
            isolate genuine physical change — vectorizing deforestation, urbanization, and land loss
            into verifiable GeoJSON evidence.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/analyze"
              className="flex items-center gap-2 rounded-full bg-signal-400 px-8 py-4 font-mono text-xs font-bold tracking-widest text-ink-950 uppercase transition-transform hover:scale-[1.03] active:scale-95 shadow-[0_0_24px_rgba(255,176,32,0.4)]"
            >
              <span>Launch Studio</span>
              <span>→</span>
            </Link>

            <a
              href="#story"
              className="rounded-full border border-bone-100/20 bg-ink-950/60 px-6 py-4 font-mono text-xs tracking-widest text-bone-200 uppercase backdrop-blur transition-colors hover:border-signal-400 hover:text-signal-400"
            >
              How It Works
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
