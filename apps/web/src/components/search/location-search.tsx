"use client";

import { useEffect, useRef, useState } from "react";
import type { GeocodeLocation } from "@/app/api/geocode/route";

interface LocationSearchProps {
  onSelectLocation: (loc: GeocodeLocation) => void;
}

export function LocationSearch({ onSelectLocation }: LocationSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<number | null>(null);

  // Global keyboard shortcut: press '/' to focus search input
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/geocode?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = (await res.json()) as GeocodeLocation[];
          setResults(data);
          setOpen(data.length > 0);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const clearQuery = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        {/* Search Icon */}
        <span className="pointer-events-none absolute start-3 text-bone-400" aria-hidden="true">
          <svg
            className="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </span>

        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-label="Search global coordinates or region"
          name="location-search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search coordinates or city… (/)"
          className="w-full rounded-lg border border-white/10 bg-ink-900/90 py-1.5 ps-9 pe-16 text-xs text-bone-100 placeholder:text-bone-400 transition-colors focus:border-signal-400/60 focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none"
        />

        {/* Status / Clear Button */}
        <div className="absolute end-2 flex items-center gap-1.5">
          {loading ? (
            <span
              className="flex items-center gap-0.5"
              role="status"
              aria-label="Searching locations…"
            >
              <span className="size-1 rounded-full bg-signal-400 animate-ping" />
              <span className="size-1 rounded-full bg-signal-400 animate-ping delay-150" />
            </span>
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={clearQuery}
              className="rounded p-0.5 text-bone-400 hover:text-bone-100 transition-colors focus-visible:ring-1 focus-visible:ring-signal-400 focus-visible:outline-none"
              aria-label="Clear search input"
            >
              <svg
                className="size-3.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          ) : (
            <kbd className="pointer-events-none hidden sm:inline-flex rounded border border-white/10 bg-ink-950 px-1.5 py-0.5 font-mono text-[10px] text-bone-400">
              /
            </kbd>
          )}
        </div>
      </div>

      {open && results.length > 0 && (
        <ul
          role="listbox"
          className="absolute inset-x-0 top-full z-40 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-ink-900/95 p-1 shadow-2xl backdrop-blur-xl"
        >
          {results.map((loc) => (
            <li key={loc.placeId} role="option" aria-selected="false">
              <button
                type="button"
                onClick={() => {
                  onSelectLocation(loc);
                  setQuery(loc.displayName.split(",")[0] ?? loc.displayName);
                  setOpen(false);
                }}
                className="w-full rounded-lg px-2.5 py-2 text-start text-xs transition-colors hover:bg-signal-400/15 hover:text-signal-400 focus-visible:bg-signal-400/15 focus-visible:text-signal-400 focus-visible:outline-none"
              >
                <span className="block font-medium truncate text-bone-100">{loc.displayName}</span>
                <span className="font-mono text-[10px] text-bone-400 tabular-nums">
                  {loc.lat.toFixed(4)}, {loc.lon.toFixed(4)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
