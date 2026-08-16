/** delphi — main menu (startup scene). */
import { ProfileStore, AnalysisMode } from "@delphi/core";
import { askLine, EOF_INPUT } from "../ui/ask";
import { c, box, hr } from "../ui/render";

export async function runMenu(store: ProfileStore, quiet = false): Promise<void> {
  if (!quiet) {
    console.log("");
    console.log("🪞 delphi —— 一面照向内心的镜子。");
    console.log(c.dim("我不会告诉你答案，但我会帮你看见你是怎么想的。"));
    console.log("");
  }

  let running = true;
  while (running) {
    console.log(box(" 日常 ", [
      "  [d] 每日回馈（记录今天的满意与不满意）",
      "  [f] 自由对话（随便聊聊，后台默默分析）",
    ], 56));
    console.log(box(" 深度探索 ", [
      "  [v] 价值观-天赋-梦想（V-T-D）",
      "  [t] 天赋信号探测（SIGN）",
      "  [s] SWOT分析",
      "  [a] 成就事件萃取",
    ], 56));
    console.log(box(" 方向与决策 ", [
      "  [c] 从业分析（适合上班还是创业？）",
      "  [l] 人生设计（Connect The Dots / 原型设计）",
      "  [m] 兴趣矩阵",
    ], 56));
    console.log(box(" 你的空间 ", [
      "  [p] 进入用户空间（成长曲线、思维档案、洞察收藏）",
      "  [o] 查看个人画像（我是谁？）",
      "  [e] 导出数据",
    ], 56));
    console.log(c.dim("  [q] 退出"));

    const raw = await askLine("\n> ");
    if (raw === EOF_INPUT) break; // 管道输入耗尽 → 退出
    const choice = raw.trim().toLowerCase();
    switch (choice) {
      case "d": {
        const { runDaily } = await import("./daily");
        await runDaily(store);
        break;
      }
      case "f": {
        const { runChat } = await import("./chat");
        await runChat(store);
        break;
      }
      case "v": {
        const { runVtd } = await import("./vtd");
        await runVtd(store);
        break;
      }
      case "t": {
        const { runSign } = await import("./sign");
        await runSign(store);
        break;
      }
      case "s": {
        const { runSwot } = await import("./swot");
        await runSwot(store);
        break;
      }
      case "a": {
        const { runAchievement } = await import("./achievement");
        await runAchievement(store);
        break;
      }
      case "c": {
        const { runCareer } = await import("./career");
        await runCareer(store);
        break;
      }
      case "l": {
        const { runLifeDesign } = await import("./lifeDesign");
        await runLifeDesign(store);
        break;
      }
      case "m": {
        const { runInterest } = await import("./interest");
        await runInterest(store);
        break;
      }
      case "p": {
        const { runSpace } = await import("./space");
        await runSpace(store);
        break;
      }
      case "o": {
        const { runPersona } = await import("./persona");
        await runPersona(store);
        break;
      }
      case "e": {
        const dest = store.exportJson();
        console.log(c.green(`✓ 档案已导出: ${dest}`));
        break;
      }
      case "q":
        running = false;
        break;
      default:
        console.log(c.dim("无效选择，输入菜单字母即可"));
    }
  }
}
