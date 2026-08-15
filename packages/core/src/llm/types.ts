/**
 * delphi —— LLM Provider 抽象（与具体实现解耦）
 * 规则引擎仍是默认路径；LLM 可用时作为增强（真正的 Agent 对话 / 深度分析）。
 */

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMUsage {
  input: number;
  output: number;
  totalTokens: number;
  cost: number;
}

export interface LLMResult {
  text: string;
  usage?: LLMUsage;
  model: string;
  provider: string;
}

export interface LLMCompleteOptions {
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
}

export interface LLMJSONOptions {
  messages: LLMMessage[];
  /** 期望 JSON 结构的自然语言描述（注入 system prompt 引导） */
  schema: string;
  temperature?: number;
  maxTokens?: number;
}

export class LLMError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "LLMError";
  }
}

/** 统一 LLM 接口：pi-ai 实现 + 测试用脚本实现 */
export interface LLMProvider {
  readonly id: string;
  readonly model: string;
  /** 是否已配置可用（如存在 API Key） */
  isConfigured(): Promise<boolean>;
  /** 普通对话补全 */
  complete(opts: LLMCompleteOptions): Promise<LLMResult>;
  /** 结构化 JSON 补全（失败/非 JSON 返回 null） */
  completeJSON<T>(opts: LLMJSONOptions): Promise<T | null>;
}
