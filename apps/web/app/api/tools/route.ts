/** GET /api/tools —— 工具模板列表（输入 / 弹出） */
import { NextResponse } from "next/server";
import { TOOL_TEMPLATES } from "@delphi/core";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    tools: TOOL_TEMPLATES.map(({ id, label, emoji, description }) => ({ id, label, emoji, description })),
  });
}
