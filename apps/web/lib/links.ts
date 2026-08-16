/**
 * Share-link ownership: resolve which user's profile owns a public feedback link.
 * Scans per-user profile dirs (small scale; could be replaced by an index).
 */
import * as fs from "fs";
import * as path from "path";
import { ProfileStore, UserAccount } from "@delphi/core";
import { loadUsers, userDir } from "./users";
import { deployMode } from "./mode";

export interface LinkOwner {
  store: ProfileStore;
  user: UserAccount;
}

/** In local mode there is a single local user; the share link lives in the root profile. */
function localOwner(linkId: string): LinkOwner | null {
  const store = new ProfileStore();
  const profile = store.get();
  const links = profile.frameworkData.feedback.shareLinks || [];
  if (Array.isArray(links) && links.some((l: { id?: string }) => l?.id === linkId)) {
    const localUser: UserAccount = {
      userId: "local",
      username: "local",
      nickname: profile.userInfo?.nickname || "delphi user",
      provider: "local",
      createdAt: profile.createdAt,
    };
    return { store, user: localUser };
  }
  return null;
}

export function findProfileForShareLink(linkId: string): LinkOwner | null {
  if (!linkId) return null;
  if (deployMode() === "local") return localOwner(linkId);
  for (const user of loadUsers()) {
    const p = path.join(userDir(user.userId), "profile.json");
    if (!fs.existsSync(p)) continue;
    try {
      const profile = JSON.parse(fs.readFileSync(p, "utf-8"));
      const links = profile?.frameworkData?.feedback?.shareLinks || [];
      if (Array.isArray(links) && links.some((l: { id?: string }) => l?.id === linkId)) {
        return { store: new ProfileStore({ dataDir: userDir(user.userId) }), user };
      }
    } catch {
      // skip unreadable profiles
    }
  }
  return null;
}
