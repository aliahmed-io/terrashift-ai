import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { PRESETS } from "@/lib/geo";
import { getScene } from "@/lib/scene";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    presetId: z.enum(PRESETS.map((p) => p.id) as [string, ...string[]]),
    dateT1: z.iso.date(),
    dateT2: z.iso.date(),
  })
  .refine((v) => v.dateT1 < v.dateT2, { message: "dateT1 must precede dateT2", path: ["dateT2"] });

const WINDOW_MS = 60_000;
const LIMIT = 10;
const hits = new Map<string, number[]>();

function limited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > LIMIT;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (limited(ip)) {
    return NextResponse.json({ code: "RATE_LIMITED" }, { status: 429, headers: { "Retry-After": "60" } });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ code: "INVALID_REQUEST", issues: parsed.error.issues }, { status: 422 });
  }
  const preset = PRESETS.find((p) => p.id === parsed.data.presetId);
  if (!preset) return NextResponse.json({ code: "INVALID_REQUEST" }, { status: 422 });

  const scene = getScene(preset.seed);
  return NextResponse.json({
    provenance: "demo-synthetic",
    seed: preset.seed,
    totalChangedKm2: scene.changedM2 / 1e6,
    changedPct: scene.changedPct,
    naivePct: scene.naivePct,
    cloudFractionT1: 0.04,
    cloudFractionT2: 0.07,
  });
}
