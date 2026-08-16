/**
 * delphi web auth — scrypt password hashing + stateless HMAC session cookies.
 * No real identity info is required: accounts are just username + password
 * (Google / WeChat providers are reserved for later).
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { resolveDataDir } from "@delphi/core";

const SESSION_TTL_MS = 30 * 24 * 3600 * 1000; // 30 days

export const SESSION_COOKIE = "delphi_session";

/** Stable server-side secret: env override, else persisted under the data dir. */
function authSecret(): string {
  const env = process.env.DELPHI_AUTH_SECRET;
  if (env && env.trim()) return env.trim();
  const dir = resolveDataDir();
  const file = path.join(dir, ".auth-secret");
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, "utf-8").trim();
      if (existing) return existing;
    }
  } catch {
    // fall through to (re)create
  }
  const secret = crypto.randomBytes(32).toString("hex");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, secret, { encoding: "utf-8", mode: 0o600 });
  return secret;
}

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  try {
    const candidate = crypto.scryptSync(password, salt, 64);
    const stored = Buffer.from(hash, "hex");
    return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  uid: string;
  exp: number;
}

export function signSession(uid: string): string {
  const body = Buffer.from(JSON.stringify({ uid, exp: Date.now() + SESSION_TTL_MS })).toString("base64url");
  const sig = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const [body, sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = crypto.createHmac("sha256", authSecret()).update(body).digest("base64url");
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SessionPayload;
    if (typeof payload.uid !== "string" || typeof payload.exp !== "number") return null;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(maxAge = 30 * 24 * 3600) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}
