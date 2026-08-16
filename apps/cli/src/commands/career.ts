/** delphi — career analysis (employment vs startup fit / content direction). */
import {
  ProfileStore,
  canAnalyzeCareer,
  buildCareerAnalysis,
  formatCareerReport,
  afterProfileUpdate,
  getLLMProvider,
  llmRefineCareer,
} from "@delphi/core";
import { c } from "../ui/render";

export async function runCareer(store: ProfileStore): Promise<void> {
  const profile = store.get();

  if (!canAnalyzeCareer(profile)) {
    console.log(c.yellow("\n📊 从业分析需要更多数据支撑。"));
    console.log(c.dim("建议先完成（任选其一）："));
    console.log(c.dim("  [v] V-T-D 价值观探索  → 明确你在乎什么"));
    console.log(c.dim("  [d] 每日回馈（≥3 次） → 看你的能量流向"));
    console.log(c.dim("  [a] 成就事件萃取      → 萃取可迁移技能"));
    console.log(c.dim("  [t] SIGN 天赋探测     → 识别天赋领域"));
    return;
  }

  const report = buildCareerAnalysis(profile);

    // LLM review enhancement
  const llm = getLLMProvider();
  if (llm) {
    console.log(c.dim("\n⚡ 正在生成从业分析评述（LLM）..."));
    try {
      const refined = await llmRefineCareer(llm, profile, report);
      if (refined) {
        report.llmNarrative = refined.narrative;
        for (const d of refined.extraDirections) {
          if (!report.contentDirection.includes(d)) report.contentDirection.push(d);
        }
        for (const a of refined.extraAvoid) {
          if (!report.avoid.includes(a)) report.avoid.push(a);
        }
      }
    } catch (err) {
      console.log(c.dim(`  ↳ 评述生成失败（规则分析仍可用）: ${(err as Error).message.slice(0, 80)}`));
    }
  }

  profile.analysisOutputs.careerAnalysis = report;
  afterProfileUpdate(profile);
  store.save();

  console.log("\n" + formatCareerReport(report, true));
  console.log(c.dim("\n（已保存到档案，数据更新后自动重算）"));
}
