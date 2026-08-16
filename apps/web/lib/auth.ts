/**
 * Web auth — thin re-export of the shared auth primitives (in @delphi/core),
 * plus the web session cookie name/options.
 */
export { hashPassword, verifyPassword, signSession, verifySession, authSecret } from "@delphi/core";

export const SESSION_COOKIE = "delphi_session";

export function sessionCookieOptions(maxAge = 30 * 24 * 3600) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
