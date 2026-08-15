/**
 * delphi —— LLM 注册表（env 配置解析 + 单例）
 *
 * 环境变量：
 *   DELPHI_LLM_PROVIDER  提供商: deepseek|openai|anthropic|openrouter|google
 *   DELPHI_LLM_MODEL     模型 id（缺省用各提供商默认模型）
 *   DELPHI_LLM_DISABLED  设为 1 强制关闭 LLM（回退规则引擎）
 *   <PROVIDER>_API_KEY   pi-ai 鉴权（如 DEEPSEEK_API_KEY / OPENROUTER_API_KEY）
 */
import { LLMProvider } from "./types";
import { LLMAgent } from "./agent";
import { PiAiProvider } from "./piAiProvider";

export const SUPPORTED_PROVIDERS = ["deepseek", "openai", "anthropic", "openrouter", "google"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface LLMConfig {
  provider: SupportedProvider;
  model?: string;
}

/** 从环境变量解析 LLM 配置；未配置任何 Key 时返回 null */
export function resolveLLMConfig(): LLMConfig | null {
  if (process.env.DELPHI_LLM_DISABLED === "1" || process.env.DELPHI_LLM_DISABLED === "true") {
    return null;
  }
  const providerRaw = process.env.DELPHI_LLM_PROVIDER?.trim().toLowerCase();
  const model = process.env.DELPHI_LLM_MODEL?.trim() || undefined;

  if (providerRaw) {
    if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(providerRaw)) {
      console.warn(`[delphi] 未知 LLM 提供商 "${providerRaw}"，回退规则引擎。支持: ${SUPPORTED_PROVIDERS.join(", ")}`);
      return null;
    }
    return { provider: providerRaw as SupportedProvider, model };
  }

  // 自动探测：第一个配置了 API Key 的提供商
  const { PROVIDER_ENV_KEYS } = require("./piAiProvider") as typeof import("./piAiProvider");
  for (const provider of SUPPORTED_PROVIDERS) {
    const key = PROVIDER_ENV_KEYS[provider];
    if (key && process.env[key]) {
      return { provider, model };
    }
  }
  return null;
}

let cachedProvider: (LLMProvider & LLMAgent) | null | undefined;

/** 获取 LLM Provider 单例；未配置时返回 null（走规则引擎） */
export function getLLMProvider(): (LLMProvider & LLMAgent) | null {
  if (cachedProvider !== undefined) return cachedProvider;
  const config = resolveLLMConfig();
  cachedProvider = config ? new PiAiProvider({ providerId: config.provider, modelId: config.model }) : null;
  return cachedProvider;
}

/** 测试用：重置单例 */
export function resetLLMProvider(): void {
  cachedProvider = undefined;
}
