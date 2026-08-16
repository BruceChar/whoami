/** delphi — achievement event extraction (STAR deep mining). */
import {
  ProfileStore,
  createAchievementFlow,
  buildAchievement,
  afterProfileUpdate,
  markMilestone,
} from "@delphi/core";
import { runFlow } from "./flowRun";
import { c } from "../ui/render";

export async function runAchievement(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const runner = createAchievementFlow();
  const ok = await runFlow(runner, {
    title: "成就事件萃取（STAR）",
    intro: "S 情境 / T 任务 / A 行动 / R 结果 —— 挖出你「以为没有、其实有」的能力。",
  });
  if (!ok) return;

  const { entry, skills } = buildAchievement(runner);
  profile.frameworkData.achievements.push(entry);

  console.log(c.cyan("\n成就事件已归档："));
  console.log(`  • ${entry.star.situation?.slice(0, 60) || "—"}`);
  console.log(`  • 行动: ${entry.star.action?.slice(0, 60) || "—"}`);
  console.log(`  • 能量感: ${entry.energyLevel === "high" ? "高 ⚡" : entry.energyLevel === "low" ? "低 🪫" : "中"}`);
  if (skills.length > 0) {
    console.log(c.green(`  • 萃取技能: ${skills.join("、")}`));
  } else {
    console.log(c.yellow("  • （未萃取到明确技能，描述具体动作试试）"));
  }

  markMilestone(profile, "完成成就事件萃取", `技能: ${skills.join("、") || "待细化"}`);
  afterProfileUpdate(profile);
  store.save();
}
