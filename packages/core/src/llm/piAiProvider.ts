/** delphi — pi-ai LLM provider. */
import { LLMCompleteOptions, LLMError, LLMJSONOptions, LLMMessage, LLMProvider, LLMResult } from "./types";
import { extractJSONAs } from "./json";
import { dynamicImport } from "./dynamicImport";
import { AgentToolDef, LLMAgent, LLMAgentResult } from "./agent";

type AnyModels = any;

/** provider id -> factory module subpath */
const PROVIDER_MODULES: Record<string, string> = {
  deepseek: "@earendil-works/pi-ai/providers/deepseek",
  openai: "@earendil-works/pi-ai/providers/openai",
  anthropic: "@earendil-works/pi-ai/providers/anthropic",
  openrouter: "@earendil-works/pi-ai/providers/openrouter",
  google: "@earendil-works/pi-ai/providers/google",
};

/** provider id -> env var name (used by isConfigured) */
export const PROVIDER_ENV_KEYS: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
};

/** List the available models for a provider (from the pi-ai catalog; no API key needed). */
export async function listProviderModels(
  providerId: string
): Promise<Array<{ id: string; inputCost?: number }>> {
  const fallback = () =>
    (DEFAULT_MODEL_CANDIDATES[providerId] || []).map((id) => ({ id }));
  try {
    const { createModels } = await dynamicImport("@earendil-works/pi-ai");
    const models = createModels();
    const modulePath = PROVIDER_MODULES[providerId];
    if (!modulePath) return fallback();
    const mod: Record<string, () => unknown> = await dynamicImport(modulePath);
    const factory = mod[`${providerId}Provider`];
    if (typeof factory !== "function") return fallback();
    models.setProvider(factory() as never);
    const all: any[] = models.getModels(providerId) || [];
    if (!Array.isArray(all) || all.length === 0) return fallback();
    return all
      .map((m) => ({ id: String(m.id || ""), inputCost: m.cost?.input }))
      .filter((m) => m.id)
      .sort((a, b) => (a.inputCost ?? Infinity) - (b.inputCost ?? Infinity));
  } catch {
    return fallback();
  }
}

/** Default model candidates per provider (cost-effective first) */
export const DEFAULT_MODEL_CANDIDATES: Record<string, string[]> = {
  deepseek: ["deepseek-v4-flash", "deepseek-v4-pro"],
  openai: ["gpt-4o-mini", "gpt-5.4-mini", "gpt-4.1-mini"],
  anthropic: ["claude-3-5-haiku", "claude-haiku-4-5", "claude-sonnet-4-5"],
  openrouter: ["openrouter/auto", "openai/gpt-5.4-mini", "anthropic/claude-3.5-haiku"],
  google: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-1.5-flash"],
};

export interface PiAiProviderOptions {
  providerId: string;
  modelId?: string;
    /** Test injection: custom models setup (overrides default provider registration) */
  setup?: (models: AnyModels) => void | Promise<void>;
    /** Test injection: custom model lookup */
  resolveModel?: (models: AnyModels, providerId: string, modelId: string | undefined) => Promise<unknown> | unknown;
}

export class PiAiProvider implements LLMProvider, LLMAgent {
  readonly id: string;
  readonly model: string;
  private readonly opts: PiAiProviderOptions;
  private modelsPromise: Promise<AnyModels> | null = null;
  private modelPromise: Promise<unknown> | null = null;

  constructor(opts: PiAiProviderOptions) {
    this.opts = opts;
    this.id = opts.providerId;
    this.model = opts.modelId || "auto";
  }

  async isConfigured(): Promise<boolean> {
    if (this.opts.setup) return true; // 测试注入视为已配置
    const envKey = PROVIDER_ENV_KEYS[this.id];
    return !!envKey && !!process.env[envKey];
  }

  private async models(): Promise<AnyModels> {
    if (!this.modelsPromise) {
      this.modelsPromise = this.buildModels();
    }
    return this.modelsPromise;
  }

