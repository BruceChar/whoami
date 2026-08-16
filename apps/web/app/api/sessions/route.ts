/** GET /api/sessions — session history for the sidebar */
import { NextResponse } from "next/server";
import { getStore, currentUserId } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const profile = getStore().get();
  const sessions = [...profile.sessions]
    .filter((s) => !s.hidden && s.messages.some((m) => m.role === "user"))
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .map((s) => ({
      id: s.id,
      title: s.title || s.messages.find((m) => m.role === "user")?.text.slice(0, 24) || "未命名会话",
      startedAt: s.startedAt,
      mode: s.mode,
      messageCount: s.messages.filter((m) => m.role === "user").length,
      summary: s.summary,
    }));
  return NextResponse.json({ sessions });
}
