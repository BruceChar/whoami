/** GET /api/career — career analysis JSON */
import { NextResponse } from "next/server";
import { canAnalyzeCareer, buildCareerAnalysis, formatCareerReport } from "@delphi/core";
import { getProfile, currentUserId } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
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
