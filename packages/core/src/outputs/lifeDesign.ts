/** delphi — life design: Connect The Dots / gravity problems / multiple lives / prototypes. */
import { LifeDesignData, UserCognitiveProfile } from "../models/types";
import { satisfiedDrivers } from "../frameworks/dailyFeedback";
import { aggregateSkills } from "../frameworks/achievement";
import { LLMAgent } from "../llm/agent";
import { llmExtractCommonElements } from "../llm/extraction";

// ---------------------------------------------------------------------------

export function buildConnectTheDots(profile: UserCognitiveProfile) {
  const fw = profile.frameworkData;

  const belief = fw.vtd.values.anchors[0] || "（尚未完成 V-T-D 价值观探索）";
  const workView = satisfiedDrivers(fw.dailyFeedback)[0] || "（每日回馈数据不足）";
  const skills = aggregateSkills(fw.achievements);
  const identity = skills[0] || "（成就事件数据不足）";

  const hasAll = Boolean(fw.vtd.values.anchors[0]) && Boolean(satisfiedDrivers(fw.dailyFeedback)[0]) && Boolean(skills[0]);
  const alignmentScore = hasAll ? 0.5 : 0.3;

  const gaps: string[] = [];
  if (hasAll && belief !== workView) {
    gaps.push(`你相信"${belief}"最重要，但工作中让你持续满意的似乎是"${workView}"`);
  }
  if (hasAll && belief !== identity && !identity.includes(belief)) {
    gaps.push(`你认同"${belief}"，但你描述自己时更常提到"${identity}"`);
  }
  if (gaps.length === 0) gaps.push("暂无显著断裂点，三者指向较一致");

  return { belief, workView, identity, alignmentScore, gaps };
}

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

/** Common elements across the three life scenarios (LLM-driven). */
export async function detectCommonElements(
  provider: LLMAgent,
  answers: Record<string, string>
): Promise<string[]> {
  const result = await llmExtractCommonElements(provider, answers);
  return result?.commonElements ?? [];
}

// ---------------------------------------------------------------------------
// life design entry point
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
