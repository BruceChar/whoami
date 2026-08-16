"use client";

import { useCallback, useEffect, useState } from "react";
import { SettingsIcon } from "@/components/icons";

interface ProviderStatus {
  configured: boolean;
  apiKeyMasked?: string;
  source?: "env" | "file" | "none";
}

interface SettingsStatus {
  configured: boolean;
  provider?: string;
  model?: string;
  apiKeyMasked?: string;
  source?: "env" | "file" | "none";
  providers?: Record<string, ProviderStatus>;
  supportedProviders?: string[];
  modelPlaceholder?: string;
}

interface ModelOption {
  id: string;
  inputCost?: number;
  contextWindow?: number;
}

function fmtTokens(n?: number): string {
  if (!n) return "";
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

const SOURCE_LABELS: Record<string, string> = { env: "env", file: "config file", none: "—" };

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // personal info
  const [nickname, setNickname] = useState("");
  const [savingNick, setSavingNick] = useState(false);
  const [nickMessage, setNickMessage] = useState<string | null>(null);
  const [nickError, setNickError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: SettingsStatus) => {
        setStatus(s);
        setProvider(s.provider || "deepseek");
        setModel(s.model || "");
      })
      .catch(() => setError("Unable to read configuration"));
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => setNickname(d.nickname || ""))
      .catch(() => {});
  }, []);

  // load the model list whenever the provider changes
  useEffect(() => {
    if (!provider) return;
    setModelsLoading(true);
    setModels([]);
    fetch(`/api/models?provider=${encodeURIComponent(provider)}`)
      .then((r) => r.json())
      .then((d) => setModels(d.models || []))
      .catch(() => setModels([]))
      .finally(() => setModelsLoading(false));
  }, [provider]);

  const selectedProviderConfigured =
    status?.providers?.[provider]?.configured || status?.apiKeyMasked != null;

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, model, apiKey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setStatus(data);
      setApiKey("");
      setMessage("✓ Saved and applied");
      window.dispatchEvent(new Event("delphi:settings-changed"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [provider, model, apiKey]);

  const clear = useCallback(async () => {
    await fetch("/api/settings", { method: "DELETE" });
    setStatus({ configured: false, source: "none" });
    setProvider("deepseek");
    setModel("");
    setMessage("Cleared all configuration");
    window.dispatchEvent(new Event("delphi:settings-changed"));
  }, []);

  const saveNickname = useCallback(async () => {
    const nick = nickname.trim();
    if (!nick) {
      setNickError("Nickname is required");
      return;
    }
    setSavingNick(true);
    setNickError(null);
    setNickMessage(null);
    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname: nick }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setNickMessage(`✓ Saved: ${data.nickname}`);
      window.dispatchEvent(new Event("delphi:profile-changed"));
    } catch (err) {
      setNickError((err as Error).message);
    } finally {
      setSavingNick(false);
    }
  }, [nickname]);

  const providers = status?.supportedProviders || ["deepseek", "openai", "anthropic", "openrouter", "google"];

  return (
    <div className="mx-auto max-w-xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-900">
          <SettingsIcon size={22} className="text-mirror-600" />
          Settings
        </h1>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            status?.configured
              ? "border-emerald-300 bg-emerald-50 text-emerald-600"
              : "border-rose-300 bg-rose-50 text-rose-500"
          }`}
        >
          {status?.configured ? `Configured (${status.apiKeyMasked})` : "Not configured"}
        </span>
      </div>

      {/* ===== Personal info ===== */}
      <div className="mirror-card space-y-3">
        <h2 className="mirror-title">🪪 Personal info</h2>
        <div>
          <label className="mb-1 block text-sm text-ink-500">What should we call you</label>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Your nickname (e.g. Xiao Zhou)"
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
            />
            <button
              onClick={saveNickname}
              disabled={savingNick || !nickname.trim()}
              className="shrink-0 rounded-xl bg-mirror-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
            >
              {savingNick ? "Saving…" : "Save"}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-400">delphi will address you by this name in conversations.</p>
        </div>
        {nickMessage && <p className="text-sm text-emerald-600">{nickMessage}</p>}
        {nickError && <p className="text-sm text-rose-500">{nickError}</p>}
      </div>

      {/* ===== LLM configuration ===== */}
      <div className="mirror-card space-y-4">
        <h2 className="mirror-title">🤖 LLM configuration</h2>

        <div>
          <label className="mb-1 block text-sm text-ink-500">Provider</label>
          <select
            value={provider}
            onChange={(e) => {
              setProvider(e.target.value);
              setModel("");
              setApiKey("");
            }}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 focus:outline-none focus:ring-1 focus:ring-mirror-400"
          >
            {providers.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          {status?.providers?.[provider]?.configured && (
            <p className="mt-1 text-xs text-emerald-600">
              ✓ Already configured ({status.providers[provider].apiKeyMasked}, source: {SOURCE_LABELS[status.providers[provider].source || "none"]}) — switch without re-entering
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-500">Model</label>
          {modelsLoading ? (
            <p className="rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-400">Loading models…</p>
          ) : models.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 focus:outline-none focus:ring-1 focus:ring-mirror-400"
            >
              <option value="">Default model (leave empty)</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id}
                  {m.contextWindow ? ` · ${fmtTokens(m.contextWindow)} ctx` : ""}
                  {m.inputCost != null ? ` · $${Number(m.inputCost).toFixed(4)}/1M in` : ""}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder={status?.modelPlaceholder || "deepseek-v4-flash"}
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
            />
          )}
          <p className="mt-1 text-xs text-ink-400">Leave empty to use the provider default.</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-500">
            API Key{selectedProviderConfigured ? " (already set — leave empty to keep it)" : ""}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status?.providers?.[provider]?.apiKeyMasked || "sk-..."}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
          />
          <p className="mt-1 text-xs text-ink-400">
            {status?.source === "env"
              ? "Currently from an environment variable; saving will prefer the config file"
              : "Saved to the local config file; keys for multiple providers are remembered"}
          </p>
        </div>

        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving || !provider || (!apiKey && !selectedProviderConfigured)}
            className="rounded-xl bg-mirror-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save configuration"}
          </button>
          {status?.configured && (
            <button onClick={clear} className="rounded-xl border border-ink-200 px-5 py-2 text-sm text-ink-500 hover:border-rose-300 hover:text-rose-500">
              Clear all
            </button>
          )}
        </div>

        {/* already-configured providers */}
        {status?.providers && (
          <div className="rounded-xl bg-ink-50 p-3">
            <p className="mb-2 text-xs font-medium text-ink-500">Remembered provider keys</p>
            <div className="flex flex-wrap gap-2">
              {providers.map((p) => {
                const ps = status.providers?.[p];
                return (
                  <span
                    key={p}
                    className={`rounded-full px-2.5 py-1 text-xs ${
                      ps?.configured ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-400"
                    }`}
                  >
                    {p}{ps?.configured ? ` ✓ ${ps.apiKeyMasked}` : " (not configured)"}
                  </span>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <ShareLinkCard />
    </div>
  );
}

function ShareLinkCard() {
  const [days, setDays] = useState("30");
  const [max, setMax] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const res = await fetch("/api/feedback/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresDays: parseInt(days, 10) || 30, maxEntries: parseInt(max, 10) || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setLink(`${typeof window !== "undefined" ? window.location.origin : ""}${data.url}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mirror-card space-y-3">
      <h2 className="mirror-title">🧑‍🤝‍🧑 360° feedback collection</h2>
      <p className="text-sm text-ink-400">
        Generate a share link and invite friends to give you feedback — it calibrates your self-perception.
      </p>
      <div className="flex gap-3">
        <input value={days} onChange={(e) => setDays(e.target.value)} placeholder="Expires in days (default 30)" className="w-44 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400" />
        <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="Response limit (optional)" className="w-44 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400" />
        <button onClick={generate} disabled={busy} className="rounded-xl bg-mirror-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40">
          Generate link
        </button>
      </div>
      {link && (
        <div className="rounded-xl bg-ink-50 p-3 text-sm">
          <p className="text-ink-500">Share link:</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 font-mono text-xs text-mirror-700" />
          <p className="mt-1 text-xs text-ink-400">
            Feedback appears in the <a href="/insights" className="text-mirror-600 underline">insights panel</a>.
          </p>
        </div>
      )}
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </div>
  );
}
