/**
 * delphi —— 原型实验室（文档 7.6）
 */
import { ProfileStore } from "@delphi/core";
import { askLine } from "../../ui/ask";
import { c, box } from "../../ui/render";

const STATUS_LABEL = { unverified: "待验证", confirmed: "✓ 证实", refuted: "✗ 证伪" } as const;

export async function runLab(store: ProfileStore): Promise<void> {
  const profile = store.get();
  let running = true;

  while (running) {
    renderLab(profile);
    console.log("");
    console.log("[1] 添加试验  [2] 记录行动  [3] 标记结果  [4] 反思  [q] 返回");
    const choice = await askLine("> ");
    switch (choice.trim().toLowerCase()) {
      case "1":
        await addTrial(store);
        break;
      case "2":
        await addAction(store);
        break;
      case "3":
        await markStatus(store);
        break;
      case "4":
        await addReflection(store);
        break;
      case "q":
        running = false;
        break;
      default:
        console.log(c.dim("无效选择"));
    }
  }
}

function renderLab(profile: import("@delphi/core").UserCognitiveProfile): void {
  console.log(c.cyan("\n🧪 原型实验室 —— 人生设计试验记录"));
  if (profile.prototypes.length === 0) {
    console.log(c.dim("  暂无原型试验。行动原则：Ask questions / Try stuff / 小步快跑。"));
    return;
  }
  profile.prototypes.forEach((p, i) => {
    const done = p.actions.filter((a) => a.done).length;
    console.log(box(` 原型 ${i + 1}: ${STATUS_LABEL[p.status]} `, [
      `想法: ${p.idea}`,
      `假设: ${p.assumptions.join("；")}`,
      `行动: ${done}/${p.actions.length} 步完成`,
      p.actions.map((a) => `  ${a.done ? "☑" : "☐"} ${a.step}${a.result ? " → " + a.result : ""}`).join("\n"),
      p.reflection ? `反思: ${p.reflection}` : "",
    ].filter(Boolean), 58));
    console.log("");
  });
}

async function addTrial(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const idea = await askLine("原型想法 > ");
  if (!idea) return;
  const assumptionsRaw = await askLine("假设（逗号分隔）> ");
  profile.prototypes.push({
    id: `proto-${Date.now()}`,
    createdAt: new Date().toISOString(),
    idea,
    assumptions: assumptionsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    actions: [],
    status: "unverified",
    reflection: "",
  });
  store.save();
  console.log(c.green("✓ 试验已添加"));
}

async function pick(store: ProfileStore, prompt: string): Promise<number | null> {
  const profile = store.get();
  if (profile.prototypes.length === 0) {
    console.log(c.yellow("暂无试验"));
    return null;
  }
  const raw = await askLine(prompt);
  const idx = parseInt(raw, 10);
  if (!profile.prototypes[idx - 1]) {
    console.log(c.yellow("序号无效"));
    return null;
  }
  return idx - 1;
}

async function addAction(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const idx = await pick(store, "选择原型序号 > ");
  if (idx === null) return;
  const step = await askLine("行动步骤 > ");
  if (!step) return;
  profile.prototypes[idx].actions.push({ step, done: false });
  store.save();
  console.log(c.green("✓ 行动已记录"));
}

async function markStatus(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const idx = await pick(store, "选择原型序号 > ");
  if (idx === null) return;
  console.log("[1] 证实  [2] 证伪  [3] 仍待验证");
  const raw = await askLine("结果 > ");
  const status = raw === "1" ? "confirmed" : raw === "2" ? "refuted" : "unverified";
  profile.prototypes[idx].status = status;
  if (status !== "unverified") {
    const result = await askLine("结果详情 > ");
    profile.prototypes[idx].actions.push({ step: "结果记录", done: true, result });
  }
  store.save();
  console.log(c.green("✓ 状态已更新"));
}

async function addReflection(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const idx = await pick(store, "选择原型序号 > ");
  if (idx === null) return;
  const reflection = await askLine("反思（这次试验带来了什么新认知？）> ");
  profile.prototypes[idx].reflection = reflection;
  store.save();
  console.log(c.green("✓ 反思已保存"));
}
