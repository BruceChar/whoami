/**
 * GET/POST/DELETE /api/settings — LLM config, persisted to <dataDir>/config.json.
 * Provider API keys are remembered per provider: switching providers never
 * requires re-entering an already-configured key.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getConfigStatus,
  saveLLMConfig,
  SUPPORTED_PROVIDERS,
  loadLLMConfigFile,
  resetLLMProvider,
  resolveDataDir,
} from "@delphi/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const dataDir = resolveDataDir();
  const status = getConfigStatus(dataDir);
  const file = loadLLMConfigFile(dataDir);
  return NextResponse.json({
    ...status,
    supportedProviders: SUPPORTED_PROVIDERS,
    modelPlaceholder: file?.model || "deepseek-v4-flash（留空用默认）",
  });
}

export async function POST(req: NextRequest) {
  let body: { provider?: string; model?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "无效请求体" }, { status: 400 });
  }
  const provider = (body.provider || "").trim().toLowerCase();
  const model = (body.model || "").trim() || undefined;
  const apiKey = (body.apiKey || "").trim();

  if (!provider) {
    return NextResponse.json({ error: "请选择提供商" }, { status: 400 });
  }
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json(
      { error: `不支持的提供商 "${provider}"，可选: ${SUPPORTED_PROVIDERS.join(" / ")}` },
      { status: 400 }
    );
  }
  if (!apiKey) {
    // allow switching to an already-configured provider without re-entering the key
    const dataDir = resolveDataDir();
    const file = loadLLMConfigFile(dataDir);
    const existing = file?.apiKeys?.[provider]?.trim() || (provider === file?.provider ? file?.apiKey?.trim() : undefined);
    if (!existing) {
      return NextResponse.json({ error: "API Key 不能为空" }, { status: 400 });
    }
  }

  const dataDir = resolveDataDir();
  saveLLMConfig({ provider, model, apiKey }, dataDir);
  resetLLMProvider(); // invalidate the server-side singleton; rebuilt on next request

  const status = getConfigStatus(dataDir);
  return NextResponse.json({ ok: true, ...status });
}

/** DELETE — clear the saved config */
export async function DELETE() {
  const { configFilePath } = await import("@delphi/core");
  const fs = await import("fs");
  const p = configFilePath(resolveDataDir());
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  } catch {
    // ignore
  }
  resetLLMProvider();
  return NextResponse.json({ ok: true, configured: false });
}
