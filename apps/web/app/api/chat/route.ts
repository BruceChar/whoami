/**
 * POST /api/chat —— 对话接口（服务端运行 ThinkingEngine + LLM Agent）
 * 会话持久化：复用最近 6 小时内的 web-chat 会话；跨期自动开新会话。
 */
import { NextRequest, NextResponse } from "next/server";
import {
  ThinkingEngine,
  beginSession,
  appendMessage,
  afterProfileUpdate,
  AnalysisMode,
} from "@delphi/core";
import { getStore, getAgent } from "@/lib/server";

export const runtime = "nodejs";

export interface ChatTurnRequest {
  message: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  mode?: AnalysisMode;
}

export async function POST(req: NextRequest) {
  let body: ChatTurnRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }
  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ error: "消息不能为空" }, { status: 400 });

  const store = getStore();
  const profile = store.get();
  const llm = getAgent();
  const mode: AnalysisMode = body.mode || "transparent";

  const engine = new ThinkingEngine(mode, llm ? { llm } : {});
  engine.llmProfile = profile;
  engine.rememberHistory(
    (body.history || []).map((h) => ({ role: h.role === "assistant" ? "agent" : "user", text: h.content }))
  );

  try {
    const result = await engine.process(message);

    // 持久化到 web 会话（复用最近 6 小时内的）
    const now = Date.now();
    let session = profile.sessions
      .filter((s) => s.title === "web-chat")
      .reverse()
      .find((s) => now - new Date(s.startedAt).getTime() < 6 * 3600 * 1000);
    if (!session) {
      session = beginSession(profile, mode, "web-chat");
    }
    appendMessage(session, {
      role: "user",
      text: message,
      timestamp: new Date().toISOString(),
      markers: result.markers,
    });
    appendMessage(session, {
      role: "agent",
      text: result.reply,
      timestamp: new Date().toISOString(),
    });

    afterProfileUpdate(profile);
    store.save();

    return NextResponse.json({
      reply: result.reply,
      mode: result.modeAfter,
      modeChanged: result.modeChanged,
      modeChangeReason: result.modeChangeReason,
      llmGenerated: result.llmGenerated,
      llmModel: result.llmModel,
      usage: result.usage,
      toolCalls: result.llmGenerated ? engine.getLastToolCalls() : [],
      markers: {
        biases: result.markers.biases.map((b) => b.type),
        attribution: result.markers.attribution,
        selfReflection: result.markers.selfReflection,
      },
    });
  } catch (err) {
    console.error("[api/chat]", err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
