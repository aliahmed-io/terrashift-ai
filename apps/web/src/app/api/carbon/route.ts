import { NextRequest, NextResponse } from "next/server";

const ML_URL = process.env.ML_SERVICE_URL ?? "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json();
    const res = await fetch(`${ML_URL}/v1/carbon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    return NextResponse.json(
      { detail: err instanceof Error ? err.message : "Failed to reach ML service" },
      { status: 502 },
    );
  }
}
