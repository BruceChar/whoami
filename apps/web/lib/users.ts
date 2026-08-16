/**
 * delphi web users — accounts registry + per-user profile directories.
 * Username: system-unique, case-insensitive, 5-64 chars (letters/digits/underscore).
 * Nickname (display name) is separate and free-form. userId is auto-generated.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { resolveDataDir, ProfileStore } from "@delphi/core";
import { hashPassword, verifyPassword } from "./auth";

export interface UserAccount {
  userId: string;
  username: string; // unique, case-insensitive
  nickname: string; // display name
  provider: "local" | "google" | "wechat";
  providerId?: string; // third-party subject id (reserved for later)
  passwordHash?: string; // local accounts only
  passwordSalt?: string; // local accounts only
  createdAt: string;
}

const USERNAME_RE = /^[a-zA-Z0-9_]{5,64}$/;

export function validateUsername(username: string): string | null {
  const u = username.trim();
  if (!USERNAME_RE.test(u)) {
    return "Username must be 5-64 characters and contain only letters, digits, or underscore.";
  }
  return null;
}

export function usersFile(): string {
  return path.join(resolveDataDir(), "users.json");
}

export function userDir(userId: string): string {
  return path.join(resolveDataDir(), "users", userId);
}

export function loadUsers(): UserAccount[] {
  try {
    const raw = fs.readFileSync(usersFile(), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

function saveUsers(users: UserAccount[]): void {
  fs.mkdirSync(resolveDataDir(), { recursive: true });
  fs.writeFileSync(usersFile(), JSON.stringify({ users }, null, 2), "utf-8");
}

export function findUserByUsername(username: string): UserAccount | null {
  const u = username.trim().toLowerCase();
  return loadUsers().find((x) => x.username.toLowerCase() === u) || null;
}

export function findUserById(userId: string): UserAccount | null {
  return loadUsers().find((x) => x.userId === userId) || null;
}

export function newUserId(): string {
  return crypto.randomUUID();
}

export function publicUser(user: UserAccount) {
  return { userId: user.userId, username: user.username, nickname: user.nickname, provider: user.provider };
}

export type CreateResult = { ok: true; user: UserAccount } | { ok: false; error: string };

export function createLocalUser(input: { username: string; password: string; nickname: string }): CreateResult {
  const username = input.username.trim();
  const nameErr = validateUsername(username);
  if (nameErr) return { ok: false, error: nameErr };
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const nickname = input.nickname.trim();
  if (!nickname) return { ok: false, error: "Nickname is required." };
  if (findUserByUsername(username)) return { ok: false, error: "Username is already taken." };

  const { salt, hash } = hashPassword(input.password);
  const user: UserAccount = {
    userId: newUserId(),
    username,
    nickname,
    provider: "local",
    passwordSalt: salt,
    passwordHash: hash,
    createdAt: new Date().toISOString(),
  };
  const users = loadUsers();
  const isFirstUser = users.length === 0;
  users.push(user);
  saveUsers(users);
  // Import the legacy single-user profile ONLY for the very first account, so
  // later accounts start from an empty workspace (no shared session lists).
  if (isFirstUser) {
    migrateLegacyProfile(user.userId);
  }
  // The nickname was already given at account creation — mirror it into the
  // user's profile so the first login doesn't ask for it again.
  ensureProfileNickname(user.userId);
  return { ok: true, user };
}

/**
 * Sync the account nickname into the user's profile (only when the profile
 * has no nickname yet). Called on registration and on login, so new accounts
 * are never prompted again for a name they already provided.
 */
export function ensureProfileNickname(userId: string): void {
  const user = findUserById(userId);
  if (!user) return;
  try {
    const store = new ProfileStore({ dataDir: userDir(userId) });
    const profile = store.get();
    if (!profile.userInfo?.nickname) {
      profile.userInfo = { ...profile.userInfo, nickname: user.nickname };
      store.save();
    }
  } catch {
    // non-fatal: the profile will sync on the next login
  }
}

/** First registration: import the legacy single-user profile (if any) into the new user's dir. */
function migrateLegacyProfile(userId: string): void {
  const dir = resolveDataDir();
  const legacy = path.join(dir, "profile.json");
  const dest = path.join(userDir(userId), "profile.json");
  if (!fs.existsSync(dest) && fs.existsSync(legacy)) {
    try {
      fs.mkdirSync(userDir(userId), { recursive: true });
      fs.copyFileSync(legacy, dest);
    } catch {
      // non-fatal
    }
  }
}

export function verifyLocalLogin(username: string, password: string): UserAccount | null {
  const user = findUserByUsername(username);
  if (!user || user.provider !== "local" || !user.passwordHash || !user.passwordSalt) return null;
  return verifyPassword(password, user.passwordSalt, user.passwordHash) ? user : null;
}
