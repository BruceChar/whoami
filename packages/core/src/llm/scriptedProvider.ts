/** delphi — scripted LLM provider for unit tests (no real API needed). */
import { LLMCompleteOptions, LLMJSONOptions, LLMProvider, LLMResult } from "./types";
import { extractJSONAs } from "./json";
import { AgentToolDef, LLMAgent, LLMAgentResult } from "./agent";

export interface ScriptedResponse {
  text: string;
    /** Used first when the input contains this fragment (default: in order) */
  when?: string;
}

export class ScriptedLLMProvider implements LLMProvider, LLMAgent {
  readonly id = "scripted";
  readonly model = "scripted-1";
  private responses: ScriptedResponse[] = [];
  calls: Array<{ messages: LLMCompleteOptions["messages"]; json?: boolean }> = [];
    /** Tools executed in agentChat */
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
    // LLMAgent: scripted tool loop
    // A response starting with "TOOL:<name>" requests a tool call;
    // the next scripted response is the final reply after the tool result.
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
          // tool executed; take the next scripted response as the final reply
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
