/** delphi — insights collection. */
import { ProfileStore, newInsightId } from "@delphi/core";
import { askLine, EOF_INPUT } from "../../ui/ask";
import { c, box } from "../../ui/render";

export async function runInsights(store: ProfileStore): Promise<void> {
  const profile = store.get();
  let running = true;

  while (running) {
    renderInsights(profile);
    console.log("");
    console.log("[1] 添加洞察  [2] 添加备注  [3] 删除  [q] 返回");
    const choice = await askLine("> ");
    if (choice === EOF_INPUT) break;
    switch (choice.trim().toLowerCase()) {
      case "1":
        await addInsight(store);
        break;
      case "2":
        await editNote(store);
        break;
      case "3":
        await removeInsight(store);
        break;
      case "q":
        running = false;
        break;
      default:
        console.log(c.dim("无效选择"));
    }
  }
}

function renderInsights(profile: import("@delphi/core").UserCognitiveProfile): void {
  console.log(c.cyan("\n⭐ 洞察收藏夹"));
  if (profile.insights.length === 0) {
    console.log(c.dim("  暂无洞察。Agent 会自动检测重要发现，你也可以手动收藏。"));
    return;
  }
  profile.insights.slice(-8).reverse().forEach((ins, idx) => {
    console.log(box(` ${profile.insights.length - idx} `, [
      `时间: ${ins.timestamp.slice(0, 10)} | 来源: ${ins.source}`,
      `片段: ${ins.quote.slice(0, 50)}`,
      `解读: ${ins.analysis}`,
      ins.note ? `备注: ${ins.note}` : "",
      ins.tags.length ? `标签: ${ins.tags.join(", ")}` : "",
    ].filter(Boolean), 56));
    console.log("");
  });
}

async function addInsight(store: ProfileStore): Promise<void> {
  const profile = store.get();
  console.log(c.dim("\n（收藏一条对你重要的发现）"));
  const quote = await askLine("原始片段/想法 > ");
  if (!quote) return;
  const analysis = await askLine("delphi 的解读（可留空）> ");
  const tagsRaw = await askLine("标签（逗号分隔）> ");

  profile.insights.push({
    id: newInsightId(),
    timestamp: new Date().toISOString(),
    source: "manual",
    quote,
    analysis: analysis || "（用户手动收藏）",
    note: "",
    tags: tagsRaw.split(/[,，]/).map((s) => s.trim()).filter(Boolean),
    userMarked: true,
    agentDetected: false,
  });
  store.save();
  console.log(c.green("✓ 洞察已收藏"));
}

async function editNote(store: ProfileStore): Promise<void> {
  const profile = store.get();
  if (profile.insights.length === 0) return;
  const idxRaw = await askLine("要编辑的洞察序号 > ");
  const idx = parseInt(idxRaw, 10);
  const ins = profile.insights[profile.insights.length - idx];
  if (!ins) {
    console.log(c.yellow("序号无效"));
    return;
  }
  const note = await askLine("个人备注 > ");
  ins.note = note;
  store.save();
  console.log(c.green("✓ 备注已保存"));
}

async function removeInsight(store: ProfileStore): Promise<void> {
  const profile = store.get();
  if (profile.insights.length === 0) return;
  const idxRaw = await askLine("要删除的洞察序号 > ");
  const idx = parseInt(idxRaw, 10);
  const target = profile.insights[profile.insights.length - idx];
  if (!target) {
    console.log(c.yellow("序号无效"));
    return;
  }
  profile.insights = profile.insights.filter((i) => i.id !== target.id);
  store.save();
  console.log(c.green("✓ 已删除"));
}
