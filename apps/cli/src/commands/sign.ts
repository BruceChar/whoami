/** delphi — SIGN talent signal detection (standalone command). */
import {
  ProfileStore,
  createSignFlow,
  buildSignResult,
  signAreas,
  afterProfileUpdate,
  markMilestone,
} from "@delphi/core";
import { runFlow } from "./flowRun";
import { c } from "../ui/render";

export async function runSign(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const runner = createSignFlow();
  const ok = await runFlow(runner, {
    title: "天赋信号探测（SIGN）",
    intro: "S 成功 / I 本能 / G 成长 / N 需求——四个信号交叉验证你的天赋领域。",
  });
  if (!ok) return;

  const result = buildSignResult(runner);
  profile.frameworkData.sign.signals = result.signals;
  const areas = signAreas(result);

  console.log(c.cyan("\n天赋信号摘要："));
  for (const [key, label] of [["success", "S 成功"], ["instinct", "I 本能"], ["growth", "G 成长"], ["needs", "N 需求"]] as const) {
    const val = result.signals[key];
    console.log(`  ${label}: ${val ? val.slice(0, 60) : "—"}`);
  }
  if (areas.length > 0) {
    console.log(c.green(`\n✓ 交叉验证到的天赋领域: ${areas.join("、")}`));
  } else {
    console.log(c.yellow("\n（信号还不够具体，下次试试描述具体场景）"));
  }

  markMilestone(profile, "完成 SIGN 天赋探测", `识别领域: ${areas.join("、") || "待细化"}`);
  afterProfileUpdate(profile);
  store.save();
}
