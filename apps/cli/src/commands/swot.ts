/** delphi — SWOT analysis (agent-enhanced). */
import {
  ProfileStore,
  createSwotFlow,
  buildSwotResult,
  afterProfileUpdate,
  markMilestone,
} from "@delphi/core";
import { runFlow } from "./flowRun";
import { c } from "../ui/render";

export async function runSwot(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const runner = createSwotFlow();
  const ok = await runFlow(runner, {
    title: "SWOT 分析（Agent 增强版）",
    intro: "优势阴影检测 / 劣势再框定 / 机会-能力匹配 / 控制圈分离",
  });
  if (!ok) return;

  const result = buildSwotResult(runner);
  profile.frameworkData.swot = {
    strengths: result.strengths,
    weaknesses: result.weaknesses,
    opportunities: result.opportunities,
    threats: result.threats,
    gravityProblems: result.gravityProblems,
    anchorProblems: result.anchorProblems,
  };

  console.log(c.cyan("\nSWOT 摘要："));
  console.log(`  S 优势: ${result.strengths.join("、") || "—"}`);
  console.log(`  W 劣势: ${result.weaknesses.join("、") || "—"}`);
  console.log(`  O 机会: ${result.opportunities.join("、") || "—"}`);
  console.log(`  T 威胁: ${result.threats.join("、") || "—"}`);

  if (result.gravityProblems.length > 0) {
    console.log(c.yellow(`\n🔒 识别到重力问题（不可控，接受为环境条件）: ${result.gravityProblems.join("、")}`));
  }
  if (result.anchorProblems.length > 0) {
    console.log(c.green(`🔧 可锚定问题（可控，可解决）: ${result.anchorProblems.join("、")}`));
  }

  markMilestone(profile, "完成 SWOT 分析", `重力问题 ${result.gravityProblems.length} 个，可解决 ${result.anchorProblems.length} 个`);
  afterProfileUpdate(profile);
  store.save();
}
