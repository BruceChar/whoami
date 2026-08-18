import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { appendSessionLog, startSessionPipeline } from "../src/sessions/logger";
import { emitSessionEvent, onSessionEvent } from "../src/sessions/stream";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "delphi-sessions-"));
}

const tick = () => new Promise((r) => setImmediate(r));

test("appendSessionLog: writes one JSONL line with timestamp + theme", () => {
  const dir = tmpDir();
  const file = appendSessionLog(
    { ts: "2026-08-16T10:00:00.000Z", sessionId: "s1", theme: "价值观探索", role: "user", content: "你好" },
    dir
  );
  assert.ok(file.endsWith("2026-08-16.jsonl"), file);
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  assert.equal(lines.length, 1);
  const ev = JSON.parse(lines[0]);
  assert.equal(ev.theme, "价值观探索");
  assert.equal(ev.role, "user");
  assert.equal(ev.sessionId, "s1");
  assert.equal(ev.ts, "2026-08-16T10:00:00.000Z");
  fs.rmSync(dir, { recursive: true, force: true });
});

test("event stream: async delivery to subscribers", async () => {
  const received: Array<{ content: string }> = [];
  const off = onSessionEvent((ev) => received.push(ev));
  emitSessionEvent({ ts: "t", sessionId: "s", theme: "t", role: "agent", content: "hi" });
  await tick();
  assert.equal(received.length, 1);
  assert.equal(received[0].content, "hi");
  off();
});

test("startSessionPipeline: events are logged to the daily JSONL (background)", async () => {
  const dir = tmpDir();
  const off = startSessionPipeline(dir);
  emitSessionEvent({ ts: "2026-08-16T10:00:00.000Z", sessionId: "s1", theme: "日常", role: "user", content: "今天很累" });
  emitSessionEvent({ ts: "2026-08-16T10:00:01.000Z", sessionId: "s1", theme: "日常", role: "agent", content: "我在听" });
  await tick();
  const file = path.join(dir, "logs", "sessions", "2026-08-16.jsonl");
  assert.ok(fs.existsSync(file), file);
  const lines = fs.readFileSync(file, "utf-8").trim().split("\n");
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).role, "user");
  assert.equal(JSON.parse(lines[1]).role, "agent");
  assert.equal(JSON.parse(lines[0]).theme, "日常");
  off();
  fs.rmSync(dir, { recursive: true, force: true });
});
