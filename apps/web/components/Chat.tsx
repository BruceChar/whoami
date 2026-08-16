"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

type Mode = "stealth" | "transparent" | "meta_guide";

const MODE_LABELS: Record<Mode, string> = {
  stealth: "隐式",
  transparent: "显式",
  meta_guide: "引导式",
};

export default function Chat() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<Mode>("stealth");
  const [busy, setBusy] = useState(false);
  const [llmInfo, setLlmInfo] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tools, setTools] = useState<ToolMeta[]>([]);
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ToolMeta | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSessionId(localStorage.getItem("delphi-session-id"));
    fetch("/api/tools").then((r) => r.json()).then((d) => setTools(d.tools || [])).catch(() => {});
    const refreshConfig = () => fetch("/api/settings").then((r) => r.json()).then((s) => setConfigured(s.configured)).catch(() => setConfigured(false));
    refreshConfig();
    window.addEventListener("delphi:settings-changed", refreshConfig);
    return () => window.removeEventListener("delphi:settings-changed", refreshConfig);
  }, []);

  // 会话历史打开 / 新建
  useEffect(() => {
    const open = () => loadSession(localStorage.getItem("delphi-session-id"));
    const reset = () => {
      setMessages([]);
      setActiveTool(null);
      localStorage.removeItem("delphi-tool-id");
    };
    window.addEventListener("delphi:open-session", open);
    window.addEventListener("delphi:new-chat", reset);
    const sid = localStorage.getItem("delphi-session-id");
    if (sid) loadSession(sid);
    return () => {
      window.removeEventListener("delphi:open-session", open);
      window.removeEventListener("delphi:new-chat", reset);
    };
  }, []);

  const loadSession = useCallback((id: string | null) => {
    if (!id) { setMessages([]); return; }
    setSessionId(id);
    fetch(`/api/sessions/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.messages) {
          setMessages(d.messages.map((m: { role: string; content: string }) => ({
            role: m.role === "assistant" ? "assistant" : "user",
            content: m.content,
          })));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async (text?: string, toolId?: string) => {
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
        localStorage.setItem("delphi-session-id", data.sessionId);
        window.dispatchEvent(new Event("delphi:sessions-changed"));
      }
      const metaParts: string[] = [];
      if (data.usage) metaParts.push(`${data.llmModel || ""} · ${data.usage.totalTokens} tokens`);
      if (data.toolCalls?.length) metaParts.push(`工具: ${data.toolCalls.join(", ")}`);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, meta: metaParts.join(" · ") || undefined }]);
      setLlmInfo(data.llmModel || "LLM");
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `（出错）${(err as Error).message}` }]);
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }, [input, busy, mode, sessionId]);

  // 输入 / 弹出工具菜单
  const onInputChange = (v: string) => {
    setInput(v);
    setToolMenuOpen(v === "/" || (v.startsWith("/") && v.length === 1));
  };

  const selectTool = (tool: ToolMeta) => {
    setActiveTool(tool);
    localStorage.setItem("delphi-tool-id", tool.id);
    setInput("");
    setToolMenuOpen(false);
    inputRef.current?.focus();
  };

  const cancelTool = () => {
    setActiveTool(null);
    localStorage.removeItem("delphi-tool-id");
  };

  return (
    <div className="flex h-full flex-col">
      {/* 顶部：模式 + LLM 状态 */}
      <header className="flex items-center justify-between border-b border-ink-200/70 px-6 py-3">
        <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-0.5 text-xs">
          {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded-md px-3 py-1 transition ${
                mode === m ? "bg-surface text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-700"
              }`}
            >
              {MODE_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-xs text-ink-400">
          {configured === false && (
            <a href="/settings" className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-rose-500 hover:bg-rose-100">
              ⚠ 未配置 API Key
            </a>
          )}
          <span>{llmInfo ? `⚡ ${llmInfo}` : "delphi"}</span>
        </div>
      </header>

      {/* 消息区 */}
      <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
        {messages.length === 0 && (
          <div className="mx-auto mt-16 max-w-md text-center">
            <p className="text-2xl">🪞</p>
            <p className="mt-3 text-lg font-medium text-ink-800">我不会告诉你答案，但我会帮你看见你是怎么想的。</p>
            <p className="mt-2 text-sm text-ink-400">
              随便聊聊（隐式模式，后台静默分析）。输入 <span className="rounded bg-ink-100 px-1.5 py-0.5 font-mono text-xs">/</span> 选择工具模板。
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mirror-50 text-sm">🪞</span>
            )}
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed ${
                m.role === "user"
                  ? "bg-mirror-500 text-white"
                  : "bg-surface text-ink-800 shadow-soft"
              }`}
            >
              {m.role === "assistant" ? renderReply(m.content) : <span className="whitespace-pre-wrap">{m.content}</span>}
              {m.meta && <div className="mt-1.5 text-[11px] opacity-60">{m.meta}</div>}
            </div>
          </div>
        ))}
        {busy && (
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-mirror-50 text-sm">🪞</span>
            <div className="rounded-2xl bg-surface px-4 py-2.5 text-sm text-ink-400 shadow-soft">delphi 正在思考…</div>
          </div>
        )}
        {error && <div className="text-center text-xs text-rose-500">{error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="relative border-t border-ink-200/70 px-6 pb-6 pt-3">
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

        <div className="flex items-end gap-2 rounded-2xl border border-ink-200 bg-surface px-4 py-2 shadow-soft focus-within:border-mirror-300">
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
            placeholder={activeTool ? `继续 ${activeTool.label}…（回答 LLM 的提问）` : "说点什么…（/ 选择工具，Enter 发送，Shift+Enter 换行）"}
            className="flex-1 bg-transparent py-1 text-[15px] text-ink-800 outline-none placeholder:text-ink-300"
          />
          <button
            onClick={() => send(undefined, activeTool?.id)}
            disabled={busy || !input.trim()}
            className="rounded-xl bg-mirror-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
          >
            发送
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-ink-300">
          delphi 只反射、不评价 · Enter 发送 · / 打开工具模板
        </p>
      </div>
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
