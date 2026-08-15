/**
 * delphi —— 人生设计引擎（文档 6）
 * Connect The Dots / 重力问题 / 多重人生假设 / 原型设计 / Choosing Well
 */
import { LifeDesignData, UserCognitiveProfile } from "../models/types";
import { satisfiedDrivers } from "../frameworks/dailyFeedback";
import { signAreas } from "../frameworks/sign";
import { aggregateSkills } from "../frameworks/achievement";

// ---------------------------------------------------------------------------
// Connect The Dots（文档 6.2）
// ---------------------------------------------------------------------------

export function buildConnectTheDots(profile: UserCognitiveProfile) {
  const fw = profile.frameworkData;

  const belief = fw.vtd.values.anchors[0] || "（尚未完成 V-T-D 价值观探索）";
  const workView = satisfiedDrivers(fw.dailyFeedback)[0] || "（每日回馈数据不足）";
  const skills = aggregateSkills(fw.achievements);
  const identity = skills[0] || "（成就事件数据不足）";

  // 对齐度：belief / workView / identity 是否指向同一主题
  const combined = `${belief} ${workView} ${identity}`;
  const overlaps = fw.vtd.values.anchors.filter((a) => combined.includes(a));
  const alignmentScore = Math.min(1, 0.3 + overlaps.length * 0.2);

  const gaps: string[] = [];
  if (belief && workView && !fw.vtd.values.anchors.includes(workView)) {
    gaps.push(`你相信"${belief}"最重要，但工作中让你持续满意的似乎是"${workView}"`);
  }
  if (belief && identity && belief !== identity && !identity.includes(belief)) {
    gaps.push(`你认同"${belief}"，但你描述自己时更常提到"${identity}"`);
  }
  if (gaps.length === 0) gaps.push("暂无显著断裂点，三者指向较一致");

  return { belief, workView, identity, alignmentScore, gaps };
}

// ---------------------------------------------------------------------------
// 多重人生假设（文档 6.4）
// ---------------------------------------------------------------------------

export const MULTIPLE_LIVES_STEPS = [
  {
    id: "current",
    title: "目前正在做的",
    prompt: "如果继续当前路径 5 年，最可能的结果是什么？",
  },
  {
    id: "ai",
    title: "AI 取代了你目前的技能",
    prompt: "如果你的核心技能明天被 AI 替代，你还有什么价值？",
  },
  {
    id: "free",
    title: "随心所欲，无条件限制",
    prompt: "如果钱、面子、他人的看法都不存在，你会选择什么？",
  },
];

export function detectCommonElements(answers: Record<string, string>): string[] {
  const texts = Object.values(answers).filter((t) => t && t.trim());
  if (texts.length === 0) return [];
  const combined = texts.join("\n");
  const counts = new Map<string, number>();
  for (const t of texts) {
    const seen = new Set<string>();
    const candidates = [
      ...["写", "做", "研究", "教", "讲", "帮", "创造", "设计", "探索", "陪伴", "分享", "学习"],
      ...["自由", "意义", "创造", "连接", "成长", "真实", "影响"],
    ];
    for (const w of candidates) {
      if (t.includes(w) && !seen.has(w)) {
        seen.add(w);
        counts.set(w, (counts.get(w) || 0) + 1);
      }
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
}

// ---------------------------------------------------------------------------
// 人生设计主入口
// ---------------------------------------------------------------------------

export function buildLifeDesign(profile: UserCognitiveProfile): LifeDesignData {
  const dots = buildConnectTheDots(profile);
  const gravity = profile.frameworkData.swot.gravityProblems;

  return {
    connectTheDots: dots,
    gravityProblems: gravity.length > 0 ? gravity : ["暂无已识别重力问题"],
    multipleLives: {
      commonElements: [],
      coreDrive: "数据积累中（完成三次多重人生推演后自动提取）",
    },
    prototypeStatus: profile.prototypes.map((p) => ({
      idea: p.idea,
      tested: p.status !== "unverified",
      assumptions: p.assumptions,
    })),
  };
}

export function formatLifeDesign(d: LifeDesignData): string {
  const lines: string[] = [];
  lines.push("🧭 人生设计");
  lines.push("");
  lines.push("【Connect The Dots】");
  lines.push(`  • 你相信（What you believe）: ${d.connectTheDots.belief}`);
  lines.push(`  • 你做的事（What you do）: ${d.connectTheDots.workView}`);
  lines.push(`  • 你是谁（Who you are）: ${d.connectTheDots.identity}`);
  lines.push(`  • 三者对齐度: ${(d.connectTheDots.alignmentScore * 100).toFixed(0)}%`);
  for (const g of d.connectTheDots.gaps) lines.push(`  ⚠ ${g}`);
  lines.push("");
  lines.push("【重力问题】（不可控，接受它作为环境条件）");
  for (const g of d.gravityProblems) lines.push(`  • ${g}`);
  lines.push("");
  lines.push("【多重人生假设】");
  lines.push(`  • 共同元素: ${d.multipleLives.commonElements.join("、") || "—"}`);
  lines.push(`  • 内驱核心: ${d.multipleLives.coreDrive}`);
  lines.push("");
  lines.push("【原型试验】");
  if (d.prototypeStatus.length === 0) {
    lines.push("  • 暂无原型试验。行动原则：Get Curious / Talk to People / Try Stuff");
  } else {
    for (const p of d.prototypeStatus) {
      lines.push(`  • ${p.idea} [${p.tested ? "已试验" : "待试验"}]`);
    }
  }
  return lines.join("\n");
}
