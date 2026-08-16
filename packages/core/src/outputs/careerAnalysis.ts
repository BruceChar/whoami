/** delphi — career analysis: work form / content direction / pitfalls (data-driven; LLM-refined). */
import { CareerAnalysis, UserCognitiveProfile } from "../models/types";
import { aggregateSkills } from "../frameworks/achievement";

export function canAnalyzeCareer(profile: UserCognitiveProfile): boolean {
  const fw = profile.frameworkData;
  return (
    fw.vtd.values.anchors.length >= 1 ||
    fw.dailyFeedback.length >= 3 ||
    fw.swot.strengths.length > 0 ||
    fw.achievements.length > 0
  );
}

export function buildCareerAnalysis(profile: UserCognitiveProfile): CareerAnalysis {
  const fw = profile.frameworkData;
  const reasoning: string[] = [];

  // ---- 1. work form fit (numeric interest-matrix signals + data counts) ----
  const independentEnergy = fw.interestMatrix.rating?.independent >= 4;
  const socialNeed = fw.interestMatrix.rating?.social >= 4;
  const workFormParts: string[] = [];
  if (independentEnergy) {
    workFormParts.push("独立工作能量高");
    reasoning.push("兴趣矩阵显示独立任务能量高");
  }
  if (socialNeed) {
    workFormParts.push("外部互动需求高");
    reasoning.push("兴趣矩阵显示社交能量高");
  }

  let workForm: string;
  if (independentEnergy && socialNeed) {
    workForm = "创业者或核心业务负责人（有自主空间，又有协作对象）";
  } else if (independentEnergy) {
    workForm = "独立/自由职业，或专家型角色（注意建立外部反馈机制）";
  } else if (socialNeed) {
    workForm = "团队协作型岗位（咨询、教学、协调等）";
  } else {
    workForm = "中等规模团队的专业岗位（数据积累后可细化）";
  }
  reasoning.push(`工作形态建议基于：${workFormParts.join("、") || "数据不足，采用默认"} `);

  // ---- 2. work content direction (LLM-extracted talent areas + skills) ----
  const areas = fw.sign.areas;
  const skills = aggregateSkills(fw.achievements);
  const energyQuadrants = fw.interestMatrix.highEnergyQuadrants;
  const contentDirection = [...new Set([...areas, ...skills, ...energyQuadrants])].slice(0, 4);
  if (contentDirection.length === 0) {
    contentDirection.push("数据积累中——先完成 SIGN 与成就事件萃取");
  }

  // ---- 3. pitfalls (data-driven: bias frequencies + energy volatility) ----
  const avoid: string[] = [];
  const dim = profile.growthTracking.dimensions;
  if ((dim.shouldTyrannyFreq?.currentLevel || 0) > 0.3) {
    avoid.push("应该暴政指数偏高 → 避免高度流程化、缺乏自主空间的工作");
  }
  if ((dim.catastrophizingFreq?.currentLevel || 0) > 0.3) {
    avoid.push("灾难化想象频率较高 → 创业初期建议预留财务缓冲");
  }
  const energyVol = dim.energyClarity?.volatility || 0;
  if (energyVol > 0.2) {
    avoid.push("能量波动较大 → 选择节奏相对可控的环境");
  }
  if (fw.swot.gravityProblems.length > 0) {
    avoid.push("存在已识别的重力问题 → 选择前先接受其作为环境条件");
  }
  if (avoid.length === 0) avoid.push("暂无显著避坑信号（数据积累中）");

  // ---- 4. risk tolerance (data-driven) ----
  const riskProfile =
    fw.swot.gravityProblems.length + fw.swot.anchorProblems.length >= 4
      ? "保守型路径（稳定优先，低风险偏好）"
      : "中等风险耐受（可小步试验，避免孤注一掷）";

  return {
    workForm,
    contentDirection,
    avoid,
    riskProfile,
    reasoning,
  };
}

export function formatCareerReport(c: CareerAnalysis, withNarrative = false): string {
  const lines: string[] = [];
  lines.push("📊 从业分析报告");
  lines.push("");
  lines.push("【工作形态建议】");
  lines.push(`  → ${c.workForm}`);
  for (const r of c.reasoning) lines.push(`    • ${r}`);
  lines.push("");
  lines.push("【工作内容方向】");
  for (const d of c.contentDirection) lines.push(`  → ${d}`);
  lines.push("");
  lines.push("【避坑提醒】");
  for (const a of c.avoid) lines.push(`  • ${a}`);
  lines.push("");
  lines.push(`【风险耐受度】${c.riskProfile}`);
  if (withNarrative && c.llmNarrative) {
    lines.push("");
    lines.push("【LLM 综合评述】");
    lines.push(`  ${c.llmNarrative}`);
  }
  return lines.join("\n");
}
