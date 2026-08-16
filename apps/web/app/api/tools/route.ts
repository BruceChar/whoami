/** GET /api/tools — tool templates for the / menu */
import { NextResponse } from "next/server";
import { TOOL_TEMPLATES } from "@delphi/core";

export const runtime = "nodejs";

export function GET() {
  return NextResponse.json({
    tools: TOOL_TEMPLATES.map(({ id, label, emoji, description }) => ({ id, label, emoji, description })),
  });
}
