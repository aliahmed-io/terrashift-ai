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
  const {
    activeCorridor,
    activeCorridorId,
    setActiveCorridorId,
    activeYear,
    activeMonth,
    temporalModifier,
  } = useAoi();

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
      "terrashift:change_pct": Number(
        (activeCorridor.baseChangePct * temporalModifier).toFixed(2)
      ),
      "terrashift:affected_area_ha": Number(
        (activeCorridor.baseAreaHa * temporalModifier).toFixed(1)
      ),
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
      <div className="w-full h-full p-6 grid grid-cols-12 gap-5 overflow-hidden">
        <div className="col-span-7 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-[16px] font-semibold text-[#1c1f23]">
                Planetary Watchlist &amp; Automated STAC Rules
              </h2>
              <p className="text-[12px] text-[#8c929c] mt-0.5">
                5-Day Sentinel-2 L2A revisit monitoring via Element84 Earth Search ({activeMonth} {activeYear})
              </p>
            </div>
            <span className="text-[12px] font-semibold text-[#22b567]">
              5 Active Corridors
            </span>
          </div>

          <div className="space-y-3 my-auto">
            {WATCHLIST_ITEMS.map((item) => {
              const isSelected = activeCorridorId === item.id;
              const modDelta = (item.delta * (0.94 + temporalModifier * 0.06))
                .toFixed(3)
                .replace(".", ",");
              const modArea = Math.round(
                item.areaHa * (0.9 + temporalModifier * 0.1)
              ).toLocaleString("en-US");
              return (
                <div
                  key={item.name}
                  onClick={() => setActiveCorridorId(item.id)}
                  className={`p-3.5 rounded-[16px] flex items-center justify-between gap-4 transition-colors cursor-pointer ${
                    isSelected
                      ? "bg-[#f0f3f1]"
                      : "bg-[#f8f9fb] hover:bg-[#f2f4f7]"
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-[260px]">
                    <img
                      src={item.thumb}
                      alt={item.name}
                      className="w-14 h-11 rounded-[10px] object-cover shrink-0"
                    />
                    <div>
                      <div className="text-[13.5px] font-semibold text-[#1c1f23]">
                        {item.name}
                      </div>
                      <div className="text-[11.5px] text-[#8c929c] mt-0.5">
                        {item.coords}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 max-w-[220px]">
                    <div className="flex items-center justify-between text-[12px] mb-1.5 tabular-nums">
                      <span className="font-semibold text-[#1c1f23]">
                        {modDelta}
                      </span>
                      <span className="font-medium text-[#3b4048]">
                        {modArea} ha
                      </span>
                      <span className="text-[#9aa0aa]">{item.pct} %</span>
                    </div>
                    <div className="h-[5px] w-full bg-[#e6e8ec] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.color}`}
                        style={{ width: item.w }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="col-span-5 bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                  OGC STAC 1.0.0 Item Manifest
                </h3>
                <p className="text-[12px] text-[#8c929c] mt-0.5">
                  Standardized eo + proj + mlm metadata extensions
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadGeoJson}
                className="text-[12px] font-medium text-[#8c929c] hover:text-[#1c1f23] transition-colors cursor-pointer"
              >
                GeoJSON
              </button>
            </div>

            <pre className="p-4 rounded-[14px] bg-[#f8f9fb] text-[11.5px] font-mono text-[#3b4048] leading-relaxed overflow-hidden">
              { JSON.stringify(stacManifest, null, 2).replace(
                /"bbox": \[\s+([^\]]+)\s+\]/,
                (_, inner: string) =>
                  `"bbox": [${inner.replace(/\s+/g, " ").trim()}]`
              ) }
            </pre>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 rounded-[14px] bg-[#f8f9fb]">
              <div className="text-[12.5px] font-semibold text-[#1c1f23]">
                {activeCorridor.tileId}
              </div>
              <div className="text-[11.5px] text-[#22b567] font-medium mt-0.5">
                Cloud 0,12 % · 10 m Optical
              </div>
            </div>
            <div className="p-3.5 rounded-[14px] bg-[#f8f9fb]">
              <div className="text-[12.5px] font-semibold text-[#1c1f23]">
                S2A_38RMV_{activeYear}0525
              </div>
              <div className="text-[11.5px] text-[#22b567] font-medium mt-0.5">
                Cloud 0,04 % · 10 m Optical
              </div>
            </div>
          </div>
        </div>
      </div>
    </StudioShell>
  );
}
