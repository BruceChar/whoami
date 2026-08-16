/** POST /api/feedback/link — create a share link for external feedback. */
import { NextRequest, NextResponse } from "next/server";
import { createShareLink } from "@delphi/core";
import { getStore, authRequired } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (authRequired()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: { expiresDays?: number; maxEntries?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const store = getStore();
  const profile = store.get();
  const days = body.expiresDays || 30;
  const link = createShareLink(profile, {
    expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
    maxEntries: body.maxEntries || undefined,
  });
  store.save();
  return NextResponse.json({
    id: link.id,
    url: `/f/${link.id}`,
    expiresAt: link.expiresAt,
    maxEntries: link.maxEntries,
  });
}