  private async buildModels(): Promise<AnyModels> {
    const { createModels } = await dynamicImport("@earendil-works/pi-ai");
    const models = createModels();
    if (this.opts.setup) {
      await this.opts.setup(models);
      return models;
    }
    const modulePath = PROVIDER_MODULES[this.id];
    if (!modulePath) {
      throw new LLMError(`不支持的 LLM 提供商: ${this.id}（支持: ${Object.keys(PROVIDER_MODULES).join(", ")}）`);
    }
    const mod: Record<string, () => unknown> = await dynamicImport(modulePath);
    const factoryName = `${this.id}Provider`;
    const factory = mod[factoryName] as (() => unknown) | undefined;
    if (!factory) {
      throw new LLMError(`提供商模块缺少工厂函数: ${factoryName}`);
    }
    models.setProvider(factory() as never);
    return models;
  }

    /** Resolve the model object (with default-model fallback) */
  private async resolveModel(): Promise<unknown> {
    if (!this.modelPromise) {
      this.modelPromise = this.doResolveModel();
    }
    return this.modelPromise;
  }

  private async doResolveModel(): Promise<unknown> {
    const models = await this.models();
    const target = this.opts.modelId;
    if (this.opts.resolveModel) {
      return this.opts.resolveModel(models, this.id, target);
    }
    if (target && target !== "auto") {
      const found = models.getModel(this.id, target);
      if (found) return found;
    }
        // default model candidates
    for (const candidate of DEFAULT_MODEL_CANDIDATES[this.id] || []) {
      const found = models.getModel(this.id, candidate);
      if (found) return found;
    }
        // fallback: cheapest model in the catalog
    const all: any[] = models.getModels(this.id) || [];
    const sorted = [...all].sort(
      (a, b) => (a.cost?.input ?? Infinity) - (b.cost?.input ?? Infinity)
    );
    const cheapest = sorted[0];
    if (cheapest) return cheapest;
    throw new LLMError(`提供商 ${this.id} 未找到可用模型（检查 ${PROVIDER_ENV_KEYS[this.id]} 与网络）`);
  }

