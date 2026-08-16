/**
 * Share-link ownership: resolve which user's profile owns a public feedback link.
 * Works with any storage backend (file / sqlite) via ProfileStore.
 */
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
    const store = new ProfileStore({ dataDir: userDir(user.userId) });
    const profile = store.get();
    const links = profile.frameworkData.feedback.shareLinks || [];
    if (Array.isArray(links) && links.some((l: { id?: string }) => l?.id === linkId)) {
      return { store, user };
    }
  }
  return null;
}
