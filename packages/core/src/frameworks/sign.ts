/** delphi — SIGN talent signals (areas now LLM-inferred, not keyword-matched). */
import { FlowRunner, FlowStep } from "./flow";
import { LLMAgent } from "../llm/agent";
import { llmExtractTalentAreas } from "../llm/extraction";

export const SIGN_STEPS: FlowStep[] = [
  { id: "s", prompt: "【S - Success】什么事你做起来比别人轻松、结果还更好？", answerKey: "s" },
  { id: "i", prompt: "【I - Instinct】什么事你会主动想做，甚至忍不住就去做？", answerKey: "i" },
  { id: "g", prompt: "【G - Growth】学什么你比别人快？做什么事最容易进入「心流」？", answerKey: "g" },
  { id: "n", prompt: "【N - Needs】做完什么事后，你感到的是满足而非空虚？", answerKey: "n" },
];

export function createSignFlow(): FlowRunner {
  return new FlowRunner(SIGN_STEPS);
}

export interface SignResult {
  signals: Record<string, string>;
  areas: string[];
}

export async function buildSignResult(runner: FlowRunner, provider: LLMAgent): Promise<SignResult> {
  const signals = {
    success: runner.answers.s || "",
    instinct: runner.answers.i || "",
    growth: runner.answers.g || "",
    needs: runner.answers.n || "",
  };
  const extracted = await llmExtractTalentAreas(provider, signals);
  return { signals, areas: extracted?.areas ?? [] };
}
