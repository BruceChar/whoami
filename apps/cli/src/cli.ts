/**
 * delphi —— Commander 命令入口
 */
import { Command } from "commander";
import { ProfileStore, requireLLMProvider, LLMNotConfiguredError, getConfigStatus, llmConfigHelp, configFilePath } from "@delphi/core";
import { closeRl } from "./ui/ask";
import { c } from "./ui/render";

const pkg = require("../package.json");

function preflight(argv: string[]): void {
  const args = argv.slice(2);
  const isHelp = args.includes("--help") || args.includes("-h");
  const isVersion = args.includes("--version") || args.includes("-V");
  const isDoctor = args[0] === "doctor" || args[0] === "status";
  if (isHelp || isVersion || isDoctor) return;
  try {
    requireLLMProvider();
  } catch (err) {
    if (err instanceof LLMNotConfiguredError) {
      console.log(err.message);
      process.exit(1);
    }
    throw err;
  }
}

export async function main(argv: string[]): Promise<void> {
  preflight(argv);
  const program = new Command();

  program
    .name("delphi")
    .description("delphi —— 一面照向内心的镜子。自我认知 Agent（CLI 本地模式，需配置 LLM API Key）")
    .version(pkg.version);

  // 无参数：进入主菜单（交互）
  program.action(async () => {
    const store = new ProfileStore();
    const { runMenu } = await import("./commands/menu");
    await runMenu(store);
    closeRl();
  });

  // 自由对话
  program
    .command("chat")
    .description("自由对话（隐式/显式/引导式模式切换）")
    .option("-m, --mode <mode>", "初始模式: stealth|transparent|guide", "stealth")
    .action(async (opts: { mode: string }) => {
      const store = new ProfileStore();
      const { runChat } = await import("./commands/chat");
      const modeMap: Record<string, import("@delphi/core").AnalysisMode> = {
        stealth: "stealth", transparent: "transparent", guide: "meta_guide",
      };
      await runChat(store, { mode: modeMap[opts.mode] || "stealth" });
    });

  // 每日回馈
  program
    .command("daily")
    .alias("d")
    .description("每日回馈（回馈分析法）")
    .action(async () => {
      const store = new ProfileStore();
      const { runDaily } = await import("./commands/daily");
      await runDaily(store);
      closeRl();
    });

  // V-T-D
  program
    .command("vtd")
    .alias("v")
    .description("价值观-天赋-梦想（V-T-D 完整流程）")
    .action(async () => {
      const store = new ProfileStore();
      const { runVtd } = await import("./commands/vtd");
      await runVtd(store);
      closeRl();
    });

  // SIGN
  program
    .command("sign")
    .alias("t")
    .description("天赋信号探测（SIGN）")
    .action(async () => {
      const store = new ProfileStore();
      const { runSign } = await import("./commands/sign");
      await runSign(store);
      closeRl();
    });

  // SWOT
  program
    .command("swot")
    .alias("s")
    .description("SWOT 分析（Agent 增强版）")
    .action(async () => {
      const store = new ProfileStore();
      const { runSwot } = await import("./commands/swot");
      await runSwot(store);
      closeRl();
    });

  // 成就事件
  program
    .command("achievement")
    .alias("a")
    .description("成就事件萃取（STAR）")
    .action(async () => {
      const store = new ProfileStore();
      const { runAchievement } = await import("./commands/achievement");
      await runAchievement(store);
      closeRl();
    });

  // 兴趣矩阵
  program
    .command("interest")
    .alias("m")
    .description("兴趣矩阵（四象限能量评分）")
    .action(async () => {
      const store = new ProfileStore();
      const { runInterest } = await import("./commands/interest");
      await runInterest(store);
      closeRl();
    });

  // 从业分析
  program
    .command("career")
    .alias("c")
    .description("从业分析（上班 vs 创业适配度）")
    .action(async () => {
      const store = new ProfileStore();
      const { runCareer } = await import("./commands/career");
      await runCareer(store);
      closeRl();
    });

  // 人生设计
  program
    .command("life")
    .alias("l")
    .description("人生设计（Connect The Dots / 多重人生 / 原型）")
    .action(async () => {
      const store = new ProfileStore();
      const { runLifeDesign } = await import("./commands/lifeDesign");
      await runLifeDesign(store);
      closeRl();
    });

  // 个人画像
  program
    .command("persona")
    .alias("o")
    .description("查看个人画像（我是谁？）")
    .action(async () => {
      const store = new ProfileStore();
      const { runPersona } = await import("./commands/persona");
      await runPersona(store);
      closeRl();
    });

  // 用户空间
  const space = program
    .command("space")
    .alias("p")
    .description("进入用户空间（认知成长记录）");
  space
    .command("dashboard")
    .description("认知仪表盘")
    .action(async () => {
      const store = new ProfileStore();
      const { runSpace } = await import("./commands/space");
      await runSpace(store, "dashboard");
      closeRl();
    });
  space
    .command("timeline")
    .description("成长时间线")
    .action(async () => {
      const store = new ProfileStore();
      const { runSpace } = await import("./commands/space");
      await runSpace(store, "timeline");
      closeRl();
    });
  space
    .command("archive")
    .description("思维档案库")
    .action(async () => {
      const store = new ProfileStore();
      const { runSpace } = await import("./commands/space");
      await runSpace(store, "archive");
      closeRl();
    });
  space
    .command("insights")
    .description("洞察收藏夹")
    .action(async () => {
      const store = new ProfileStore();
      const { runSpace } = await import("./commands/space");
      await runSpace(store, "insights");
      closeRl();
    });
  space
    .command("lab")
    .description("原型实验室")
    .action(async () => {
      const store = new ProfileStore();
      const { runSpace } = await import("./commands/space");
      await runSpace(store, "lab");
      closeRl();
    });
  space
    .command("settings")
    .description("设置与隐私")
    .action(async () => {
      const store = new ProfileStore();
      const { runSpace } = await import("./commands/space");
      await runSpace(store, "settings");
      closeRl();
    });
  space.action(async () => {
    const store = new ProfileStore();
    const { runSpace } = await import("./commands/space");
    await runSpace(store);
    closeRl();
  });

  // 数据导出
  program
    .command("export")
    .alias("e")
    .description("导出档案 JSON")
    .action(async () => {
      const store = new ProfileStore();
      const dest = store.exportJson();
      console.log(c.green(`✓ 档案已导出: ${dest}`));
      closeRl();
    });

  // 重置
  program
    .command("reset")
    .description("清空全部数据（危险操作，需确认）")
    .action(async () => {
      const store = new ProfileStore();
      const { askLine } = await import("./ui/ask");
      const confirm = await askLine(c.red("⚠ 确认清空全部数据？输入 yes 确认 > "));
      if (confirm === "yes") {
        store.reset();
        console.log(c.green("✓ 数据已清空"));
      } else {
        console.log(c.dim("已取消"));
      }
      closeRl();
    });

  // 状态
  program
    .command("status")
    .description("查看数据目录与会话统计")
    .action(async () => {
      const store = new ProfileStore();
      const profile = store.get();
      console.log(`数据目录: ${profile.settings.dataDir}`);
      console.log(`会话: ${profile.sessions.length} 次 | 洞察: ${profile.insights.length} | 原型: ${profile.prototypes.length}`);
      console.log(`成长阶段: ${profile.growthTracking.growthStage}`);
      console.log(`画像版本: ${profile.currentPersona ? profile.currentPersona.version : "（未生成）"}`);
      closeRl();
    });

  // 配置检查（不需要 API Key 也能运行）
  program
    .command("doctor")
    .description("检查 LLM 配置状态（API Key / 提供商 / 模型）")
    .action(async () => {
      const store = new ProfileStore();
      const status = getConfigStatus(store.dataDir);
      console.log(c.cyan("\n🔍 delphi 配置检查"));
      console.log(`  数据目录: ${store.dataDir}`);
      if (!status.configured) {
        console.log(c.red(`  LLM: 未配置 ✗`));
        console.log("");
        console.log(llmConfigHelp());
      } else {
        console.log(c.green(`  LLM: 已配置 ✓`));
        console.log(`  提供商: ${status.provider}`);
        console.log(`  模型: ${status.model || "（默认）"}`);
        console.log(`  API Key: ${status.apiKeyMasked}`);
        console.log(`  配置来源: ${status.source === "env" ? "环境变量" : status.source === "file" ? `配置文件 (${configFilePath(store.dataDir)})` : "—"}`);
        console.log("");
        console.log(c.dim("运行 `delphi chat` 开始对话。"));
      }
      closeRl();
    });

  await program.parseAsync(argv);
}
