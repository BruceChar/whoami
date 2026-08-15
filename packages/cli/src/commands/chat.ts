/**
 * delphi —— 自由对话（隐式分析的主战场）
 */
import {
  AnalysisMode,
  ProfileStore,
  ThinkingEngine,
  appendMessage,
  beginSession,
  afterProfileUpdate,
  BIAS_LABELS,
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
  const engine = new ThinkingEngine(opts.mode || profile.settings.defaultMode);

  if (!opts.quiet) {
    console.log(BANNER.join("\n"));
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

    const result = engine.process(input);
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

    // 显式模式下偏差统计（思维快照已由 engine 渲染）
    if (result.markers.biases.length > 0 && engine.getMode() === "meta_guide") {
      console.log(c.dim(`  ↳ 检测: ${result.markers.biases.map((b) => BIAS_LABELS[b.type]).join("、")}`));
    }
  }

  // 会话收尾
  const summary = engine.sessionSummary();
  if (summary.length > 0) {
    console.log("");
    console.log(c.dim(hr(40)));
    console.log(c.dim("本次对话小结："));
    for (const line of summary) console.log(c.dim(line));
  }
  afterProfileUpdate(profile);
  store.save();
  console.log(c.green("\n✓ 对话已记录到你的认知档案。"));
  closeRl();
}
