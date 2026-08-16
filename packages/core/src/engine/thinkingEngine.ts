/** delphi — thinking engine (three analysis modes). */
import { AnalysisMode, ChatMessage, MessageMarkers } from "../models/types";
import { analyzeMessage, AnalyzeOptions } from "../analyzer/cognitiveMarker";
import {
  resolveModeSwitch,
  detectCrisis,
  companionResponse,
} from "./modeSwitcher";
import { TransparentAnalyzer } from "./transparent";
import { LLMAgent, runChatAgent } from "../llm/agent";
import { LLMUsage } from "../llm/types";
import { llmExtractMarkers, mergeMarkers } from "../llm/enhancedAnalysis";
import { BIAS_LABELS } from "../analyzer/biasDetector";

export interface EngineTurnResult {
    /** Agent reply text to display */
  reply: string;
    /** Cognitive markers of this input */
  markers: MessageMarkers;
    /** Mode after processing */
  modeAfter: AnalysisMode;
    /** Whether a mode switch happened */
  modeChanged: boolean;
  modeChangeReason?: string;
    /** Emotional crisis (companion mode) */
  companion: boolean;
    /** Whether the input was a pure command (no analysis) */
  isCommand: boolean;
    /** LLM usage, when LLM-generated */
  usage?: LLMUsage;
  llmModel?: string;
    /** Whether the reply was LLM-generated */
  llmGenerated?: boolean;
}

export interface EngineOptions {
  sensitivity?: AnalyzeOptions["sensitivity"];
  lightTouch?: boolean;
    /** LLM agent (pi-ai) — required */
  llm: LLMAgent;
    /** Per-message LLM marker enhancement (token-heavy, off by default) */
  deepAnalyze?: boolean;
    /** Tool template system prompt (VTD/SWOT etc. triggered by "/") */
  toolPrompt?: string;
}

const COMMANDS = new Set([
  "/stealth", "/transparent", "/guide", "/deep", "/analyze", "/talk",
]);

/** Per-mode agent system prompt (mirror principle + mode behavior) */
function systemPromptFor(mode: AnalysisMode, markers: MessageMarkers, input: string, toolPrompt?: string): string {
  const base =
    "你是 delphi，一面照向内心的镜子——一个自我认知 Agent。\n" +
    "铁律（镜子原则）：永远不说「你应该…」，只描述「我注意到…」；不评判、不下定义、不贴标签。\n" +
    "关注用户「怎么想」而非「想了什么」。用中文回复，保持简洁自然（一般 2-4 句），像朋友一样对话。\n" +
    "你可以调用工具 get_cognitive_profile / search_memory 读取用户的认知档案，让回答真正基于用户的数据。";

    // tool template: takes priority over the mode (LLM conducts the flow)
  if (toolPrompt) {
    return base + "\n\n" + toolPrompt;
  }

  const markerHint = buildMarkerHint(markers);

  switch (mode) {
    case "transparent":
      return (
        base +
        "\n\n当前为【显式模式】：自然回应之后，另起一段输出「metacog:」思维快照，" +
        "引用用户原话中的关键词，指出 1-3 条可观察的思维模式（如「总是」这类绝对化用词、「应该」、「我觉得所以」、「直接跳到结论」），只反射不评价。" +
        (markerHint ? `\n规则引擎实时标记：${markerHint}` : "")
      );
    case "meta_guide":
      return (
        base +
        "\n\n当前为【引导式模式】：你是元认知引导者。根据规则引擎线索选择最合适的引导策略并提出一个问题，让用户跳出自动思维。" +
        "策略：具体化锚定（抽象/模糊时）、边界测试（绝对化时）、反事实推演（条件句时）、溯源追问（「应该」时）、速度降维（跳跃时）。" +
        (markerHint ? `\n规则引擎线索：${markerHint}。` : "") +
        `\n用户原话：「${input.slice(0, 120)}」`
      );
    case "stealth":
    default:
      return base + (markerHint ? `\n（后台静默标记：${markerHint}——不向用户展示）` : "");
  }
}

