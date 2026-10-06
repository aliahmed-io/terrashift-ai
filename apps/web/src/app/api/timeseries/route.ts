import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
  yearT1: z.number().int().min(2017).max(2025).optional(),
  yearT2: z.number().int().min(2017).max(2025).optional(),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload for time-series analysis" },
      { status: 422 },
    );
  }

  const { polygon, yearT1 = 2017, yearT2 = 2024 } = parsed.data;
  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";

  try {
    const res = await fetch(`${mlUrl}/v1/timeseries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon,
        year_t1: yearT1,
        year_t2: yearT2,
      }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "Failed to run time-series");
      return NextResponse.json({ error: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "ML service unreachable for time-series forecast",
      },
      { status: 503 },
    );
  }
}
