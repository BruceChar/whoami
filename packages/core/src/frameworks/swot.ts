/** delphi — S strength-shadow detection / W weakness reframing / O opportunity-capability */
import { FlowRunner, FlowStep } from "./flow";

export const SWOT_STEPS: FlowStep[] = [
  {
    id: "s",
    prompt: "【S 优势】你擅长什么？别人常夸你什么？\n   （提示：这些优势有没有被过度使用、反噬你的时候？）",
    answerKey: "s",
  },
  {
    id: "w",
    prompt: "【W 劣势】你不擅长什么？什么场景容易卡住？\n   （提示：这是「暂时不会」，还是「永远不行」？）",
    answerKey: "w",
  },
  {
    id: "o",
    prompt: "【O 机会】现在的环境里，有哪些机会让你心动？\n   （提示：抓住这些机会，你需要先改变自己什么？）",
    answerKey: "o",
  },
  {
    id: "t",
    prompt: "【T 威胁】你最担心什么风险？\n   （提示：把风险分成「我能控制的」和「我不能控制的」两部分）",
    answerKey: "t",
  },
];

export function createSwotFlow(): FlowRunner {
  return new FlowRunner(SWOT_STEPS);
}

export interface SwotResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  gravityProblems: string[]; // 不可控威胁 → 重力问题
  anchorProblems: string[]; // 可控威胁 → 锚定问题
}

export function buildSwotResult(runner: FlowRunner): SwotResult {
  const split = (s: string) =>
    s.split(/[；;，,\n、]/).map((x) => x.trim()).filter((x) => x.length > 0);

  const strengths = split(runner.answers.s || "");
  const weaknesses = split(runner.answers.w || "");
  const opportunities = split(runner.answers.o || "");
  const threats = split(runner.answers.t || "");

    // control-circle split: uncontrollable keywords -> gravity problem
  const uncontrollable = /不可控|控制不了|没办法|注定|客观|改变不了|无法改变|大势|时代|出身|年龄/;
  const gravity = threats.filter((t) => uncontrollable.test(t));
  const anchor = threats.filter((t) => !uncontrollable.test(t));

  return { strengths, weaknesses, opportunities, threats, gravityProblems: gravity, anchorProblems: anchor };
}
