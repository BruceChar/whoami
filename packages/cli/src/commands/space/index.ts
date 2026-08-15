/**
 * delphi —— 用户空间入口（文档 10.2）
 */
import { ProfileStore } from "@delphi/core";
import { askLine } from "../../ui/ask";
import { c, box } from "../../ui/render";

export async function runSpace(store: ProfileStore, sub?: string): Promise<void> {
  if (sub) {
    const { runDashboard } = await import("./dashboard");
    const { runTimeline } = await import("./timeline");
    const { runArchive } = await import("./archive");
    const { runInsights } = await import("./insights");
    const { runLab } = await import("./lab");
    const { runSettings } = await import("./settings");
    const dispatch: Record<string, () => Promise<void>> = {
      dashboard: () => runDashboard(store),
      timeline: () => runTimeline(store),
      archive: () => runArchive(store),
      insights: () => runInsights(store),
      lab: () => runLab(store),
      settings: () => runSettings(store),
    };
    const fn = dispatch[sub];
    if (fn) {
      await fn();
    } else {
      console.log(c.yellow(`未知子命令: ${sub}`));
    }
    return;
  }

  let running = true;
  while (running) {
    console.log(box(" 🏠 用户空间 —— 你的认知成长记录 ", [
      "[1] 认知仪表盘  — 当前状态一览",
      "[2] 成长时间线  — 你的认知演化轨迹",
      "[3] 思维档案库  — 所有探索记录",
      "[4] 洞察收藏夹  — 重要发现与转折点",
      "[5] 原型实验室  — 人生设计试验记录",
      "[6] 设置与隐私  — 数据管理与导出",
    ], 56));
    const choice = (await askLine("\n> ")).trim();
    switch (choice) {
      case "1": {
        const { runDashboard } = await import("./dashboard");
        await runDashboard(store);
        break;
      }
      case "2": {
        const { runTimeline } = await import("./timeline");
        await runTimeline(store);
        break;
      }
      case "3": {
        const { runArchive } = await import("./archive");
        await runArchive(store);
        break;
      }
      case "4": {
        const { runInsights } = await import("./insights");
        await runInsights(store);
        break;
      }
      case "5": {
        const { runLab } = await import("./lab");
        await runLab(store);
        break;
      }
      case "6": {
        const { runSettings } = await import("./settings");
        await runSettings(store);
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
