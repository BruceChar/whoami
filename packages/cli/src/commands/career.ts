/**
 * delphi —— 从业分析（上班 vs 创业适配度 / 工作内容方向）
 */
import {
  ProfileStore,
  canAnalyzeCareer,
  buildCareerAnalysis,
  formatCareerReport,
  afterProfileUpdate,
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
  profile.analysisOutputs.careerAnalysis = report;
  afterProfileUpdate(profile);
  store.save();

  console.log("\n" + formatCareerReport(report));
  console.log(c.dim("\n（已保存到档案，数据更新后自动重算）"));
}
