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
  getModelInfo,
  DEFAULT_MODEL_CANDIDATES,
  PROVIDER_DEFAULT_CONTEXT,
} from "@delphi/core";
import type { SupportedProvider } from "@delphi/core";
import { authRequired } from "@/lib/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (authRequired()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const dataDir = resolveDataDir();
  const status = getConfigStatus(dataDir);
  const file = loadLLMConfigFile(dataDir);
  // context window of the currently configured model (for the usage ring)
  let contextWindow: number | undefined;
  let effectiveModel: string | undefined;
  if (status.provider) {
    effectiveModel = file?.model || DEFAULT_MODEL_CANDIDATES[status.provider]?.[0];
    if (effectiveModel) {
      const info = await getModelInfo(status.provider, effectiveModel);
      contextWindow = info?.contextWindow || PROVIDER_DEFAULT_CONTEXT[status.provider];
    }
  }
  return NextResponse.json({
    ...status,
    supportedProviders: SUPPORTED_PROVIDERS,
    modelPlaceholder: file?.model || "deepseek-v4-flash (leave empty for default)",
    contextWindow,
    effectiveModel,
  });
}

export async function POST(req: NextRequest) {
  if (authRequired()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  let body: { provider?: string; model?: string; apiKey?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const provider = (body.provider || "").trim().toLowerCase();
  const model = (body.model || "").trim() || undefined;
  const apiKey = (body.apiKey || "").trim();

  if (!provider) {
    return NextResponse.json({ error: "Please choose a provider" }, { status: 400 });
  }
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json(
      { error: `Unsupported provider "${provider}". Choose one of: ${SUPPORTED_PROVIDERS.join(" / ")}` },
      { status: 400 }
    );
  }
  if (!apiKey) {
    // allow switching to an already-configured provider without re-entering the key
    const dataDir = resolveDataDir();
    const file = loadLLMConfigFile(dataDir);
    const existing = file?.apiKeys?.[provider]?.trim() || (provider === file?.provider ? file?.apiKey?.trim() : undefined);
    if (!existing) {
      return NextResponse.json({ error: "API Key is required" }, { status: 400 });
    }
  }

  const dataDir = resolveDataDir();
  saveLLMConfig({ provider: provider as SupportedProvider, model, apiKey }, dataDir);
  resetLLMProvider(); // invalidate the server-side singleton; rebuilt on next request

  const status = getConfigStatus(dataDir);
  return NextResponse.json({ ok: true, ...status });
}

/** DELETE — clear the saved config */
export async function DELETE() {
  if (authRequired()) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
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
