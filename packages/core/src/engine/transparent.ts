/** delphi — transparent mode. */
import { AnalysisMode, MessageMarkers, ChatMessage } from "../models/types";
import { BIAS_LABELS } from "../analyzer/biasDetector";
import { detectAbstractionJump } from "../analyzer/cognitiveMarker";

export interface TransparentOutput {
  narration: string[]; // metacog 叙述（自然语言，融入对话）
  snapshot: string[]; // 思维快照行
}

const ATTRIBUTION_LABEL: Record<string, string> = {
  internal: "内归因",
  external: "外归因",
  situational: "情境归因",
};
export { ATTRIBUTION_LABEL };

export class TransparentAnalyzer {
    /** Keyword counts for this session (accumulated across messages) */
  private keywordCounts = new Map<string, number>();
  private userMessageCount = 0;

    /** Record a message and update session stats (also called in stealth mode) */
  observe(text: string, markers: MessageMarkers): void {
    this.userMessageCount++;
    for (const b of markers.biases) {
      const key = b.keyword;
      this.keywordCounts.set(key, (this.keywordCounts.get(key) || 0) + 1);
    }
        // emotions and attribution also count toward the snapshot
    for (const [category, count] of Object.entries(markers.emotionTone)) {
      this.keywordCounts.set(`情绪:${category}`, (this.keywordCounts.get(`情绪:${category}`) || 0) + count);
    }
    if (markers.attribution) {
      const label = ATTRIBUTION_LABEL[markers.attribution];
      this.keywordCounts.set(`归因:${label}`, (this.keywordCounts.get(`归因:${label}`) || 0) + 1);
    }
  }

    /** Build the transparent display (reflect, never judge) */
  generate(text: string, markers: MessageMarkers): TransparentOutput {
    const narration: string[] = [];
    const snapshot: string[] = [];

        // 1. repeated keywords (patterns)
    for (const b of markers.biases) {
      const count = this.keywordCounts.get(b.keyword) || 1;
      if (count >= 2) {
        narration.push(
          `我注意到你说"${b.keyword}"——这是你本次对话里第 ${count} 次用到这个词。`
        );
        snapshot.push(`"${b.keyword}" 出现 ${count} 次 → ${BIAS_LABELS[b.type]}标记`);
        break; // 每条消息只提示一个重复关键词，避免轰炸
      }
    }

        // 2. emotional reasoning: fact -> feeling jumps
    const emotionKeys = Object.keys(markers.emotionTone);
    if (emotionKeys.length > 0 && markers.biases.some((b) => b.type === "emotional_reasoning")) {
      narration.push(
        "另外，从事实跳到感受之间似乎有一个解读的过程——这是你的观察，还是你的推断？"
      );
      snapshot.push(`事实→感受跳跃 → 情绪推理检测`);
    }

        // 3. abstraction jumps
    if (detectAbstractionJump(text)) {
      narration.push("我注意到你从具体的事情跳到了更抽象的层面，中间那一步发生了什么？");
      snapshot.push(`抽象层级跳跃 → 具体↔意义`);
    }

        // 4. attribution direction
    if (markers.attribution) {
      const label = ATTRIBUTION_LABEL[markers.attribution];
      snapshot.push(`归因方向: ${label}${markers.attribution === "external" ? "主导" : ""}`);
    }

        // 5. certainty wording
    if (markers.certainty >= 0.7) {
      narration.push("我听到几个很确定的词——听起来你对这件事已经有结论了？");
    } else if (markers.certainty <= 0.3 && markers.certainty > 0) {
      narration.push("你的用词里有不少不确定——这部分是你不确定，还是不想下结论？");
    }

        // 6. self-reflection signals
    if (markers.selfReflection) {
      narration.push("我注意到你正在回看自己——这对看见自己如何思考很有帮助。");
      snapshot.push(`自我反思信号 ✓`);
    }

    return { narration, snapshot };
  }

  /** Assemble the full display block (metacog narration + snapshot) */
  render(text: string, markers: MessageMarkers, messages: ChatMessage[]): string {
    this.observe(text, markers);
    const out = this.generate(text, markers);
    if (out.narration.length === 0 && out.snapshot.length === 0) return "";

    const lines: string[] = [];
    lines.push("");
    lines.push("metacog:");
    for (const n of out.narration) lines.push(`  ${n}`);
    if (out.snapshot.length > 0) {
      lines.push("");
      lines.push(`[思维快照 - 本次对话 · 第${this.userMessageCount}条]`);
      const arrows = ["├──", "├──", "└──"];
      out.snapshot.slice(0, 3).forEach((s, i) => {
        lines.push(`  ${arrows[Math.min(i, 2)]} ${s}`);
      });
    }
    return lines.join("\n");
  }

  /** Session-level summary (printed at conversation end) */
  sessionSummary(): string[] {
    const lines: string[] = [];
    const entries = [...this.keywordCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    if (entries.length === 0) return lines;
    lines.push("本次对话关键词热度:");
    entries.forEach(([k, v], i) => {
      const mark = i === entries.length - 1 ? "└──" : "├──";
      lines.push(`  ${mark} ${k}: ${v}次`);
    });
    return lines;
  }
}

export interface GuideStrategy {
  strategy: string;
  question: string;
  trigger: string;
}

export function selectGuideStrategy(text: string, markers: MessageMarkers): GuideStrategy | null {
  const biases = markers.biases.map((b) => b.type);
  const hasEmotion = Object.keys(markers.emotionTone).length > 0;
  const vague = /烦|累|迷茫|难受|不对劲|说不清|复杂|乱/.test(text);

  if (markers.abstractionJump) {
    return {
      strategy: "速度降维",
      question: "你刚才从具体的事情直接跳到了一个很抽象的结论——中间 B 和 C 发生了什么？",
      trigger: "检测到抽象层级跳跃",
    };
  }
  if (biases.includes("should_tyranny")) {
    return {
      strategy: "溯源追问",
      question: "这个「应该」是谁告诉你的？你自己真的认同它吗？",
      trigger: "检测到「应该暴政」",
    };
  }
  if (biases.includes("overgeneralization")) {
    return {
      strategy: "边界测试",
      question: "如果去掉「总是/从来」这两个词，这件事还剩多少是成立的？",
      trigger: "检测到绝对化表达",
    };
  }
  if (biases.includes("mind_reading") || biases.includes("emotional_reasoning")) {
    return {
      strategy: "具体化锚定",
      question: "你刚才提到一个判断——它是你观察到的事实，还是你的猜测？有哪些具体证据？",
      trigger: "检测到读心/情绪推理",
    };
  }
  if (vague && hasEmotion) {
    return {
      strategy: "具体化锚定",
      question: "这种感受最常出现在什么具体情境里？身体哪个部位最先有反应？",
      trigger: "模糊情绪表达",
    };
  }
  if (/如果|要不是|假如/.test(text)) {
    return {
      strategy: "反事实推演",
      question: "如果那个条件不存在了，你的选择会改变吗？",
      trigger: "出现条件句",
    };
  }
  return null;
}

export function guideResponse(strategy: GuideStrategy): string {
  return `【引导 · ${strategy.strategy}】${strategy.question}`;
}
