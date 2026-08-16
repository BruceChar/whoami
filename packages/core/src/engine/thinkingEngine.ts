/** delphi — thinking engine (three analysis modes, LLM-driven). */
import { AnalysisMode, ChatMessage, MessageMarkers } from "../models/types";
import { resolveModeSwitch, isModeCommand } from "./modeSwitcher";
import { LLMAgent, runChatAgent } from "../llm/agent";
import { LLMUsage } from "../llm/types";
import { llmExtractMarkers } from "../llm/enhancedAnalysis";

export interface EngineTurnResult {
  /** Agent reply text to display */
  reply: string;
  /** Cognitive markers of this input (LLM-extracted) */
  markers: MessageMarkers;
  /** Mode after processing */
  modeAfter: AnalysisMode;
  /** Whether a mode switch happened */
  modeChanged: boolean;
  modeChangeReason?: string;
  /** Whether the input was a pure slash command (no analysis) */
  isCommand: boolean;
  /** LLM usage, when LLM-generated */
  usage?: LLMUsage;
  llmModel?: string;
  /** Whether the reply was LLM-generated */
  llmGenerated?: boolean;
}

export interface EngineOptions {
  /** LLM agent (pi-ai) — required */
  llm: LLMAgent;
  /** Tool template system prompt (VTD/SWOT etc. triggered by "/") */
  toolPrompt?: string;
  /** How to address the user (from their profile); optional. */
  userNickname?: string;
}

const BASE_SYSTEM_PROMPT = [
  "You are delphi, a self-knowledge agent — a mirror into the mind.",
  "Iron rule (mirror principle): never say \"you should…\"; only describe \"I notice…\". Never judge, label, or define the user.",
  "Focus on HOW the user thinks, not just WHAT they say.",
  "Reply in the same language the user writes in — detect it automatically from their input.",
  "Keep replies concise and natural (usually 2-4 sentences), like a thoughtful friend.",
  "You may call the tools get_cognitive_profile / search_memory to ground your reply in the user's cognitive profile.",
  "If the user seems distressed or in crisis, prioritize care and presence over analysis.",
].join("\n");

/** Per-mode agent system prompt (mirror principle + mode behavior). */
function systemPromptFor(mode: AnalysisMode, toolPrompt?: string, nickname?: string): string {
  const greeting = nickname && nickname.trim()
    ? `The user goes by the name "${nickname.trim()}"; address them by it when natural.`
    : "";
  const base = greeting ? `${BASE_SYSTEM_PROMPT}\n${greeting}` : BASE_SYSTEM_PROMPT;
  if (toolPrompt) {
    return `${base}\n\n${toolPrompt}`;
  }
  switch (mode) {
    case "transparent":
      return (
        `${BASE_SYSTEM_PROMPT}\n\n` +
        "Current mode: transparent. After a natural reply, add a short \"metacog:\" block pointing out 1-3 observable thinking patterns " +
        "(e.g. absolutist words like \"always\", \"should\", \"everyone\", or jumping straight to a conclusion). Reflect, never judge."
      );
    case "meta_guide":
      return (
        `${BASE_SYSTEM_PROMPT}\n\n` +
        "Current mode: guide. Be a metacognitive guide. Ask ONE probing question that helps the user step outside their automatic thinking " +
        "(concretize a vague statement, boundary-test an absolutist claim, run a counterfactual, trace where a \"should\" came from, or slow down a jump). " +
        "Do not give conclusions — only questions."
      );
    case "stealth":
    default:
      return (
        `${BASE_SYSTEM_PROMPT}\n\n` +
        "Current mode: stealth. Analyze quietly in the background; do not surface analysis in your reply. Just converse naturally."
      );
  }
}

export class ThinkingEngine {
  mode: AnalysisMode;
  private round = 0;
  private readonly opts: { llm: LLMAgent; toolPrompt?: string; userNickname?: string };
  /** Session history (LLM context) */
  private history: ChatMessage[] = [];
  /** Profile read by tool calls (injected by the CLI/web) */
  llmProfile: import("../models/types").UserCognitiveProfile | null = null;
  private lastToolCalls: string[] = [];

  constructor(initialMode: AnalysisMode = "stealth", opts: EngineOptions) {
    this.mode = initialMode;
    this.opts = { llm: opts.llm, toolPrompt: opts.toolPrompt, userNickname: opts.userNickname };
  }

  /** Process one user input; returns the reply to display */
  async process(input: string): Promise<EngineTurnResult> {
    const trimmed = input.trim();
    const isCommand = isModeCommand(trimmed);

    // 1. mode switch (explicit commands only)
    const sw = resolveModeSwitch(trimmed);
    if (sw) {
      this.mode = sw.mode;
      if (isCommand) {
        return {
          reply: sw.reason,
          markers: emptyMarkers(),
          modeAfter: this.mode,
          modeChanged: true,
          modeChangeReason: sw.reason,
          isCommand: true,
        };
      }
    }

    // 2. LLM cognitive-marker extraction (the only marker producer; failures degrade to empty)
    let markers = emptyMarkers();
    try {
      const extracted = await llmExtractMarkers(this.opts.llm, trimmed);
      if (extracted) markers = extracted;
    } catch {
      // extraction failure must not break the main flow
    }

    this.history.push({ role: "user", text: trimmed, timestamp: new Date().toISOString(), markers });

    // 3. LLM chat reply (tool calling + profile grounding)
    const system = systemPromptFor(this.mode, this.opts.toolPrompt, this.opts.userNickname);
    const result = await runChatAgent({
      provider: this.opts.llm,
      system,
      history: this.history,
      profile: this.llmProfile || emptyProfile(),
    });

    if (result.toolCalls.length > 0) {
      this.lastToolCalls = result.toolCalls;
    }

    this.round++;
    return {
      reply: result.text,
      markers,
      modeAfter: this.mode,
      modeChanged: !!sw && !isCommand,
      modeChangeReason: sw?.reason,
      isCommand: false,
      usage: result.usage,
      llmModel: result.model,
      llmGenerated: true,
    };
  }

  /** Current mode */
  getMode(): AnalysisMode {
    return this.mode;
  }

  /** Tools executed this session (for CLI display) */
  getLastToolCalls(): string[] {
    return this.lastToolCalls;
  }

  /** Seed history messages (LLM context only; no re-analysis) */
  rememberHistory(messages: Array<{ role: "user" | "agent"; text: string }>): void {
    for (const m of messages.slice(-24)) {
      this.history.push({ role: m.role, text: m.text, timestamp: new Date().toISOString() });
    }
  }

  /** Session-end summary (rule-based keyword heat removed; kept for API compatibility) */
  sessionSummary(): string[] {
    return [];
  }
}

function emptyProfile(): import("../models/types").UserCognitiveProfile {
  return {
    userId: "", createdAt: "", updatedAt: "",
    sessions: [], insights: [], prototypes: [],
  } as unknown as import("../models/types").UserCognitiveProfile;
}

function emptyMarkers(): MessageMarkers {
  return {
    biases: [],
    attribution: null,
    certainty: 0.5,
    timeOrientation: { past: 0, present: 0, future: 0 },
    emotionTone: {},
    selfReflection: false,
    abstractionJump: false,
    emotionFact: 0.5,
  };
}
