/** delphi — daily feedback. */
import {
  ProfileStore,
  createDailyFlow,
  buildDailyEntry,
  afterProfileUpdate,
} from "@delphi/core";
import { runFlow } from "./flowRun";
import { c } from "../ui/render";

export async function runDaily(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const runner = createDailyFlow();
  const ok = await runFlow(runner, {
    title: "每日回馈 · 决策考古",
    intro: "回馈分析法：记录今天的满意与不满意，累积 7/30/90 天后生成决策模式报告。",
  });
  if (!ok) return;

  const entry = buildDailyEntry(runner);
  profile.frameworkData.dailyFeedback.push(entry);

  afterProfileUpdate(profile);
  store.save();

  console.log(c.cyan("\n今日回馈已归档："));
  console.log(`  ✓ 满意: ${entry.satisfied.event || "—"} (${entry.satisfied.reason || "—"})`);
  console.log(`  ✗ 不满意: ${entry.unsatisfied.event || "—"} (${entry.unsatisfied.reason || "—"})`);
  if (entry.themes.length > 0) {
    console.log(`  主题: ${entry.themes.join("、")}`);
  }
  console.log(c.dim(`累计 ${profile.frameworkData.dailyFeedback.length} 条回馈，继续积累将驱动从业分析与能量地图。`));
}
