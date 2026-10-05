import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${mlUrl}/v1/model/weights`, {
      method: "GET",
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Model checkpoint not found on ML service" },
        { status: 502 },
      );
    }

    const data = await res.arrayBuffer();
    return new NextResponse(data, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": "attachment; filename=siamese_unet_checkpoint.pt",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Service unavailable";
    return NextResponse.json(
      { error: `Cannot fetch model weights: ${msg}` },
      { status: 503 },
    );
  }
}
