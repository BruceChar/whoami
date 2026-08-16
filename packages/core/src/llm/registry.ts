/** delphi — LLM registry (config resolution + singleton + config file). */
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
    /** Config source: env=environment variable, file=config file */
  source: "env" | "file";
}

/** Thrown when no LLM is configured (message doubles as help text) */
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
// config file read/write
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

/** Current config status (for doctor / web settings); key masked */
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
// config resolution
// ---------------------------------------------------------------------------

/** Resolve the LLM config; null when no key is configured */
export function resolveLLMConfig(dataDir?: string): LLMConfig | null {
  const file = loadLLMConfigFile(dataDir);

  const explicitProvider = process.env.DELPHI_LLM_PROVIDER?.trim().toLowerCase();
  const model = (process.env.DELPHI_LLM_MODEL || file?.model || "").trim() || undefined;
  const fileKey = file?.apiKey?.trim() || undefined;

    // 1) explicit env provider (needs its key)
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

    // 2) config file (written by the web Settings page)
  if (fileKey && file?.provider) {
    const provider = file.provider.trim().toLowerCase() as SupportedProvider;
    if ((SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
      return { provider, model, apiKey: fileKey, source: "file" };
    }
  }

    // 3) auto-detect env vars
  for (const provider of SUPPORTED_PROVIDERS) {
    const key = process.env[PROVIDER_ENV_KEYS[provider]];
    if (key) {
      return { provider, model, apiKey: key, source: "env" };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// singleton (cached by config signature; rebuilt when config changes)
// ---------------------------------------------------------------------------

let cached: { key: string; value: (LLMProvider & LLMAgent) | null } | null = null;
  /** Env keys injected by this module (cleaned up when config is cleared) */
const injectedEnvKeys = new Set<string>();

  /** Get the LLM provider singleton; null when unconfigured */
export function getLLMProvider(dataDir?: string): (LLMProvider & LLMAgent) | null {
  const config = resolveLLMConfig(dataDir);
  const key = config ? JSON.stringify(config) : "null";
  if (cached && cached.key === key) return cached.value;
  let value: (LLMProvider & LLMAgent) | null = null;
  if (config) {
        // file config: inject the apiKey into the env pi-ai reads (tracked for cleanup)
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

  /** Get the LLM provider or throw LLMNotConfiguredError (with help text) */
export function requireLLMProvider(dataDir?: string): LLMProvider & LLMAgent {
  const provider = getLLMProvider(dataDir);
  if (!provider) {
    throw new LLMNotConfiguredError();
  }
  return provider;
}

  /** Tests/config changes: clear injected keys and reset the cache */
export function resetLLMProvider(): void {
  for (const k of injectedEnvKeys) {
    delete process.env[k];
  }
  injectedEnvKeys.clear();
  cached = null;
}

/** Config help text (shown by the CLI when unconfigured) */
export function llmConfigHelp(): string {
  return [
    "⚠ delphi 需要配置 LLM API Key 才能使用。",
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
