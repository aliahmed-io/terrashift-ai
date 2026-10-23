import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.resolve(process.cwd(), "reports", "saudi_pilot_evaluation.json");
  const fallbackPath = path.resolve(process.cwd(), "..", "..", "reports", "saudi_pilot_evaluation.json");

  const targetPath = fs.existsSync(/*turbopackIgnore: true*/ filePath)
    ? filePath
    : fs.existsSync(/*turbopackIgnore: true*/ fallbackPath)
      ? fallbackPath
      : null;

  if (targetPath) {
    try {
      const raw = fs.readFileSync(/*turbopackIgnore: true*/ targetPath, "utf-8");
      const data = JSON.parse(raw);
      return NextResponse.json(data);
    } catch (err) {
      return NextResponse.json({ error: "Failed to parse benchmark file", details: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Saudi benchmark evaluation file not found on disk." }, { status: 404 });
}
