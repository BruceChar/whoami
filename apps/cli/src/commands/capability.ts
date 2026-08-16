/**
 * delphi — core capability model command.
 */
import {
  ProfileStore,
  createCapabilityFlow,
  buildCapabilityResult,
  capabilityFields,
  afterProfileUpdate,
  markMilestone,
  requireLLMProvider,
} from "@delphi/core";
import { runFlow } from "./flowRun";
import { askLine, EOF_INPUT } from "../ui/ask";
import { c } from "../ui/render";

export async function runCapability(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const llm = requireLLMProvider();

  console.log(c.cyan("\n可选领域: " + capabilityFields().join(" / ")));
  const field = await askLine("目标领域 > ");
  if (field === EOF_INPUT || !field.trim()) {
    console.log(c.dim("已取消。"));
    return;
  }

  const runner = createCapabilityFlow(field.trim());
  const ok = await runFlow(runner, {
    title: "核心能力模型",
    intro: "为每个核心能力自评 0-5 分，随后与你的成就事件/SIGN 档案交叉验证。",
  });
  if (!ok) return;

  const result = await buildCapabilityResult(profile, runner, llm, field.trim());
  profile.frameworkData.capability = result;

  console.log(c.cyan(`\n「${result.field}」能力画像：`));
  for (const r of result.ratings) {
    const bar = "█".repeat(r.score) + "░".repeat(5 - r.score);
    console.log(`  ${r.capability.padEnd(8)} ${bar} ${r.score}/5`);
  }
  if (result.hiddenStrengths.length > 0) {
    console.log(c.green(`\n✓ 交叉验证发现「你以为没有、其实有」的能力: ${result.hiddenStrengths.join("、")}`));
  }
  console.log(c.dim(`  优势(≥4): ${result.strengths.join("、") || "—"}`));
  console.log(c.dim(`  差距(≤2): ${result.gaps.join("、") || "—"}`));

  markMilestone(profile, "完成核心能力模型", `领域 ${result.field}`);
  afterProfileUpdate(profile);
  store.save();
}
