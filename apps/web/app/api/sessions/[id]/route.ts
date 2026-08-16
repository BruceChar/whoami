/** GET /api/sessions/[id] —— 单个会话的消息 */
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
      role: m.role,
      content: m.text,
      timestamp: m.timestamp,
    })),
  });
}
