/** delphi — V: 5 deep questions + value anchor/conflict extraction */
import { FlowRunner, FlowStep } from "./flow";
import { extractValues, detectValueConflicts, extractPureDrives, detectExternalMotives } from "./keywordExtract";

// ---------------------------------------------------------------------------
// V values phase (5 questions)
// ---------------------------------------------------------------------------

export const V_STEPS: FlowStep[] = [
  {
    id: "v1",
    prompt: "最近有没有一件事，让你做得很投入、做完很满足？它是什么，为什么？",
    answerKey: "v1",
  },
  {
    id: "v2",
    prompt: "什么情况下你会觉得「这才是我」？（可以是一件小事，也可以是一个场景）",
    answerKey: "v2",
  },
  {
    id: "v3",
    prompt: "你最不能妥协的是什么？什么情况下你会果断说「不」？",
    answerKey: "v3",
  },
  {
    id: "v4",
    prompt: "你欣赏什么样的人？你欣赏 ta 身上的什么特质？",
    answerKey: "v4",
  },
  {
    id: "v5",
    prompt: "如果生命只剩一年，你会把时间花在哪里？",
    answerKey: "v5",
  },
];

export function createVFlow(): FlowRunner {
  return new FlowRunner(V_STEPS);
}

export interface VResult {
  anchors: string[];
  conflicts: string[];
  raw: Record<string, string>;
}

export function buildVResult(runner: FlowRunner): VResult {
  const raw = { ...runner.answers };
  const anchors = extractValues(Object.values(raw).join("\n"));
  const conflicts = detectValueConflicts(anchors);
  return { anchors, conflicts, raw };
}

// ---------------------------------------------------------------------------
// D dream phase (motive purification)
// ---------------------------------------------------------------------------

export const D_STEPS: FlowStep[] = [
  {
    id: "d1",
    prompt: "如果钱完全不是问题，你最想做什么？",
    answerKey: "d1",
  },
  {
    id: "d2",
    prompt: "有没有一件事，即使没人认可、也不赚钱，你依然愿意做？",
    answerKey: "d2",
  },
  {
    id: "d3",
    prompt: "你小时候最想成为什么？现在想起来还有感觉吗？",
    answerKey: "d3",
  },
];

export function createDFlow(): FlowRunner {
  return new FlowRunner(D_STEPS);
}

export interface DResult {
  pureDrives: string[];
  externalMotivesFiltered: string[];
  raw: Record<string, string>;
}

export function buildDResult(runner: FlowRunner): DResult {
  const raw = { ...runner.answers };
  const combined = Object.values(raw).join("\n");
  return {
    pureDrives: extractPureDrives(combined),
    externalMotivesFiltered: detectExternalMotives(combined),
    raw,
  };
}
