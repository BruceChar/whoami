/** POST /api/feedback — public feedback submission via a share link (resolves the owner's profile). */
import { NextRequest, NextResponse } from "next/server";
import { submitFeedback, feedbackSummary } from "@delphi/core";
import { findProfileForShareLink } from "@/lib/links";
import { getStore, currentUserId } from "@/lib/server";

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
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!body.linkId || !body.impression) {
    return NextResponse.json({ error: "Missing link or feedback content" }, { status: 400 });
  }
  const owner = findProfileForShareLink(body.linkId);
  if (!owner) {
    return NextResponse.json({ error: "Feedback link does not exist or has expired" }, { status: 400 });
  }
  const store = owner.store;
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

/** GET — the signed-in user's own feedback summary. */
export function GET() {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const profile = getStore().get();
  const summary = feedbackSummary(profile);
  return NextResponse.json({
    ...summary,
    records: profile.frameworkData.feedback.records,
    consensusReport: profile.frameworkData.feedback.consensusReport,
    selfExternalGaps: profile.frameworkData.feedback.selfExternalGaps,
  });
}
