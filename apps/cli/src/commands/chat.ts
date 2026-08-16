/** delphi — free chat (the main arena of stealth analysis, slash-command driven). */
import {
  AnalysisMode,
  ProfileStore,
  ThinkingEngine,
  appendMessage,
  beginSession,
  afterProfileUpdate,
  requireLLMProvider,
  llmAnalyzeSession,
  applySessionDeepAnalysis,
} from "@delphi/core";
import { askLine, closeRl, EOF_INPUT } from "../ui/ask";
import { c, hr } from "../ui/render";

const BANNER = [
  "",
  "🪞 delphi —— 一面照向内心的镜子。",
  c.dim("Be water my friend. 我不会告诉你答案，但我会帮你看见你是怎么想的。"),
  c.dim("输入 / 查看可用指令 · /help 查看帮助 · /quit 结束"),
  "",
];

const COMMAND_LIST = [
  "/daily        每日回馈（回馈分析法）",
  "/vtd          V-T-D 价值观-天赋-梦想",
  "/sign         SIGN 天赋探测",
  "/swot         SWOT 分析",
  "/achievement  成就事件萃取（STAR）",
  "/interest     兴趣矩阵",
  "/capability   核心能力模型",
  "/career       从业分析",
  "/life         人生设计",
  "/feedback     反馈收集（360°）",
  "/persona      个人画像",
  "/space        用户空间（dashboard/timeline/archive/insights/lab/settings）",
  "/export       导出档案 JSON",
  "/reset        清空全部数据（需确认）",
  "/help         显示帮助",
  "/quit         结束对话",
];

export const CHAT_HELP = ["可用指令：", ...COMMAND_LIST.map((l) => c.dim(l)), ""].join("\n");

const QUICK_HELP = [
  "可用指令：",
  c.dim(COMMAND_LIST.map((l) => l.split(/\s+/)[0]).join(" ")),
  c.dim("输入 /help 查看每条指令的说明"),
  "",
].join("\n");

/** Tool commands run inside the chat loop (each runs its own flow, then returns). */
const TOOL_RUNNERS: Record<string, (store: ProfileStore) => Promise<void>> = {
  "/daily": (s) => import("./daily").then((m) => m.runDaily(s)),
  "/vtd": (s) => import("./vtd").then((m) => m.runVtd(s)),
  "/sign": (s) => import("./sign").then((m) => m.runSign(s)),
  "/swot": (s) => import("./swot").then((m) => m.runSwot(s)),
  "/achievement": (s) => import("./achievement").then((m) => m.runAchievement(s)),
  "/interest": (s) => import("./interest").then((m) => m.runInterest(s)),
  "/capability": (s) => import("./capability").then((m) => m.runCapability(s)),
  "/career": (s) => import("./career").then((m) => m.runCareer(s)),
  "/life": (s) => import("./lifeDesign").then((m) => m.runLifeDesign(s)),
  "/feedback": (s) => import("./feedback").then((m) => m.runFeedback(s)),
  "/persona": (s) => import("./persona").then((m) => m.runPersona(s)),
};

/** Engine-internal mode commands (kept for compatibility; default is stealth). */
const MODE_COMMANDS = new Set(["/stealth", "/transparent", "/guide", "/deep", "/analyze", "/talk"]);

