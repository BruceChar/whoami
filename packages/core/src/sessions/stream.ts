/**
 * delphi — session event stream (async pub/sub).
 *
 * The chat emits `session:message` events; background consumers (the JSONL
 * logger and, later, the analysis agent) subscribe without blocking the
 * conversation. Delivery is deferred (setImmediate) so the chat never waits
 * on consumers. The bus lives on globalThis so it survives dev hot-reloads.
 */
import { EventEmitter } from "events";

export interface SessionEvent {
  ts: string; // ISO 8601
  sessionId: string; // used for the JSONL filename; not persisted inside the record
  role: "user" | "agent";
  content: string;
  markers?: {
    biases?: string[];
    attribution?: string | null;
    selfReflection?: boolean;
  };
}

export const SESSION_EVENT = "session:message";

const g = globalThis as unknown as { __delphiSessionBus?: EventEmitter };
const bus: EventEmitter = g.__delphiSessionBus || (g.__delphiSessionBus = new EventEmitter());

/** Publish an event asynchronously (next tick) so the caller is never blocked. */
export function emitSessionEvent(ev: SessionEvent): void {
  setImmediate(() => {
    try {
      bus.emit(SESSION_EVENT, ev);
    } catch {
      // a consumer must never break the chat
    }
  });
}

/** Subscribe to session events; returns an unsubscribe function. */
export function onSessionEvent(handler: (ev: SessionEvent) => void): () => void {
  bus.on(SESSION_EVENT, handler);
  return () => bus.off(SESSION_EVENT, handler);
}
