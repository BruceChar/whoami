"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import InsightsPanel from "./InsightsPanel";
import Logo from "./Logo";
import { InsightsIcon } from "./icons";

interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: string;
}

interface ToolMeta {
  id: string;
  label: string;
  emoji: string;
  description: string;
}

const SESSION_KEY = "delphi-session-id";
const TOOL_KEY = "delphi-tool-id";

interface ProfileInfo {
  nickname: string;
  sessions: number;
  insights: number;
  personaVersion: string | null;
}

export default function Chat() {
  const router = useRouter();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [llmModel, setLlmModel] = useState<string | null>(null);
  const [contextTokens, setContextTokens] = useState(0);
  const [contextWindow, setContextWindow] = useState<number | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolMeta | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [profile, setProfile] = useState<ProfileInfo | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [nicknameInput, setNicknameInput] = useState("");
  const [savingNick, setSavingNick] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initial load: session id, tool list, LLM config status, profile.
  useEffect(() => {
    setSessionId(localStorage.getItem(SESSION_KEY));
    fetch("/api/tools").then((r) => r.json()).then((d) => setTools(d.tools || [])).catch(() => {});
    const refreshConfig = () =>
      fetch("/api/settings")
        .then((r) => r.json())
        .then((s) => {
          setConfigured(s.configured);
          setLlmModel((prev) => prev || s.model || s.provider || null);
          if (typeof s.contextWindow === "number") setContextWindow(s.contextWindow);
        })
        .catch(() => setConfigured(false));
    const refreshProfile = () =>
      fetch("/api/profile")
        .then((r) => r.json())
        .then((d) => {
          setProfile({
            nickname: d.nickname || "",
            sessions: d.sessions || 0,
            insights: d.insights || 0,
            personaVersion: d.personaVersion || null,
          });
        })
        .catch(() => setProfile(null));
    refreshConfig();
    refreshProfile();
    window.addEventListener("delphi:settings-changed", refreshConfig);
    window.addEventListener("delphi:sessions-changed", refreshProfile);
    window.addEventListener("delphi:profile-changed", refreshProfile);
    return () => {
      window.removeEventListener("delphi:settings-changed", refreshConfig);
      window.removeEventListener("delphi:sessions-changed", refreshProfile);
      window.removeEventListener("delphi:profile-changed", refreshProfile);
    };
  }, []);

  const saveNickname = useCallback(async () => {
    const nick = nicknameInput.trim();
    if (!nick) return;
    setSavingNick(true);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nick }),
      });
      if (!res.ok) throw new Error("Save failed");
      setProfile((p) => ({ ...(p || { sessions: 0, insights: 0, personaVersion: null }), nickname: nick }));
      setNicknameInput("");
      window.dispatchEvent(new Event("delphi:profile-changed"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingNick(false);
    }
  }, [nicknameInput]);

  const loadSession = useCallback((id: string | null) => {
    if (!id) {
      setSessionId(null);
      setMessages([]);
      setContextTokens(0);
      return;
    }
    setSessionId(id);
    setContextTokens(0);
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages) {
          setMessages(
            d.messages.map((m: { role: string; content: string }) => ({
              role: m.role === "user" ? "user" : "assistant",
              content: m.content,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Sidebar-driven session open / new-chat events.
  useEffect(() => {
    const open = () => loadSession(localStorage.getItem(SESSION_KEY));
    const reset = () => {
      setSessionId(null); // do not append to the previous session
      setMessages([]);
      setActiveTool(null);
      setError(null);
      setContextTokens(0);
      localStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(TOOL_KEY);
    };
    window.addEventListener("delphi:open-session", open);
    window.addEventListener("delphi:new-chat", reset);
    const sid = localStorage.getItem(SESSION_KEY);
    if (sid) loadSession(sid);
    return () => {
      window.removeEventListener("delphi:open-session", open);
      window.removeEventListener("delphi:new-chat", reset);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoGrow = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(180, el.scrollHeight) + "px";
  };

  const send = useCallback(
    async (text?: string, toolId?: string) => {
      const content = (text ?? input).trim();
      if (!content || busy) return;
      setInput("");
      setError(null);
      setToolMenuOpen(false);
      if (inputRef.current) inputRef.current.style.height = "auto";
      const userMsg: Msg = { role: "user", content };
      setMessages((m) => [...m, userMsg]);
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, mode: "stealth", toolId, sessionId: sessionId || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Request failed");
        if (data.sessionId && data.sessionId !== sessionId) {
          setSessionId(data.sessionId);
          localStorage.setItem(SESSION_KEY, data.sessionId);
          window.dispatchEvent(new Event("delphi:sessions-changed"));
        }
        const metaParts: string[] = [];
        if (data.usage) {
          metaParts.push(`${data.llmModel || ""} · ${data.usage.totalTokens} tokens`);
          setContextTokens((t) => t + (data.usage.totalTokens || 0));
        }
        if (typeof data.contextWindow === "number") setContextWindow(data.contextWindow);
        if (data.toolCalls?.length) metaParts.push(`tools: ${data.toolCalls.join(", ")}`);
        setMessages((m) => [...m, { role: "assistant", content: data.reply, meta: metaParts.join(" · ") || undefined }]);
        if (data.llmModel) setLlmModel(data.llmModel);
      } catch (err) {
        const msg = (err as Error).message;
        setMessages((m) => [...m, { role: "assistant", content: `(error) ${msg}` }]);
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [input, busy, sessionId]
  );

  // Show the tool menu only while the input is exactly "/".
  const onInputChange = (v: string) => {
    setInput(v);
    setToolMenuOpen(v === "/");
  };

  const selectTool = (tool: ToolMeta) => {
    setActiveTool(tool);
    localStorage.setItem(TOOL_KEY, tool.id);
    setInput("");
    setToolMenuOpen(false);
    inputRef.current?.focus();
  };

  const cancelTool = () => {
    setActiveTool(null);
    localStorage.removeItem(TOOL_KEY);
  };

  const userLabel = profile?.nickname || "you";
  const contextPct = contextWindow ? Math.min(100, Math.round((contextTokens / contextWindow) * 100)) : 0;
  const contextHint = contextWindow
    ? `Context ${contextPct}% · ${contextTokens.toLocaleString()} / ${contextWindow.toLocaleString()} tokens`
    : `${contextTokens.toLocaleString()} tokens (unknown window)`;

  return (
    <div className="flex h-full">
      {/* main chat column */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        {/* Header: centered slogan */}
        <header className="relative flex items-center justify-center border-b border-ink-200/70 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Be water my friend.</h1>
          {configured === false && (
            <Link
              href="/settings"
              className="absolute right-6 rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-500 hover:bg-rose-100"
            >
              ⚠ No API key configured
            </Link>
          )}
        </header>

        {/* Messages */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* Onboarding: collect the nickname on first run */}
          {profile && !profile.nickname && messages.length === 0 && (
            <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-ink-200/70 bg-surface p-6 text-center shadow-soft">
              <div className="flex justify-center"><Logo size={44} /></div>
              <h2 className="mt-3 text-lg font-semibold text-ink-900">Hi, I'm delphi.</h2>
              <p className="mt-1 text-sm text-ink-400">What should I call you? I'll use this name in our conversations.</p>
              <div className="mt-4 flex gap-2">
                <input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNickname();
                  }}
                  placeholder="Your nickname (e.g. Xiao Zhou)"
                  className="flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 outline-none focus:border-mirror-300"
                />
                <button
                  onClick={saveNickname}
                  disabled={savingNick || !nicknameInput.trim()}
                  className="rounded-xl bg-mirror-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
                >
                  {savingNick ? "Saving…" : "Start"}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-ink-400">You can also update it later in Settings → Personal info.</p>
            </div>
          )}

          {messages.length === 0 && profile?.nickname && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <div className="flex justify-center"><Logo size={40} /></div>
              <p className="mt-3 text-lg font-medium text-ink-800">Hi {profile.nickname}. Be water my friend.</p>
              <p className="mt-2 text-sm text-ink-400">
                Chat freely — I quietly observe your thinking patterns in the background. Type <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">/</span> to pick a tool template.
              </p>
            </div>
          )}
          {messages.length === 0 && !profile && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <div className="flex justify-center"><Logo size={40} /></div>
              <p className="mt-3 text-lg font-medium text-ink-800">Be water my friend.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex w-full flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <span className="px-1 text-[11px] text-ink-400">{m.role === "user" ? userLabel : "delphi"}</span>
              <div className={`flex w-full items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "assistant" && <Logo size={28} />}
                <div
                  className={`break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "w-fit max-w-[78%] bg-mirror-500 text-white"
                      : "w-fit max-w-[78%] bg-surface text-ink-800 shadow-soft"
                  }`}
                >
                  {m.role === "assistant" ? renderReply(m.content) : <span className="whitespace-pre-wrap">{m.content}</span>}
                  {m.meta && <div className="mt-1.5 text-[11px] opacity-60">{m.meta}</div>}
                </div>
              </div>
            </div>
          ))}
          {busy && (
            <div className="flex flex-col gap-1">
              <span className="px-1 text-[11px] text-ink-400">delphi</span>
              <div className="flex gap-3">
                <Logo size={28} />
                <div className="rounded-2xl bg-surface px-4 py-2.5 text-sm text-ink-400 shadow-soft">delphi is thinking…</div>
              </div>
            </div>
          )}
          {error && <div className="text-center text-xs text-rose-500">{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Composer: tall input + bottom toolbar */}
        <div className="relative border-t border-ink-200/70 px-6 pb-5 pt-3">
          {activeTool && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mirror-50 px-3 py-1 text-xs text-mirror-700">
                {activeTool.emoji} {activeTool.label} · in progress
              </span>
              <button onClick={cancelTool} className="text-xs text-ink-400 hover:text-ink-600">✕ Cancel</button>
            </div>
          )}

          {toolMenuOpen && tools.length > 0 && (
            <div className="absolute bottom-full left-6 right-6 z-10 mb-2 max-h-72 overflow-y-auto rounded-2xl border border-ink-200 bg-surface p-1.5 shadow-soft">
              {tools.map((t) => (
                <button
                  key={t.id}
                  onClick={() => selectTool(t)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition hover:bg-ink-50"
                >
                  <span className="text-lg">{t.emoji}</span>
                  <span>
                    <span className="block text-sm font-medium text-ink-800">/{t.id} · {t.label}</span>
                    <span className="block text-xs text-ink-400">{t.description}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-ink-200 bg-surface shadow-soft focus-within:border-mirror-300">
            <textarea
              ref={inputRef}
              value={input}
              rows={2}
              onChange={(e) => {
                onInputChange(e.target.value);
                autoGrow();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(undefined, activeTool?.id);
                }
              }}
              placeholder={activeTool ? `Continue ${activeTool.label}… (answer the LLM's question)` : "Type a message… (/ for tools, Enter to send, Shift+Enter for newline)"}
              className="max-h-[180px] w-full resize-none bg-transparent px-4 pt-3 text-[15px] text-ink-800 outline-none placeholder:text-ink-300"
            />
            <div className="flex items-center justify-between gap-3 px-3 pb-2 pt-1">
              {/* left: currently only stealth mode is open */}
              <div className="flex items-center gap-0.5 rounded-lg bg-ink-100 p-0.5 text-xs">
                <span className="rounded-md bg-surface px-2.5 py-1 text-ink-900 shadow-soft" title="Only stealth mode is open for now">
                  Stealth
                </span>
              </div>

              {/* right: model · context ring · send */}
              <div className="flex items-center gap-3 text-[11px] text-ink-400">
                <span className="hidden max-w-44 truncate sm:inline" title={llmModel || undefined}>
                  {llmModel || "No model connected"}
                </span>
                <span className="group relative flex items-center gap-1">
                  <ContextRing pct={contextPct} />
                  <span className="pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 hidden whitespace-nowrap rounded-lg border border-ink-200 bg-surface px-2 py-1 text-[10px] text-ink-500 shadow-soft group-hover:block">
                    {contextHint}
                  </span>
                </span>
                <button
                  onClick={() => send(undefined, activeTool?.id)}
                  disabled={busy || !input.trim()}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-mirror-500 text-white transition hover:bg-mirror-600 disabled:opacity-40"
                  title="Send"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 19V5" />
                    <path d="m5 12 7-7 7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* global stats below the input */}
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-ink-500">
            <button onClick={() => router.push("/insights")} className="transition hover:text-mirror-700" title="View analysis panel">
              Sessions {profile?.sessions ?? 0}
            </button>
            <span className="text-ink-200">·</span>
            <button onClick={() => router.push("/insights")} className="transition hover:text-mirror-700" title="查看分析面板">
              Insights {profile?.insights ?? 0}
            </button>
            <span className="text-ink-200">·</span>
            <button onClick={() => router.push("/insights")} className="transition hover:text-mirror-700" title="查看分析面板">
              {profile?.personaVersion ? `Persona ${profile.personaVersion}` : "Persona —"}
            </button>
          </div>
        </div>

        {/* insights edge tab (middle of the right border) */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "Close insights" : "Open insights"}
          className="absolute right-0 top-1/2 z-30 flex h-24 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-ink-200 bg-surface text-ink-400 shadow-soft transition hover:border-mirror-300 hover:text-mirror-600"
        >
          {panelOpen ? "›" : <InsightsIcon size={14} />}
        </button>
      </div>

      {/* right sidebar: collapsible insights */}
      {panelOpen && <InsightsPanel onClose={() => setPanelOpen(false)} />}
    </div>
  );
}

/** Small circular context-usage indicator. */
function ContextRing({ pct }: { pct: number }) {
  const r = 8;
  const c = 2 * Math.PI * r;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
      <circle cx="10" cy="10" r={r} fill="none" stroke="currentColor" strokeWidth="2.5" className="text-ink-200" />
      <circle
        cx="10"
        cy="10"
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray={`${(pct / 100) * c} ${c}`}
        transform="rotate(-90 10 10)"
        className={pct >= 90 ? "text-rose-400" : "text-mirror-500"}
      />
    </svg>
  );
}

function renderReply(content: string) {
  const idx = content.indexOf("metacog:");
  if (idx === -1) return <span className="whitespace-pre-wrap">{content}</span>;
  const before = content.slice(0, idx);
  const snapshot = content.slice(idx);
  return (
    <div className="space-y-2">
      {before && <span className="whitespace-pre-wrap">{before}</span>}
      <pre className="whitespace-pre-wrap rounded-xl bg-ink-50 p-3 text-xs text-ink-600">{snapshot}</pre>
    </div>
  );
}
