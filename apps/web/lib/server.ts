/**
 * delphi Web — shared server-side helpers.
 * Data is resolved per signed-in user (each user gets their own profile dir);
 * the CLI keeps using the plain DELPHI_DATA_DIR / ~/.delphi directly.
 */
import { cookies } from "next/headers";
import { cache } from "react";
import { ProfileStore, getLLMProvider, UserCognitiveProfile, LLMAgent, resolveDataDir } from "@delphi/core";
import * as path from "path";
import { SESSION_COOKIE, verifySession } from "./auth";
import { userDir, findUserById } from "./users";

/** Current signed-in user id, or null. */
export function currentUserId(): string | null {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  return findUserById(payload.uid) ? payload.uid : null;
}

/** ProfileStore bound to the current user (guarded routes redirect before this). */
export function getStore(): ProfileStore {
  const userId = currentUserId();
  const dir = userId ? userDir(userId) : path.join(resolveDataDir(), "_anon");
  return new ProfileStore({ dataDir: dir });
}

export const getProfile = cache((): UserCognitiveProfile => {
  return getStore().get();
});

export function getAgent(): (LLMAgent & import("@delphi/core").LLMProvider) | null {
  return getLLMProvider();
}
