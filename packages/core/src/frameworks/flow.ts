/**
 * delphi —— 方法论工具的流程问答引擎
 * 每个框架 = 一组步骤（FlowStep）+ 状态机（FlowRunner）。
 * CLI 负责渲染问题与收集输入，core 负责推进与产出数据。
 */

export interface FlowStep {
  id: string;
  prompt: string;
  hint?: string;
  /** 该步骤产出存到 answers 的 key */
  answerKey: string;
}

export class FlowRunner {
  readonly steps: FlowStep[];
  readonly answers: Record<string, string> = {};
  private index = 0;

  constructor(steps: FlowStep[]) {
    this.steps = steps;
  }

  /** 当前步骤；null 表示流程已结束 */
  current(): FlowStep | null {
    return this.steps[this.index] || null;
  }

  /** 提交当前步骤的回答，推进流程 */
  submit(answer: string): { done: boolean; next: FlowStep | null } {
    const step = this.current();
    if (!step) return { done: true, next: null };
    this.answers[step.answerKey] = answer.trim();
    this.index++;
    const next = this.current();
    return { done: !next, next };
  }

  get progress(): { index: number; total: number } {
    return { index: this.index, total: this.steps.length };
  }

  /** 是否已跳过（用于多行输入续行） */
  isDone(): boolean {
    return this.index >= this.steps.length;
  }
}