  async complete(opts: LLMCompleteOptions): Promise<LLMResult> {
    const models = await this.models();
    const model = await this.resolveModel();
    const systemPrompt = opts.messages
      .filter((m) => m.role === "system")
      .map((m) => m.content)
      .join("\n");
    const context = {
      systemPrompt: systemPrompt || undefined,
      messages: opts.messages
        .filter((m) => m.role !== "system")
        .map((m) => ({
          role: m.role,
          content: toPiContent(m.role, m.content),
          timestamp: Date.now(),
        })),
    };
    let response;
    try {
      response = await models.complete(model, context);
    } catch (err) {
      throw new LLMError(`LLM 调用失败: ${(err as Error).message}`, err);
    }
    if (response.errorMessage) {
      throw new LLMError(`LLM 返回错误: ${response.errorMessage}`);
    }
    const text = (response.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("")
      .trim();
    if (!text) {
      throw new LLMError("LLM 未返回文本内容");
    }
    return {
      text,
      usage: response.usage
        ? {
            input: response.usage.input ?? 0,
            output: response.usage.output ?? 0,
            totalTokens: response.usage.totalTokens ?? 0,
            cost: response.usage.cost?.total ?? 0,
          }
        : undefined,
      model: response.model || this.model,
      provider: response.provider || this.id,
    };
  }

  async completeJSON<T>(opts: LLMJSONOptions): Promise<T | null> {
    const messages: LLMMessage[] = [
      {
        role: "system",
        content:
          "You are a strict structured-output assistant. Output a single valid JSON value (object or array) only — no explanation, prefix, suffix, or Markdown code fence.\nExpected shape:\n" +
          opts.schema,
      },
      ...opts.messages,
    ];
    try {
      const res = await this.complete({ messages, temperature: opts.temperature ?? 0.2, maxTokens: opts.maxTokens });
      return extractJSONAs<T>(res.text);
    } catch {
      return null;
    }
  }

  // -------------------------------------------------------------------------
    // LLMAgent: tool-calling loop (complete -> toolCall -> toolResult -> complete)
  // -------------------------------------------------------------------------

  async agentChat(opts: {
    messages: LLMMessage[];
    system?: string;
    tools?: AgentToolDef[];
    executeTool?: (name: string, args: Record<string, unknown>) => Promise<string>;
    maxToolRounds?: number;
  }): Promise<LLMAgentResult> {
    const models = await this.models();
    const model = await this.resolveModel();
    const maxRounds = opts.maxToolRounds ?? 3;
    const { Type } = await dynamicImport("@earendil-works/pi-ai");

    const context: any = {
      systemPrompt: opts.system || undefined,
      messages: opts.messages.map((m) => ({
        role: m.role,
        content: toPiContent(m.role, m.content),
        timestamp: Date.now(),
      })),
      tools: opts.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: jsonSchemaToTypeBox(Type, t.parameters),
      })),
    };

    const executedTools: string[] = [];
    let lastText = "";

    for (let round = 0; round <= maxRounds; round++) {
      let response;
      try {
        response = await models.complete(model, context);
      } catch (err) {
        throw new LLMError(`LLM Agent 调用失败: ${(err as Error).message}`, err);
      }
      if (response.errorMessage) {
        throw new LLMError(`LLM Agent 返回错误: ${response.errorMessage}`);
      }

      const text = (response.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("")
        .trim();
      if (text) lastText = text;

      const toolCalls: any[] = (response.content || []).filter((b: any) => b.type === "toolCall");
      if (toolCalls.length === 0 || round === maxRounds) {
        const usage = response.usage
          ? {
              input: response.usage.input ?? 0,
              output: response.usage.output ?? 0,
              totalTokens: response.usage.totalTokens ?? 0,
              cost: response.usage.cost?.total ?? 0,
            }
          : undefined;
        if (!lastText && toolCalls.length > 0) {
          throw new LLMError("LLM Agent 工具调用后未返回文本");
        }
        return {
          text: lastText || "（模型未返回内容）",
          usage,
          model: response.model || this.model,
          toolCalls: executedTools,
        };
      }

            // execute the tool and feed the result back into context
      context.messages.push(response);
      for (const call of toolCalls) {
        executedTools.push(call.name);
        let resultText: string;
        try {
          resultText = opts.executeTool
            ? await opts.executeTool(call.name, call.arguments || {})
            : JSON.stringify({ error: "无工具执行器" });
        } catch (err) {
          resultText = JSON.stringify({ error: (err as Error).message });
        }
        context.messages.push({
          role: "toolResult",
          toolCallId: call.id,
          toolName: call.name,
          content: [{ type: "text", text: resultText }],
          isError: false,
          timestamp: Date.now(),
        });
      }
    }
    throw new LLMError("LLM Agent 工具循环超过上限");
  }
}

/** JSON Schema (subset) -> TypeBox TSchema (required for pi-ai tool parameters) */
function jsonSchemaToTypeBox(Type: any, schema: import("./agent").JsonSchema): any {  switch (schema.type) {
    case "string":
      return Type.String(schema.description ? { description: schema.description } : undefined);
    case "number":
      return Type.Number(schema.description ? { description: schema.description } : undefined);
    case "integer":
      return Type.Integer(schema.description ? { description: schema.description } : undefined);
    case "boolean":
      return Type.Boolean(schema.description ? { description: schema.description } : undefined);
    case "array":
      return Type.Array(jsonSchemaToTypeBox(Type, schema.items || { type: "string" }));
    case "object": {
      const props: Record<string, any> = {};
      for (const [key, sub] of Object.entries(schema.properties || {})) {
        props[key] = jsonSchemaToTypeBox(Type, sub);
      }
      return Type.Object(props, { additionalProperties: false });
    }
    default:
      return Type.Any();
  }
}

/**
 * Normalize message content for pi-ai: assistant messages must carry content
 * as an array of content blocks (pi-ai's converter calls content.flatMap on
 * assistant messages; a plain string would throw).
 */
function toPiContent(
  role: string,
  content: string
): string | Array<{ type: "text"; text: string }> {
  if (role === "assistant") {
    return [{ type: "text", text: content }];
  }
  return content;
}
