/** delphi — interactive input helpers. */
import * as readline from "readline";

let rl: readline.Interface | null = null;
let pipedLines: string[] | null = null;

/** EOF sentinel: returned by askLine when piped input is exhausted; menu loops treat it as exit */
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
      // ignore stdin read failures
  }
}

/** Ask for one line (with prompt); returns EOF_INPUT after piped input is exhausted */
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

/** Ask with a default value */
export async function askLineDefault(prompt: string, def: string): Promise<string> {
  const ans = await askLine(prompt);
  return ans === "" ? def : ans;
}

/** Close readline (call before process exit) */
export function closeRl(): void {
  if (rl) {
    rl.close();
    rl = null;
  }
}
