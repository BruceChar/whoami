/** delphi — LLM agent (real agent: tool calling + profile grounding). */
import { ChatMessage, UserCognitiveProfile } from "../models/types";
import { LLMMessage, LLMProvider, LLMUsage } from "./types";

/** JSON Schema subset (for tool parameters) */
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
  /** Tool names executed this turn */
  toolCalls: string[];
}

/** LLM agent interface with tool calling (pi-ai impl + test impl) */
export interface LLMAgent extends LLMProvider {
  agentChat(opts: {
    messages: LLMMessage[];
    system?: string;
    tools?: AgentToolDef[];
    executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
    maxToolRounds?: number;
  }): Promise<LLMAgentResult>;
}

// ---------------------------------------------------------------------------
// delphi tool definitions
// ---------------------------------------------------------------------------

export const DELPHI_TOOLS: AgentToolDef[] = [
  {
    name: "get_cognitive_profile",
    description:
      "Fetch a summary of the user's cognitive profile (growth stage, attribution pattern, cognitive-bias frequencies, value anchors, energy map, persona version, etc.). Call this before answering questions about the user's self-knowledge.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "search_memory",
    description: "Keyword-search the user's conversation records, insights, daily feedback, SWOT items, and achievements; returns matching snippets.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "search keyword" },
      },
      required: ["query"],
    },
  },
];

/** Build the profile summary JSON (for the get_cognitive_profile tool). */
export function buildProfileSummaryJSON(profile: UserCognitiveProfile): string {
  const g = profile.growthTracking;
  const topBiases = Object.entries(profile.cognitiveMarkers.biasFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${k}:${v}`);

  const summary = {
    growthStage: g.growthStage,
    sessionCount: profile.sessions.length,
    attributionPattern: {
      internal: Math.round(profile.cognitiveMarkers.attributionPattern.internal * 100),
      external: Math.round(profile.cognitiveMarkers.attributionPattern.external * 100),
      situational: Math.round(profile.cognitiveMarkers.attributionPattern.situational * 100),
    },
    certaintyIndex: Number(profile.cognitiveMarkers.certaintyIndex.toFixed(2)),
    topBiasFrequencies: topBiases,
    valueAnchors: profile.frameworkData.vtd.values.anchors,
    valueConflicts: profile.frameworkData.vtd.values.conflicts,
    intrinsicDrives: profile.frameworkData.vtd.dreams.pureDrives,
    energySources: profile.currentPersona?.energyMap.sources || profile.frameworkData.dailyFeedback.map((d) => d.satisfied.event),
    energyBlackHoles: profile.currentPersona?.energyMap.blackHoles || [],
    talentAreas: profile.frameworkData.sign.areas,
    personaVersion: profile.currentPersona?.version || "not generated",
    recentInsights: profile.insights.slice(-3).map((i) => i.analysis),
  };
  return JSON.stringify(summary, null, 1);
}

/** Keyword search across the profile (for the search_memory tool). */
export function searchMemoryJSON(profile: UserCognitiveProfile, query: string): string {
  const q = query.trim();
  if (!q) return JSON.stringify({ error: "missing search term" });
  const hits: Array<{ source: string; snippet: string; date: string }> = [];
  const push = (source: string, text: string, date: string) => {
    if (text && text.includes(q) && hits.length < 6) {
      hits.push({ source, snippet: text.slice(0, 120), date: date.slice(0, 10) });
    }
  };
  for (const s of profile.sessions) {
    for (const m of s.messages) {
      if (m.role === "user") push("conversation", m.text, m.timestamp);
    }
  }
  for (const i of profile.insights) {
    push("insight", `${i.quote} ${i.analysis}`, i.timestamp);
  }
  for (const d of profile.frameworkData.dailyFeedback) {
    push("daily_feedback", `${d.satisfied.event} / ${d.unsatisfied.event}`, d.date);
  }
  for (const a of profile.frameworkData.achievements) {
    push("achievement", `${a.star.situation} ${a.star.action}`, a.eventId);
  }
  const fw = profile.frameworkData;
  for (const w of fw.swot.strengths.concat(fw.swot.weaknesses, fw.swot.opportunities, fw.swot.threats)) {
    push("swot", w, profile.updatedAt);
  }
  return JSON.stringify(hits.length ? hits : { message: "no matching records found" }, null, 1);
}

// ---------------------------------------------------------------------------
// High-level entry: hand session history + system prompt to the agent
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
          return JSON.stringify({ error: `unknown tool: ${name}` });
      }
    },
  });
}
