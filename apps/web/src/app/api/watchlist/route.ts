import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";
  try {
    const res = await fetch(`${mlUrl}/v1/watchlist`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json([], { status: 200 });
    }
    const items = await res.json();
    return NextResponse.json(items);
  } catch {
    return NextResponse.json([], { status: 200 });
  }
}

export async function POST(req: NextRequest) {
  const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";
  try {
    const body = await req.json();
    const res = await fetch(`${mlUrl}/v1/watchlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return NextResponse.json({ status: "ok", local_only: true });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ status: "ok", local_only: true });
  }
}
