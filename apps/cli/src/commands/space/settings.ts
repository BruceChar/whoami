/** delphi — settings & privacy. */
import { ProfileStore, AnalysisMode } from "@delphi/core";
import { askLine, EOF_INPUT } from "../../ui/ask";
import { c, box } from "../../ui/render";
import * as fs from "fs";

export async function runSettings(store: ProfileStore): Promise<void> {
  const profile = store.get();
  let running = true;

  while (running) {
    console.log(c.cyan("\n⚙️ 设置与隐私"));
    console.log(box("", [
      `数据目录: ${profile.settings.dataDir}`,
      `默认模式: ${profile.settings.defaultMode}`,
      `偏差敏感度: ${profile.settings.biasSensitivity}`,
      `练习效应校正: ${profile.settings.practiceEffectCorrection ? "开" : "关"}`,
      `转折点自动检测: ${profile.settings.autoDetectInflections ? "开" : "关"}`,
      `会话数: ${profile.sessions.length} | 洞察: ${profile.insights.length} | 原型: ${profile.prototypes.length}`,
    ], 56));
    console.log("");
    console.log("[1] 导出档案 JSON  [2] 备份  [3] 导入  [4] 切换默认模式  [5] 切换偏差敏感度  [6] 清空数据  [q] 返回");
    const choice = await askLine("> ");
    if (choice === EOF_INPUT) break;
    switch (choice.trim().toLowerCase()) {
      case "1": {
        const dest = store.exportJson();
        console.log(c.green(`✓ 已导出: ${dest}`));
        break;
      }
      case "2": {
        const dest = store.backup();
        console.log(c.green(`✓ 已备份: ${dest}`));
        break;
      }
      case "3": {
        const file = await askLine("导入文件路径 > ");
        if (file && fs.existsSync(file)) {
          store.importJson(file);
          console.log(c.green("✓ 已导入并保存"));
        } else {
          console.log(c.yellow("文件不存在"));
        }
        break;
      }
      case "4": {
        const modes: AnalysisMode[] = ["stealth", "transparent", "meta_guide"];
        console.log(c.dim("[1] 隐式 [2] 显式 [3] 引导式"));
        const m = parseInt((await askLine("> ")).trim(), 10);
        if (modes[m - 1]) {
          profile.settings.defaultMode = modes[m - 1];
          store.save();
          console.log(c.green(`✓ 默认模式已切换为 ${modes[m - 1]}`));
        }
        break;
      }
      case "5": {
        const s = (await askLine("敏感度 [low/medium/high] > ")).trim();
        if (["low", "medium", "high"].includes(s)) {
          profile.settings.biasSensitivity = s as "low" | "medium" | "high";
          store.save();
          console.log(c.green(`✓ 敏感度已切换为 ${s}`));
        }
        break;
      }
      case "6": {
        const confirm = await askLine(c.red("⚠ 确认清空全部数据？输入 yes 确认 > "));
        if (confirm === "yes") {
          store.reset();
          console.log(c.green("✓ 数据已清空"));
        } else {
          console.log(c.dim("已取消"));
        }
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
