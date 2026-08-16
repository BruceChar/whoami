/** delphi — LLM-enhanced analysis. */
import {
  CareerAnalysis,
  Insight,
  MessageMarkers,
  PersonaSnapshot,
  SessionRecord,
  UserCognitiveProfile,
} from "../models/types";
import { LLMAgent } from "./agent";
import { newInsightId } from "../services/profileService";
import { BiasType } from "../models/types";

// ---------------------------------------------------------------------------
// session-level deep analysis
// ---------------------------------------------------------------------------

export interface SessionDeepAnalysis {
  summary: string;
  insights: Array<{ title: string; analysis: string; quote?: string }>;
}

const SESSION_SCHEMA = `{
  summary: string,            // 2-3 句总结这次对话中观察到的思维模式
  insights: [{
    title: string,            // 洞察标题（如"发现新的价值观锚点：真实"）
    analysis: string,         // 1-2 句解读，引用用户原话中的关键词
    quote: string             // 触发该洞察的用户原话片段
  }]                          // 0-3 条，没有就不给
}`;

export async function llmAnalyzeSession(
  provider: LLMAgent,
  profile: UserCognitiveProfile,
  session: SessionRecord
): Promise<SessionDeepAnalysis | null> {
  const userTexts = session.messages
    .filter((m) => m.role === "user")
    .map((m, i) => `${i + 1}. ${m.text}`)
    .join("\n");
  if (!userTexts.trim()) return null;

  const schema =
    "你是 delphi 的隐式认知分析师。只反射、不评价、不贴标签。分析下面这次对话，输出 JSON（严格合法，无解释）：\n" + SESSION_SCHEMA + "\n\n对话内容：\n" + userTexts.slice(0, 4000);

  const result = await provider.completeJSON<SessionDeepAnalysis>({
    messages: [{ role: "user", content: schema }],
    schema: SESSION_SCHEMA,
    temperature: 0.4,
  });
  if (!result || typeof result.summary !== "string") return null;
  return {
    summary: result.summary,
    insights: Array.isArray(result.insights) ? result.insights.slice(0, 3) : [],
  };
}

/** Persist session deep analysis (summary + auto insights); returns new insights */
export function applySessionDeepAnalysis(
  profile: UserCognitiveProfile,
  session: SessionRecord,
  analysis: SessionDeepAnalysis
): Insight[] {
  session.summary = analysis.summary;
  const created: Insight[] = [];
  for (const ins of analysis.insights) {
    if (!ins.title || !ins.analysis) continue;
        // de-dup: same analysis within 30 days
    const dup = profile.insights.some(
      (i) => i.agentDetected && i.analysis === ins.analysis
    );
    if (dup) continue;
    const insight: Insight = {
      id: newInsightId(),
      timestamp: new Date().toISOString(),
      source: `会话 ${session.id}`,
      quote: ins.quote || "",
      analysis: ins.analysis,
      note: "",
      tags: ["agent"],
      userMarked: false,
      agentDetected: true,
    };
    profile.insights.push(insight);
    created.push(insight);
  }
  return created;
}

// ---------------------------------------------------------------------------
// persona narratives (six dimensions, natural language)
// ---------------------------------------------------------------------------

const PERSONA_SCHEMA = `{
  fingerprint: string,   // 2-3 句：用"你倾向于…"描述归因/确定性/时间取向/情绪基调（不贴标签）
  energyMap: string,     // 2 句：什么给你能量、什么消耗你（基于数据）
  terrain: string,       // 2 句：思维高地、洼地与张力
  relationship: string,  // 2 句：关系中的需求与边界
  decision: string,      // 2 句：决策风格与锚点
  growth: string         // 2 句：成长方向与当前瓶颈
}`;

export interface PersonaNarratives {
  fingerprint?: string;
  energyMap?: string;
  terrain?: string;
  relationship?: string;
  decision?: string;
  growth?: string;
}

export async function llmEnrichPersona(
  provider: LLMAgent,
  profile: UserCognitiveProfile,
  persona: PersonaSnapshot
): Promise<PersonaNarratives | null> {
  const input = JSON.stringify({
    stage: persona.growthTrajectory.currentStage,
    attribution: persona.cognitiveFingerprint.attributionPattern,
    certainty: persona.cognitiveFingerprint.certaintyLevel,
    timeOrientation: persona.cognitiveFingerprint.timeOrientation,
    emotionalTone: persona.cognitiveFingerprint.emotionalTone,
    energySources: persona.energyMap.sources,
    energyBlackHoles: persona.energyMap.blackHoles,
    highlands: persona.thinkingTerrain.highlands,
    lowlands: persona.thinkingTerrain.lowlands,
    canyons: persona.thinkingTerrain.canyons,
    coreNeeds: persona.relationalPattern.coreNeeds,
    decisionAnchors: persona.decisionStyle.decisionAnchors,
    riskTendency: persona.decisionStyle.riskTendency,
    bottleneck: persona.growthTrajectory.currentBottleneck,
    suggestion: persona.growthTrajectory.breakthroughSuggestion,
    anchors: profile.frameworkData.vtd.values.anchors,
  }, null, 1);

  const result = await provider.completeJSON<PersonaNarratives>({
    messages: [
      {
        role: "user",
        content:
          "你是 delphi 的画像叙述者。基于以下用户认知画像数据，用第二人称「你」写 6 段自然语言叙事（每段 2-3 句），" +
          "只描述动态模式（「你倾向于/数据显示/最近」），绝不贴固定标签（不说「你是XX型」）。输出 JSON：\n" + input,
      },
    ],
    schema: PERSONA_SCHEMA,
    temperature: 0.5,
    maxTokens: 800,
  });
  if (!result) return null;
  return result;
}

