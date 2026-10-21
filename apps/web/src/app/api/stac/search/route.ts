import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const searchSchema = z.object({
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  datetime_range: z.string().optional(),
  max_items: z.number().int().min(1).max(50).optional().default(10),
});

export async function POST(req: NextRequest) {
  try {
    const rawJson = await req.json().catch(() => null);
    const parsed = searchSchema.safeParse(rawJson);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid search parameters", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";
    const res = await fetch(`${mlUrl}/v1/stac/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "STAC search failed" }));
      return NextResponse.json(err, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "STAC search service unavailable";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
