/** delphi — thinking archive. */
import { ProfileStore } from "@delphi/core";
import { c, box, hr } from "../../ui/render";

export async function runArchive(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const fw = profile.frameworkData;

  console.log(c.cyan("\n📚 思维档案库 —— 所有探索记录"));
  console.log(hr(58));

  console.log("\n【每日回馈】");
  console.log(`  ${fw.dailyFeedback.length} 条记录`);
  for (const e of fw.dailyFeedback.slice(-3)) {
    console.log(`  • ${e.date}: ${e.satisfied.event?.slice(0, 30) || "—"} / ${e.unsatisfied.event?.slice(0, 30) || "—"}`);
  }

  console.log("\n【V-T-D 价值观】");
  console.log(`  锚点: ${fw.vtd.values.anchors.join("、") || "—"}`);
  console.log(`  冲突: ${fw.vtd.values.conflicts.join("、") || "—"}`);
  console.log(`  内驱源: ${fw.vtd.dreams.pureDrives.join("、") || "—"}`);

  console.log("\n【SIGN 天赋信号】");
  for (const [key, label] of [["success", "S"], ["instinct", "I"], ["growth", "G"], ["needs", "N"]] as const) {
    const val = fw.sign.signals[key];
    if (val) console.log(`  ${label}: ${val.slice(0, 50)}`);
  }
  if (!Object.values(fw.sign.signals).some((v) => v)) console.log("  （未完成 SIGN 探测）");

  console.log("\n【SWOT】");
  console.log(`  优势: ${fw.swot.strengths.join("、") || "—"}`);
  console.log(`  劣势: ${fw.swot.weaknesses.join("、") || "—"}`);
  console.log(`  机会: ${fw.swot.opportunities.join("、") || "—"}`);
  console.log(`  威胁: ${fw.swot.threats.join("、") || "—"}`);

  console.log("\n【成就事件】");
  console.log(`  ${fw.achievements.length} 个事件`);
  for (const a of fw.achievements) {
    console.log(`  • ${a.star.situation?.slice(0, 40) || "—"} [技能: ${a.skills.join("、") || "—"}]`);
  }

  console.log("\n【兴趣矩阵】");
  console.log(`  高能象限: ${fw.interestMatrix.highEnergyQuadrants.join("、") || "—"}`);

  console.log("\n【会话】");
  console.log(`  ${profile.sessions.length} 次会话`);
  for (const s of profile.sessions.slice(-5).reverse()) {
    const userMsgs = s.messages.filter((m) => m.role === "user").length;
    console.log(`  • ${s.startedAt.slice(0, 16).replace("T", " ")}  [${s.mode}] ${userMsgs} 条输入 ${s.title ? "- " + s.title : ""}`);
  }
  console.log(hr(58));
}
