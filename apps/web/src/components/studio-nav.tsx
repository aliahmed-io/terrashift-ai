"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";

const NAV_ITEMS = [
  { href: "/analyze", label: "GIS Map Studio", code: "01" },
  { href: "/benchmarks", label: "Ablation & XAI", code: "02" },
  { href: "/timeline", label: "BFAST Timeline", code: "03" },
  { href: "/lab", label: "Image Pair Lab", code: "04" },
  { href: "/carbon", label: "Carbon & UHI", code: "05" },
  { href: "/watchlist", label: "STAC Watchlist", code: "06" },
] as const;

export function StudioNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-bone-100/10 bg-ink-950/90 backdrop-blur-xl">
      {/* Top Orbital Telemetry Micro-Bar */}
      <div className="border-b border-bone-100/5 bg-ink-900/70 px-6 py-1">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between font-mono text-[10px] tracking-widest uppercase text-bone-400">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-phosphor-400">
              <span className="size-1.5 rounded-full bg-phosphor-400 shadow-[0_0_8px_#00F5A0]" />
              ORBITAL TELEMETRY LOCKED
            </span>
            <span className="hidden sm:inline text-bone-400/50">|</span>
            <span className="hidden sm:inline">SENTINEL-2 L2A · 10M MULTI-SPECTRAL</span>
          </div>
          <div className="flex items-center gap-4 tabular-nums">
            <span className="hidden md:inline">TENSOR ENGINE: FC-SIAM-DIFF (5-CH)</span>
            <span className="text-signal-400">SUN-SYNC 786 KM</span>
          </div>
        </div>
      </div>

      {/* Main Command Navigation Bar */}
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between px-6 gap-4">
        <div className="flex items-center gap-6">
          <Link
            href="/"
            className="group flex items-center gap-2.5 text-bone-100 hover:text-signal-400 transition-colors"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="1.3"
                className="opacity-80"
              />
              <path d="M12 2v20" stroke="#FFB020" strokeWidth="1.8" />
              <path
                d="M2 12h20"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeDasharray="2 2"
              />
            </svg>
            <div className="flex flex-col">
              <span className="font-mono text-xs font-semibold tracking-[0.22em] uppercase leading-none">
                TerraShift
              </span>
              <span className="font-mono text-[9px] tracking-widest text-bone-400 uppercase mt-0.5">
                Orbital Intelligence
              </span>
            </div>
          </Link>

          <nav aria-label="Studio Navigation" className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    active ? "text-ink-950 font-semibold" : "text-bone-300 hover:text-bone-100"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="orbital-nav-pill"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      className="absolute inset-0 rounded-lg bg-signal-400 shadow-[0_0_20px_rgba(255,176,32,0.35)]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <span
                      className={`font-mono text-[10px] ${
                        active ? "text-ink-950/75" : "text-bone-400"
                      }`}
                    >
                      {item.code}
                    </span>
                    <span>{item.label}</span>
                  </span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/api/model/weights"
            download="siamese_unet_checkpoint.pt"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-900 hover:bg-ink-800 border border-bone-100/15 text-xs font-mono text-bone-200 transition-colors"
          >
            <span className="size-1.5 rounded-full bg-signal-400" />
            <span>Weights (.pt)</span>
          </a>
          <Link
            href="/analyze"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-signal-400 hover:bg-signal-500 text-ink-950 font-semibold text-xs transition-all shadow-[0_0_18px_rgba(255,176,32,0.25)]"
          >
            <span>Open Map Studio</span>
          </Link>
        </div>
      </div>

      {/* Mobile Navigation Strip */}
      <nav
        aria-label="Mobile Studio Navigation"
        className="flex lg:hidden items-center gap-1.5 overflow-x-auto px-4 py-2 border-t border-bone-100/10"
      >
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 px-2.5 py-1 rounded-md text-xs font-mono transition-colors ${
                active
                  ? "bg-signal-400 text-ink-950 font-semibold"
                  : "text-bone-300 bg-ink-900/80 border border-bone-100/10"
              }`}
            >
              {item.code} · {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