// ---------------------------------------------------------------------------
// career analysis review
// ---------------------------------------------------------------------------

const CAREER_SCHEMA = `{
  narrative: string,          // 3-5 句综合评述：工作形态与内容方向的整体判断，基于数据
  extraDirections: string[],  // 补充的工作内容方向（0-2 个）
  extraAvoid: string[]        // 补充的避坑提醒（0-2 条）
}`;

export async function llmRefineCareer(
  provider: LLMAgent,
  profile: UserCognitiveProfile,
  career: CareerAnalysis
): Promise<{ narrative: string; extraDirections: string[]; extraAvoid: string[] } | null> {
  const input = JSON.stringify({
    anchors: profile.frameworkData.vtd.values.anchors,
    conflicts: profile.frameworkData.vtd.values.conflicts,
    strengths: profile.frameworkData.swot.strengths,
    weaknesses: profile.frameworkData.swot.weaknesses,
    threats: profile.frameworkData.swot.threats,
    skills: profile.frameworkData.achievements.map((a) => a.skills),
    energySources: profile.frameworkData.dailyFeedback.map((d) => d.satisfied.event),
    currentWorkForm: career.workForm,
    currentDirections: career.contentDirection,
  }, null, 1);

  const result = await provider.completeJSON<{ narrative: string; extraDirections: string[]; extraAvoid: string[] }>({
    messages: [
      {
        role: "user",
        content:
          "你是 delphi 的从业分析顾问。基于用户认知档案数据，先确认/修正工作形态判断，再补充方向与避坑提醒。用第二人称。输出 JSON：\n" + input,
      },
    ],
    schema: CAREER_SCHEMA,
    temperature: 0.4,
    maxTokens: 600,
  });
  return result;
}

// ---------------------------------------------------------------------------
// per-message marker enhancement (optional; token-heavy per call)
// ---------------------------------------------------------------------------

const MARKER_SCHEMA = `{
  attribution: "internal" | "external" | "situational" | null,
  certainty: number,                     // 0-1
  selfReflection: boolean,
  abstractionJump: boolean,
  emotionTone: { [类别: string]: number }, // 如 {焦虑: 2}
  extraBiases: [{ type: string, keyword: string, quote: string }]  // 规则引擎未覆盖的偏差
}`;

export async function llmExtractMarkers(
  provider: LLMAgent,
  text: string
): Promise<Partial<MessageMarkers> & { extraBiases?: Array<{ type: string; keyword: string; quote: string }> } | null> {
  const result = await provider.completeJSON<any>({
    messages: [
      {
        role: "user",
        content:
          "你是 delphi 的认知标记提取器。分析下面这句话（中文），提取思维标记，只输出 JSON：\n" +
          `句子：「${text.slice(0, 500)}」`,
      },
    ],
    schema: MARKER_SCHEMA,
    temperature: 0.2,
  });
  if (!result) return null;
  return result;
}

/** Merge LLM markers into rule markers (LLM wins; biases are unioned) */
export function mergeMarkers(rule: MessageMarkers, llm: NonNullable<Awaited<ReturnType<typeof llmExtractMarkers>>>): MessageMarkers {
  const merged: MessageMarkers = { ...rule };
  if (llm.attribution) merged.attribution = llm.attribution;
  if (typeof llm.certainty === "number") merged.certainty = llm.certainty;
  if (typeof llm.selfReflection === "boolean") merged.selfReflection = llm.selfReflection;
  if (typeof llm.abstractionJump === "boolean") merged.abstractionJump = llm.abstractionJump;
  if (llm.emotionTone && typeof llm.emotionTone === "object") {
    merged.emotionTone = { ...rule.emotionTone };
    for (const [k, v] of Object.entries(llm.emotionTone)) {
      merged.emotionTone[k] = (merged.emotionTone[k] || 0) + (typeof v === "number" ? v : 0);
    }
  }
  if (Array.isArray(llm.extraBiases)) {
    const have = new Set(rule.biases.map((b) => b.type));
    for (const b of llm.extraBiases) {
      if (b?.type && !have.has(b.type as BiasType)) {
        merged.biases.push({ type: b.type as BiasType, keyword: b.keyword || "", quote: b.quote || "" });
        have.add(b.type as BiasType);
      }
    }
  }
  return merged;
}
