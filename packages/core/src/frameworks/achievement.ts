/**
 * delphi —— 成就事件分析（STAR 深度萃取，文档 4.3.3）
 * 情境/任务 → 行动（追问决策点）→ 结果（追问长期影响）
 * 产出：成就事件库 + 可迁移技能萃取
 */
import { AchievementEntry } from "../models/types";
import { FlowRunner, FlowStep } from "./flow";
import { extractSkills } from "./keywordExtract";

export const ACHIEVEMENT_STEPS: FlowStep[] = [
  { id: "situation", prompt: "【S/T】当时是什么情境？你要完成的任务是什么？", answerKey: "situation" },
  { id: "action", prompt: "【A】你具体做了什么？\n   （追问：当时还有别的选择吗？你为什么选了这个？）", answerKey: "action" },
  { id: "result", prompt: "【R】结果如何？", answerKey: "result" },
  { id: "impact", prompt: "这件事对你后来的选择有什么长期影响？", answerKey: "impact" },
  {
    id: "energy",
    prompt: "做完这件事，你的能量感是？[高/中/低]",
    answerKey: "energy",
    hint: "高=做完更想继续；低=做完被掏空",
  },
];

export function createAchievementFlow(): FlowRunner {
  return new FlowRunner(ACHIEVEMENT_STEPS);
}

export interface AchievementResult {
  entry: AchievementEntry;
  skills: string[];
}

export function buildAchievement(runner: FlowRunner): AchievementResult {
  const energyRaw = (runner.answers.energy || "中").trim();
  const energyLevel: AchievementEntry["energyLevel"] =
    energyRaw.includes("高") ? "high" : energyRaw.includes("低") ? "low" : "medium";

  const combined = [runner.answers.situation, runner.answers.action, runner.answers.result, runner.answers.impact].join("\n");
  const skills = extractSkills(combined);

  const entry: AchievementEntry = {
    eventId: `ach-${Date.now()}`,
    star: {
      situation: runner.answers.situation || "",
      task: runner.answers.situation || "", // S/T 合并提问
      action: runner.answers.action || "",
      result: runner.answers.result || "",
    },
    skills,
    energyLevel,
  };
  return { entry, skills };
}

/** 从成就库提取最高频技能（能力画像） */
export function aggregateSkills(entries: AchievementEntry[]): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const s of e.skills) counts.set(s, (counts.get(s) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
}