export async function runChat(store: ProfileStore, opts: { mode?: AnalysisMode; quiet?: boolean } = {}): Promise<void> {
  const profile = store.get();
  const llm = requireLLMProvider();
  const engine = new ThinkingEngine(opts.mode || profile.settings.defaultMode, {
    llm,
    userNickname: profile.userInfo?.nickname,
  });
  engine.llmProfile = profile;

  if (!opts.quiet) {
    console.log(BANNER.join("\n"));
    console.log(c.green(`⚡ LLM Agent 已接入（${llm.id} / ${llm.model}）——由真实模型驱动，可调用档案工具`));
    console.log("");
  }

  const session = beginSession(profile, engine.getMode());
  appendMessage(session, {
    role: "agent",
    text: "你好，我在。今天想聊点什么？",
    timestamp: new Date().toISOString(),
  });

  let running = true;
  while (running) {
    const input = await askLine(c.cyan("你> "));
    if (input === EOF_INPUT) break; // 输入耗尽 → 结束对话
    if (input === "") continue;
    const lower = input.toLowerCase();
    const first = lower.split(/\s+/)[0];

    // ---- slash commands ----
    if (first === "/quit" || first === "/exit" || lower === "q") {
      running = false;
      break;
    }
    if (first === "/" || first === "/help" || lower === "help") {
      console.log(first === "/" ? QUICK_HELP : CHAT_HELP);
      continue;
    }
    if (input.startsWith("/")) {
      if (MODE_COMMANDS.has(first)) {
        // pass through to the engine (mode commands kept for compatibility)
      } else if (TOOL_RUNNERS[first]) {
        await TOOL_RUNNERS[first](store);
        continue;
      } else if (first === "/space") {
        const sub = input.trim().split(/\s+/)[1];
        const { runSpace } = await import("./space");
        await runSpace(store, (sub || undefined) as Parameters<typeof runSpace>[1]);
        continue;
      } else if (first === "/export") {
        const dest = store.exportJson();
        console.log(c.green(`✓ 档案已导出: ${dest}`));
        continue;
      } else if (first === "/reset") {
        const confirm = await askLine(c.red("⚠ 确认清空全部数据？输入 yes 确认 > "));
        if (confirm === "yes") {
          store.reset();
          console.log(c.green("✓ 数据已清空"));
        } else {
          console.log(c.dim("已取消"));
        }
        continue;
      } else {
        console.log(c.dim(`未知指令 ${first}，输入 /help 查看可用指令`));
        continue;
      }
    }

    // ---- normal message: LLM engine ----
    let result;
    try {
      result = await engine.process(input);
    } catch (err) {
      console.log(c.red(`  ✗ LLM 调用失败: ${(err as Error).message.slice(0, 200)}`));
      console.log(c.dim("    请检查 API Key / 网络 / 模型配置后重试。"));
      continue;
    }
    appendMessage(session, {
      role: "user",
      text: input,
      timestamp: new Date().toISOString(),
      markers: result.markers,
    });

    if (result.modeChanged && !result.isCommand) {
      console.log(c.dim(`〔${result.modeChangeReason}〕`));
    }
    console.log(`delphi> ${result.reply}`);

    // LLM meta info (usage / tool calls)
    if (result.llmGenerated) {
      const parts: string[] = [];
      if (result.usage) parts.push(`${result.usage.totalTokens} tokens · $${result.usage.cost.toFixed(4)}`);
      if (result.llmModel) parts.push(result.llmModel);
      const tools = engine.getLastToolCalls();
      if (tools.length > 0) parts.push(`工具: ${tools.join(", ")}`);
      console.log(c.dim(`  ↳ [llm-agent ${parts.join(" · ")}]`));
    }
  }

  // session finalization
  const summary = engine.sessionSummary();
  if (summary.length > 0) {
    console.log("");
    console.log(c.dim(hr(40)));
    console.log(c.dim("本次对话小结："));
    for (const line of summary) console.log(c.dim(line));
  }

  // LLM deep analysis (session summary + auto insights)
  if (session.messages.some((m) => m.role === "user")) {
    console.log(c.dim("\n⚡ 正在深度分析这次对话（LLM）..."));
    try {
      const deep = await llmAnalyzeSession(llm, profile, session);
      if (deep) {
        const created = applySessionDeepAnalysis(profile, session, deep);
        console.log(c.cyan("深度分析："));
        console.log(`  ${deep.summary}`);
        for (const ins of created) {
          console.log(c.green(`  ⭐ 自动洞察: ${ins.analysis}`));
        }
      }
    } catch (err) {
      console.log(c.dim(`  ↳ 深度分析失败（不影响已保存内容）: ${(err as Error).message.slice(0, 80)}`));
    }
  }

  afterProfileUpdate(profile);
  store.save();
  console.log(c.green("\n✓ 对话已记录到你的认知档案。"));
  closeRl();
}
