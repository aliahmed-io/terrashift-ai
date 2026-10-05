import { NextResponse, type NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mlUrl = process.env["ML_SERVICE_URL"] ?? "http://127.0.0.1:8000";

    const res = await fetch(`${mlUrl}/v1/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to generate report from ML service" }, { status: 502 });
    }

    const pdfBuffer = await res.arrayBuffer();
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "attachment; filename=terrashift-audit-report.pdf",
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal ML service unavailable for PDF generation" }, { status: 503 });
  }
}
