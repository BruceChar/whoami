/** delphi — flow runner for framework tools. */

export interface FlowStep {
  id: string;
  prompt: string;
  hint?: string;
    /** Key under which this step's answer is stored */
  answerKey: string;
}

export class FlowRunner {
  readonly steps: FlowStep[];
  readonly answers: Record<string, string> = {};
  private index = 0;

  constructor(steps: FlowStep[]) {
    this.steps = steps;
  }

    /** Current step; null means the flow is finished */
  current(): FlowStep | null {
    return this.steps[this.index] || null;
  }

    /** Submit the answer for the current step and advance */
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

    /** Whether the flow is done */
  isDone(): boolean {
    return this.index >= this.steps.length;
  }
}
