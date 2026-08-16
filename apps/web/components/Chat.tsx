"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Msg {
  role: "user" | "assistant";
  content: string;
  meta?: string;
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
  const [mode, setMode] = useState<Mode>("transparent");
  const [busy, setBusy] = useState(false);
  const [llmInfo, setLlmInfo] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("delphi-chat");
    if (saved) setMessages(JSON.parse(saved));
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s) => setConfigured(s.configured))
      .catch(() => setConfigured(false));
  }, []);

  useEffect(() => {
    localStorage.setItem("delphi-chat", JSON.stringify(messages.slice(-60)));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const history = messages.map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: m.content }));
    const userMsg: Msg = { role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, history, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "请求失败");
      const metaParts: string[] = [];
      if (data.llmGenerated && data.usage) {
        metaParts.push(`llm ${data.llmModel || ""} · ${data.usage.totalTokens} tokens · $${data.usage.cost.toFixed(4)}`);
        if (data.toolCalls?.length) metaParts.push(`工具: ${data.toolCalls.join(", ")}`);
      }
      if (data.modeChanged && data.modeChangeReason) metaParts.push(data.modeChangeReason);
      setMessages((m) => [...m, { role: "assistant", content: data.reply, meta: metaParts.join(" · ") || undefined }]);
      setLlmInfo(data.llmGenerated ? "⚡ LLM Agent" : "规则引擎");
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `（出错）${(err as Error).message}` }]);
    } finally {
      setBusy(false);
    }
  }, [input, busy, messages, mode]);

  return (
    <div className="flex h-[calc(100vh-140px)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">🪞 自由对话</h1>
        <div className="flex items-center gap-3 text-sm">
          {configured === false && (
            <Link href="/settings" className="rounded-full border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
              ⚠ 未配置 API Key · 去设置
            </Link>
          )}
          <span className="text-slate-500">{llmInfo || "模式"}</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded-lg border border-slate-700 bg-ink-800 px-3 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-mirror"
          >
            {(Object.keys(MODE_LABELS) as Mode[]).map((m) => (
              <option key={m} value={m}>{MODE_LABELS[m]}</option>
            ))}
          </select>
        </div>
      </div>

      {configured === false && (
        <div className="mb-4 rounded-xl border border-rose-500/40 bg-rose-500/5 p-3 text-sm text-rose-200">
          离线模式已取消：请先在 <Link href="/settings" className="underline">⚙️ 设置</Link> 中配置 LLM API Key，才能开始对话。
        </div>
      )}

      <div className="flex-1 space-y-4 overflow-y-auto rounded-xl border border-slate-800 bg-ink-900/50 p-5">
        {messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-slate-500">
            我不会告诉你答案，但我会帮你看见你是怎么想的。开始聊聊吧。
          </p>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "user" ? "bg-mirror/15 text-slate-100" : "bg-ink-800 text-slate-200"
            }`}>
              {m.role === "assistant" && renderReply(m.content)}
              {m.role === "user" && <span className="whitespace-pre-wrap">{m.content}</span>}
              {m.meta && <div className="mt-2 text-[11px] text-slate-500">{m.meta}</div>}
            </div>
          </div>
        ))}
        {busy && <div className="text-sm text-slate-500">delphi 正在思考…</div>}
        <div ref={bottomRef} />
      </div>

      <div className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="说点什么…（/stealth /transparent /guide 切换模式）"
          className="flex-1 rounded-xl border border-slate-700 bg-ink-900 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-mirror"
        />
        <button
          onClick={send}
          disabled={busy || !input.trim()}
          className="rounded-xl bg-mirror px-5 py-3 text-sm font-medium text-ink-950 transition hover:brightness-110 disabled:opacity-40"
        >
          发送
        </button>
      </div>
    </div>
  );
}

/** 渲染回复：metacog: 思维快照特殊样式 */
function renderReply(content: string) {
  const idx = content.indexOf("metacog:");
  if (idx === -1) return <span className="whitespace-pre-wrap">{content}</span>;
  const before = content.slice(0, idx);
  const snapshot = content.slice(idx);
  return (
    <div className="space-y-2">
      {before && <span className="whitespace-pre-wrap">{before}</span>}
      <pre className="whitespace-pre-wrap rounded-lg border border-mirror/30 bg-ink-950/70 p-3 text-xs text-mirror/90">{snapshot}</pre>
    </div>
  );
}
