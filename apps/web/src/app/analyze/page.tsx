import type { Metadata } from "next";
import { AnalyzeClient } from "@/components/analyze/analyze-client";

export const metadata: Metadata = { title: "Analysis console — TerraShift" };

export default function AnalyzePage() {
  return <AnalyzeClient />;
}
