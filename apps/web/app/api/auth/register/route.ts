/** POST /api/auth/register — create a local account (username + password + nickname). */
import { NextRequest, NextResponse } from "next/server";
import { createLocalUser, publicUser } from "@/lib/users";
import { signSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string; nickname?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const result = createLocalUser({
    username: body.username || "",
    password: body.password || "",
    nickname: body.nickname || "",
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const res = NextResponse.json({ ok: true, user: publicUser(result.user) });
  res.cookies.set(SESSION_COOKIE, signSession(result.user.userId), sessionCookieOptions());
  return res;
}
