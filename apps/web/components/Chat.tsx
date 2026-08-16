"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import InsightsPanel from "./InsightsPanel";

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

interface HistoryItem {
  id: string;
  title: string;
}

type Mode = "stealth" | "transparent" | "meta_guide";

const MODE_LABELS: Record<Mode, string> = {
  stealth: "隐式",
  transparent: "显式",
  meta_guide: "引导式",
};

const MODE_DESC: Record<Mode, string> = {
  stealth: "后台静默分析，自然对话",
  transparent: "实时展示思维快照",
  meta_guide: "主动提问，引导元思考",
};

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
  const [mode, setMode] = useState<Mode>("stealth");
  const [modeOpen, setModeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [llmInfo, setLlmInfo] = useState<string | null>(null);
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
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initial load: session id, tool list, LLM config status, profile, history.
  useEffect(() => {
    setSessionId(localStorage.getItem(SESSION_KEY));
    setActiveId(localStorage.getItem(SESSION_KEY));
    fetch("/api/tools").then((r) => r.json()).then((d) => setTools(d.tools || [])).catch(() => {});
    const refreshConfig = () =>
      fetch("/api/settings").then((r) => r.json()).then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
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
    const refreshHistory = () =>
      fetch("/api/sessions")
        .then((r) => r.json())
        .then((d) =>
          setHistory(
            (d.sessions || []).map((s: { id: string; title: string }) => ({ id: s.id, title: s.title || "未命名会话" }))
          )
        )
        .catch(() => setHistory([]));
    refreshConfig();
    refreshProfile();
    refreshHistory();
    const onSessionsChanged = () => {
      refreshHistory();
      refreshProfile();
      setActiveId(localStorage.getItem(SESSION_KEY));
    };
    window.addEventListener("delphi:settings-changed", refreshConfig);
    window.addEventListener("delphi:sessions-changed", onSessionsChanged);
    window.addEventListener("delphi:profile-changed", refreshProfile);
    return () => {
      window.removeEventListener("delphi:settings-changed", refreshConfig);
      window.removeEventListener("delphi:sessions-changed", onSessionsChanged);
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
      if (!res.ok) throw new Error("保存失败");
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
      setActiveId(null);
      setMessages([]);
      return;
    }
    setSessionId(id);
    setActiveId(id);
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
    const open = () => {
      const id = localStorage.getItem(SESSION_KEY);
      setActiveId(id);
      loadSession(id);
    };
    const reset = () => {
      setSessionId(null); // do not append to the previous session
      setActiveId(null);
      setMessages([]);
      setActiveTool(null);
      setError(null);
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

  const send = useCallback(
    async (text?: string, toolId?: string) => {
      const content = (text ?? input).trim();
      if (!content || busy) return;
      setInput("");
      setError(null);
      setToolMenuOpen(false);
      const userMsg: Msg = { role: "user", content };
      setMessages((m) => [...m, userMsg]);
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, mode, toolId, sessionId: sessionId || undefined }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "请求失败");
        if (data.sessionId && data.sessionId !== sessionId) {
          setSessionId(data.sessionId);
          setActiveId(data.sessionId);
          localStorage.setItem(SESSION_KEY, data.sessionId);
          window.dispatchEvent(new Event("delphi:sessions-changed"));
        }
        const metaParts: string[] = [];
        if (data.usage) metaParts.push(`${data.llmModel || ""} · ${data.usage.totalTokens} tokens`);
        if (data.toolCalls?.length) metaParts.push(`工具: ${data.toolCalls.join(", ")}`);
        setMessages((m) => [...m, { role: "assistant", content: data.reply, meta: metaParts.join(" · ") || undefined }]);
        setLlmInfo(data.llmModel || "LLM");
      } catch (err) {
        const msg = (err as Error).message;
        setMessages((m) => [...m, { role: "assistant", content: `（出错）${msg}` }]);
        setError(msg);
      } finally {
        setBusy(false);
      }
    },
    [input, busy, mode, sessionId]
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

  const openHistory = (id: string) => {
    localStorage.setItem(SESSION_KEY, id);
    setActiveId(id);
    loadSession(id);
  };

  // "Delete" hides the session from the list only; data is kept for analysis.
  const deleteHistory = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    } catch {
      // ignore network errors; still refresh
    }
    window.dispatchEvent(new Event("delphi:sessions-changed"));
    if (id === sessionId) {
      localStorage.removeItem(SESSION_KEY);
      loadSession(null);
    }
  };

  const userLabel = profile?.nickname || "你";

  return (
    <div className="flex h-full">
      {/* main chat column */}
      <div className="relative flex h-full min-w-0 flex-1 flex-col">
        {/* Header: centered slogan */}
        <header className="relative flex items-center justify-center border-b border-ink-200/70 px-20 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-ink-900">Be water my friend.</h1>
          <div className="absolute right-6 flex items-center gap-3 text-xs">
            {configured === false && (
              <Link href="/settings" className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-rose-500 hover:bg-rose-100">
                ⚠ 未配置 API Key
              </Link>
            )}
            {llmInfo && <span className="hidden text-ink-400 sm:inline">⚡ {llmInfo}</span>}
            <Link
              href="/settings"
              title="设置"
              className="rounded-full border border-ink-200 bg-surface px-3 py-1.5 text-ink-500 transition hover:border-mirror-300 hover:text-mirror-700"
            >
              ⚙️
            </Link>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {/* Onboarding: collect the nickname on first run */}
          {profile && !profile.nickname && messages.length === 0 && (
            <div className="mx-auto mt-10 w-full max-w-md rounded-2xl border border-ink-200/70 bg-surface p-6 text-center shadow-soft">
              <h2 className="text-lg font-semibold text-ink-900">你好，我是 delphi。</h2>
              <p className="mt-1 text-sm text-ink-400">你希望我怎么称呼你？之后我会用这个名字和你对话。</p>
              <div className="mt-4 flex gap-2">
                <input
                  value={nicknameInput}
                  onChange={(e) => setNicknameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveNickname();
                  }}
                  placeholder="你的称呼（如：小舟）"
                  className="flex-1 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 outline-none focus:border-mirror-300"
                />
                <button
                  onClick={saveNickname}
                  disabled={savingNick || !nicknameInput.trim()}
                  className="rounded-xl bg-mirror-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
                >
                  {savingNick ? "保存中…" : "开始"}
                </button>
              </div>
              <p className="mt-3 text-[11px] text-ink-400">也可以稍后在「设置 → 个人基础信息」里修改。</p>
            </div>
          )}

          {messages.length === 0 && profile?.nickname && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <p className="mt-3 text-lg font-medium text-ink-800">你好，{profile.nickname}。Be water my friend.</p>
              <p className="mt-2 text-sm text-ink-400">
                随便聊聊，我会在后台悄悄观察你的思维模式。输入 <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">/</span> 选择工具模板。
              </p>
            </div>
          )}
          {messages.length === 0 && !profile && (
            <div className="mx-auto mt-16 max-w-md text-center">
              <p className="mt-3 text-lg font-medium text-ink-800">Be water my friend.</p>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex flex-col gap-1 ${m.role === "user" ? "items-end" : "items-start"}`}>
              <span className="px-1 text-[11px] text-ink-400">{m.role === "user" ? userLabel : "delphi"}</span>
              <div className={`flex items-start gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                {m.role === "assistant" && (
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mirror-50 text-sm">🪞</span>
                )}
                <div
                  className={`w-fit break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                    m.role === "user"
                      ? "min-w-[7.5rem] max-w-[78%] bg-mirror-500 text-white"
                      : "max-w-[78%] bg-surface text-ink-800 shadow-soft"
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
                <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-mirror-50 text-sm">🪞</span>
                <div className="rounded-2xl bg-surface px-4 py-2.5 text-sm text-ink-400 shadow-soft">delphi 正在思考…</div>
              </div>
            </div>
          )}
          {error && <div className="text-center text-xs text-rose-500">{error}</div>}
          <div ref={bottomRef} />
        </div>

        {/* Composer + stats + history */}
        <div className="relative border-t border-ink-200/70 px-6 pb-5 pt-3">
          {activeTool && (
            <div className="mb-2 flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-mirror-50 px-3 py-1 text-xs text-mirror-700">
                {activeTool.emoji} {activeTool.label} · 进行中
              </span>
              <button onClick={cancelTool} className="text-xs text-ink-400 hover:text-ink-600">✕ 取消</button>
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

          {/* input row: mode drawer at the bottom-left INSIDE the input */}
          <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-surface px-2 py-1.5 shadow-soft focus-within:border-mirror-300">
            <div className="relative shrink-0">
              <button
                onClick={() => setModeOpen((v) => !v)}
                className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition ${
                  modeOpen ? "bg-mirror-50 text-mirror-700" : "text-ink-500 hover:bg-ink-100"
                }`}
                title="分析模式"
              >
                {MODE_LABELS[mode]} <span className="text-[10px]">▾</span>
              </button>
              {modeOpen && (
                <div className="absolute bottom-full left-0 z-20 mb-1 w-52 rounded-xl border border-ink-200 bg-surface p-1 shadow-soft">
                  {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        setMode(m);
                        setModeOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                        mode === m ? "bg-mirror-50 text-mirror-700" : "text-ink-600 hover:bg-ink-100"
                      }`}
                    >
                      <span>{MODE_LABELS[m]}</span>
                      {mode === m && <span className="text-xs">✓</span>}
                    </button>
                  ))}
                  <p className="border-t border-ink-100 px-3 pb-1 pt-1.5 text-[11px] text-ink-400">{MODE_DESC[mode]}</p>
                </div>
              )}
            </div>

            <input
              ref={inputRef}
              value={input}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(undefined, activeTool?.id);
                }
              }}
              placeholder={activeTool ? `继续 ${activeTool.label}…（回答 LLM 的提问）` : "说点什么…（/ 选择工具，Enter 发送）"}
              className="flex-1 bg-transparent px-1 py-1.5 text-[15px] text-ink-800 outline-none placeholder:text-ink-300"
            />
            <button
              onClick={() => send(undefined, activeTool?.id)}
              disabled={busy || !input.trim()}
              className="rounded-xl bg-mirror-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
            >
              发送
            </button>
          </div>

          {/* global stats below the input */}
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-ink-500">
            <button onClick={() => router.push("/insights")} className="transition hover:text-mirror-700" title="查看分析面板">
              会话 {profile?.sessions ?? 0}
            </button>
            <span className="text-ink-200">·</span>
            <button onClick={() => router.push("/insights")} className="transition hover:text-mirror-700" title="查看分析面板">
              洞察 {profile?.insights ?? 0}
            </button>
            <span className="text-ink-200">·</span>
            <button onClick={() => router.push("/insights")} className="transition hover:text-mirror-700" title="查看分析面板">
              {profile?.personaVersion ? `画像 ${profile.personaVersion}` : "画像 未生成"}
            </button>
          </div>

          {/* history strip at the bottom */}
          {history.length > 0 && (
            <div className="mt-3 border-t border-ink-100 pt-2">
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="shrink-0 text-[11px] text-ink-400">历史对话</span>
                {history.map((s) => (
                  <span
                    key={s.id}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full border border-ink-200 bg-surface py-1 pl-3 pr-1.5 text-xs shadow-soft"
                  >
                    <button
                      onClick={() => openHistory(s.id)}
                      className={`max-w-36 truncate ${activeId === s.id ? "text-mirror-700" : "text-ink-600 hover:text-mirror-700"}`}
                      title={s.title}
                    >
                      {s.title}
                    </button>
                    <button
                      onClick={() => deleteHistory(s.id)}
                      className="rounded-full p-0.5 text-ink-300 transition hover:bg-rose-50 hover:text-rose-500"
                      title="从列表移除"
                    >
                      ✕
                    </button>
                  </span>
                ))}
              </div>
              <p className="pt-0.5 text-[10px] text-ink-300">删除仅从列表移除，数据仍保留用于分析。</p>
            </div>
          )}
        </div>

        {/* insights edge tab (middle of the right border) */}
        <button
          onClick={() => setPanelOpen((v) => !v)}
          title={panelOpen ? "收起洞察" : "展开洞察"}
          className="absolute right-0 top-1/2 z-30 flex h-24 w-6 -translate-y-1/2 items-center justify-center rounded-l-lg border border-r-0 border-ink-200 bg-surface text-xs text-ink-400 shadow-soft transition hover:border-mirror-300 hover:text-mirror-600"
        >
          {panelOpen ? "›" : "📊"}
        </button>
      </div>

      {/* right sidebar: collapsible insights */}
      {panelOpen && <InsightsPanel onClose={() => setPanelOpen(false)} />}
    </div>
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
