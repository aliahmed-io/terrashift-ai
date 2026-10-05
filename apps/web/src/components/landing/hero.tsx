"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { useEffect, useRef } from "react";
import { RegionOverlay } from "@/components/region-overlay";
import { SceneCanvas } from "@/components/scene-canvas";
import { getScene } from "@/lib/scene";
import { motion as motionTokens } from "@/tokens";

const CANVAS = "absolute inset-0 size-full object-cover";

export function Hero() {
  const scene = getScene(7);
  const wrap = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const apply = (x: number): void => el.style.setProperty("--x", `${x}px`);
    let target = el.clientWidth * 0.5;
    let current = target;
    apply(current);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let lastMove = -Infinity;
    let raf = 0;
    let visible = true;

    const onMove = (e: PointerEvent): void => {
      target = e.clientX - el.getBoundingClientRect().left;
      lastMove = performance.now();
    };
    const tick = (t: number): void => {
      if (visible) {
        if (t - lastMove > 2500) target = el.clientWidth * (0.5 + 0.32 * Math.sin(t / 1800));
        current += (target - current) * 0.08;
        apply(current);
      }
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true;
    });
    io.observe(el);
    el.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("pointermove", onMove);
    };
  }, []);

  const reveal = (delay: number) => ({
    initial: { opacity: 0, y: 48 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: motionTokens.slow, delay, ease: motionTokens.easeOutExpo },
  });

  return (
    <section
      ref={wrap}
      dir="ltr"
      aria-label="Introduction"
      className="bg-ink-950 relative isolate h-dvh min-h-[640px] touch-pan-y overflow-hidden [--x:50%]"
    >
      <SceneCanvas scene={scene} mode="before" className={CANVAS} />
      <div className="absolute inset-0 [clip-path:inset(0_0_0_var(--x))]">
        <SceneCanvas scene={scene} mode="after" className={CANVAS} />
        <RegionOverlay scene={scene} className={CANVAS} fill />
      </div>
      <div className="bg-signal-400 pointer-events-none absolute inset-y-0 start-0 w-px [transform:translateX(var(--x))] shadow-[0_0_24px_4px_rgba(255,176,32,0.5)]">
        <span className="border-signal-400 bg-ink-950/80 text-signal-400 absolute top-1/2 -ms-4 grid size-8 -translate-y-1/2 place-items-center rounded-full border font-mono text-[10px] backdrop-blur">
          T₁T₂
        </span>
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(5,8,12,0.75)_100%)]" />
      <div className="from-ink-950 via-ink-950/70 pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t to-transparent" />

      <div dir="ltr" className="relative z-10 flex h-full flex-col justify-end px-6 pb-16 lg:px-16 lg:pb-20">
        <motion.p {...reveal(0.1)} className="text-signal-400 mb-6 font-mono text-xs tracking-[0.3em] uppercase">
          Sentinel-2 change intelligence
        </motion.p>
        <motion.h1
          {...reveal(0.25)}
          className="font-display max-w-5xl text-[clamp(3.5rem,11vw,10rem)] leading-[0.9] tracking-tight"
        >
          The ground never lies.
          <br />
          <em className="text-signal-400">Seasons do.</em>
        </motion.h1>
        <motion.div {...reveal(0.45)} className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <p className="text-bone-300 max-w-md text-lg leading-relaxed">
            Drag across the planet. Everything on the right is what changed between two dates, after we silence the
            weather, the sun angle, and the harvest.
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/analyze"
              className="bg-signal-400 text-ink-950 rounded-full px-8 py-4 font-mono text-xs tracking-widest uppercase transition-transform hover:scale-[1.03] active:scale-95"
            >
              Launch analysis
            </Link>
            <a
              href="#story"
              className="border-bone-100/30 hover:border-signal-400 hover:text-signal-400 rounded-full border px-8 py-4 font-mono text-xs tracking-widest uppercase backdrop-blur transition-colors"
            >
              Read the story ↓
            </a>
          </div>
        </motion.div>
      </div>

      <dl className="text-bone-300 pointer-events-none absolute end-6 top-24 hidden text-end font-mono text-[11px] leading-6 tracking-widest uppercase md:block lg:end-16">
        <div>
          <dt className="inline">Naive diff flags </dt>
          <dd className="inline text-[#FF5240]">{scene.naivePct.toFixed(0)}%</dd>
        </div>
        <div>
          <dt className="inline">Actual change </dt>
          <dd className="text-signal-400 inline">{scene.changedPct.toFixed(1)}%</dd>
        </div>
        <div className="text-ink-400">Illustrative synthetic tile · 10 m</div>
      </dl>
    </section>
  );
}
