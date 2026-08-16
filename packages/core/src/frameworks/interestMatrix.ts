/** delphi — Four-quadrant energy rating: creative <-> analytical x independent <-> social. */
import { FlowRunner, FlowStep } from "./flow";

export interface InterestRating {
  creative: number; // 0-5
  analytical: number; // 0-5
  independent: number; // 0-5
  social: number; // 0-5
}

export const INTEREST_STEPS: FlowStep[] = [
  { id: "creative", prompt: "做创造性的事（写作、设计、创作、策划）时，你的能量是？（0-5）", answerKey: "creative" },
  { id: "analytical", prompt: "做分析性的事（研究、数据、逻辑推理、编程）时，你的能量是？（0-5）", answerKey: "analytical" },
  { id: "independent", prompt: "独立完成事情（自由职业、创业、个人项目）时，你的能量是？（0-5）", answerKey: "independent" },
  { id: "social", prompt: "与人打交道的事（沟通、协作、教学、咨询）时，你的能量是？（0-5）", answerKey: "social" },
];

export function createInterestFlow(): FlowRunner {
  return new FlowRunner(INTEREST_STEPS);
}

function parseRating(raw: string | undefined): number {
  const n = parseInt(raw || "", 10);
  if (isNaN(n)) return 2;
  return Math.max(0, Math.min(5, n));
}

export function buildInterestRating(runner: FlowRunner): InterestRating {
  return {
    creative: parseRating(runner.answers.creative),
    analytical: parseRating(runner.answers.analytical),
    independent: parseRating(runner.answers.independent),
    social: parseRating(runner.answers.social),
  };
}

export interface QuadrantInfo {
  key: string;
  label: string;
  examples: string[];
  creative: number; // -1(分析) ~ +1(创造)
  social: number; // -1(独立) ~ +1(社交)
}

export const QUADRANTS: QuadrantInfo[] = [
  { key: "art", label: "艺术/创作", examples: ["写作", "设计", "插画", "音乐"], creative: 1, social: -1 },
  { key: "code", label: "编程/数据", examples: ["开发", "数据分析", "算法"], creative: -1, social: -1 },
  { key: "content", label: "表达/内容", examples: ["内容创作", "自媒体", "教学"], creative: 1, social: 1 },
  { key: "consult", label: "咨询/产品", examples: ["咨询顾问", "产品经理", "研究"], creative: -1, social: 1 },
];

export interface InterestMatrixResult {
  rating: InterestRating;
  highEnergyQuadrants: string[];
  conflicts: string[];
}

export function buildInterestMatrix(runner: FlowRunner): InterestMatrixResult {
  const rating = buildInterestRating(runner);

    // quadrant energy: creative and social axes combined
  const scores = QUADRANTS.map((q) => {
    const creativeScore = q.creative === 1 ? rating.creative : rating.analytical;
    const socialScore = q.social === 1 ? rating.social : rating.independent;
    return { key: q.key, label: q.label, score: creativeScore * 0.6 + socialScore * 0.4 };
  }).sort((a, b) => b.score - a.score);

  const high = scores.filter((s) => s.score >= 3).map((s) => s.label);
  const highEnergyQuadrants = high.length >= 2 ? high : scores.slice(0, 2).map((s) => s.label);

    // conflict detection: high-energy axis vs low-energy axis
  const conflicts: string[] = [];
  if (rating.creative >= 4 && rating.analytical <= 1) conflicts.push("创造性与分析性差异大——工作可能难以两全");
  if (rating.social >= 4 && rating.independent <= 1) conflicts.push("社交需求高但独立倾向低——自由职业可能孤独");
  if (rating.independent >= 4 && rating.social <= 1) conflicts.push("独立倾向高但社交需求低——协作型工作可能消耗你");

  return { rating, highEnergyQuadrants, conflicts };
}
