"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Logo from "./Logo";
import { SettingsIcon, PencilIcon, ArchiveIcon } from "./icons";

interface SessionItem {
  id: string;
  title: string;
  startedAt: string;
  messageCount: number;
}

function groupByDate(sessions: SessionItem[]): Array<{ label: string; items: SessionItem[] }> {
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86400000).toDateString();
  const groups = new Map<string, SessionItem[]>();
  // sessions arrive newest-first from the API: today at the top, older below
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const key =
      d.toDateString() === today
        ? "今天"
        : d.toDateString() === yesterday
          ? "昨天"
          : d.toLocaleDateString("zh-CN", { month: "long", day: "numeric" });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(s);
  }
  return [...groups.entries()].map(([label, items]) => ({ label, items }));
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; value: string } | null>(null);

  const loadSessions = useCallback(() => {
    fetch("/api/sessions")
      .then((r) => r.json())
      .then((d) => setSessions(d.sessions || []))
      .catch(() => setSessions([]));
  }, []);

  useEffect(() => {
    loadSessions();
    const onSessionChange = () => {
      loadSessions();
      setActiveId(localStorage.getItem("delphi-session-id"));
    };
    window.addEventListener("delphi:sessions-changed", onSessionChange);
    return () => window.removeEventListener("delphi:sessions-changed", onSessionChange);
  }, [loadSessions]);

  const newChat = () => {
    localStorage.removeItem("delphi-session-id");
    setActiveId(null);
    router.push("/");
    window.dispatchEvent(new Event("delphi:new-chat"));
  };

  const openSession = (id: string) => {
    localStorage.setItem("delphi-session-id", id);
    setActiveId(id);
    router.push("/");
    window.dispatchEvent(new Event("delphi:open-session"));
  };

  const renameSession = async (id: string, title: string) => {
    try {
      await fetch(`/api/sessions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
    } catch {
      // ignore; list refresh below reflects the actual state
    }
    setEditing(null);
    window.dispatchEvent(new Event("delphi:sessions-changed"));
  };

  // "Archive" hides the session from the list only; data stays for analysis.
  const archiveSession = async (id: string) => {
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
    } catch {
      // ignore network errors; still refresh
    }
    if (id === activeId) {
      localStorage.removeItem("delphi-session-id");
      setActiveId(null);
    }
    window.dispatchEvent(new Event("delphi:sessions-changed"));
  };

  const groups = groupByDate(sessions);

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-ink-200/70 bg-surface/70">
      <div className="px-4 pb-3 pt-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={26} />
          <span className="text-lg font-semibold tracking-tight text-ink-900">delphi</span>
        </Link>
        <button
          onClick={newChat}
          className="mt-4 w-full rounded-xl border border-ink-200 bg-surface px-4 py-2 text-sm font-medium text-ink-700 shadow-soft transition hover:border-mirror-300 hover:text-mirror-700"
        >
          + 新对话
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2.5 pb-3">
        {groups.length === 0 ? (
          <p className="px-2 py-2 text-xs text-ink-400">暂无会话历史</p>
        ) : (
          groups.map((g) => (
            <div key={g.label} className="mb-2">
              <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wider text-ink-400">{g.label}</p>
              {g.items.map((s) => {
                const isEditing = editing?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`group mb-0.5 flex items-center rounded-lg transition ${
                      activeId === s.id ? "bg-mirror-50" : "hover:bg-ink-100"
                    }`}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editing.value}
                        onChange={(e) => setEditing({ id: s.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") renameSession(s.id, editing.value);
                          if (e.key === "Escape") setEditing(null);
                        }}
                        onBlur={() => renameSession(s.id, editing.value)}
                        className="mx-1 my-0.5 w-full rounded-md border border-mirror-300 bg-surface px-1.5 py-1 text-sm text-ink-800 outline-none"
                      />
                    ) : (
                      <>
                        <button
                          onClick={() => openSession(s.id)}
                          className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-sm text-ink-600 transition group-hover:text-ink-800"
                          title={s.title}
                        >
                          {s.title}
                        </button>
                        <button
                          onClick={() => setEditing({ id: s.id, value: s.title })}
                          className="hidden rounded p-1 text-ink-300 transition hover:text-mirror-600 group-hover:block"
                          title="重命名"
                        >
                          <PencilIcon size={13} />
                        </button>
                        <button
                          onClick={() => archiveSession(s.id)}
                          className="mr-1 hidden rounded p-1 text-ink-300 transition hover:text-rose-500 group-hover:block"
                          title="归档（从列表移除，不影响分析）"
                        >
                          <ArchiveIcon size={13} />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          ))
        )}
        <p className="px-2 pb-1 pt-2 text-[10px] text-ink-300">悬停可重命名 / 归档；归档仅从列表移除，不影响已分析的数据。</p>
      </div>

      <div className="border-t border-ink-200/70 px-3 py-3">
        <Link
          href="/settings"
          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition ${
            pathname === "/settings" ? "bg-mirror-50 font-medium text-mirror-700" : "text-ink-600 hover:bg-ink-100"
          }`}
        >
          <SettingsIcon size={15} />
          设置
        </Link>
      </div>
    </aside>
  );
}
