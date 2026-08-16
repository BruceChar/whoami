/**
 * POST /api/chat —— 对话接口（服务端运行 ThinkingEngine + LLM Agent）
 * 会话化：sessionId 复用会话；缺省新建会话（标题取自首条消息）。
 * toolId 指定工具模板（VTD/SWOT/SIGN/...，输入 / 触发）。
 */
import { NextRequest, NextResponse } from "next/server";
import {
  ThinkingEngine,
  beginSession,
  appendMessage,
  afterProfileUpdate,
  AnalysisMode,
  getToolTemplate,
  SessionRecord,
} from "@delphi/core";
import { getStore, getAgent } from "@/lib/server";

export const runtime = "nodejs";

export interface ChatTurnRequest {
  message: string;
  mode?: AnalysisMode;
  toolId?: string;
  sessionId?: string;
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
  if (!llm) {
    return NextResponse.json(
      { error: "未配置 LLM API Key（离线模式已取消）。请前往 /settings 配置或设置环境变量。", helpUrl: "/settings" },
      { status: 400 }
    );
  }

  const mode: AnalysisMode = body.mode || "stealth";
  const tool = body.toolId ? getToolTemplate(body.toolId) : undefined;

  // 会话：复用或新建
  let session: SessionRecord | undefined;
  if (body.sessionId) {
    session = profile.sessions.find((s) => s.id === body.sessionId);
  }
  if (!session) {
    session = beginSession(profile, mode, message.slice(0, 24));
  }

  const engine = new ThinkingEngine(mode, { llm, toolPrompt: tool?.prompt });
  engine.llmProfile = profile;
  engine.rememberHistory(
    session.messages.map((m) => ({
      role: m.role === "agent" ? "agent" : "user",
      text: m.text,
    }))
  );

  try {
    const result = await engine.process(message);

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
      sessionId: session.id,
      title: session.title || message.slice(0, 24),
      reply: result.reply,
      mode: result.modeAfter,
      tool: tool ? { id: tool.id, label: tool.label } : undefined,
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
