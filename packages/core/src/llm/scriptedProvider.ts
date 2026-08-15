/**
 * delphi —— 脚本化 LLM Provider（单元测试用，无需真实 API）
 * 按顺序返回预设响应；JSON 模式返回预设 JSON 或回声。
 */
import { LLMCompleteOptions, LLMJSONOptions, LLMProvider, LLMResult } from "./types";
import { extractJSONAs } from "./json";

export interface ScriptedResponse {
  text: string;
  /** 匹配包含此片段的输入时优先使用（默认按顺序） */
  when?: string;
}

export class ScriptedLLMProvider implements LLMProvider {
  readonly id = "scripted";
  readonly model = "scripted-1";
  private responses: ScriptedResponse[] = [];
  calls: Array<{ messages: LLMCompleteOptions["messages"]; json?: boolean }> = [];

  constructor(responses: ScriptedResponse[] = []) {
    this.responses = responses;
  }

  setResponses(responses: ScriptedResponse[]): void {
    this.responses = responses;
  }

  async isConfigured(): Promise<boolean> {
    return true;
  }

  private pick(input: string): string {
    const matchedIndex = this.responses.findIndex((r) => r.when && input.includes(r.when));
    if (matchedIndex !== -1) {
      return this.responses.splice(matchedIndex, 1)[0].text;
    }
    const next = this.responses.shift();
    return next ? next.text : "（脚本响应耗尽）";
  }

  async complete(opts: LLMCompleteOptions): Promise<LLMResult> {
    this.calls.push({ messages: opts.messages });
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content || "";
    return {
      text: this.pick(lastUser),
      usage: { input: 10, output: 5, totalTokens: 15, cost: 0 },
      model: this.model,
      provider: this.id,
    };
  }

  async completeJSON<T>(opts: LLMJSONOptions): Promise<T | null> {
    this.calls.push({ messages: opts.messages, json: true });
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content || "";
    const text = this.pick(lastUser);
    return extractJSONAs<T>(text);
  }
}
