import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  CORRIDOR_PROFILES,
  getTemporalModifier,
  type CorridorId,
  type MonthLabel,
  TIMELINE_MONTHS,
} from "@/lib/corridors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  corridorId: z.enum(["roshn", "wadi", "neom", "redsea", "rondonia"]).optional(),
  corridor_id: z.enum(["roshn", "wadi", "neom", "redsea", "rondonia"]).optional(),
  yearT1: z.number().int().min(2017).max(2025).optional(),
  year_t1: z.number().int().min(2017).max(2025).optional(),
  yearT2: z.number().int().min(2017).max(2025).optional(),
  year_t2: z.number().int().min(2017).max(2025).optional(),
  month: z.enum(TIMELINE_MONTHS as unknown as [MonthLabel, ...MonthLabel[]]).optional(),
  threshold: z.number().min(0.1).max(0.9).optional(),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(raw);
  const data = parsed.success ? parsed.data : {};
  const corridorId = (data.corridorId ?? data.corridor_id ?? "roshn") as CorridorId;
  const yearT1 = data.yearT1 ?? data.year_t1 ?? 2018;
  const yearT2 = data.yearT2 ?? data.year_t2 ?? 2024;
  const month = (data.month ?? "Jul") as MonthLabel;
  const threshold = data.threshold ?? 0.45;

  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";

  try {
    const mlRes = await fetch(`${mlUrl}/v1/corridor/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        corridor_id: corridorId,
        year_t1: yearT1,
        year_t2: yearT2,
        month,
        threshold,
      }),
      signal: AbortSignal.timeout(3500),
    });

    if (mlRes.ok) {
      const telemetry = await mlRes.json();
      return NextResponse.json(telemetry, {
        headers: {
          "Cache-Control": "public, max-age=60",
          "X-Telemetry-Origin": "ml-engine",
        },
      });
    }
  } catch {
    // Fall through to deterministic fallback
  }

  // Fallback computation
  const profile = CORRIDOR_PROFILES[corridorId];
  const tMod = getTemporalModifier(yearT2, month);
  const areaHa = Number((profile.baseAreaHa * tMod).toFixed(1));
  const chgPct = Number((profile.baseChangePct * tMod * (1.0 + (0.45 - threshold) * 0.4)).toFixed(1));

  const fallbackRows = profile.anomalyRows.map((r) => ({
    label: r.label,
    baseVal: Number((r.baseVal * tMod).toFixed(3)),
    baseAreaHa: Number((areaHa * (r.pct / 100)).toFixed(1)),
    pct: r.pct,
    tone: r.tone,
  }));

  const fallbackTelemetry = {
    id: profile.id,
    name: profile.name,
    shortName: profile.shortName,
    subtitle: profile.subtitle,
    coordsLabel: profile.coordsLabel,
    epsg: profile.epsg,
    bbox: profile.bbox,
    baseAreaHa: areaHa,
    baseChangePct: chgPct,
    baseF1: profile.baseF1,
    baseIou: profile.baseIou,
    basePrecision: profile.basePrecision,
    baseRecall: profile.baseRecall,
    defaultEffect: profile.defaultEffect,
    anomalyRows: fallbackRows,
    spectralBands2018: profile.spectralBands2018,
    spectralBands2024: profile.spectralBands2024,
    carbonMgPerHa: Number((profile.carbonMgPerHa * tMod).toFixed(1)),
    thermalDeltaC: Number((profile.thermalDeltaC * (tMod / 0.95)).toFixed(1)),
    temporalModifier: tMod,
    rasterUrls: {
      split: `/api/raster/${profile.id}/split?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
      nir: `/api/raster/${profile.id}/nir?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
      ndbi: `/api/raster/${profile.id}/ndbi?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
      magma: `/api/raster/${profile.id}/magma?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
      confusion: `/api/raster/${profile.id}/confusion?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
      contagion: `/api/raster/${profile.id}/contagion?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
      carbon: `/api/raster/${profile.id}/carbon?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
      thermal: `/api/raster/${profile.id}/thermal?yearT1=${yearT1}&yearT2=${yearT2}&threshold=${threshold}`,
    },
  };

  return NextResponse.json(fallbackTelemetry, {
    headers: {
      "Cache-Control": "public, max-age=60",
      "X-Telemetry-Origin": "fallback-engine",
    },
  });
}
