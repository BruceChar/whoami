/**
 * delphi —— 思维分析引擎（三层模式统一入口）
 * 隐式 / 显式 / 引导式 的切换与执行都在这里完成。
 */
import { AnalysisMode, ChatMessage, MessageMarkers } from "../models/types";
import { analyzeMessage, AnalyzeOptions } from "../analyzer/cognitiveMarker";
import {
  resolveModeSwitch,
  detectCrisis,
  companionResponse,
} from "./modeSwitcher";
import { stealthReply } from "./stealth";
import {
  TransparentAnalyzer,
  selectGuideStrategy,
  guideResponse,
} from "./transparent";

export interface EngineTurnResult {
  /** 需要展示给用户的 Agent 回复文本 */
  reply: string;
  /** 本次输入的分析标记 */
  markers: MessageMarkers;
  /** 处理后的模式 */
  modeAfter: AnalysisMode;
  /** 是否触发了模式切换 */
  modeChanged: boolean;
  modeChangeReason?: string;
  /** 情绪脆弱（陪伴模式） */
  companion: boolean;
  /** 是否为纯命令输入（不参与分析） */
  isCommand: boolean;
}

export interface EngineOptions {
  sensitivity?: AnalyzeOptions["sensitivity"];
  lightTouch?: boolean; // 隐式模式下第 4 轮起是否轻量标记
}

const COMMANDS = new Set([
  "/stealth", "/transparent", "/guide", "/deep", "/analyze", "/talk",
]);

export class ThinkingEngine {
  mode: AnalysisMode;
  private analyzer = new TransparentAnalyzer();
  private round = 0;
  private readonly opts: Required<EngineOptions>;

  constructor(initialMode: AnalysisMode = "stealth", opts: EngineOptions = {}) {
    this.mode = initialMode;
    this.opts = {
      sensitivity: opts.sensitivity || "medium",
      lightTouch: opts.lightTouch !== undefined ? opts.lightTouch : true,
    };
  }

  /** 处理一条用户输入，返回 Agent 应展示的回复 */
  process(input: string): EngineTurnResult {
    const trimmed = input.trim();
    const isCommand = COMMANDS.has(trimmed.split(/\s+/)[0]);

    // 1. 模式切换（含情绪危机检测）
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

    // 2. 分析
    const markers = analyzeMessage(trimmed, { sensitivity: this.opts.sensitivity });
    this.analyzer.observe(trimmed, markers);
    const msg: ChatMessage = {
      role: "user",
      text: trimmed,
      timestamp: new Date().toISOString(),
      markers,
    };
    void msg;

    // 3. 按模式生成回复
    let reply: string;
    if (companion || detectCrisis(trimmed)) {
      reply = companionResponse();
    } else if (this.mode === "meta_guide") {
      const strategy = selectGuideStrategy(trimmed, markers);
      reply = strategy ? guideResponse(strategy) : "我在听。你继续说说？";
    } else if (this.mode === "transparent") {
      const annotation = this.analyzer.render(trimmed, markers, []);
      const base = "嗯，我听到了。";
      reply = annotation ? `${base}\n${annotation}` : stealthReply(markers, this.round, this.opts.lightTouch);
    } else {
      reply = stealthReply(markers, this.round, this.opts.lightTouch);
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
    };
  }

  /** 当前模式 */
  getMode(): AnalysisMode {
    return this.mode;
  }

  /** 会话结束时的摘要 */
  sessionSummary(): string[] {
    return this.analyzer.sessionSummary();
  }
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
