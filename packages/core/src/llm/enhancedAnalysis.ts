/** delphi — LLM analysis: session deep-dive, persona narratives, career review, and cognitive markers. */
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

// ---------------------------------------------------------------------------
// session-level deep analysis
// ---------------------------------------------------------------------------

export interface SessionDeepAnalysis {
  summary: string;
  insights: Array<{ title: string; analysis: string; quote?: string }>;
}

const SESSION_SCHEMA = `{
  summary: string,            // 2-3 sentences summarizing the thinking patterns observed
  insights: [{
    title: string,            // insight title (e.g. "discovered a new value anchor: authenticity")
    analysis: string,         // 1-2 sentences of interpretation, quoting the user's own words
    quote: string             // the user's original phrase that triggered the insight
  }]                          // 0-3 items; omit if none
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

  const instruction =
    "You are delphi's stealth cognitive analyst. Reflect, never judge or label. Analyze the following conversation and output JSON (strictly valid, no commentary):\n" +
    SESSION_SCHEMA +
    "\n\nConversation:\n" +
    userTexts.slice(0, 4000);

  const result = await provider.completeJSON<SessionDeepAnalysis>({
    messages: [{ role: "user", content: instruction }],
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
    // de-dup: same analysis already present
    const dup = profile.insights.some((i) => i.agentDetected && i.analysis === ins.analysis);
    if (dup) continue;
    const insight: Insight = {
      id: newInsightId(),
      timestamp: new Date().toISOString(),
      source: `session ${session.id}`,
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
  fingerprint: string,   // 2-3 sentences: describe attribution/certainty/time-orientation/emotional tone ("you tend to…")
  energyMap: string,     // 2 sentences: what energizes you, what drains you (data-based)
  terrain: string,       // 2 sentences: thinking highlands, lowlands and tensions
  relationship: string,  // 2 sentences: needs and boundaries in relationships
  decision: string,      // 2 sentences: decision style and anchors
  growth: string         // 2 sentences: growth direction and current bottleneck
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
          "You are delphi's persona narrator. Based on the cognitive-profile data below, write 6 short natural-language narratives (2-3 sentences each) in the second person \"you\". " +
          "Describe dynamic patterns (\"you tend to / the data shows / recently\"), never fixed labels (never \"you are an X type\"). " +
          "Write in the user's language. Output JSON:\n" +
          input,
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
  narrative: string,          // 3-5 sentence review of work-form and content-direction, data-based
  extraDirections: string[],  // additional content directions (0-2)
  extraAvoid: string[]        // additional pitfalls (0-2)
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
          "You are delphi's career advisor. Based on the cognitive profile data below, confirm or correct the work-form judgment, then add content directions and pitfalls. " +
          "Use the second person and the user's language. Output JSON:\n" +
          input,
      },
    ],
    schema: CAREER_SCHEMA,
    temperature: 0.4,
    maxTokens: 600,
  });
  return result;
}

// ---------------------------------------------------------------------------
// per-message cognitive markers (the sole marker producer; no rule fallback)
// ---------------------------------------------------------------------------

const MARKER_SCHEMA = `{
  attribution: "internal" | "external" | "situational" | null,
  certainty: number,                     // 0-1
  timeOrientation: { past: number, present: number, future: number },  // shares summing to 1
  emotionTone: { [category: string]: number },   // e.g. { "anxiety": 2 }
  selfReflection: boolean,
  abstractionJump: boolean,
  emotionFact: number,                   // 0-1, emotion-vs-fact separation clarity (1 = clear)
  biases: [{ type: string, keyword: string, quote: string }]  // cognitive biases detected
}`;

export async function llmExtractMarkers(
  provider: LLMAgent,
  text: string
): Promise<MessageMarkers | null> {
  const result = await provider.completeJSON<{
    attribution?: MessageMarkers["attribution"];
    certainty?: number;
    timeOrientation?: MessageMarkers["timeOrientation"];
    emotionTone?: Record<string, number>;
    selfReflection?: boolean;
    abstractionJump?: boolean;
    emotionFact?: number;
    biases?: Array<{ type?: string; keyword?: string; quote?: string }>;
  }>({
    messages: [
      {
        role: "user",
        content:
          "You are delphi's cognitive-marker extractor. Analyze the sentence below and extract thinking markers. Output only JSON:\n" +
          `Sentence: "${text.slice(0, 500)}"`,
      },
    ],
    schema: MARKER_SCHEMA,
    temperature: 0.2,
  });
  if (!result) return null;

  const biasTypeOf = (t?: string): MessageMarkers["biases"][number]["type"] | null => {
    const known = new Set<MessageMarkers["biases"][number]["type"]>([
      "should_tyranny", "catastrophizing", "mind_reading", "confirmation_bias",
      "overgeneralization", "emotional_reasoning", "all_or_nothing",
    ]);
    return t && known.has(t as MessageMarkers["biases"][number]["type"])
      ? (t as MessageMarkers["biases"][number]["type"])
      : null;
  };

  const biases = Array.isArray(result.biases)
    ? result.biases
        .filter((b) => b && biasTypeOf(b.type))
        .map((b) => ({ type: biasTypeOf(b.type)!, keyword: b.keyword || "", quote: b.quote || "" }))
    : [];

  const to = result.timeOrientation;
  const tTotal = (to?.past || 0) + (to?.present || 0) + (to?.future || 0);

  return {
    biases,
    attribution: result.attribution ?? null,
    certainty: typeof result.certainty === "number" ? result.certainty : 0.5,
    timeOrientation: tTotal
      ? { past: (to?.past || 0) / tTotal, present: (to?.present || 0) / tTotal, future: (to?.future || 0) / tTotal }
      : { past: 0.33, present: 0.34, future: 0.33 },
    emotionTone: result.emotionTone && typeof result.emotionTone === "object" ? result.emotionTone : {},
    selfReflection: !!result.selfReflection,
    abstractionJump: !!result.abstractionJump,
    emotionFact: typeof result.emotionFact === "number" ? result.emotionFact : 0.5,
  };
}
