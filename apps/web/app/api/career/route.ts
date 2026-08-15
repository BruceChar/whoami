/** GET /api/career —— 从业分析 JSON */
import { NextResponse } from "next/server";
import { canAnalyzeCareer, buildCareerAnalysis, formatCareerReport } from "@delphi/core";
import { getProfile } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const profile = getProfile();
  if (!canAnalyzeCareer(profile)) {
    return NextResponse.json({ available: false, message: "数据不足" });
  }
  const report = buildCareerAnalysis(profile);
  return NextResponse.json({
    available: true,
    report,
    text: formatCareerReport(report, !!report.llmNarrative),
  });
}
