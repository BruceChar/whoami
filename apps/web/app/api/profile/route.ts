/** GET/POST /api/profile — profile summary + basic user info (nickname). */
import { NextRequest, NextResponse } from "next/server";
import { getProfile, getStore } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const profile = getProfile();
  return NextResponse.json({
    nickname: profile.userInfo.nickname,
    growthStage: profile.growthTracking.growthStage,
    sessions: profile.sessions.length,
    insights: profile.insights.length,
    prototypes: profile.prototypes.length,
    personaVersion: profile.currentPersona?.version ?? null,
    attribution: profile.cognitiveMarkers.attributionPattern,
    anchors: profile.frameworkData.vtd.values.anchors,
    firstUseAt: profile.sessions[0]?.startedAt || profile.createdAt,
    updatedAt: profile.updatedAt,
  });
}

/** Update basic user info (nickname / how to address the user). */
export async function POST(req: NextRequest) {
  const store = getStore();
  const profile = store.get();
  let body: { nickname?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const nickname = (body.nickname || "").trim().slice(0, 40);
  if (!nickname) {
    return NextResponse.json({ error: "称呼不能为空" }, { status: 400 });
  }
  profile.userInfo = { nickname };
  store.save();
  return NextResponse.json({ ok: true, nickname });
}
