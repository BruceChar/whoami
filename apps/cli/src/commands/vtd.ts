/** delphi — full V-T-D flow (values -> talent -> dream). */
import {
  ProfileStore,
  createVFlow,
  buildVResult,
  createDFlow,
  buildDResult,
  createSignFlow,
  buildSignResult,
  afterProfileUpdate,
  markMilestone,
  requireLLMProvider,
} from "@delphi/core";
import { runFlow } from "./flowRun";
import { askLine } from "../ui/ask";
import { c } from "../ui/render";

export async function runVtd(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const llm = requireLLMProvider();

    // ---- V values ----
  const vRunner = createVFlow();
  const vOk = await runFlow(vRunner, {
    title: "V · 价值观探索（5 题）",
    intro: "回答没有对错，越具体越好。完成 5 题后我会提取你的价值观锚点。",
  });
  if (!vOk) return;
  const v = await buildVResult(vRunner, llm);
  profile.frameworkData.vtd.values.anchors = v.anchors;
  profile.frameworkData.vtd.values.conflicts = v.conflicts;

  console.log(c.cyan("\n提取到的价值观锚点："));
  if (v.anchors.length === 0) {
    console.log(c.yellow("  （未检测到明确锚点——试试用更具体的词描述，比如「自由」、「创造」）"));
  } else {
    for (const a of v.anchors) console.log(`  ◈ ${a}`);
  }
  if (v.conflicts.length > 0) {
    console.log(c.yellow("检测到价值观张力："));
    for (const conflict of v.conflicts) console.log(`  ⚠ ${conflict}`);
  }

    // ---- T talent (SIGN linkage) ----
  const tRunner = createSignFlow();
  await runFlow(tRunner, {
    title: "T · 天赋探测（SIGN 模型）",
    intro: "S 成功 / I 本能 / G 成长 / N 需求——四个信号交叉验证你的天赋领域。",
  });
  const sign = await buildSignResult(tRunner, llm);
  profile.frameworkData.sign.signals = sign.signals;

    // ---- D dream (motive purification) ----
  const dRunner = createDFlow();
  const dOk = await runFlow(dRunner, {
    title: "D · 梦想探索（动机净化）",
    intro: "找出「即使没人认可、不赚钱也愿意做」的事——那是你的内驱源。",
  });
  if (!dOk) return;
  const d = await buildDResult(dRunner, llm);
  profile.frameworkData.vtd.dreams.pureDrives = d.pureDrives;
  profile.frameworkData.vtd.dreams.externalMotivesFiltered = d.externalMotivesFiltered;

  if (d.pureDrives.length > 0) {
    console.log(c.green(`\n✓ 检测到内驱源: ${d.pureDrives.join("、")}`));
  } else {
    console.log(c.yellow("\n（未检测到明确内驱源，多描述具体动作试试，比如「写、画、教、研究」）"));
  }
  if (d.externalMotivesFiltered.length > 0) {
    console.log(c.dim(`已过滤的外部动机信号: ${d.externalMotivesFiltered.join("、")}`));
  }

  markMilestone(profile, "完成 V-T-D 探索", `价值观锚点 ${v.anchors.length} 个，内驱源 ${d.pureDrives.length} 个`);
  afterProfileUpdate(profile);
  store.save();

  const again = await askLine(c.dim("\n是否立即查看更新后的画像？[y/N] "));
  if (again.toLowerCase() === "y") {
    const { runPersona } = await import("./persona");
    await runPersona(store);
  }
}
