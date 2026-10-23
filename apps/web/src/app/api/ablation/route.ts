import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  polygon: z.array(z.tuple([z.number(), z.number()])).min(3),
  yearT1: z.number().int().min(2017).max(2025),
  yearT2: z.number().int().min(2017).max(2025),
});

export async function POST(req: NextRequest) {
  const raw = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request payload for ablation study", issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const { polygon, yearT1, yearT2 } = parsed.data;
  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";

  try {
    const res = await fetch(`${mlUrl}/v1/ablation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        polygon,
        year_t1: yearT1,
        year_t2: yearT2,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        methods?: Array<Record<string, unknown>>;
        models?: Array<Record<string, unknown>>;
        [key: string]: unknown;
      };
      if (data.methods && !data.models) {
        data.models = data.methods.map((m) => ({
          ...m,
          iou_score: m["iou"] ?? m["iou_score"] ?? 0,
        }));
      }
      return NextResponse.json(data);
    }

    return NextResponse.json(
      {
        error: "Backend ablation computation failed",
        status_code: res.status,
        is_live_inference: false,
      },
      { status: res.status },
    );
  } catch {
    // Return honest 503 service unavailable response without fabricating live metrics
    return NextResponse.json(
      {
        error: "Live ML ablation service unavailable",
        message:
          "The Python ML backend is currently unreachable. Live multi-method ablation requires the backend service. For verified historical benchmark results, see the official OSCD scorecard.",
        is_live_inference: false,
        status: "service_unavailable",
      },
      { status: 503 },
    );
  }
}
