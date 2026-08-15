/**
 * delphi —— pi-ai LLM Provider 实现
 * 基于 @earendil-works/pi-ai（Unified LLM API：自动模型发现 + 提供商配置 + 工具调用）。
 *
 * 说明：
 * - pi-ai 为 ESM-only 包，这里通过动态 import() 从 CJS 调用（Node 20+ 支持）。
 * - 只注册选中的提供商工厂（按需加载，不引入全部 SDK）。
 * - 鉴权走环境变量（DEEPSEEK_API_KEY / OPENAI_API_KEY / ANTHROPIC_API_KEY / OPENROUTER_API_KEY / GOOGLE_API_KEY）。
 */
import { LLMCompleteOptions, LLMError, LLMJSONOptions, LLMMessage, LLMProvider, LLMResult } from "./types";
import { extractJSONAs } from "./json";
import { dynamicImport } from "./dynamicImport";
import { AgentToolDef, LLMAgent, LLMAgentResult } from "./agent";

type AnyModels = any;

/** 提供商 id → 工厂模块子路径 */
const PROVIDER_MODULES: Record<string, string> = {
  deepseek: "@earendil-works/pi-ai/providers/deepseek",
  openai: "@earendil-works/pi-ai/providers/openai",
  anthropic: "@earendil-works/pi-ai/providers/anthropic",
  openrouter: "@earendil-works/pi-ai/providers/openrouter",
  google: "@earendil-works/pi-ai/providers/google",
};

/** 提供商 id → 环境变量名（用于 isConfigured） */
export const PROVIDER_ENV_KEYS: Record<string, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  google: "GOOGLE_API_KEY",
};

/** 各提供商的默认模型候选（按性价比优先） */
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
  /** 测试注入：自定义 models 集合装配（覆盖默认提供商注册） */
  setup?: (models: AnyModels) => void | Promise<void>;
  /** 测试注入：自定义模型查找 */
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

  /** 解析模型对象（含默认模型回退） */
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
    // 默认模型候选
    for (const candidate of DEFAULT_MODEL_CANDIDATES[this.id] || []) {
      const found = models.getModel(this.id, candidate);
      if (found) return found;
    }
    // 兜底：取目录中成本最低的模型
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
          content: m.content,
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
          "你是一个严格的结构化输出助手。只输出一个合法的 JSON 值（对象或数组），不要输出任何解释、前后缀或 Markdown 代码围栏。\n期望结构：\n" +
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
  // LLMAgent：工具调用循环（complete → toolCall → toolResult → complete）
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
        content: m.content,
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

      // 执行工具并把结果回灌上下文
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

/** JSON Schema（子集）→ TypeBox TSchema（pi-ai 工具参数需要） */
function jsonSchemaToTypeBox(Type: any, schema: import("./agent").JsonSchema): any {
  switch (schema.type) {
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