function buildMarkerHint(markers: MessageMarkers): string {
  const parts: string[] = [];
  if (markers.biases.length > 0) {
    const counts = new Map<string, number>();
    for (const b of markers.biases) counts.set(BIAS_LABELS[b.type], (counts.get(BIAS_LABELS[b.type]) || 0) + 1);
    parts.push(`偏差[${[...counts.entries()].map(([k, v]) => `${k}×${v}`).join("、")}]`);
  }
  if (markers.attribution) {
    const label = { internal: "内归因", external: "外归因", situational: "情境归因" }[markers.attribution];
    parts.push(`归因=${label}`);
  }
  if (markers.selfReflection) parts.push("自我反思✓");
  if (markers.abstractionJump) parts.push("抽象跳跃");
  if (Object.keys(markers.emotionTone).length > 0) {
    parts.push(`情绪[${Object.keys(markers.emotionTone).join("、")}]`);
  }
  return parts.join("，");
}

export class ThinkingEngine {
  mode: AnalysisMode;
  private analyzer = new TransparentAnalyzer();
  private round = 0;
  private readonly opts: {
    sensitivity: AnalyzeOptions["sensitivity"];
    lightTouch: boolean;
    deepAnalyze: boolean;
    llm: LLMAgent;
    toolPrompt?: string;
  };
    /** Session history (LLM context) */
  private history: ChatMessage[] = [];
    /** Profile read by tool calls (injected by the CLI/web) */
  llmProfile: import("../models/types").UserCognitiveProfile | null = null;
  private lastToolCalls: string[] = [];

  constructor(initialMode: AnalysisMode = "stealth", opts: EngineOptions) {
    this.mode = initialMode;
    this.opts = {
      sensitivity: opts.sensitivity || "medium",
      lightTouch: opts.lightTouch !== undefined ? opts.lightTouch : true,
      llm: opts.llm,
      deepAnalyze: opts.deepAnalyze || false,
      toolPrompt: opts.toolPrompt,
    };
  }

    /** Process one user input; returns the reply to display */
  async process(input: string): Promise<EngineTurnResult> {
    const trimmed = input.trim();
    const isCommand = COMMANDS.has(trimmed.split(/\s+/)[0]);

        // 1. mode switch (incl. crisis detection)
    const sw = resolveModeSwitch(trimmed, this.mode);
    let companion = false;
    if (sw) {
      this.mode = sw.mode;
      companion = sw.companion;
      if (isCommand) {
        return {
          reply: sw.reason,
          markers: emptyMarkers(),
          modeAfter: this.mode,
          modeChanged: true,
          modeChangeReason: sw.reason,
          companion,
          isCommand: true,
        };
      }
    }

        // 2. rule analysis (always runs, produces markers)
    let markers = analyzeMessage(trimmed, { sensitivity: this.opts.sensitivity });

        // 2.1 optional: per-message LLM marker enhancement (deepAnalyze)
    if (this.opts.deepAnalyze) {
      try {
        const llmMarkers = await llmExtractMarkers(this.opts.llm, trimmed);
        if (llmMarkers) markers = mergeMarkers(markers, llmMarkers);
      } catch {
                // enhancement failure must not break the main flow
      }
    }

    this.analyzer.observe(trimmed, markers);
    this.history.push({ role: "user", text: trimmed, timestamp: new Date().toISOString(), markers });

    let reply: string;
    let usage: LLMUsage | undefined;
    let llmModel: string | undefined;

    if (companion || detectCrisis(trimmed)) {
      reply = companionResponse();
    } else {
      const system = systemPromptFor(this.mode, markers, trimmed, this.opts.toolPrompt);
      const result = await runChatAgent({
        provider: this.opts.llm,
        system,
        history: this.history,
        profile: this.llmProfile || emptyProfile(),
      });
      reply = result.text;
      usage = result.usage;
      llmModel = result.model;
      if (result.toolCalls.length > 0) {
        this.lastToolCalls = result.toolCalls;
      }
    }

    this.round++;
    return {
      reply,
      markers,
      modeAfter: this.mode,
      modeChanged: !!sw,
      modeChangeReason: sw?.reason,
      companion,
      isCommand: false,
      usage,
      llmModel,
      llmGenerated: !companion && !detectCrisis(trimmed),
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

    /** Seed history messages (LLM context only; no re-analysis or recounting) */
  rememberHistory(messages: Array<{ role: "user" | "agent"; text: string }>): void {
    for (const m of messages.slice(-24)) {
      this.history.push({ role: m.role, text: m.text, timestamp: new Date().toISOString() });
    }
  }

    /** Session-end summary */
  sessionSummary(): string[] {
    return this.analyzer.sessionSummary();
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
    isQuestion: false,
  };
}
