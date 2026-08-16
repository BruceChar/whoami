/**
 * delphi — storage backends.
 *
 * The logical model is a set of JSON documents (profile / users / config /
 * per-user profiles). Where those documents physically live is pluggable:
 *
 *   - file   : JSON files under <dataDir> (human-readable, zero-dep)
 *   - sqlite : single delphi.db under <dataDir> (transactional, zero native deps
 *              via node:sqlite; the DEFAULT for local use)
 *   - postgres: hosted production (async adapter — planned, see DEPLOYMENT.md)
 *
 * Selected via the DELPHI_STORAGE environment variable.
 */
import * as fs from "fs";
import * as path from "path";
import { DatabaseSync } from "node:sqlite";
import { resolveDataDir } from "./store";

export interface StorageBackend {
  readonly id: "file" | "sqlite";
  read(key: string): string | null;
  write(key: string, value: string): void;
  remove(key: string): void;
  list(prefix: string): string[];
}

// ---------------------------------------------------------------------------
// file backend
// ---------------------------------------------------------------------------

export class FileStorageBackend implements StorageBackend {
  readonly id = "file" as const;
  constructor(private root: string) {
    fs.mkdirSync(root, { recursive: true });
  }

  private path(key: string): string {
    return path.join(this.root, ...key.split("/").filter(Boolean));
  }

  read(key: string): string | null {
    try {
      return fs.readFileSync(this.path(key), "utf-8");
    } catch {
      return null;
    }
  }

  write(key: string, value: string): void {
    const p = this.path(key);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const tmp = `${p}.tmp`;
    fs.writeFileSync(tmp, value, "utf-8");
    fs.renameSync(tmp, p); // atomic replace
  }

  remove(key: string): void {
    try {
      fs.unlinkSync(this.path(key));
    } catch {
      // ignore
    }
  }

  list(prefix: string): string[] {
    const out: string[] = [];
    const walk = (dir: string, rel: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = rel ? `${rel}/${e.name}` : e.name;
        if (e.isDirectory()) walk(path.join(dir, e.name), r);
        else if (e.isFile() && r.startsWith(prefix)) out.push(r);
      }
    };
    if (fs.existsSync(this.root)) walk(this.root, "");
    return out;
  }
}

// ---------------------------------------------------------------------------
// sqlite backend (node:sqlite, sync, zero native deps)
// ---------------------------------------------------------------------------

const DOC_KEYS = ["profile.json", "users.json", "config.json"];

export class SqliteStorageBackend implements StorageBackend {
  readonly id = "sqlite" as const;
  private db: DatabaseSync;

  constructor(private root: string) {
    fs.mkdirSync(root, { recursive: true });
    this.db = new DatabaseSync(path.join(root, "delphi.db"));
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)");
    this.importLegacyFiles();
  }

  /** One-time import: copy existing JSON documents into the DB (no data loss on switch). */
  private importLegacyFiles(): void {
    const row = this.db.prepare("SELECT COUNT(*) AS n FROM kv").get() as { n: number };
    if (row.n > 0) return;
    for (const name of DOC_KEYS) {
      const p = path.join(this.root, name);
      if (fs.existsSync(p)) {
        try {
          this.write(name, fs.readFileSync(p, "utf-8"));
        } catch {
          // skip unreadable files
        }
      }
    }
  }

  read(key: string): string | null {
    const row = this.db.prepare("SELECT v FROM kv WHERE k = ?").get(key) as { v: string } | undefined;
    return row ? row.v : null;
  }

  write(key: string, value: string): void {
    this.db
      .prepare("INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .run(key, value);
  }

  remove(key: string): void {
    this.db.prepare("DELETE FROM kv WHERE k = ?").run(key);
  }

  list(prefix: string): string[] {
    const rows = this.db.prepare("SELECT k FROM kv WHERE k LIKE ?").all(`${prefix}%`) as Array<{ k: string }>;
    return rows.map((r) => r.k);
  }
}

// ---------------------------------------------------------------------------
// resolution
// ---------------------------------------------------------------------------

const backendCache = new Map<string, StorageBackend>();

/** Resolve the storage backend for a data dir (DELPHI_STORAGE=file|sqlite|postgres). */
export function resolveStorageBackend(dataDir?: string, envOverride?: string): StorageBackend {
  const dir = dataDir || resolveDataDir();
  const mode = (envOverride || process.env.DELPHI_STORAGE || "sqlite").trim().toLowerCase();
  if (mode === "postgres") {
    throw new Error(
      "[delphi] DELPHI_STORAGE=postgres is not implemented yet — use 'file' or 'sqlite', or see DEPLOYMENT.md " +
        "(the async Postgres adapter is the planned backend for hosted production)."
    );
  }
  if (mode !== "file" && mode !== "sqlite") {
    throw new Error(`[delphi] unknown storage backend "${mode}" (file | sqlite | postgres)`);
  }
  const key = `${mode}:${dir}`;
  const hit = backendCache.get(key);
  if (hit) return hit;
  const backend: StorageBackend =
    mode === "file" ? new FileStorageBackend(dir) : new SqliteStorageBackend(dir);
  backendCache.set(key, backend);
  return backend;
}
