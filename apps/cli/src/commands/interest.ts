/** delphi — interest matrix. */
import {
  ProfileStore,
  createInterestFlow,
  buildInterestMatrix,
  QUADRANTS,
  afterProfileUpdate,
} from "@delphi/core";
import { runFlow } from "./flowRun";
import { c } from "../ui/render";

export async function runInterest(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const runner = createInterestFlow();
  const ok = await runFlow(runner, {
    title: "兴趣矩阵",
    intro: "为四类活动打分（0-5），找到你的高能区域。",
  });
  if (!ok) return;

  const result = buildInterestMatrix(runner);
  profile.frameworkData.interestMatrix = {
    highEnergyQuadrants: result.highEnergyQuadrants,
    conflicts: result.conflicts,
    rating: result.rating,
  };

  console.log(c.cyan("\n兴趣矩阵："));
  console.log(`  创造性 ${result.rating.creative}/5  |  分析性 ${result.rating.analytical}/5`);
  console.log(`  独立性 ${result.rating.independent}/5  |  社交性 ${result.rating.social}/5`);
  console.log(`  高能象限: ${result.highEnergyQuadrants.join("、")}`);
  if (result.conflicts.length > 0) {
    console.log(c.yellow("冲突检测:"));
    for (const conflict of result.conflicts) console.log(`  ⚠ ${conflict}`);
  }

  afterProfileUpdate(profile);
  store.save();
}
