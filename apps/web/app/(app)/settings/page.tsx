"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { SettingsIcon } from "@/components/icons";

type Section = "personal" | "model" | "account" | "share" | "system";

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
}

interface ModelOption {
  id: string;
  inputCost?: number;
  contextWindow?: number;
}

interface UserInfo {
  nickname: string;
  occupation?: string;
  age?: number | null;
  gender?: string;
  interests?: string[];
}

function fmtTokens(n?: number): string {
  if (!n) return "";
  if (n >= 1000000) return `${(n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1)}M`;
  if (n >= 1000) return `${Math.round(n / 1000)}k`;
  return String(n);
}

const SECTIONS: Array<{ id: Section; label: string; disabled?: boolean }> = [
  { id: "personal", label: "Personal info" },
  { id: "model", label: "Model" },
  { id: "account", label: "Account" },
  { id: "share", label: "Share" },
  { id: "system", label: "System", disabled: true },
];

export default function SettingsPage() {
  const router = useRouter();
  const [section, setSection] = useState<Section>("personal");

  const close = useCallback(() => {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }, [router]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/30 p-4 backdrop-blur-[2px]"
      onClick={close}
    >
      <div
        className="flex h-[min(86vh,760px)] w-[min(94vw,920px)] overflow-hidden rounded-2xl border border-ink-200/80 bg-surface shadow-soft"
        onClick={(e) => e.stopPropagation()}
      >
        {/* left section nav */}
        <aside className="flex w-48 shrink-0 flex-col border-r border-ink-200/70 bg-surface/70">
          <div className="flex items-center gap-2 border-b border-ink-200/70 px-4 py-3.5">
            <SettingsIcon size={16} className="text-mirror-600" />
            <span className="text-sm font-semibold text-ink-800">Settings</span>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto p-2">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                disabled={s.disabled}
                onClick={() => setSection(s.id)}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                  s.disabled
                    ? "cursor-not-allowed text-ink-300"
                    : section === s.id
                      ? "bg-mirror-50 font-medium text-mirror-700"
                      : "text-ink-600 hover:bg-ink-100"
                }`}
              >
                {s.label}
                {s.disabled && <span className="text-[10px] text-ink-300">soon</span>}
              </button>
            ))}
          </nav>
        </aside>

        {/* content */}
        <div className="relative flex-1 overflow-y-auto">
          {/* close button top-right */}
          <button
            onClick={close}
            title="Close"
            className="absolute right-4 top-3.5 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 bg-surface text-ink-400 transition hover:border-ink-300 hover:text-ink-700"
          >
            ✕
          </button>

          <div className="px-7 py-6">
            {section === "personal" && <PersonalSection />}
            {section === "model" && <ModelSection />}
            {section === "account" && <AccountSection />}
            {section === "share" && <ShareSection />}
            {section === "system" && <SystemSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 text-lg font-semibold text-ink-900">{children}</h2>;
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm text-ink-500">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-400">{hint}</p>}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400";

/* ============================ Personal ============================ */

function PersonalSection() {
  const [info, setInfo] = useState<UserInfo>({ nickname: "", occupation: "", age: null, gender: "", interests: [] });
  const [interestsText, setInterestsText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        const u: UserInfo = d.userInfo || { nickname: d.nickname || "" };
        setInfo({ nickname: u.nickname || "", occupation: u.occupation || "", age: u.age ?? null, gender: u.gender || "", interests: u.interests || [] });
        setInterestsText((u.interests || []).join(", "));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const interests = interestsText.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nickname: info.nickname,
          occupation: info.occupation,
          age: info.age === null || info.age === undefined ? null : Number(info.age),
          gender: info.gender,
          interests,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setMessage("✓ Saved");
      window.dispatchEvent(new Event("delphi:profile-changed"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) return <p className="text-sm text-ink-400">Loading…</p>;

  return (
    <div className="max-w-md space-y-4">
      <SectionTitle>Personal info</SectionTitle>
      <Field label="Nickname (what we call you)">
        <input value={info.nickname} onChange={(e) => setInfo({ ...info, nickname: e.target.value })} placeholder="e.g. Xiao Zhou" className={inputCls} />
      </Field>
      <Field label="Occupation">
        <input value={info.occupation || ""} onChange={(e) => setInfo({ ...info, occupation: e.target.value })} placeholder="e.g. Product manager" className={inputCls} />
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Age">
          <input
            type="number"
            min={1}
            max={120}
            value={info.age ?? ""}
            onChange={(e) => setInfo({ ...info, age: e.target.value === "" ? null : Number(e.target.value) })}
            placeholder="e.g. 28"
            className={inputCls}
          />
        </Field>
        <Field label="Gender">
          <select
            value={info.gender || ""}
            onChange={(e) => setInfo({ ...info, gender: e.target.value })}
            className={inputCls}
          >
            <option value="">Prefer not to say</option>
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Non-binary">Non-binary</option>
            <option value="Other">Other</option>
          </select>
        </Field>
      </div>
      <Field label="Interests" hint="Separate with commas">
        <input value={interestsText} onChange={(e) => setInterestsText(e.target.value)} placeholder="e.g. writing, running, philosophy" className={inputCls} />
      </Field>
      {message && <p className="text-sm text-emerald-600">{message}</p>}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <button
        onClick={save}
        disabled={saving || !info.nickname.trim()}
        className="rounded-xl bg-mirror-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

/* ============================ Model ============================ */

function ModelSection() {
  const [status, setStatus] = useState<SettingsStatus | null>(null);
  const [provider, setProvider] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
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
      .catch(() => setError("Unable to read configuration"));
  }, []);

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

  const selectedConfigured = status?.providers?.[provider]?.configured || status?.apiKeyMasked != null;

  const save = async () => {
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
  };

  const clear = async () => {
    await fetch("/api/settings", { method: "DELETE" });
    setStatus({ configured: false, source: "none" });
    setMessage("Cleared all configuration");
    window.dispatchEvent(new Event("delphi:settings-changed"));
  };

  const providers = status?.supportedProviders || ["deepseek", "openai", "anthropic", "openrouter", "google"];

  return (
    <div className="max-w-md space-y-4">
      <SectionTitle>Model</SectionTitle>
      <Field label="Provider">
        <select
          value={provider}
          onChange={(e) => {
            setProvider(e.target.value);
            setModel("");
            setApiKey("");
          }}
          className={inputCls}
        >
          {providers.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        {status?.providers?.[provider]?.configured && (
          <p className="mt-1 text-xs text-emerald-600">✓ Already configured — switch without re-entering</p>
        )}
      </Field>
      <Field label="Model">
        {modelsLoading ? (
          <p className="rounded-xl border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-400">Loading models…</p>
        ) : models.length > 0 ? (
          <select value={model} onChange={(e) => setModel(e.target.value)} className={inputCls}>
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
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="deepseek-v4-flash" className={inputCls} />
        )}
        <p className="mt-1 text-xs text-ink-400">Leave empty to use the provider default.</p>
      </Field>
      <Field label={`API Key${selectedConfigured ? " (already set — leave empty to keep it)" : ""}`}>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder={status?.providers?.[provider]?.apiKeyMasked || "sk-..."}
          className={inputCls}
        />
      </Field>
      {message && <p className="text-sm text-emerald-600">{message}</p>}
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <div className="flex gap-3">
        <button
          onClick={save}
          disabled={saving || !provider || (!apiKey && !selectedConfigured)}
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
      {status?.providers && (
        <div className="rounded-xl bg-ink-50 p-3">
          <p className="mb-2 text-xs font-medium text-ink-500">Remembered provider keys</p>
          <div className="flex flex-wrap gap-2">
            {providers.map((p) => {
              const ps = status.providers?.[p];
              return (
                <span key={p} className={`rounded-full px-2.5 py-1 text-xs ${ps?.configured ? "bg-emerald-50 text-emerald-600" : "bg-ink-100 text-ink-400"}`}>
                  {p}{ps?.configured ? ` ✓ ${ps.apiKeyMasked}` : " (not configured)"}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================ Account ============================ */

function AccountSection() {
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; nickname: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setUser(d.user || null))
      .catch(() => setUser(null));
  }, []);

  const signOut = async (toLogin: boolean) => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    }
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="max-w-md space-y-5">
      <SectionTitle>Account</SectionTitle>
      <div className="rounded-xl bg-ink-50 p-4">
        <p className="text-sm text-ink-500">Signed in as</p>
        <p className="mt-1 text-lg font-semibold text-ink-900">{user?.nickname || "—"}</p>
        <p className="text-xs text-ink-400">@{user?.username || "—"}</p>
      </div>
      <div className="space-y-2">
        <button
          onClick={() => signOut(true)}
          disabled={busy}
          className="w-full rounded-xl border border-ink-200 px-4 py-2.5 text-sm text-ink-600 transition hover:border-mirror-300 hover:text-mirror-700 disabled:opacity-40"
        >
          Switch account
        </button>
        <button
          onClick={() => signOut(false)}
          disabled={busy}
          className="w-full rounded-xl border border-rose-200 px-4 py-2.5 text-sm text-rose-500 transition hover:bg-rose-50 disabled:opacity-40"
        >
          Log out
        </button>
      </div>
      <p className="text-xs text-ink-400">Data is stored per account; each workspace is isolated.</p>
    </div>
  );
}

/* ============================ Share ============================ */

function ShareSection() {
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
    <div className="max-w-md space-y-4">
      <SectionTitle>Share</SectionTitle>
      <p className="text-sm text-ink-400">
        Generate a link and invite friends to give you feedback — it calibrates your self-perception.
      </p>
      <div className="flex gap-3">
        <input value={days} onChange={(e) => setDays(e.target.value)} placeholder="Expires in days (default 30)" className={`${inputCls} w-44`} />
        <input value={max} onChange={(e) => setMax(e.target.value)} placeholder="Response limit (optional)" className={`${inputCls} w-44`} />
      </div>
      <button onClick={generate} disabled={busy} className="rounded-xl bg-mirror-500 px-5 py-2 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40">
        Generate link
      </button>
      {link && (
        <div className="rounded-xl bg-ink-50 p-3 text-sm">
          <p className="text-ink-500">Share link:</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="mt-1 w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 font-mono text-xs text-mirror-700" />
          <p className="mt-1 text-xs text-ink-400">Feedback appears in the insights panel.</p>
        </div>
      )}
      {error && <p className="text-sm text-rose-500">{error}</p>}
    </div>
  );
}

/* ============================ System ============================ */

function SystemSection() {
  const rows = [
    { label: "Language", value: "English", note: "More languages coming soon" },
    { label: "Theme", value: "System", note: "Coming soon" },
    { label: "Data export", value: "—", note: "Coming soon" },
  ];
  return (
    <div className="max-w-md space-y-4">
      <SectionTitle>System</SectionTitle>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between rounded-xl border border-ink-100 bg-ink-50/50 px-4 py-3 opacity-60">
          <div>
            <p className="text-sm text-ink-600">{r.label}</p>
            <p className="text-xs text-ink-400">{r.note}</p>
          </div>
          <span className="rounded-full bg-ink-100 px-2.5 py-1 text-xs text-ink-400">{r.value} · soon</span>
        </div>
      ))}
    </div>
  );
}
