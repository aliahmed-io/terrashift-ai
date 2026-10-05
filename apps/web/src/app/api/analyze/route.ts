import { type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z
  .object({
    polygon: z
      .array(z.tuple([z.number(), z.number()]))
      .min(3, { message: "Polygon must contain at least 3 vertices" }),
    yearT1: z.number().int().min(2017).max(2025),
    yearT2: z.number().int().min(2017).max(2025),
  })
  .refine((d) => d.yearT1 < d.yearT2, {
    message: "Year T1 must precede Year T2",
    path: ["yearT2"],
  });

const WINDOW_MS = 60_000;
const LIMIT = 30;
const hits = new Map<string, number[]>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > LIMIT;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  if (isRateLimited(ip)) {
    return new Response(
      `data: ${JSON.stringify({ error: { code: "RATE_LIMITED", message: "Rate limit exceeded. Please wait a moment." } })}\n\n`,
      {
        status: 429,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      },
    );
  }

  const rawJson = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(rawJson);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid analysis parameters";
    return new Response(
      `data: ${JSON.stringify({ error: { code: "INVALID_REQUEST", message: msg } })}\n\n`,
      {
        status: 422,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      },
    );
  }

  const { polygon, yearT1, yearT2 } = parsed.data;
  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";

  try {
    const mlRes = await fetch(`${mlUrl}/v1/analyze/stream`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon,
        year_t1: yearT1,
        year_t2: yearT2,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!mlRes.ok) {
      const errText = await mlRes.text().catch(() => "Unknown ML service error");
      return new Response(
        `data: ${JSON.stringify({ error: { code: "ML_SERVICE_ERROR", message: `Analysis failed (${mlRes.status}): ${errText}` } })}\n\n`,
        {
          status: mlRes.status,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        },
      );
    }

    if (!mlRes.body) {
      return new Response(
        `data: ${JSON.stringify({ error: { code: "EMPTY_STREAM", message: "ML microservice returned empty stream" } })}\n\n`,
        {
          status: 502,
          headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        },
      );
    }

    // Stream directly back to client
    return new Response(mlRes.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Cannot connect to ML service";
    return new Response(
      `data: ${JSON.stringify({
        error: {
          code: "SERVICE_UNAVAILABLE",
          message: `ML microservice is currently unreachable (${msg}). Verify the FastAPI backend is running on ${mlUrl}.`,
        },
      })}\n\n`,
      {
        status: 503,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
      },
    );
  }
}
