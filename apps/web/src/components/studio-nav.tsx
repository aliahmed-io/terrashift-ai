"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode, type FormEvent } from "react";

const STUDIO_LINKS = [
  { href: "/", label: "Orbital Deck", badge: "Live" },
  { href: "/analyze", label: "Tasking & Map Studio", badge: "Primary" },
  { href: "/benchmarks", label: "Model Benchmarks & XAI" },
  { href: "/timeline", label: "BFAST Timeline" },
  { href: "/lab", label: "Image Pair Lab" },
  { href: "/carbon", label: "Carbon & UHI" },
  { href: "/watchlist", label: "Live STAC Atlas" },
] as const;

export interface StudioNavProps {
  readonly rightSlot?: ReactNode;
  readonly onQuickSearch?: ((query: string) => void) | undefined;
}

export function StudioNav({ rightSlot, onQuickSearch }: StudioNavProps = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    if (onQuickSearch) {
      onQuickSearch(q);
    } else {
      router.push(`/analyze?q=${encodeURIComponent(q)}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0F4C6C] text-white shadow-[0_4px_20px_rgba(8,47,68,0.45)] border-b border-white/15">
      <div className="flex h-13 w-full items-center justify-between px-4 sm:px-6">
        {/* Left Cluster: User Avatar Badge + Brand + Inline Navigation (Ref 1) */}
        <div className="flex items-center gap-4">
          <div className="relative flex items-center gap-2">
            <button
              type="button"
              onClick={() => setProfileOpen((v) => !v)}
              className="group relative flex items-center gap-2 focus-visible:outline-none"
              aria-label="Open mission operator profile and active alerts"
              aria-expanded={profileOpen}
            >
              <span className="relative flex size-8.5 items-center justify-center rounded-full border-2 border-white/90 bg-[#0B3B54] text-white transition-transform group-hover:scale-105">
                <svg
                  className="size-4.5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                {/* Warm-Sand Notification Badge (Ref 1) */}
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-[#F4C396] text-[10px] font-bold text-[#082F44] shadow-xs">
                  2
                </span>
              </span>
              <svg
                className="size-2.5 text-white/80 transition-transform group-hover:text-white"
                viewBox="0 0 12 12"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M2 4l4 5 4-5H2z" />
              </svg>
            </button>

            {profileOpen ? (
              <div className="absolute left-0 top-full mt-2 w-72 rounded-xl bg-white p-3.5 text-[#111827] shadow-2xl border border-[#E6EAEE] z-50">
                <div className="flex items-center justify-between border-b border-[#E6EAEE] pb-2.5">
                  <div>
                    <p className="text-xs font-semibold text-[#111827]">KSA Vision 2030 Desk</p>
                    <p className="text-[11px] text-[#64707D]">2 Active Change Alerts Ready</p>
                  </div>
                  <span className="rounded-md bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-semibold text-[#0284C7]">
                    Active
                  </span>
                </div>
                <div className="mt-2.5 space-y-1.5 text-xs">
                  <Link
                    href="/analyze"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center justify-between rounded-lg bg-[#F3F5F7] px-2.5 py-2 hover:bg-[#E6EAEE] transition-colors"
                  >
                    <span className="font-medium text-[#111827]">Riyadh ROSHN Sedra</span>
                    <span className="font-mono text-[11px] font-semibold text-[#00875A]">89% prob</span>
                  </Link>
                  <Link
                    href="/watchlist"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center justify-between rounded-lg bg-[#F3F5F7] px-2.5 py-2 hover:bg-[#E6EAEE] transition-colors"
                  >
                    <span className="font-medium text-[#111827]">NEOM Spine Corridor</span>
                    <span className="font-mono text-[11px] font-semibold text-[#0284C7]">94% prob</span>
                  </Link>
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href="/"
            className="flex items-center gap-2 text-white hover:opacity-90 transition-opacity focus-visible:outline-none"
          >
            <span className="text-sm font-semibold tracking-tight">TerraShift</span>
            <span className="hidden sm:inline-block rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium text-[#36C5D8]">
              Earth Intelligence
            </span>
          </Link>

          <div className="hidden lg:block h-4 w-px bg-white/20" aria-hidden="true" />

          {/* Desktop Module Links */}
          <nav aria-label="Primary Navigation" className="hidden lg:flex items-center gap-1">
            {STUDIO_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname === link.href || pathname?.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "bg-white/18 text-white font-semibold shadow-2xs"
                      : "text-white/75 hover:text-white hover:bg-white/10 font-medium"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Cluster: Underlined Search + Custom Slot + === MENU (Exact Ref 1 pattern) */}
        <div className="flex items-center gap-4 sm:gap-5">
          {rightSlot}

          <form onSubmit={handleSearchSubmit} className="hidden sm:flex items-center">
            <label htmlFor="petrol-nav-search" className="sr-only">
              Search coordinates or region
            </label>
            <div className="flex items-center gap-2 border-b border-white/70 pb-1 focus-within:border-[#36C5D8] transition-colors">
              <svg
                className="size-3.5 text-white/85"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.3-4.3" />
              </svg>
              <input
                id="petrol-nav-search"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search"
                className="w-32 lg:w-44 bg-transparent text-xs text-white placeholder:text-white/65 focus:outline-none"
              />
            </div>
          </form>

          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md px-2 py-1 text-xs font-semibold tracking-wider text-white hover:bg-white/10 transition-colors focus-visible:outline-none"
            aria-expanded={menuOpen}
            aria-label="Toggle platform navigation menu"
          >
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
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="15" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <span className="tracking-widest">MENU</span>
          </button>
        </div>
      </div>

      {/* Slide-Down Porcelain & Petrol Navigation Drawer */}
      {menuOpen ? (
        <div className="border-t border-white/15 bg-[#0B3B54]/98 px-6 py-4 backdrop-blur-xl shadow-2xl">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {STUDIO_LINKS.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : pathname === link.href || pathname?.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs transition-colors ${
                      active
                        ? "bg-white text-[#0F4C6C] font-semibold shadow-sm"
                        : "bg-white/10 text-white hover:bg-white/20 font-medium"
                    }`}
                  >
                    <span>{link.label}</span>
                    {"badge" in link && link.badge ? (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                          active
                            ? "bg-[#0F4C6C]/15 text-[#0F4C6C]"
                            : "bg-[#36C5D8]/20 text-[#36C5D8]"
                        }`}
                      >
                        {link.badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
            <a
              href="/api/model"
              download="siamese_unet_levircd.pt"
              className="inline-flex items-center gap-2 rounded-lg bg-[#00875A] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#006E49] transition-colors shadow-sm"
            >
              <span>Download PyTorch Weights (8.45 MB)</span>
            </a>
          </div>
        </div>
      ) : null}
    </header>
  );
}
