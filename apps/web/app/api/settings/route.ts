/**
 * GET/POST /api/settings —— LLM 配置（写入 <dataDir>/config.json，Web「设置」按钮）
 * 离线模式已取消：API Key 必须配置。
 */
import { NextRequest, NextResponse } from "next/server";
import {
  getConfigStatus,
  saveLLMConfigFile,
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
    return NextResponse.json({ error: "API Key 不能为空（离线模式已取消）" }, { status: 400 });
  }

  const dataDir = resolveDataDir();
  saveLLMConfigFile({ provider, model, apiKey }, dataDir);
  resetLLMProvider(); // 使服务端缓存失效，下次请求重建 Provider

  const status = getConfigStatus(dataDir);
  return NextResponse.json({ ok: true, ...status });
}

/** DELETE —— 清除配置 */
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
