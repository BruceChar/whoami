/**
 * delphi —— LLM 注册表（配置解析 + 单例 + 配置文件支持）
 *
 * 离线模式已取消：API Key 必须配置，否则 CLI 弹出帮助信息、Web 提示去设置。
 *
 * 配置来源（优先级：环境变量 > 配置文件）：
 *   1. 环境变量
 *      DELPHI_LLM_PROVIDER  提供商: deepseek|openai|anthropic|openrouter|google
 *      DELPHI_LLM_MODEL     模型 id（缺省用各提供商默认模型）
 *      <PROVIDER>_API_KEY   pi-ai 鉴权（如 DEEPSEEK_API_KEY）
 *   2. 配置文件  <dataDir>/config.json
 *      { "provider": "...", "model": "...", "apiKey": "..." }
 *      （Web 端「设置」按钮写入；dataDir = DELPHI_DATA_DIR 或 ~/.delphi）
 */
import * as fs from "fs";
import * as path from "path";
import { LLMProvider } from "./types";
import { LLMAgent } from "./agent";
import { PiAiProvider, PROVIDER_ENV_KEYS } from "./piAiProvider";
import { resolveDataDir } from "../storage/store";

export const SUPPORTED_PROVIDERS = ["deepseek", "openai", "anthropic", "openrouter", "google"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

export interface LLMConfig {
  provider: SupportedProvider;
  model?: string;
  apiKey?: string;
  /** 配置来源：env=环境变量 file=配置文件 */
  source: "env" | "file";
}

/** 未配置 LLM 时抛出（消息即帮助信息） */
export class LLMNotConfiguredError extends Error {
  constructor(message?: string) {
    super(message || llmConfigHelp());
    this.name = "LLMNotConfiguredError";
  }
}

export interface LLMConfigFile {
  provider?: string;
  model?: string;
  apiKey?: string;
}

// ---------------------------------------------------------------------------
// 配置文件读写
// ---------------------------------------------------------------------------

export function configFilePath(dataDir?: string): string {
  return path.join(dataDir || resolveDataDir(), "config.json");
}

export function loadLLMConfigFile(dataDir?: string): LLMConfigFile | null {
  try {
    const p = configFilePath(dataDir);
    if (!fs.existsSync(p)) return null;
    return JSON.parse(fs.readFileSync(p, "utf-8")) as LLMConfigFile;
  } catch {
    return null;
  }
}

export function saveLLMConfigFile(cfg: LLMConfigFile, dataDir?: string): void {
  const dir = dataDir || resolveDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configFilePath(dir), JSON.stringify(cfg, null, 2), "utf-8");
}

/** 当前配置状态（doctor / Web 设置页用），key 脱敏 */
export interface LLMConfigStatus {
  configured: boolean;
  provider?: string;
  model?: string;
  apiKeyMasked?: string;
  source?: "env" | "file" | "none";
}

export function getConfigStatus(dataDir?: string): LLMConfigStatus {
  const config = resolveLLMConfig(dataDir);
  if (!config) {
    return { configured: false, source: "none" };
  }
  const masked = config.apiKey
    ? `${config.apiKey.slice(0, 4)}****${config.apiKey.slice(-4)}`
    : undefined;
  return {
    configured: true,
    provider: config.provider,
    model: config.model,
    apiKeyMasked: masked,
    source: config.source,
  };
}

// ---------------------------------------------------------------------------
// 配置解析
// ---------------------------------------------------------------------------

