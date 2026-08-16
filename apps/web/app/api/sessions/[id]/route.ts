/** GET/DELETE /api/sessions/[id] — messages of one session, or hide it from the list. */
import { NextRequest, NextResponse } from "next/server";
import { getStore } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const profile = getStore().get();
  const session = profile.sessions.find((s) => s.id === params.id);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  return NextResponse.json({
    id: session.id,
    title: session.title || session.messages.find((m) => m.role === "user")?.text.slice(0, 24) || "未命名会话",
    mode: session.mode,
    messages: session.messages.map((m) => ({
      role: m.role === "agent" ? "assistant" : m.role,
      content: m.text,
      timestamp: m.timestamp,
    })),
  });
}

/**
 * DELETE — hide a session from the history list.
 * The record stays in the profile so the cognitive analysis is unaffected.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const store = getStore();
  const profile = store.get();
  const session = profile.sessions.find((s) => s.id === params.id);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  session.hidden = true;
  store.save();
  return NextResponse.json({ ok: true });
}
