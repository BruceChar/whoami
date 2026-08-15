/**
 * delphi —— 回馈分析法（文档 4.1.1）
 * 每日结束时记录：一件满意的事 + 原因；一件不满意的事 + 原因。
 * 数据驱动从业分析（什么类型的工作让你持续满意）与人生设计（能量流向）。
 */
import { DailyFeedbackEntry } from "../models/types";
import { FlowRunner, FlowStep } from "./flow";
import { extractThemes } from "./keywordExtract";

export const DAILY_STEPS: FlowStep[] = [
  { id: "satisfied_event", prompt: "今天让你满意的一件事是什么？", answerKey: "satisfiedEvent" },
  { id: "satisfied_reason", prompt: "它为什么让你满意？（背后的原因是什么）", answerKey: "satisfiedReason" },
  { id: "unsatisfied_event", prompt: "今天让你不满意的一件事是什么？", answerKey: "unsatisfiedEvent" },
  { id: "unsatisfied_reason", prompt: "它为什么让你不满意？", answerKey: "unsatisfiedReason" },
];

export function createDailyFlow(): FlowRunner {
  return new FlowRunner(DAILY_STEPS);
}

/** 从 FlowRunner 收集结果生成回馈条目 */
export function buildDailyEntry(runner: FlowRunner, date?: string): DailyFeedbackEntry {
  const a = runner.answers;
  const satisfied = { event: a.satisfiedEvent || "", reason: a.satisfiedReason || "" };
  const unsatisfied = { event: a.unsatisfiedEvent || "", reason: a.unsatisfiedReason || "" };
  return {
    date: date || new Date().toISOString().slice(0, 10),
    satisfied,
    unsatisfied,
    themes: extractThemes(satisfied.event, satisfied.reason, unsatisfied.event, unsatisfied.reason),
  };
}

/** 汇总多次回馈的满意驱动主题（能量源） */
export function satisfiedDrivers(entries: DailyFeedbackEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.themes) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}

/** 不满意驱动主题（能量黑洞） */
export function unsatisfiedDrivers(entries: DailyFeedbackEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.themes) counts.set(t, (counts.get(t) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
}
