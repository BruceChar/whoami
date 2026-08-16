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
  reasoning?: "low" | "medium" | "high";
  providers?: Record<string, ProviderStatus>;
  supportedProviders?: string[];
  modelPlaceholder?: string;
}

interface ModelOption {
  id: string;
  inputCost?: number;
}

export default function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [reasoning, setReasoning] = useState<"low" | "medium" | "high">("medium");
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
        setReasoning(s.reasoning || "medium");
      })
      .catch(() => setError("无法读取配置状态"));
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
        body: JSON.stringify({ provider, model, apiKey, reasoning }),
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
  }, [provider, model, apiKey, reasoning]);

  const clear = useCallback(async () => {
    await fetch("/api/settings", { method: "DELETE" });
    setStatus({ configured: false, source: "none" });
    setProvider("deepseek");
    setModel("");
    setMessage("已清除全部配置");
    window.dispatchEvent(new Event("delphi:settings-changed"));
  }, []);

  const saveNickname = useCallback(async () => {
    const nick = nickname.trim();
    if (!nick) {
      setNickError("称呼不能为空");
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
      if (!res.ok) throw new Error(data.error || "保存失败");
      setNickMessage(`✓ 已记住：${data.nickname}`);
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
          设置
        </h1>
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

      {/* ===== 个人基础信息 ===== */}
      <div className="mirror-card space-y-3">
        <h2 className="mirror-title">🪪 个人基础信息</h2>
        <div>
          <label className="mb-1 block text-sm text-ink-500">怎么称呼你</label>
          <div className="flex gap-2">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="你的称呼（如：小舟）"
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
            />
            <button
              onClick={saveNickname}
              disabled={savingNick || !nickname.trim()}
              className="shrink-0 rounded-xl bg-mirror-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
            >
              {savingNick ? "保存中…" : "保存"}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-400">对话中 delphi 会用这个名字称呼你。</p>
        </div>
        {nickMessage && <p className="text-sm text-emerald-600">{nickMessage}</p>}
        {nickError && <p className="text-sm text-rose-500">{nickError}</p>}
      </div>

      {/* ===== LLM 配置 ===== */}
      <div className="mirror-card space-y-4">
        <h2 className="mirror-title">🤖 LLM 配置</h2>

        <div>
          <label className="mb-1 block text-sm text-ink-500">LLM 提供商</label>
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
              ✓ 该提供商已配置（{status.providers[provider].apiKeyMasked}，来源：{status.providers[provider].source === "env" ? "环境变量" : "配置文件"}），切换无需重新输入
            </p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-500">模型</label>
          {modelsLoading ? (
            <p className="rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-400">加载模型列表…</p>
          ) : models.length > 0 ? (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 focus:outline-none focus:ring-1 focus:ring-mirror-400"
            >
              <option value="">默认模型（留空）</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.id}{m.inputCost != null ? ` · $${Number(m.inputCost).toFixed(4)}/1M in` : ""}</option>
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
          <p className="mt-1 text-xs text-ink-400">留空使用该提供商的默认模型</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-500">推理深度</label>
          <select
            value={reasoning}
            onChange={(e) => setReasoning(e.target.value as "low" | "medium" | "high")}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 focus:outline-none focus:ring-1 focus:ring-mirror-400"
          >
            <option value="low">低（更快，成本更低）</option>
            <option value="medium">中（平衡）</option>
            <option value="high">高（更深思考）</option>
          </select>
          <p className="mt-1 text-xs text-ink-400">显示在对话输入栏；后续可映射到模型的推理参数。</p>
        </div>

        <div>
          <label className="mb-1 block text-sm text-ink-500">
            API Key{selectedProviderConfigured ? "（已配置，可留空保持不变）" : ""}
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={status?.providers?.[provider]?.apiKeyMasked || "sk-..."}
            className="w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400"
          />
          <p className="mt-1 text-xs text-ink-400">
            {status?.source === "env" ? "当前由环境变量配置，保存后优先使用文件配置" : "保存到本地配置文件；多个提供商的 Key 都会记住"}
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
            {saving ? "保存中…" : "保存配置"}
          </button>
          {status?.configured && (
            <button onClick={clear} className="rounded-xl border border-ink-200 px-5 py-2 text-sm text-ink-500 hover:border-rose-300 hover:text-rose-500">
              清除全部配置
            </button>
          )}
        </div>

        {/* already-configured providers */}
        {status?.providers && (
          <div className="rounded-xl bg-ink-50 p-3">
            <p className="mb-2 text-xs font-medium text-ink-500">已记录的提供商 Key</p>
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
                    {p}{ps?.configured ? ` ✓ ${ps.apiKeyMasked}` : "（未配置）"}
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
      if (!res.ok) throw new Error(data.error || "生成失败");
      setLink(`${typeof window !== "undefined" ? window.location.origin : ""}${data.url}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mirror-card space-y-3">
      <h2 className="mirror-title">🧑‍🤝‍🧑 反馈收集（360°）</h2>
      <p className="text-sm text-ink-400">生成分享链接发给亲友，邀请他们填写对你的反馈，校准自我认知。</p>
      <div className="flex gap-3">
        <input value={days} onChange={(e) => setDays(e.target.value)} placeholder="有效期（天，默认30）" className="w-40 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400" />
        <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="人数上限（可选）" className="w-40 rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400" />
        <button onClick={generate} disabled={busy} className="rounded-xl bg-mirror-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40">
          生成链接
        </button>
      </div>
      {link && (
        <div className="rounded-xl bg-ink-50 p-3 text-sm">
          <p className="text-ink-500">分享链接：</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 font-mono text-xs text-mirror-700" />
          <p className="mt-1 text-xs text-ink-400">在 <a href="/insights" className="text-mirror-600 underline">洞察面板</a> 查看收到的反馈。</p>
        </div>
      )}
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </div>
  );
}
