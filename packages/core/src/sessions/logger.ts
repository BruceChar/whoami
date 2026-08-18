/**
 * delphi — background session pipeline.
 *
 * Consumes session events asynchronously:
 *   1. persists every event to a JSONL log —
 *      <dataDir>/logs/sessions/YYYY-MM-DD.jsonl, one JSON line per message,
 *      each line carrying { ts, sessionId, theme, role, content, markers? };
 *   2. prints a short line — a placeholder for the future background
 *      analysis agent, which will consume the same events (theme + content +
 *      markers) for cognitive analysis without touching the conversation.
 */
import * as fs from "fs";
import * as path from "path";
import { resolveDataDir } from "../storage/store";
import { SessionEvent, onSessionEvent } from "./stream";

/** Append one event to the daily JSONL log; returns the file path. */
export function appendSessionLog(ev: SessionEvent, dataDir?: string): string {
  const day = (ev.ts || new Date().toISOString()).slice(0, 10);
  const dir = path.join(dataDir || resolveDataDir(), "logs", "sessions");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${day}.jsonl`);
  fs.appendFileSync(file, JSON.stringify(ev) + "\n", "utf-8");
  return file;
}

const g = globalThis as unknown as { __delphiSessionPipelineStarted?: boolean };
let started = g.__delphiSessionPipelineStarted ?? false;

/**
 * Start the background consumer (idempotent). Each session event is logged to
 * the daily JSONL file and printed; a real analysis agent hooks in here later.
 */
export function startSessionPipeline(dataDir?: string): () => void {
  if (started) return () => {};
  started = true;
  g.__delphiSessionPipelineStarted = true;

  const off = onSessionEvent((ev) => {
    try {
      appendSessionLog(ev, dataDir);
      // TODO(analysis agent): analyze theme + content + markers (LLM) here.
      // For now: just print the message.
      console.log(
        `[session] ${ev.ts} ${ev.role} · theme: ${ev.theme} · ${ev.content.slice(0, 80).replace(/\n/g, " ")}`
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
