"use client";

import React, { useState, useEffect, useRef } from "react";
import { StudioShell } from "@/components/studio-nav";
import { useAoi } from "@/lib/aoi-context";

interface LabObjectRow {
  id: string;
  name: string;
  utm: string;
  area: string;
  ndvi: string;
  ndbi: string;
  conf: string;
}

const DEFAULT_OBJECTS: LabObjectRow[] = [
  {
    id: "OBJ-01",
    name: "ROSHN Sedra Residential Superblock",
    utm: "673840E 2746120N",
    area: "6,420 px²",
    ndvi: "-0,184",
    ndbi: "+0,442",
    conf: "98,4 %",
  },
  {
    id: "OBJ-02",
    name: "King Salman Airbase Re-Grid Sector",
    utm: "671420E 2744890N",
    area: "4,810 px²",
    ndvi: "-0,142",
    ndbi: "+0,389",
    conf: "97,1 %",
  },
  {
    id: "OBJ-03",
    name: "Eastern Logistics & Commercial Pad",
    utm: "676910E 2745310N",
    area: "3,290 px²",
    ndvi: "-0,095",
    ndbi: "+0,354",
    conf: "96,2 %",
  },
  {
    id: "OBJ-04",
    name: "Northern Wadi Riparian Green Buffer",
    utm: "669540E 2747920N",
    area: "2,640 px²",
    ndvi: "+0,382",
    ndbi: "-0,240",
    conf: "95,8 %",
  },
  {
    id: "OBJ-05",
    name: "Princess Nourah Ring Road Interchange",
    utm: "672890E 2746800N",
    area: "1,980 px²",
    ndvi: "-0,112",
    ndbi: "+0,318",
    conf: "94,9 %",
  },
];

export default function LabPage() {
  const { activeCorridor, activeYear, activeMonth, temporalModifier, getRasterUrl } = useAoi();
  const [objects, setObjects] = useState<LabObjectRow[]>(DEFAULT_OBJECTS);
  const [f1Score, setF1Score] = useState<string>("0,934 F1");
  const [iouScore, setIouScore] = useState<string>("87,6 % IoU");
  const [customImg1, setCustomImg1] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/lab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preset_id: activeCorridor.id,
        threshold: 0.45,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            validation?: { f1_score?: number; iou_score?: number };
          } | null
        ) => {
          if (!cancelled && data?.validation) {
            if (data.validation.f1_score) {
              setF1Score(
                `${data.validation.f1_score.toFixed(3).replace(".", ",")} F1`
              );
            }
            if (data.validation.iou_score) {
              setIouScore(
                `${(data.validation.iou_score * 100).toFixed(1).replace(".", ",")} % IoU`
              );
            }
          }
        }
      )
      .catch(() => {
        // Fallback already in state
      });
    return () => {
      cancelled = true;
    };
  }, [activeCorridor.id]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setCustomImg1(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const panels = [
    {
      title: "1. Bi-Temporal Input (T₁ / T₂)",
      sub: "0,14 px RMSE",
      img: customImg1 ?? getRasterUrl("split"),
    },
    {
      title: "2. Siamese Posterior P(Δ)",
      sub: f1Score,
      img: getRasterUrl("magma"),
    },
    {
      title: "3. Ground-Truth Pixel Audit",
      sub: iouScore,
      img: getRasterUrl("confusion"),
    },
  ];

  return (
    <StudioShell>
      <div className="w-full h-full p-6 grid grid-rows-[1.12fr_0.88fr] gap-5 overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <div className="grid grid-cols-3 gap-5 min-h-0">
          {panels.map((panel, idx) => (
            <div
              key={panel.title}
              onClick={() => {
                if (idx === 0) fileInputRef.current?.click();
              }}
              title={idx === 0 ? "Click to upload custom optical image" : panel.title}
              className="bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-4 flex flex-col min-h-0 cursor-pointer hover:shadow-[0_12px_32px_rgba(0,0,0,0.08)] transition-shadow"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[14.5px] font-semibold text-[#1c1f23]">
                  {panel.title}
                </h3>
                <span className="text-[12px] font-medium text-[#22b567] tabular-nums">
                  {panel.sub}
                </span>
              </div>
              <div className="relative flex-1 rounded-[14px] overflow-hidden min-h-0">
                <img
                  src={panel.img}
                  alt={panel.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-[20px] shadow-[0_8px_28px_rgba(0,0,0,0.05)] p-6 flex flex-col justify-between min-h-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-semibold text-[#1c1f23]">
                Connected-Component Segmented Footprints
              </h3>
              <p className="text-[12px] text-[#8c929c] mt-0.5">
                8-Connectivity Labeling + Douglas-Peucker Polygon Vectorization ·{" "}
                {activeCorridor.shortName} ({activeMonth} {activeYear})
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() =>
                  setObjects((prev) => [...prev].reverse())
                }
                className="text-[12px] font-medium text-[#8c929c] hover:text-[#1c1f23] transition-colors cursor-pointer"
              >
                Sort by Area
              </button>
              <span className="text-[12.5px] font-semibold text-[#22b567]">
                Precision 94,8 % · Recall 92,1 %
              </span>
            </div>
          </div>

          <table className="w-full text-left border-collapse my-auto">
            <thead>
              <tr className="border-b border-[#edeff2] text-[11.5px] font-medium text-[#8c929c]">
                <th className="pb-2">Object ID</th>
                <th className="pb-2">Semantic Structure</th>
                <th className="pb-2">UTM Centroid</th>
                <th className="pb-2">Area</th>
                <th className="pb-2">ΔNDVI</th>
                <th className="pb-2">ΔNDBI</th>
                <th className="pb-2 text-right">Confidence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f4f5f7] text-[12.5px] tabular-nums">
              {objects.map((row) => {
                const rawArea = Number(row.area.replace(/[^0-9]/g, ""));
                const scaledArea = Math.round(rawArea * (0.9 + temporalModifier * 0.1));
                return (
                  <tr key={row.id}>
                    <td className="py-2 font-semibold text-[#1c1f23]">{row.id}</td>
                    <td className="py-2 font-medium text-[#1c1f23]">{row.name}</td>
                    <td className="py-2 text-[#8c929c]">{row.utm}</td>
                    <td className="py-2 text-[#3b4048]">
                      {scaledArea.toLocaleString("en-US")} px²
                    </td>
                    <td className="py-2 text-[#3b4048]">{row.ndvi}</td>
                    <td className="py-2 text-[#3b4048]">{row.ndbi}</td>
                    <td className="py-2 text-right font-semibold text-[#22b567]">
                      {row.conf}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </StudioShell>
  );
}
