/**
 * delphi —— 人生设计（Connect The Dots / 多重人生 / 原型设计）
 */
import {
  ProfileStore,
  buildLifeDesign,
  formatLifeDesign,
  MULTIPLE_LIVES_STEPS,
  detectCommonElements,
  afterProfileUpdate,
} from "@delphi/core";
import { askLine, EOF_INPUT } from "../ui/ask";
import { c, section } from "../ui/render";

export async function runLifeDesign(store: ProfileStore): Promise<void> {
  const profile = store.get();
  let running = true;

  while (running) {
    const design = buildLifeDesign(profile);
    console.log("\n" + formatLifeDesign(design));

    console.log("");
    console.log("[1] 多重人生推演  [2] 添加原型试验  [3] 原型实验室  [q] 返回");
    const choice = await askLine("> ");
    if (choice === EOF_INPUT) break;
    switch (choice.trim().toLowerCase()) {
      case "1":
        await runMultipleLives(store);
        break;
      case "2":
        await runAddPrototype(store);
        break;
      case "3": {
        const { runLab } = await import("./space/lab");
        await runLab(store);
        break;
      }
      case "q":
        running = false;
        break;
      default:
        console.log(c.dim("无效选择"));
    }
  }
}

/** 多重人生推演（文档 6.4） */
async function runMultipleLives(store: ProfileStore): Promise<void> {
  const profile = store.get();
  console.log("");
  console.log(section("多重人生假设"));
  const answers: Record<string, string> = {};
  for (const step of MULTIPLE_LIVES_STEPS) {
    console.log(c.cyan(`\n【${step.title}】${step.prompt}`));
    answers[step.id] = await askLine("> ");
  }
  const common = detectCommonElements(answers);
  if (profile.analysisOutputs.lifeDesign) {
    profile.analysisOutputs.lifeDesign.multipleLives = {
      commonElements: common,
      coreDrive: common[0] || "尚未找到稳定内驱核心",
    };
  }
  console.log(c.cyan("\n三种构想共同元素（无论条件怎么变你都想要的）："));
  console.log(common.length > 0 ? `  ◈ ${common.join("、")}` : c.yellow("  （暂未发现共同元素，可再推演一次）"));
  afterProfileUpdate(profile);
  store.save();
}

/** 添加原型试验（文档 6.5 原型设计） */
async function runAddPrototype(store: ProfileStore): Promise<void> {
  const profile = store.get();
  console.log("");
  console.log(section("原型设计 · 做一点试试看"));
  console.log(c.dim("不是想清楚再做，而是「做一点试试看」。四个原则：Ask questions / Expose assumptions / Involve others / Sneak up on the future"));

  const idea = await askLine("原型想法（要做什么小试验）> ");
  if (!idea) return;
  const assumptionsRaw = await askLine("隐含假设（逗号分隔，比如：别人会需要这个）> ");
  const assumptions = assumptionsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean);

  profile.prototypes.push({
    id: `proto-${Date.now()}`,
    createdAt: new Date().toISOString(),
    idea,
    assumptions: assumptions.length ? assumptions : ["（未记录假设）"],
    actions: [],
    status: "unverified",
    reflection: "",
  });
  afterProfileUpdate(profile);
  store.save();
  console.log(c.green(`\n✓ 原型试验已记录：${idea}`));
}
