/**
 * delphi —— 脚本化 LLM Provider（单元测试用，无需真实 API）
 * 按顺序返回预设响应；JSON 模式返回预设 JSON 或回声。
 */
import { LLMCompleteOptions, LLMJSONOptions, LLMProvider, LLMResult } from "./types";
import { extractJSONAs } from "./json";
import { AgentToolDef, LLMAgent, LLMAgentResult } from "./agent";

export interface ScriptedResponse {
  text: string;
  /** 匹配包含此片段的输入时优先使用（默认按顺序） */
  when?: string;
}

export class ScriptedLLMProvider implements LLMProvider, LLMAgent {
  readonly id = "scripted";
  readonly model = "scripted-1";
  private responses: ScriptedResponse[] = [];
  calls: Array<{ messages: LLMCompleteOptions["messages"]; json?: boolean }> = [];
  /** agentChat 中执行过的工具 */
  executedTools: string[] = [];

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

  // -------------------------------------------------------------------------
  // LLMAgent：脚本化工具循环
  // 响应文本以 "TOOL:<name>" 开头时视为请求工具调用；
  // 随后脚本中的下一条响应作为工具结果后的最终回复。
  // -------------------------------------------------------------------------

  async agentChat(opts: {
    messages: LLMCompleteOptions["messages"];
    system?: string;
    tools?: AgentToolDef[];
    executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
    maxToolRounds?: number;
  }): Promise<LLMAgentResult> {
    this.calls.push({ messages: opts.messages });
    const lastUser = [...opts.messages].reverse().find((m) => m.role === "user")?.content || "";
    const executed: string[] = [];
    let text = this.pick(lastUser);

    const toolMarker = /^TOOL:(\w+)/;
    const match = toolMarker.exec(text);
    if (match && opts.executeTool) {
      const name = match[1];
      executed.push(name);
      const result = await opts.executeTool(name, {});
      // 工具结果已执行，取脚本下一条作为最终回复
      text = this.pick(result);
    }
    this.executedTools.push(...executed);
    return {
      text,
      usage: { input: 10, output: 5, totalTokens: 15, cost: 0 },
      model: this.model,
      toolCalls: executed,
    };
  }
}
