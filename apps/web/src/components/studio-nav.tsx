"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

const STUDIO_LINKS = [
  { href: "/", label: "Command Deck" },
  { href: "/analyze", label: "Map Studio" },
  { href: "/benchmarks", label: "Model Benchmarks & XAI" },
  { href: "/timeline", label: "BFAST Timeline" },
  { href: "/lab", label: "Image Pair Lab" },
  { href: "/carbon", label: "Carbon & UHI" },
  { href: "/watchlist", label: "Live STAC Atlas" },
] as const;

export interface StudioNavProps {
  readonly rightSlot?: ReactNode;
}

export function StudioNav({ rightSlot }: StudioNavProps = {}) {
  const pathname = usePathname();
  const [utcTime, setUtcTime] = useState("12:44:09.82 Z");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setUtcTime(`${now.toISOString().substring(11, 22)} Z`);
    };
    updateClock();
    const id = setInterval(updateClock, 500);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-50 w-full bg-[#04070B]/85 backdrop-blur-xl border-b border-[#334155]/30 shadow-2xl">
      {/* Telemetry Ticker Top Banner (from Stitch Design) */}
      <div className="hidden lg:flex items-center justify-between px-4 py-1 border-b border-[#334155]/25 bg-[#0D1424]/40 text-[10px] font-mono tracking-widest text-[#94A3B8]">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-[#FFB020]">
            <span className="size-1.5 rounded-full bg-[#FFB020] animate-ping" aria-hidden="true" />
            ORBITAL LEO S2-A OVERPASS ACTIVE
          </span>
          <span className="text-[#334155]">|</span>
          <span>LAT: 24.8350° N</span>
          <span>LON: 46.7450° E</span>
          <span className="text-[#334155]">|</span>
          <span>ALTITUDE: 786.2 KM</span>
          <span>INCL: 98.62°</span>
          <span>SWATH: 290 KM</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] font-mono tabular-nums">
          <span className="text-[#38E8FF]">SUN ELEV: 64.2°</span>
          <span className="text-[#00F5A0]">GSD: 10m/px BOA</span>
          <span className="text-[#F0F4F8]">UTC: {utcTime}</span>
        </div>
      </div>

      {/* Main Command Nav */}
      <div className="flex justify-between items-center w-full px-4 py-2.5 backdrop-blur-md">
        {/* Brand Cluster */}
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none"
          >
            <div className="relative size-8 rounded-lg bg-[#0D1424]/90 border border-[#FFB020]/40 flex items-center justify-center text-[#FFB020] shadow-[0_0_15px_rgba(255,176,32,0.3)] group-hover:border-[#FFB020] transition-colors">
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M13 7 9 3 5 7l4 4" />
                <path d="m17 11 4 4-4 4-4-4" />
                <path d="m8 12 4 4 6-6-4-4Z" />
                <path d="m16 8 3-3" />
                <path d="M9 21a6 6 0 0 0-6-6" />
              </svg>
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#00F5A0]" />
            </div>
            <div className="flex flex-col">
              <span className="leading-none text-xs tracking-widest text-[#FFB020] font-bold uppercase">
                TERRASHIFT AI
              </span>
              <span className="mt-0.5 text-[9px] font-mono tracking-widest text-[#94A3B8] uppercase">
                SOLARIS // KSA 2030
              </span>
            </div>
          </Link>

          <div className="hidden xl:block h-6 w-px bg-[#334155]/35" aria-hidden="true" />

          {/* Navigation Links */}
          <nav
            aria-label="Mission Modules"
            className="flex items-center gap-4 xl:gap-5 overflow-x-auto py-0.5"
          >
            {STUDIO_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap pb-1 text-xs tracking-wider uppercase transition-colors flex items-center gap-1.5 ${
                    active
                      ? "text-[#FFB020] border-b-2 border-[#FFB020] font-bold"
                      : "text-[#94A3B8] hover:text-[#F0F4F8] font-medium border-b-2 border-transparent"
                  }`}
                >
                  {active ? (
                    <span className="size-1.5 rounded-full bg-[#FFB020]" aria-hidden="true" />
                  ) : null}
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action Cluster */}
        <div className="flex items-center gap-3 shrink-0">
          {rightSlot}
          <a
            href="/api/model"
            download="siamese_unet_levircd.pt"
            title="Download trained PyTorch FC-Siam-diff weights (.pt)"
            className="hidden sm:flex items-center gap-2 bg-[#0D1424]/80 border border-[#334155]/40 hover:border-[#00F5A0]/50 px-2.5 py-1.5 rounded text-[11px] font-mono text-[#94A3B8] transition-colors"
          >
            <span className="size-2 rounded-full bg-[#00F5A0] animate-pulse" aria-hidden="true" />
            <span className="text-[#F0F4F8] font-semibold">Weights v4.2-FC-Siam</span>
            <span className="text-[#FFB020] text-[10px]">42.8ms</span>
          </a>

          <Link
            href="/analyze"
            className="bg-[#FFB020] text-[#04070B] font-bold text-xs uppercase tracking-wider px-3.5 py-2 rounded flex items-center gap-1.5 shadow-[0_0_20px_rgba(255,176,32,0.35)] hover:brightness-110 active:scale-[0.98] transition-all"
          >
            <svg
              className="size-3.5"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
            <span>Execute Inference</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
