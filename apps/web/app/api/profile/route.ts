/** GET /api/profile —— 档案摘要 JSON */
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const profile = getProfile();
  return NextResponse.json({
    growthStage: profile.growthTracking.growthStage,
    sessions: profile.sessions.length,
    insights: profile.insights.length,
    personaVersion: profile.currentPersona?.version ?? null,
    attribution: profile.cognitiveMarkers.attributionPattern,
    anchors: profile.frameworkData.vtd.values.anchors,
    updatedAt: profile.updatedAt,
  });
}
