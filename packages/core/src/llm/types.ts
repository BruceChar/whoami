/** delphi — LLM provider abstraction (decoupled from implementations). */

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
    /** Natural-language description of the expected JSON shape (injected into the system prompt) */
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

/** Unified LLM interface: pi-ai implementation + scripted test implementation */
export interface LLMProvider {
  readonly id: string;
  readonly model: string;
    /** Whether the provider is configured (e.g. an API key exists) */
  isConfigured(): Promise<boolean>;
    /** Plain chat completion */
  complete(opts: LLMCompleteOptions): Promise<LLMResult>;
    /** Structured JSON completion (null on failure / non-JSON) */
  completeJSON<T>(opts: LLMJSONOptions): Promise<T | null>;
}
