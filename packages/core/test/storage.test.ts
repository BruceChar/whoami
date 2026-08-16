import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import {
  FileStorageBackend,
  SqliteStorageBackend,
  resolveStorageBackend,
  ProfileStore,
} from "../src/index";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "delphi-storage-"));
}

test("FileStorageBackend: write/read/remove/list round-trip", () => {
  const dir = tmpDir();
  const b = new FileStorageBackend(dir);
  b.write("a/b.json", '{"x":1}');
  assert.equal(b.read("a/b.json"), '{"x":1}');
  assert.deepEqual(b.list("a/"), ["a/b.json"]);
  b.remove("a/b.json");
  assert.equal(b.read("a/b.json"), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("SqliteStorageBackend: write/read/remove/list round-trip", () => {
  const dir = tmpDir();
  const b = new SqliteStorageBackend(dir);
  b.write("profile.json", '{"a":1}');
  b.write("users.json", '{"users":[]}');
  assert.equal(b.read("profile.json"), '{"a":1}');
  assert.deepEqual(b.list("users"), ["users.json"]);
  assert.deepEqual(b.list("").sort(), ["profile.json", "users.json"]);
  b.remove("profile.json");
  assert.equal(b.read("profile.json"), null);
  fs.rmSync(dir, { recursive: true, force: true });
});

test("SqliteStorageBackend: imports legacy JSON files on first use", () => {
  const dir = tmpDir();
  fs.writeFileSync(path.join(dir, "profile.json"), '{"legacy":true}', "utf-8");
  const b = new SqliteStorageBackend(dir);
  assert.equal(b.read("profile.json"), '{"legacy":true}');
  fs.rmSync(dir, { recursive: true, force: true });
});

test("resolveStorageBackend: DELPHI_STORAGE selection; postgres not implemented", () => {
  const dir = tmpDir();
  const prev = process.env.DELPHI_STORAGE;
  try {
    process.env.DELPHI_STORAGE = "file";
    assert.equal(resolveStorageBackend(dir).id, "file");
    process.env.DELPHI_STORAGE = "sqlite";
    assert.equal(resolveStorageBackend(dir).id, "sqlite");
    process.env.DELPHI_STORAGE = "postgres";
    assert.throws(() => resolveStorageBackend(dir), /postgres is not implemented/);
  } finally {
    if (prev === undefined) delete process.env.DELPHI_STORAGE;
    else process.env.DELPHI_STORAGE = prev;
  }
  fs.rmSync(dir, { recursive: true, force: true });
});

test("ProfileStore persists through sqlite and file backends", () => {
  for (const mode of ["sqlite", "file"] as const) {
    const dir = tmpDir();
    const backend = mode === "file" ? new FileStorageBackend(dir) : undefined;
    const store = new ProfileStore({ dataDir: dir, backend });
    store.get().userInfo.nickname = "tester";
    store.save();

    const store2 = new ProfileStore({ dataDir: dir, backend: mode === "file" ? new FileStorageBackend(dir) : undefined });
    assert.equal(store2.get().userInfo.nickname, "tester", `mode=${mode}`);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
