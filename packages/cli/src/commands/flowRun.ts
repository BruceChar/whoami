/**
 * delphi —— 方法论流程的交互驱动（CLI 侧）
 */
import { FlowRunner } from "@delphi/core";
import { askLine, EOF_INPUT } from "../ui/ask";
import { c, section } from "../ui/render";

export interface RunFlowOptions {
  title: string;
  intro?: string;
  onCancel?: () => void;
}

/** 驱动一个 FlowRunner：逐个渲染问题、收集回答 */
export async function runFlow(runner: FlowRunner, opts: RunFlowOptions): Promise<boolean> {
  console.log("");
  console.log(section(opts.title));
  if (opts.intro) console.log(c.dim(opts.intro));

  while (!runner.isDone()) {
    const step = runner.current();
    if (!step) break;
    const { index, total } = runner.progress;
    console.log("");
    console.log(c.cyan(`[${index + 1}/${total}]`) + " " + step.prompt);
    const answer = await askLine(c.dim("> ") as string);
    if (answer === EOF_INPUT || answer.toLowerCase() === "/cancel") {
      console.log(c.yellow("已取消本次流程。"));
      opts.onCancel?.();
      return false;
    }
    runner.submit(answer);
  }
  console.log(c.green(`\n✓ ${opts.title} 完成`));
  return true;
}
