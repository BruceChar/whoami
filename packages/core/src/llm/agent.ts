/**
 * delphi —— LLM Agent（真正的 Agent：工具调用 + 档案接地）
 * 模型通过工具 get_cognitive_profile / search_memory 读取用户认知档案，
 * 让对话真正"知道"用户是谁，而不是空泛的聊天。
 */
import { ChatMessage, UserCognitiveProfile } from "../models/types";
import { LLMMessage, LLMUsage } from "./types";
import { DIMENSION_LABELS, UP_IS_GOOD } from "../profiler/growthTracker";
import { PERSONA_STAGE_LABELS } from "../persona/persona";
import { EMOTION_LABELS } from "../persona/fingerprint";

/** JSON Schema 子集（用于工具参数） */
export interface JsonSchema {
  type?: "object" | "string" | "number" | "boolean" | "array" | "integer";
  description?: string;
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  required?: string[];
}

export interface AgentToolDef {
  name: string;
  description: string;
  parameters: JsonSchema;
}

export interface AgentToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMAgentResult {
  text: string;
  usage?: LLMUsage;
  model: string;
  /** 本次执行过的工具名 */
  toolCalls: string[];
}

/** 具备工具调用能力的 LLM Agent 接口（pi-ai 实现 + 测试实现） */
export interface LLMAgent {
  readonly id: string;
  readonly model: string;
  isConfigured(): Promise<boolean>;
  agentChat(opts: {
    messages: LLMMessage[];
    system?: string;
    tools?: AgentToolDef[];
    executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
    maxToolRounds?: number;
  }): Promise<LLMAgentResult>;
}

// ---------------------------------------------------------------------------
// delphi 工具定义
// ---------------------------------------------------------------------------

export const DELPHI_TOOLS: AgentToolDef[] = [
  {
    name: "get_cognitive_profile",
    description:
      "获取用户的认知档案摘要（成长阶段、归因模式、思维偏差频率、价值观锚点、能量地图、画像版本等）。回答与用户自我认知相关的问题前建议先调用。",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "search_memory",
    description: "在用户的对话记录、洞察、回馈、SWOT 等档案中按关键词搜索，返回相关片段。",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词（中文）" },
      },
      required: ["query"],
    },
  },
];

/** 生成档案摘要 JSON（供 get_cognitive_profile 工具） */
export function buildProfileSummaryJSON(profile: UserCognitiveProfile): string {
  const g = profile.growthTracking;
  const dims = Object.entries(g.dimensions)
    .filter(([k]) => !UP_IS_GOOD[k]) // 频率类（应下降）
    .map(([k, d]) => `${DIMENSION_LABELS[k] || k}:${d.currentLevel.toFixed(2)}`)
    .slice(0, 5);
  const upDims = Object.entries(g.dimensions)
    .filter(([k]) => UP_IS_GOOD[k] === undefined || !UP_IS_GOOD[k])
    .slice(0, 3)
    .map(([k, d]) => `${DIMENSION_LABELS[k] || k}:${d.currentLevel.toFixed(2)}`);

  const emotions = Object.entries(profile.cognitiveMarkers.biasFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}:${v}`);

  const summary = {
    成长阶段: PERSONA_STAGE_LABELS[g.growthStage],
    会话数: profile.sessions.length,
    归因模式: {
      内归因: Math.round(profile.cognitiveMarkers.attributionPattern.internal * 100),
      外归因: Math.round(profile.cognitiveMarkers.attributionPattern.external * 100),
      情境归因: Math.round(profile.cognitiveMarkers.attributionPattern.situational * 100),
    },
    确定性指数: profile.cognitiveMarkers.certaintyIndex.toFixed(2),
    高频偏差: emotions,
    频率类指标: dims,
    价值观锚点: profile.frameworkData.vtd.values.anchors,
    价值观冲突: profile.frameworkData.vtd.values.conflicts,
    内驱源: profile.frameworkData.vtd.dreams.pureDrives,
    能量源: profile.currentPersona?.energyMap.sources || profile.frameworkData.dailyFeedback.map((d) => d.satisfied.event),
    能量黑洞: profile.currentPersona?.energyMap.blackHoles || [],
    画像版本: profile.currentPersona?.version || "未生成",
    最近洞察: profile.insights.slice(-3).map((i) => i.analysis),
  };
  return JSON.stringify(summary, null, 1);
}

/** 关键词搜索档案（供 search_memory 工具） */
export function searchMemoryJSON(profile: UserCognitiveProfile, query: string): string {
  const q = query.trim();
  if (!q) return JSON.stringify({ error: "缺少搜索词" });
  const hits: Array<{ source: string; snippet: string; date: string }> = [];
  const push = (source: string, text: string, date: string) => {
    if (text && text.includes(q) && hits.length < 6) {
      hits.push({ source, snippet: text.slice(0, 120), date: date.slice(0, 10) });
    }
  };
  for (const s of profile.sessions) {
    for (const m of s.messages) {
      if (m.role === "user") push("对话", m.text, m.timestamp);
    }
  }
  for (const i of profile.insights) {
    push("洞察", `${i.quote} ${i.analysis}`, i.timestamp);
  }
  for (const d of profile.frameworkData.dailyFeedback) {
    push("每日回馈", `${d.satisfied.event} / ${d.unsatisfied.event}`, d.date);
  }
  for (const a of profile.frameworkData.achievements) {
    push("成就事件", `${a.star.situation} ${a.star.action}`, a.eventId);
  }
  const fw = profile.frameworkData;
  for (const w of fw.swot.strengths.concat(fw.swot.weaknesses, fw.swot.opportunities, fw.swot.threats)) {
    push("SWOT", w, profile.updatedAt);
  }
  return JSON.stringify(hits.length ? hits : { message: "未找到相关记录" }, null, 1);
}

/** 情绪基调中文名（供上下文提示） */
export function emotionLabel(key: string): string {
  return EMOTION_LABELS[key] || key;
}

// ---------------------------------------------------------------------------
// 高层入口：把会话历史 + 系统提示交给 Agent
// ---------------------------------------------------------------------------

export interface ChatAgentOptions {
  provider: LLMAgent;
  system: string;
  history: ChatMessage[];
  profile: UserCognitiveProfile;
}

export async function runChatAgent(opts: ChatAgentOptions): Promise<LLMAgentResult> {
  const messages: LLMMessage[] = opts.history
    .slice(-24)
    .map((m) => ({
      role: m.role === "agent" ? "assistant" : "user",
      content: m.text,
    }));
  return opts.provider.agentChat({
    messages,
    system: opts.system,
    tools: DELPHI_TOOLS,
    executeTool: async (name, args) => {
      switch (name) {
        case "get_cognitive_profile":
          return buildProfileSummaryJSON(opts.profile);
        case "search_memory":
          return searchMemoryJSON(opts.profile, String(args.query ?? ""));
        default:
          return JSON.stringify({ error: `未知工具: ${name}` });
      }
    },
  });
}
