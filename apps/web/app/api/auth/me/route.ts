/** GET /api/auth/me — current signed-in user (public fields) or null. */
import { NextResponse } from "next/server";
import { currentUserId } from "@/lib/server";
import { findUserById, publicUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const userId = currentUserId();
  const user = userId ? findUserById(userId) : null;
  return NextResponse.json({ user: user ? publicUser(user) : null });
}
