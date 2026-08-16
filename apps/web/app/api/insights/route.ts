/** GET /api/insights — lightweight insights payload for the right sidebar. */
import { NextResponse } from "next/server";
import { getProfile } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const profile = getProfile();
  const g = profile.growthTracking;
  const dims = Object.entries(g.dimensions).map(([k, d]) => ({
    key: k,
    currentLevel: d.currentLevel,
    trendSlope: d.adjustedTrendSlope,
    volatility: d.volatility,
  }));
  return NextResponse.json({
    nickname: profile.userInfo.nickname,
    growthStage: g.growthStage,
    sessions: profile.sessions.length,
    personaVersion: profile.currentPersona?.version ?? null,
    narratives: profile.currentPersona?.narratives ?? null,
    insights: profile.insights
      .slice(-12)
      .reverse()
      .map((i) => ({ id: i.id, timestamp: i.timestamp, analysis: i.analysis, source: i.source, tags: i.tags })),
    inflectionPoints: g.inflectionPoints
      .slice(-8)
      .reverse()
      .map((ip) => ({ timestamp: ip.timestamp, type: ip.type, title: ip.title })),
    dimensions: dims,
    feedbackCount: profile.frameworkData.feedback.records.length,
    feedbackConsensus: profile.frameworkData.feedback.consensusReport,
  });
}
