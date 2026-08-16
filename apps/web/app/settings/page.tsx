"use client";

import { useCallback, useEffect, useState } from "react";

interface SettingsStatus {
  configured: boolean;
  provider?: string;
  model?: string;
  apiKeyMasked?: string;
  source?: "env" | "file" | "none";
  supportedProviders?: string[];
  modelPlaceholder?: string;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((s: SettingsStatus) => {
        setStatus(s);
        setProvider(s.provider || "deepseek");
        setModel(s.model || "");
      })
      .catch(() => setError("无法读取配置状态"));
  }, []);

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
      if (!res.ok) throw new Error(data.error || "保存失败");
      setStatus(data);
      setApiKey("");
      setMessage("✓ 配置已保存，立即生效");
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
    setMessage("已清除配置");
    window.dispatchEvent(new Event("delphi:settings-changed"));
  }, []);

  return (
    <div className="mx-auto max-w-xl space-y-6 px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-ink-900">⚙️ 设置</h1>
        <span
          className={`rounded-full border px-3 py-1 text-xs ${
            status?.configured
              ? "border-emerald-300 bg-emerald-50 text-emerald-600"
              : "border-rose-300 bg-rose-50 text-rose-500"
          }`}
        >
          {status?.configured ? `已配置（${status.apiKeyMasked}）` : "未配置 API Key"}
        </span>
      </div>

      <div className="mirror-card space-y-4">
        <div>
          <label className="mb-1 block text-sm text-ink-500">LLM 提供商</label>
          <select
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 focus:outline-none focus:ring-1 focus:ring-mirror-400"
          >
            {(status?.supportedProviders || ["deepseek", "openai", "anthropic", "openrouter", "google"]).map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-500">模型（可选）</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={status?.modelPlaceholder || "deepseek-v4-flash"}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
          />
          <p className="mt-1 text-xs text-ink-400">留空使用该提供商的默认模型</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-500">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status?.apiKeyMasked || "sk-..."}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
          />
          <p className="mt-1 text-xs text-ink-400">
            {status?.source === "env" ? "当前由环境变量配置，保存后优先使用文件配置" : "保存到本地配置文件，仅供本地使用"}
          </p>
        </div>

        {message && <p className="text-sm text-emerald-600">{message}</p>}
        {error && <p className="text-sm text-rose-500">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving || !provider || !apiKey}
            className="rounded-xl bg-mirror-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存配置"}
          </button>
          {status?.source === "file" && (
            <button onClick={clear} className="rounded-xl border border-ink-200 px-5 py-2 text-sm text-ink-500 hover:border-rose-300 hover:text-rose-500">
              清除配置
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
