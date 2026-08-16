/** GET/POST /api/profile — profile summary + basic user info. */
import { NextRequest, NextResponse } from "next/server";
import { getProfile, getStore, currentUserId } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const profile = getProfile();
  return NextResponse.json({
    userInfo: profile.userInfo,
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

interface UserInfoInput {
  nickname?: string;
  occupation?: string;
  age?: number | null;
  gender?: string;
  interests?: string[];
}

/** Update basic user info (nickname, occupation, age, gender, interests). */
export async function POST(req: NextRequest) {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const store = getStore();
  const profile = store.get();
  let body: UserInfoInput;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const nickname = (body.nickname || "").trim().slice(0, 40);
  if (!nickname) {
    return NextResponse.json({ error: "Nickname is required" }, { status: 400 });
  }

  let age: number | null = null;
  if (body.age !== null && body.age !== undefined) {
    const n = Math.floor(Number(body.age));
    age = Number.isFinite(n) && n > 0 ? Math.min(120, n) : null;
  }
  profile.userInfo = {
    nickname,
    occupation: (body.occupation || "").trim().slice(0, 80) || undefined,
    age,
    gender: (body.gender || "").trim().slice(0, 20) || undefined,
    interests: Array.isArray(body.interests)
      ? body.interests.map((s) => s.trim()).filter(Boolean).slice(0, 20)
      : [],
  };
  store.save();
  return NextResponse.json({ ok: true, userInfo: profile.userInfo });
}
