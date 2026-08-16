/** GET /api/models?provider=xxx — list available models for a provider. */
import { NextRequest, NextResponse } from "next/server";
import { listProviderModels, SUPPORTED_PROVIDERS } from "@delphi/core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const provider = (req.nextUrl.searchParams.get("provider") || "").trim().toLowerCase();
  if (!provider || !(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    return NextResponse.json({ provider, models: [] });
  }
  const models = await listProviderModels(provider);
  return NextResponse.json({ provider, models });
}
