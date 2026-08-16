/**
 * delphi — core capability model.
 * User picks a target field, self-rates its core capabilities, then the
 * result is cross-validated against achievement skills and SIGN signals
 * (surfacing "capabilities you think you lack but actually have").
 */
import { CapabilityData, UserCognitiveProfile } from "../models/types";
import { FlowRunner, FlowStep } from "./flow";
import { aggregateSkills } from "./achievement";

export interface CapabilityCatalog {
  field: string;
  capabilities: string[];
}

export const CAPABILITY_CATALOG: CapabilityCatalog[] = [
  { field: "产品经理", capabilities: ["需求分析", "沟通协调", "数据敏感度", "用户洞察", "原型设计", "项目推进"] },
  { field: "软件工程师", capabilities: ["编程", "系统设计", "调试排错", "抽象思维", "快速学习", "工程交付"] },
  { field: "内容创作", capabilities: ["写作", "选题策划", "表达", "审美", "排版", "传播"] },
  { field: "创业", capabilities: ["机会识别", "资源整合", "决策", "抗压", "销售", "团队组建"] },
  { field: "研究/学术", capabilities: ["文献检索", "实验设计", "批判性思维", "学术写作", "数据分析", "专注"] },
  { field: "咨询顾问", capabilities: ["结构化思维", "沟通", "商业洞察", "呈现表达", "客户管理", "快速学习"] },
];

export function capabilityFields(): string[] {
  return CAPABILITY_CATALOG.map((c) => c.field);
}

export function getCapabilities(field: string): string[] {
  return CAPABILITY_CATALOG.find((c) => c.field === field)?.capabilities || [];
}

/** Build a self-rating flow for a target field. */
export function createCapabilityFlow(field: string): FlowRunner {
  const caps = getCapabilities(field);
  const steps: FlowStep[] = [
    { id: "field", prompt: "目标领域？（产品经理 / 软件工程师 / 内容创作 / 创业 / 研究·学术 / 咨询顾问）", answerKey: "field" },
    ...caps.map((cap, i) => ({
      id: `cap-${i}`,
      prompt: `「${cap}」你自评几分？（0-5，0=完全不会 5=非常擅长）`,
      answerKey: `cap-${i}`,
    })),
  ];
  return new FlowRunner(steps);
}

function parseScore(raw: string | undefined): number {
  const n = parseInt(raw || "", 10);
  if (isNaN(n)) return 2;
  return Math.max(0, Math.min(5, n));
}

/** Build the capability result and cross-validate against existing data. */
export function buildCapabilityResult(
  profile: UserCognitiveProfile,
  runner: FlowRunner,
  field?: string
): CapabilityData {
  const resolvedField = field || runner.answers.field || "产品经理";
  const caps = getCapabilities(resolvedField);
  const ratings = caps.map((cap, i) => ({
    capability: cap,
    score: parseScore(runner.answers[`cap-${i}`]),
  }));

  const strengths = ratings.filter((r) => r.score >= 4).map((r) => r.capability);
  const gaps = ratings.filter((r) => r.score <= 2).map((r) => r.capability);

  // Cross-validate: capabilities rated low but evidenced in the archive.
  const evidence = new Set<string>([
    ...aggregateSkills(profile.frameworkData.achievements),
    ...Object.values(profile.frameworkData.sign.signals).join(" ").split(/\s+/),
    ...(profile.frameworkData.swot.strengths || []),
  ].map((s) => s.trim()).filter(Boolean));

  const hiddenStrengths = ratings
    .filter((r) => r.score <= 2)
    .filter((r) => [...evidence].some((e) => e.length >= 2 && (r.capability.includes(e) || e.includes(r.capability))))
    .map((r) => r.capability);

  return { field: resolvedField, ratings, strengths, gaps, hiddenStrengths };
}
