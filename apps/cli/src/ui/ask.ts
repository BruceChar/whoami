/**
 * delphi —— 交互输入助手
 * TTY：readline 逐行提问（带提示语）
 * 非 TTY（管道/脚本）：一次性读取 stdin 行队列，逐行弹出（便于自动化测试）
 */
import * as readline from "readline";

let rl: readline.Interface | null = null;
let pipedLines: string[] | null = null;

/** EOF 哨兵：管道输入耗尽时 askLine 返回该值，菜单式循环应将其视为退出 */
export const EOF_INPUT = "\u0000__EOF__";

function isPiped(): boolean {
  return !process.stdin.isTTY;
}

async function ensurePipedLines(): Promise<void> {
  if (pipedLines !== null) return;
  pipedLines = [];
  try {
    for await (const chunk of process.stdin) {
      const text = typeof chunk === "string" ? chunk : chunk.toString();
      pipedLines.push(...text.split("\n"));
    }
  } catch {
    // stdin 读取失败时静默处理
  }
}

/** 询问一行输入（显示提示语）；管道输入耗尽后返回 EOF_INPUT */
export async function askLine(prompt: string): Promise<string> {
  if (isPiped()) {
    await ensurePipedLines();
    const line = pipedLines!.shift();
    if (line === undefined) return EOF_INPUT;
    return line.trim();
  }
  return new Promise((resolve) => {
    if (!rl) {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: true,
      });
    }
    rl.question(prompt, (answer) => resolve(answer.trim()));
  });
}

/** 询问并给出默认值 */
export async function askLineDefault(prompt: string, def: string): Promise<string> {
  const ans = await askLine(prompt);
  return ans === "" ? def : ans;
}

/** 关闭 readline（进程退出前调用） */
export function closeRl(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}
