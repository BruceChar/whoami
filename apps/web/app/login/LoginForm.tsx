"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Logo from "@/components/Logo";

type Tab = "login" | "register";

export default function LoginForm({ invitedBy = "" }: { invitedBy?: string }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        tab === "login"
          ? { username, password }
          : { username, password, nickname };
      const res = await fetch(`/api/auth/${tab}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Request failed");
      router.push("/");
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="flex justify-center"><Logo size={48} /></div>
          <h1 className="mt-3 text-2xl font-semibold text-ink-900">delphi</h1>
          <p className="mt-1 text-sm italic text-ink-400">Be water my friend.</p>
          {invitedBy && (
            <p className="mt-3 rounded-full bg-mirror-50 px-3 py-1.5 text-xs text-mirror-700">
              Invited by {invitedBy} — start your own discovery journey
            </p>
          )}
        </div>

        <div className="mirror-card space-y-4">
          <div className="flex items-center gap-1 rounded-lg bg-ink-100 p-0.5 text-sm">
            {(["login", "register"] as Tab[]).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1.5 transition ${
                  tab === t ? "bg-surface text-ink-900 shadow-soft" : "text-ink-500 hover:text-ink-700"
                }`}
              >
                {t === "login" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {tab === "register" && (
            <div>
              <label className="mb-1 block text-xs text-ink-500">Nickname (what we call you)</label>
              <input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Xiao Zhou"
                className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs text-ink-500">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="5-64 chars: letters, digits, underscore"
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-ink-500">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
              }}
              placeholder={tab === "register" ? "At least 6 characters" : "Your password"}
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
            />
          </div>

          {tab === "register" && (
            <p className="text-[11px] leading-relaxed text-ink-400">
              No real identity needed — just a unique username. Your data stays local to this instance.
            </p>
          )}

          {error && <p className="text-sm text-rose-500">{error}</p>}

          <button
            onClick={submit}
            disabled={busy || !username.trim() || !password}
            className="w-full rounded-xl bg-mirror-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
          >
            {busy ? "Working…" : tab === "login" ? "Sign in" : "Create account"}
          </button>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-ink-100" />
            <span className="text-[11px] text-ink-400">or</span>
            <span className="h-px flex-1 bg-ink-100" />
          </div>

          <div className="flex gap-2">
            <button
              disabled
              title="Coming soon"
              className="flex-1 rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-400"
            >
              Continue with Google
            </button>
            <button
              disabled
              title="Coming soon"
              className="flex-1 rounded-xl border border-ink-200 px-3 py-2 text-xs text-ink-400"
            >
              WeChat
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-[11px] text-ink-300">
          Username is unique and case-insensitive. Nickname is just for display.
        </p>
      </div>
    </div>
  );
}
