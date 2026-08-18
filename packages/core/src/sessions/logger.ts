/**
 * delphi — background session pipeline.
 *
 * Consumes session events asynchronously:
 *   1. persists every message to a per-session JSONL file —
 *      <dataDir>/logs/sessions/<sessionId>.jsonl, one JSON line per message.
 *      The record is lean: { ts, role, content, markers? } — the session id
 *      lives in the file name, the timestamp in the record.
 *   2. prints a short line — a placeholder for the future background
 *      analysis agent, which will consume the same events for cognitive
 *      analysis without touching the conversation.
 */
import * as fs from "fs";
import * as path from "path";
import { resolveDataDir } from "../storage/store";
import { SessionEvent, onSessionEvent } from "./stream";

/** Safe file-name fragment for a session id. */
function safeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]/g, "_") || "session";
}

/** Append one event to the session's JSONL file; returns the file path. */
export function appendSessionLog(ev: SessionEvent, dataDir?: string): string {
  const dir = path.join(dataDir || resolveDataDir(), "logs", "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${safeId(ev.sessionId)}.jsonl`);
  const record = {
    ts: ev.ts,
    role: ev.role,
    content: ev.content,
    ...(ev.markers ? { markers: ev.markers } : {}),
  };
  fs.appendFileSync(file, JSON.stringify(record) + "\n", "utf-8");
  return file;
}

const g = globalThis as unknown as { __delphiSessionPipelineStarted?: boolean };
let started = g.__delphiSessionPipelineStarted ?? false;

/**
 * Start the background consumer (idempotent). Each session event is logged to
 * the session's JSONL file and printed; a real analysis agent hooks in later.
 */
export function startSessionPipeline(dataDir?: string): () => void {
  if (started) return () => {};
  started = true;
  g.__delphiSessionPipelineStarted = true;

  const off = onSessionEvent((ev) => {
    try {
      appendSessionLog(ev, dataDir);
      // TODO(analysis agent): analyze content + markers (LLM) here.
      // For now: just print the message.
      console.log(
        `[session] ${ev.ts} ${ev.role} · ${ev.sessionId} · ${ev.content.slice(0, 80).replace(/\n/g, " ")}`
      );
    } catch (err) {
      console.error(`[session-log] write failed: ${(err as Error).message}`);
    }
  });

  return () => {
    off();
    started = false;
    g.__delphiSessionPipelineStarted = false;
  };
}
