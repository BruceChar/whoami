/**
 * delphi — user accounts & per-user workspaces.
 * Shared by the Web login and the CLI user-management commands: both operate on
 * the same <dataDir>/users.json registry and <dataDir>/users/<userId>/ profiles.
 * Username: system-unique, case-insensitive, 5-64 chars (letters/digits/underscore).
 * Nickname (display name) is separate and free-form. userId is auto-generated.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import { resolveDataDir, ProfileStore } from "../storage/store";
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

export function usersFile(dataDir?: string): string {
  return path.join(dataDir || resolveDataDir(), "users.json");
}

export function userDir(userId: string, dataDir?: string): string {
  return path.join(dataDir || resolveDataDir(), "users", userId);
}

export function loadUsers(dataDir?: string): UserAccount[] {
  try {
    const raw = fs.readFileSync(usersFile(dataDir), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

function saveUsers(users: UserAccount[], dataDir?: string): void {
  const dir = dataDir || resolveDataDir();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(usersFile(dataDir), JSON.stringify({ users }, null, 2), "utf-8");
}

export function findUserByUsername(username: string, dataDir?: string): UserAccount | null {
  const u = username.trim().toLowerCase();
  return loadUsers(dataDir).find((x) => x.username.toLowerCase() === u) || null;
}

export function findUserById(userId: string, dataDir?: string): UserAccount | null {
  return loadUsers(dataDir).find((x) => x.userId === userId) || null;
}

export function newUserId(): string {
  return crypto.randomUUID();
}

export function publicUser(user: UserAccount) {
  return { userId: user.userId, username: user.username, nickname: user.nickname, provider: user.provider };
}

export type CreateResult = { ok: true; user: UserAccount } | { ok: false; error: string };

export function createLocalUser(
  input: { username: string; password: string; nickname: string },
  dataDir?: string
): CreateResult {
  const username = input.username.trim();
  const nameErr = validateUsername(username);
  if (nameErr) return { ok: false, error: nameErr };
  if (!input.password || input.password.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const nickname = input.nickname.trim();
  if (!nickname) return { ok: false, error: "Nickname is required." };
  if (findUserByUsername(username, dataDir)) return { ok: false, error: "Username is already taken." };

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
  const users = loadUsers(dataDir);
  const isFirstUser = users.length === 0;
  users.push(user);
  saveUsers(users, dataDir);
  // Import the legacy single-user profile ONLY for the very first account, so
  // later accounts start from an empty workspace (no shared session lists).
  if (isFirstUser) {
    migrateLegacyProfile(user.userId, dataDir);
  }
  // The nickname was already given at account creation — mirror it into the
  // user's profile so the first login doesn't ask for it again.
  ensureProfileNickname(user.userId, dataDir);
  return { ok: true, user };
}

/** First registration: import the legacy single-user profile (if any) into the new user's dir. */
function migrateLegacyProfile(userId: string, dataDir?: string): void {
  const dir = dataDir || resolveDataDir();
  const legacy = path.join(dir, "profile.json");
  const dest = path.join(userDir(userId, dataDir), "profile.json");
  if (!fs.existsSync(dest) && fs.existsSync(legacy)) {
    try {
      fs.mkdirSync(userDir(userId, dataDir), { recursive: true });
      fs.copyFileSync(legacy, dest);
    } catch {
      // non-fatal
    }
  }
}

/**
 * Sync the account nickname into the user's profile (only when the profile
 * has no nickname yet). Called on registration and on login, so new accounts
 * are never prompted again for a name they already provided.
 */
export function ensureProfileNickname(userId: string, dataDir?: string): void {
  const user = findUserById(userId, dataDir);
  if (!user) return;
  try {
    const store = new ProfileStore({ dataDir: userDir(userId, dataDir) });
    const profile = store.get();
    if (!profile.userInfo?.nickname) {
      profile.userInfo = { ...profile.userInfo, nickname: user.nickname };
      store.save();
    }
  } catch {
    // non-fatal: the profile will sync on the next login
  }
}

export function verifyLocalLogin(username: string, password: string, dataDir?: string): UserAccount | null {
  const user = findUserByUsername(username, dataDir);
  if (!user || user.provider !== "local" || !user.passwordHash || !user.passwordSalt) return null;
  return verifyPassword(password, user.passwordSalt, user.passwordHash) ? user : null;
}

// ---------------------------------------------------------------------------
// management operations (used by the CLI admin tool)
// ---------------------------------------------------------------------------

export type OpResult = { ok: true } | { ok: false; error: string };

export function resetUserPassword(username: string, newPassword: string, dataDir?: string): OpResult {
  if (!newPassword || newPassword.length < 6) {
    return { ok: false, error: "Password must be at least 6 characters." };
  }
  const user = findUserByUsername(username, dataDir);
  if (!user) return { ok: false, error: `User "${username}" not found.` };
  if (user.provider !== "local") {
    return { ok: false, error: `User "${username}" is a ${user.provider} account; password cannot be reset.` };
  }
  const { salt, hash } = hashPassword(newPassword);
  const users = loadUsers(dataDir);
  const target = users.find((u) => u.userId === user.userId);
  if (!target) return { ok: false, error: `User "${username}" not found.` };
  target.passwordSalt = salt;
  target.passwordHash = hash;
  saveUsers(users, dataDir);
  return { ok: true };
}

export function renameUser(username: string, nickname: string, dataDir?: string): OpResult {
  const nick = nickname.trim();
  if (!nick) return { ok: false, error: "Nickname is required." };
  const users = loadUsers(dataDir);
  const target = users.find((u) => u.username.toLowerCase() === username.trim().toLowerCase());
  if (!target) return { ok: false, error: `User "${username}" not found.` };
  target.nickname = nick;
  saveUsers(users, dataDir);
  // also update the profile nickname if it matches the old account nickname
  const profile = new ProfileStore({ dataDir: userDir(target.userId, dataDir) }).get();
  if (profile.userInfo?.nickname === nick || !profile.userInfo?.nickname) {
    profile.userInfo = { ...profile.userInfo, nickname: nick };
    new ProfileStore({ dataDir: userDir(target.userId, dataDir) }).save();
  }
  return { ok: true };
}

export function deleteUser(username: string, dataDir?: string): OpResult {
  const user = findUserByUsername(username, dataDir);
  if (!user) return { ok: false, error: `User "${username}" not found.` };
  const users = loadUsers(dataDir).filter((u) => u.userId !== user.userId);
  saveUsers(users, dataDir);
  try {
    fs.rmSync(userDir(user.userId, dataDir), { recursive: true, force: true });
  } catch {
    // non-fatal
  }
  return { ok: true };
}

/** Reset a user's workspace: wipe the profile but keep the account. */
export function clearUserWorkspace(username: string, dataDir?: string): OpResult {
  const user = findUserByUsername(username, dataDir);
  if (!user) return { ok: false, error: `User "${username}" not found.` };
  const dir = userDir(user.userId, dataDir);
  try {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
  } catch {
    // non-fatal
  }
  ensureProfileNickname(user.userId, dataDir);
  return { ok: true };
}

/** Export a user's profile to the data dir exports folder; returns the path. */
export function exportUserWorkspace(username: string, dataDir?: string): { ok: true; path: string } | { ok: false; error: string } {
  const user = findUserByUsername(username, dataDir);
  if (!user) return { ok: false, error: `User "${username}" not found.` };
  const store = new ProfileStore({ dataDir: userDir(user.userId, dataDir) });
  try {
    const dest = store.exportJson();
    return { ok: true, path: dest };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
