/**
 * Share-link ownership: resolve which user's profile owns a public feedback link.
 * Scans per-user profile dirs (small scale; could be replaced by an index).
 */
import * as fs from "fs";
import * as path from "path";
import { ProfileStore } from "@delphi/core";
import { loadUsers, userDir } from "./users";

export function findProfileForShareLink(linkId: string): ProfileStore | null {
  if (!linkId) return null;
  for (const user of loadUsers()) {
    const p = path.join(userDir(user.userId), "profile.json");
    if (!fs.existsSync(p)) continue;
    try {
      const profile = JSON.parse(fs.readFileSync(p, "utf-8"));
      const links = profile?.frameworkData?.feedback?.shareLinks || [];
      if (Array.isArray(links) && links.some((l: { id?: string }) => l?.id === linkId)) {
        return new ProfileStore({ dataDir: userDir(user.userId) });
      }
    } catch {
      // skip unreadable profiles
    }
  }
  return null;
}
