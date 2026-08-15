/**
 * delphi —— 模式切换器（对应文档 3.4 模式切换规则）
 */
import { AnalysisMode } from "../models/types";

export interface ModeSwitchResult {
  mode: AnalysisMode;
  companion: boolean; // 陪伴模式（情绪脆弱时）
  reason: string;
}

/** 情绪崩溃信号检测：检测到后自动降级为 隐式+陪伴 */
const CRISIS_PATTERNS = [
  "崩溃", "活不下去", "绝望", "想死", "撑不下去", "受不了了", "坚持不住",
  "没有意义", "不想活了", "快疯了", "彻底完了", "被击垮", "扛不住",
];

export function detectCrisis(text: string): boolean {
  return CRISIS_PATTERNS.some((p) => text.includes(p));
}

/**
 * 根据用户输入与当前模式，计算应切换到的模式。
 * 返回 null 表示无需切换（保持当前模式）。
 */
export function resolveModeSwitch(input: string, current: AnalysisMode): ModeSwitchResult | null {
  const cmd = input.trim().toLowerCase();

  // 显式命令
  if (cmd.startsWith("/stealth")) {
    return { mode: "stealth", companion: false, reason: "切换到隐式模式" };
  }
  if (cmd.startsWith("/transparent") || cmd.startsWith("/analyze")) {
    return { mode: "transparent", companion: false, reason: "切换到显式模式，实时展示分析" };
  }
  if (cmd.startsWith("/deep") || cmd.startsWith("/guide")) {
    return { mode: "meta_guide", companion: false, reason: "切换到引导式模式，主动元思考引导" };
  }
  if (cmd.startsWith("/talk")) {
    return { mode: "stealth", companion: false, reason: "切换到自由聊天（隐式）" };
  }

  // 自然语言触发
  if (/帮我分析|分析我|看看我怎么想|分析一下/.test(input)) {
    return { mode: "transparent", companion: false, reason: "检测到「分析」意图，进入显式模式" };
  }

  // 情绪脆弱 → 任何 → 隐式 + 陪伴
  if (detectCrisis(input)) {
    return { mode: "stealth", companion: true, reason: "检测到情绪脆弱信号，进入隐式+陪伴模式" };
  }

  return null;
}

/** 陪伴模式的开场回应 */
export function companionResponse(): string {
  return (
    "我先不分析这些了。你刚才说的这些，听起来真的很不容易。\n" +
    "我在这儿，你可以慢慢说。我们先不急着找答案。"
  );
}
