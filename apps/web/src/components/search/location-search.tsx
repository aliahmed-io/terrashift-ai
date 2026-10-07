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
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="location-search-listbox"
          aria-haspopup="listbox"
          aria-label="Search for place or coordinates"
          name="location-search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Search for place or coordinates"
          className="w-full rounded-xl bg-white py-2.5 ps-4 pe-10 text-xs font-medium text-[#111827] placeholder:text-[#64707D] shadow-[0_8px_24px_rgba(8,47,68,0.22)] border border-[#E6EAEE] focus:border-[#0F4C6C] focus-visible:outline-none transition-colors"
        />

        <div className="absolute end-3 flex items-center gap-1.5 text-[#111827]">
          {loading ? (
            <span
              className="flex items-center gap-0.5"
              role="status"
              aria-label="Searching locations…"
            >
              <span className="size-1.5 rounded-full bg-[#0F4C6C] animate-ping" />
            </span>
          ) : query.length > 0 ? (
            <button
              type="button"
              onClick={clearQuery}
              className="rounded p-0.5 text-[#64707D] hover:text-[#111827] transition-colors focus-visible:outline-none"
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
            <svg
              className="size-4 text-[#111827]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
          )}
        </div>
      </div>

      {open && results.length > 0 && (
        <ul
          id="location-search-listbox"
          role="listbox"
          className="absolute inset-x-0 top-full z-50 mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-[#E6EAEE] bg-white p-1.5 shadow-2xl"
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
                className="w-full rounded-lg px-3 py-2 text-start text-xs transition-colors hover:bg-[#F3F5F7] focus-visible:bg-[#F3F5F7] focus-visible:outline-none"
              >
                <span className="block font-semibold truncate text-[#111827]">
                  {loc.displayName}
                </span>
                <span className="font-mono text-[10px] text-[#64707D] tabular-nums">
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
