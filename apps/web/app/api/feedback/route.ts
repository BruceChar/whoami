/** POST /api/feedback — submit external feedback (public, via share link). */
import { NextRequest, NextResponse } from "next/server";
import { submitFeedback, feedbackSummary } from "@delphi/core";
import { getStore } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: {
    linkId: string;
    author?: string;
    relationship?: string;
    knownFor?: string;
    impression: string;
    evidence?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }
  if (!body.linkId || !body.impression) {
    return NextResponse.json({ error: "缺少链接或评价内容" }, { status: 400 });
  }
  const store = getStore();
  const profile = store.get();
  const result = submitFeedback(profile, body.linkId, {
    author: body.author || "",
    relationship: body.relationship || "",
    knownFor: body.knownFor || "",
    impression: body.impression,
    evidence: body.evidence || "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.reason }, { status: 400 });
  }
  store.save();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  const profile = getStore().get();
  const summary = feedbackSummary(profile);
  return NextResponse.json({
    ...summary,
    records: profile.frameworkData.feedback.records,
    consensusReport: profile.frameworkData.feedback.consensusReport,
    selfExternalGaps: profile.frameworkData.feedback.selfExternalGaps,
  });
}
