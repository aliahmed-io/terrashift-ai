"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export interface StudioNavItem {
  href: string;
  label: string;
  badge?: string;
}

export const STUDIO_NAV_ITEMS: readonly StudioNavItem[] = [
  { href: "/analyze", label: "GIS Studio" },
  { href: "/benchmarks", label: "Ablation & XAI" },
  { href: "/timeline", label: "Time-Series" },
  { href: "/lab", label: "Image Lab" },
  { href: "/carbon", label: "Carbon & ESG" },
  { href: "/watchlist", label: "Case Atlas" },
];

interface StudioNavProps {
  rightSlot?: ReactNode;
}

export function StudioNav({ rightSlot }: StudioNavProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex h-14 w-full shrink-0 items-center justify-between border-b border-white/10 bg-ink-950/95 px-4 backdrop-blur-md">
      <div className="flex items-center gap-3 overflow-x-auto no-scrollbar">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-lg p-1 text-bone-200 transition-colors hover:text-signal-400 focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none shrink-0"
          aria-label="Back to TerraShift Home"
        >
          <svg
            className="size-4 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="font-semibold tracking-tight text-bone-100 text-sm">TerraShift</span>
        </Link>

        <div className="h-4 w-px bg-white/10 shrink-0" aria-hidden="true" />

        <nav aria-label="Platform sections" className="flex items-center gap-1">
          {STUDIO_NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-signal-400 focus-visible:outline-none ${
                  active
                    ? "bg-signal-400/15 text-signal-400 border border-signal-400/40"
                    : "text-bone-300 hover:bg-white/5 hover:text-bone-100 border border-transparent"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>

      {rightSlot ? <div className="flex items-center gap-2 shrink-0 ms-3">{rightSlot}</div> : null}
    </header>
  );
}
