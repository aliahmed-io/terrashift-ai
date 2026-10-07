"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode } from "react";

const STUDIO_LINKS = [
  { href: "/", label: "Overview" },
  { href: "/analyze", label: "Map Studio" },
  { href: "/benchmarks", label: "Benchmarks & XAI" },
  { href: "/timeline", label: "BFAST Timeline" },
  { href: "/lab", label: "Image Pair Lab" },
  { href: "/carbon", label: "Carbon & UHI" },
  { href: "/watchlist", label: "STAC Atlas" },
] as const;

export interface StudioNavProps {
  readonly rightSlot?: ReactNode;
}

export function StudioNav({ rightSlot }: StudioNavProps = {}) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-bone-100/10 bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6">
        {/* Brand */}
        <div className="flex items-center gap-6 overflow-x-auto">
          <Link
            href="/"
            className="flex items-center gap-2.5 shrink-0 text-bone-100 hover:opacity-90 transition-opacity focus-visible:outline-none"
          >
            <span className="flex size-7 items-center justify-center rounded-lg bg-signal-400/15 border border-signal-400/30 text-signal-400">
              <svg
                className="size-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M3.6 9h16.8" />
                <path d="M3.6 15h16.8" />
                <path d="M11.5 3a17 17 0 0 0 0 18" />
                <path d="M12.5 3a17 17 0 0 1 0 18" />
              </svg>
            </span>
            <span className="text-sm font-semibold tracking-tight text-bone-100">
              TerraShift
            </span>
          </Link>

          {/* Primary Navigation Links */}
          <nav aria-label="Platform navigation" className="flex items-center gap-1">
            {STUDIO_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    active
                      ? "bg-signal-400/15 text-signal-400 font-semibold border border-signal-400/30"
                      : "text-bone-300 hover:text-bone-100 hover:bg-bone-100/5 font-medium border border-transparent"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Contextual Right Actions */}
        <div className="flex items-center gap-2.5 shrink-0">
          {rightSlot ?? (
            <Link
              href="/analyze"
              className="rounded-lg bg-signal-400 px-3.5 py-1.5 text-xs font-semibold text-ink-950 hover:bg-signal-400/90 transition-colors"
            >
              Launch Map Studio
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
