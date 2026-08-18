/**
 * POST /api/chat — chat endpoint (runs ThinkingEngine + LLM Agent server-side).
 * Sessions: reuse by sessionId, or create a new one (title from first message).
 * toolId selects a tool template (VTD/SWOT/SIGN/..., triggered by "/").
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
  getModelInfo,
  PROVIDER_DEFAULT_CONTEXT,
  emitSessionEvent,
} from "@delphi/core";
import { getStore, getAgent, authRequired } from "@/lib/server";

export const runtime = "nodejs";

export interface ChatTurnRequest {
  message: string;
  mode?: AnalysisMode;
  toolId?: string;
  sessionId?: string;
}

export async function POST(req: NextRequest) {
  if (authRequired()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: ChatTurnRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const message = (body.message || "").trim();
  if (!message) return NextResponse.json({ error: "Message cannot be empty" }, { status: 400 });

  const store = getStore();
  const profile = store.get();
  const llm = getAgent();
  if (!llm) {
    return NextResponse.json(
      { error: "No LLM API key configured. Configure it in /settings or set an environment variable.", helpUrl: "/settings" },
      { status: 400 }
    );
  }

  const mode: AnalysisMode = body.mode || "stealth";
  const tool = body.toolId ? getToolTemplate(body.toolId) : undefined;

  // reuse the session or create a new one
  let session: SessionRecord | undefined;
  if (body.sessionId) {
    session = profile.sessions.find((s) => s.id === body.sessionId);
  }
  if (!session) {
    session = beginSession(profile, mode, message.slice(0, 24));
  }

  const engine = new ThinkingEngine(mode, {
    llm,
    toolPrompt: tool?.prompt,
    userNickname: profile.userInfo?.nickname,
  });
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
    emitSessionEvent({
      ts: new Date().toISOString(),
      sessionId: session.id,
      theme: session.title || message.slice(0, 24),
      role: "user",
      content: message,
      markers: {
        biases: result.markers.biases.map((b) => b.type),
        attribution: result.markers.attribution,
        selfReflection: result.markers.selfReflection,
      },
    });
    appendMessage(session, {
      role: "agent",
      text: result.reply,
      timestamp: new Date().toISOString(),
    });
    emitSessionEvent({
      ts: new Date().toISOString(),
      sessionId: session.id,
      theme: session.title || message.slice(0, 24),
      role: "agent",
      content: result.reply,
    });

    afterProfileUpdate(profile);
    store.save();

    // resolve the real model's max input context from the catalog (for the usage ring)
    const modelInfo = await getModelInfo(llm.id, result.llmModel || "");
    const contextWindow = modelInfo?.contextWindow || PROVIDER_DEFAULT_CONTEXT[llm.id];

    return NextResponse.json({
      sessionId: session.id,
      title: session.title || message.slice(0, 24),
      reply: result.reply,
      mode: result.modeAfter,
      tool: tool ? { id: tool.id, label: tool.label } : undefined,
      llmGenerated: result.llmGenerated,
      llmModel: result.llmModel,
      contextWindow,
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
