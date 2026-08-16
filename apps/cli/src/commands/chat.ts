/** delphi — free chat (the main arena of stealth analysis). */
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
  c.dim("我不会告诉你答案，但我会帮你看见你是怎么想的。"),
  "",
];

export const CHAT_HELP = [
  c.dim("/stealth      切换到隐式模式（默认，静默分析）"),
  c.dim("/transparent  切换到显式模式（实时展示分析）"),
  c.dim("/guide        切换到引导式模式（主动元思考引导）"),
  c.dim("/analyze      让 delphi 开始分析你刚才说的话"),
  c.dim("/quit         结束本次对话"),
  "",
].join("\n");

export async function runChat(store: ProfileStore, opts: { mode?: AnalysisMode; quiet?: boolean } = {}): Promise<void> {
  const profile = store.get();
  const llm = requireLLMProvider();
  const engine = new ThinkingEngine(opts.mode || profile.settings.defaultMode, { llm });
  engine.llmProfile = profile;

  if (!opts.quiet) {
    console.log(BANNER.join("\n"));
    console.log(c.green(`⚡ LLM Agent 已接入（${llm.id} / ${llm.model}）——由真实模型驱动，可调用档案工具`));
    console.log(`当前模式: ${c.cyan(engine.getMode())}  | 输入 /help 查看命令`);
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

    if (lower === "/quit" || lower === "/exit" || lower === "q") {
      running = false;
      break;
    }
    if (lower === "/help" || lower === "help") {
      console.log(CHAT_HELP);
      continue;
    }

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

        // bias stats in meta-guide mode (snapshot rendered by the engine)
    if (result.markers.biases.length > 0 && engine.getMode() === "meta_guide") {
      console.log(c.dim(`  ↳ detected: ${result.markers.biases.map((b) => b.type).join(", ")}`));
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
