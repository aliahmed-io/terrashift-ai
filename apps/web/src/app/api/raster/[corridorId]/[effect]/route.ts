import { type NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{
    corridorId: string;
    effect: string;
  }>;
}

const EFFECT_FALLBACK_FILES: Record<string, string> = {
  split: "riyadh_bitemporal_split.jpg",
  nir: "riyadh_nir.jpg",
  ndbi: "riyadh_ndbi.jpg",
  magma: "riyadh_magma.jpg",
  confusion: "riyadh_confusion.jpg",
  contagion: "riyadh_contagion.jpg",
  carbon: "riyadh_carbon.jpg",
  thermal: "riyadh_thermal.jpg",
};

const RASTER_CACHE = new Map<string, { buffer: ArrayBuffer; origin: string; ts: number }>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

export async function GET(req: NextRequest, { params }: RouteParams) {
  const { corridorId, effect } = await params;
  const searchParams = req.nextUrl.searchParams;
  const yearT1 = searchParams.get("yearT1") ?? "2018";
  const yearT2 = searchParams.get("yearT2") ?? "2024";
  const threshold = Number(searchParams.get("threshold") ?? "0.45").toFixed(2);
  const splitRatio = searchParams.get("splitRatio") ?? "0.44";

  const cacheKey = `${corridorId}:${effect}:${yearT1}:${yearT2}:${threshold}:${splitRatio}`;
  const cached = RASTER_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return new NextResponse(cached.buffer, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "X-Raster-Origin": cached.origin,
      },
    });
  }

  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";

  try {
    const mlRes = await fetch(
      `${mlUrl}/v1/render/${encodeURIComponent(corridorId)}/${encodeURIComponent(effect)}?year_t1=${yearT1}&year_t2=${yearT2}&threshold=${threshold}&split_ratio=${splitRatio}`,
      {
        headers: { Accept: "image/jpeg, image/*" },
        signal: AbortSignal.timeout(2500),
      },
    );

    if (mlRes.ok) {
      const buffer = await mlRes.arrayBuffer();
      if (RASTER_CACHE.size > 120) {
        const oldestKey = RASTER_CACHE.keys().next().value;
        if (oldestKey) RASTER_CACHE.delete(oldestKey);
      }
      RASTER_CACHE.set(cacheKey, { buffer, origin: "ml-engine", ts: Date.now() });
      return new NextResponse(buffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
          "X-Raster-Origin": "ml-engine",
        },
      });
    }
  } catch {
    // Fall through to sample fallback on timeout or connection refused
  }

  // Safe fallback to local sample
  const sampleName = EFFECT_FALLBACK_FILES[effect.toLowerCase()] ?? "riyadh_bitemporal_split.jpg";
  const samplePath = path.join(process.cwd(), "public", "samples", sampleName);

  try {
    if (fs.existsSync(samplePath)) {
      const sampleBuffer = fs.readFileSync(samplePath);
      const ab = sampleBuffer.buffer.slice(
        sampleBuffer.byteOffset,
        sampleBuffer.byteOffset + sampleBuffer.byteLength,
      ) as ArrayBuffer;
      RASTER_CACHE.set(cacheKey, { buffer: ab, origin: "sample-fallback", ts: Date.now() });
      return new NextResponse(sampleBuffer, {
        headers: {
          "Content-Type": "image/jpeg",
          "Cache-Control": "public, max-age=3600",
          "X-Raster-Origin": "sample-fallback",
        },
      });
    }
  } catch {
    // Fallback failed
  }

  return new NextResponse(null, { status: 404 });
}

