"use client";

import React from "react";
import { StudioShell } from "@/components/studio-nav";
import { useAoi, type CorridorId } from "@/lib/aoi-context";

const WATCHLIST_ITEMS: {
  id: CorridorId;
  name: string;
  coords: string;
  delta: number;
  areaHa: number;
  pct: number;
  w: string;
  color: string;
  thumb: string;
}[] = [
  {
    id: "neom",
    name: "NEOM · The Line Spine Sector 1",
    coords: "Tabuk Province · 28.12°N, 35.10°E",
    delta: 0.38,
    areaHa: 1420,
    pct: 18,
    w: "68%",
    color: "bg-[#e94235]",
    thumb: "/api/raster/neom/magma",
  },
  {
    id: "wadi",
    name: "Green Riyadh · Wadi Hanifah Canopy",
    coords: "Riyadh Province · 24.66°N, 46.68°E",
    delta: 0.39,
    areaHa: 890,
    pct: 12,
    w: "52%",
    color: "bg-[#22b567]",
    thumb: "/api/raster/wadi/carbon",
  },
  {
    id: "redsea",
    name: "Red Sea Global · Shura Lagoon",
    coords: "Al Wajh Coast · 25.58°N, 36.93°E",
    delta: 0.21,
    areaHa: 640,
    pct: 9,
    w: "38%",
    color: "bg-[#f39223]",
    thumb: "/api/raster/redsea/ndbi",
  },
  {
    id: "rondonia",
    name: "Rondônia · Primary Forest Loss",
    coords: "Ariquemes, Brazil · 10.86°S, 61.93°W",
    delta: 0.415,
    areaHa: 2151,
    pct: 20,
    w: "74%",
    color: "bg-[#e94235]",
    thumb: "/api/raster/rondonia/confusion",
  },
];

export default function WatchlistPage() {
  const { activeCorridor, activeCorridorId, setActiveCorridorId, activeYear, activeMonth, temporalModifier } = useAoi();

  const stacManifest = {
    stac_version: "1.0.0",
    id: activeCorridor.stacId,
    collection: "terrashift-vision2030-v1",
    bbox: activeCorridor.bbox,
    properties: {
      datetime: `${activeYear}-06-14T07:36:12Z`,
      constellation: "sentinel-2",
      gsd: 10.0,
      "eo:cloud_cover": 0.12,
      "proj:epsg": activeCorridor.epsg,
      "terrashift:model": "SiameseResUNet-10ch",
      "terrashift:change_pct": Number((activeCorridor.baseChangePct * temporalModifier).toFixed(2)),
      "terrashift:affected_area_ha": Number((activeCorridor.baseAreaHa * temporalModifier).toFixed(1)),
      "terrashift:confidence": 0.962,
    },
  };

  const handleDownloadGeoJson = () => {
    const blob = new Blob([JSON.stringify(stacManifest, null, 2)], {
      type: "application/geo+json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeCorridor.stacId.toLowerCase()}.geojson`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <StudioShell>
      <div className="grid h-full w-full grid-cols-12 gap-5 overflow-hidden p-6">
        <div className="col-span-7 flex min-h-0 flex-col justify-between rounded-[20px] bg-white p-6 shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1c1f23]">
                Planetary Watchlist &amp; Automated STAC Rules
              </h2>
              <p className="mt-0.5 text-[12px] text-[#8c929c]">
                5-Day Sentinel-2 L2A revisit monitoring via Element84 Earth Search ({activeMonth} {activeYear})
              </p>
            </div>
            <span className="text-[12px] font-semibold text-[#22b567]">5 Active Corridors</span>
          </div>

          <div className="my-auto space-y-3">
            {WATCHLIST_ITEMS.map((item) => {
              const isSelected = activeCorridorId === item.id;
              const modDelta = (item.delta * (0.94 + temporalModifier * 0.06)).toFixed(3).replace(".", ",");
              const modArea = Math.round(item.areaHa * (0.9 + temporalModifier * 0.1)).toLocaleString("en-US");
              return (
                <div
                  key={item.name}
                  onClick={() => setActiveCorridorId(item.id)}
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-[16px] p-3.5 transition-colors ${
                    isSelected ? "bg-[#f0f3f1]" : "bg-[#f8f9fb] hover:bg-[#f2f4f7]"
                  }`}
                >
                  <div className="flex min-w-[260px] items-center gap-3.5">
                    <img src={item.thumb} alt={item.name} className="h-11 w-14 shrink-0 rounded-[10px] object-cover" />
                    <div>
                      <div className="text-[13.5px] font-semibold text-[#1c1f23]">{item.name}</div>
                      <div className="mt-0.5 text-[11.5px] text-[#8c929c]">{item.coords}</div>
                    </div>
                  </div>

                  <div className="max-w-[220px] flex-1">
                    <div className="mb-1.5 flex items-center justify-between text-[12px] tabular-nums">
                      <span className="font-semibold text-[#1c1f23]">{modDelta}</span>
                      <span className="font-medium text-[#3b4048]">{modArea} ha</span>
                      <span className="text-[#9aa0aa]">{item.pct} %</span>
                    </div>
                    <div className="h-[5px] w-full overflow-hidden rounded-full bg-[#e6e8ec]">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: item.w }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-5 flex min-h-0 flex-col justify-between rounded-[20px] bg-white p-6 shadow-[0_8px_28px_rgba(0,0,0,0.05)]">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1c1f23]">OGC STAC 1.0.0 Item Manifest</h3>
                <p className="mt-0.5 text-[12px] text-[#8c929c]">Standardized eo + proj + mlm metadata extensions</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadGeoJson}
                className="cursor-pointer text-[12px] font-medium text-[#8c929c] transition-colors hover:text-[#1c1f23]"
              >
                GeoJSON
              </button>
            </div>

            <pre className="overflow-hidden rounded-[14px] bg-[#f8f9fb] p-4 font-mono text-[11.5px] leading-relaxed text-[#3b4048]">
              {JSON.stringify(stacManifest, null, 2).replace(
                /"bbox": \[\s+([^\]]+)\s+\]/,
                (_, inner: string) => `"bbox": [${inner.replace(/\s+/g, " ").trim()}]`,
              )}
            </pre>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[14px] bg-[#f8f9fb] p-3.5">
              <div className="text-[12.5px] font-semibold text-[#1c1f23]">{activeCorridor.tileId}</div>
              <div className="mt-0.5 text-[11.5px] font-medium text-[#22b567]">Cloud 0,12 % · 10 m Optical</div>
            </div>
            <div className="rounded-[14px] bg-[#f8f9fb] p-3.5">
              <div className="text-[12.5px] font-semibold text-[#1c1f23]">S2A_38RMV_{activeYear}0525</div>
              <div className="mt-0.5 text-[11.5px] font-medium text-[#22b567]">Cloud 0,04 % · 10 m Optical</div>
            </div>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