/** 解析 LLM 配置；未配置任何 Key 时返回 null */
export function resolveLLMConfig(dataDir?: string): LLMConfig | null {
  const file = loadLLMConfigFile(dataDir);

  const explicitProvider = process.env.DELPHI_LLM_PROVIDER?.trim().toLowerCase();
  const model = (process.env.DELPHI_LLM_MODEL || file?.model || "").trim() || undefined;
  const fileKey = file?.apiKey?.trim() || undefined;

  // 1) 显式环境变量提供商（需配对应 Key）
  if (explicitProvider) {
    if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(explicitProvider)) {
      throw new LLMNotConfiguredError(
        `[delphi] 未知 LLM 提供商 "${explicitProvider}"。支持: ${SUPPORTED_PROVIDERS.join(" / ")}\n\n` + llmConfigHelp()
      );
    }
    const envKey = process.env[PROVIDER_ENV_KEYS[explicitProvider]] || fileKey;
    if (!envKey) {
      throw new LLMNotConfiguredError();
    }
    return {
      provider: explicitProvider as SupportedProvider,
      model,
      apiKey: envKey,
      source: process.env[PROVIDER_ENV_KEYS[explicitProvider]] ? "env" : "file",
    };
  }

  // 2) 配置文件（Web「设置」页写入）
  if (fileKey && file?.provider) {
    const provider = file.provider.trim().toLowerCase() as SupportedProvider;
    if ((SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
      return { provider, model, apiKey: fileKey, source: "file" };
    }
  }

  // 3) 自动探测环境变量
  for (const provider of SUPPORTED_PROVIDERS) {
    const key = process.env[PROVIDER_ENV_KEYS[provider]];
    if (key) {
      return { provider, model, apiKey: key, source: "env" };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// 单例（按配置签名缓存，配置变化自动重建）
// ---------------------------------------------------------------------------

let cached: { key: string; value: (LLMProvider & LLMAgent) | null } | null = null;
/** 由本模块注入到 process.env 的 Key（便于清除配置时一并清理） */
const injectedEnvKeys = new Set<string>();

/** 获取 LLM Provider 单例；未配置时返回 null */
export function getLLMProvider(dataDir?: string): (LLMProvider & LLMAgent) | null {
  const config = resolveLLMConfig(dataDir);
  const key = config ? JSON.stringify(config) : "null";
  if (cached && cached.key === key) return cached.value;
  let value: (LLMProvider & LLMAgent) | null = null;
  if (config) {
    // 文件配置：把 apiKey 注入 pi-ai 读取的环境变量（跟踪以便清理）
    if (config.source === "file" && config.apiKey) {
      const envKey = PROVIDER_ENV_KEYS[config.provider];
      if (!process.env[envKey]) {
        process.env[envKey] = config.apiKey;
        injectedEnvKeys.add(envKey);
      }
    }
    value = new PiAiProvider({ providerId: config.provider, modelId: config.model });
  }
  cached = { key, value };
  return value;
}

/** 必须拿到 LLM Provider，否则抛出 LLMNotConfiguredError（含配置帮助） */
export function requireLLMProvider(dataDir?: string): LLMProvider & LLMAgent {
  const provider = getLLMProvider(dataDir);
  if (!provider) {
    throw new LLMNotConfiguredError();
  }
  return provider;
}

/** 测试/配置变更用：清理注入的 Key 并重置单例缓存 */
export function resetLLMProvider(): void {
  for (const k of injectedEnvKeys) {
    delete process.env[k];
  }
  injectedEnvKeys.clear();
  cached = null;
}

/** 配置帮助信息（CLI 未配置时弹出） */
export function llmConfigHelp(): string {
  return [
    "⚠ delphi 需要配置 LLM API Key 才能使用（离线模式已取消）。",
    "",
    "方式一：环境变量",
    "  export DELPHI_LLM_PROVIDER=deepseek      # deepseek|openai|anthropic|openrouter|google",
    "  export DEEPSEEK_API_KEY=sk-你的密钥",
    "  export DELPHI_LLM_MODEL=deepseek-v4-flash # 可选，缺省用默认模型",
    "",
    "方式二：配置文件（Web 端「设置」页也会写入这里）",
    "  编辑 " + configFilePath() + " 为：",
    '  { "provider": "deepseek", "model": "deepseek-v4-flash", "apiKey": "sk-你的密钥" }',
    "",
    "支持提供商与 Key 环境变量：",
    "  deepseek → DEEPSEEK_API_KEY",
    "  openai → OPENAI_API_KEY",
    "  anthropic → ANTHROPIC_API_KEY",
    "  openrouter → OPENROUTER_API_KEY",
    "  google → GOOGLE_API_KEY",
    "",
    "查看命令帮助：delphi --help",
  ].join("\n");
}
