/** GET/PATCH/DELETE /api/sessions/[id] — messages, rename, or archive-from-list. */
import { NextRequest, NextResponse } from "next/server";
import { getStore, currentUserId } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const profile = getStore().get();
  const session = profile.sessions.find((s) => s.id === params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  return NextResponse.json({
    id: session.id,
    title: session.title || session.messages.find((m) => m.role === "user")?.text.slice(0, 24) || "Untitled session",
    mode: session.mode,
    messages: session.messages.map((m) => ({
      role: m.role === "agent" ? "assistant" : m.role,
      content: m.text,
      timestamp: m.timestamp,
    })),
  });
}

/** PATCH — rename the session title. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: { title?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const title = (body.title || "").trim().slice(0, 60);
  if (!title) {
    return NextResponse.json({ error: "Title cannot be empty" }, { status: 400 });
  }
  const store = getStore();
  const profile = store.get();
  const session = profile.sessions.find((s) => s.id === params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  session.title = title;
  store.save();
  return NextResponse.json({ ok: true, title });
}

/**
 * DELETE — archive a session: hidden from the history list.
 * The record stays in the profile so the cognitive analysis is unaffected.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  if (!currentUserId()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const store = getStore();
  const profile = store.get();
  const session = profile.sessions.find((s) => s.id === params.id);
  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }
  session.hidden = true;
  store.save();
  return NextResponse.json({ ok: true });
}
