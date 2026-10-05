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
  const debounceRef = useRef<number | null>(null);

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
    }, 350);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  return (
    <div className="relative w-full">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search global coordinates or city..."
          className="w-full rounded-lg border border-bone-100/15 bg-ink-900 px-4 py-3 pe-10 font-mono text-xs text-bone-100 placeholder:text-ink-400 transition-colors focus:border-signal-400 focus:outline-none"
        />
        {loading ? (
          <span className="absolute end-3 top-1/2 -translate-y-1/2 font-mono text-xs text-signal-400 animate-pulse">
            •••
          </span>
        ) : (
          <span className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">
            🔍
          </span>
        )}
      </div>

      {open && results.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-56 overflow-y-auto rounded-lg border border-bone-100/15 bg-ink-900/95 p-1 shadow-2xl backdrop-blur">
          {results.map((loc) => (
            <li key={loc.placeId}>
              <button
                type="button"
                onClick={() => {
                  onSelectLocation(loc);
                  setQuery(loc.displayName.split(",")[0] ?? loc.displayName);
                  setOpen(false);
                }}
                className="w-full rounded p-2 text-start text-xs transition-colors hover:bg-signal-400/15 hover:text-signal-400"
              >
                <span className="block font-medium truncate">{loc.displayName}</span>
                <span className="font-mono text-[10px] text-ink-400">
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
