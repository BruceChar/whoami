/**
 * Deployment mode — same codebase, different storage/security behavior:
 *  - local  (default): single local user, no login, data in local files.
 *  - hosted: multi-user accounts (login required), data in a database
 *           (Vercel / Neon / Supabase etc. — persistent backend).
 * Selected via the DELPHI_MODE environment variable.
 */
export type DeployMode = "local" | "hosted";

export function deployMode(): DeployMode {
  const m = (process.env.DELPHI_MODE || "").trim().toLowerCase();
  return m === "hosted" ? "hosted" : "local";
}
