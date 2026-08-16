/** delphi — SWOT. Threat control-split is now LLM-driven. */
import { FlowRunner, FlowStep } from "./flow";
import { LLMAgent } from "../llm/agent";
import { llmSplitThreats } from "../llm/extraction";

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
  gravityProblems: string[]; // uncontrollable threats -> gravity problems
  anchorProblems: string[]; // controllable threats -> anchor problems
}

const split = (s: string) =>
  s.split(/[；;，,\n、]/).map((x) => x.trim()).filter((x) => x.length > 0);

export async function buildSwotResult(runner: FlowRunner, provider: LLMAgent): Promise<SwotResult> {
  const strengths = split(runner.answers.s || "");
  const weaknesses = split(runner.answers.w || "");
  const opportunities = split(runner.answers.o || "");
  const threats = split(runner.answers.t || "");

  // control-circle split is LLM-driven (no keyword rules)
  const splitResult = await llmSplitThreats(provider, threats);
  const gravity = splitResult?.gravity ?? [];
  const anchor = splitResult?.anchor ?? threats.filter((t) => !gravity.includes(t));

  return { strengths, weaknesses, opportunities, threats, gravityProblems: gravity, anchorProblems: anchor };
}
