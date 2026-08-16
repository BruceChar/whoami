/** POST /api/auth/login — verify local credentials and set the session cookie. */
import { NextRequest, NextResponse } from "next/server";
import { verifyLocalLogin, publicUser } from "@/lib/users";
import { signSession, sessionCookieOptions, SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const user = verifyLocalLogin(body.username || "", body.password || "");
  if (!user) {
    return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true, user: publicUser(user) });
  res.cookies.set(SESSION_COOKIE, signSession(user.userId), sessionCookieOptions());
  return res;
}
