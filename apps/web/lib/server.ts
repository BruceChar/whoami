/**
 * delphi Web — shared server-side helpers.
 * local mode:  single local user, data in <dataDir>/profile.json (no login).
 * hosted mode: per signed-in user workspace (<dataDir>/users/<id>/).
 */
import { cookies } from "next/headers";
import { cache } from "react";
import { ProfileStore, getLLMProvider, UserCognitiveProfile, LLMAgent, resolveDataDir } from "@delphi/core";
import * as path from "path";
import { SESSION_COOKIE, verifySession } from "./auth";
import { userDir, findUserById } from "./users";
import { deployMode } from "./mode";

/** Current signed-in user id, or null (always null in local mode). */
export function currentUserId(): string | null {
  if (deployMode() === "local") return null;
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifySession(token);
  if (!payload) return null;
  return findUserById(payload.uid) ? payload.uid : null;
}

/** True when this request must be authenticated (hosted mode & not signed in). */
export function authRequired(): boolean {
  return deployMode() === "hosted" && !currentUserId();
}

/** ProfileStore bound to the current context. */
export function getStore(): ProfileStore {
  if (deployMode() === "local") {
    return new ProfileStore(); // single local user at the data-dir root
  }
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
