"use client";

import { useState } from "react";

export default function FeedbackForm({ linkId }: { linkId: string }) {
  const [author, setAuthor] = useState("");
  const [relationship, setRelationship] = useState("朋友");
  const [knownFor, setKnownFor] = useState("");
  const [impression, setImpression] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId, author, relationship, knownFor, impression, evidence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "提交失败");
      setDone(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-700">
        已收到你的反馈，感谢你的真诚分享。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="你的称呼">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="如 张三 / 匿名" className={inputCls} />
        </Field>
        <Field label="与 ta 的关系">
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls}>
            {["朋友", "同事", "家人", "前领导", "同学", "其他"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
        <Field label="认识多久了">
          <input value={knownFor} onChange={(e) => setKnownFor(e.target.value)} placeholder="如 3年 / 从小一起长大" className={inputCls} />
        </Field>
      </div>
      <Field label="你对 ta 的整体印象">
        <textarea value={impression} onChange={(e) => setImpression(e.target.value)} rows={3} placeholder="如：我觉得你是一个很有主见的人，但有时过于坚持自己的想法" className={inputCls} />
      </Field>
      <Field label="能举一个具体场景吗？（可选）">
        <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} placeholder="如：上次一起做项目时…" className={inputCls} />
      </Field>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !impression.trim()}
        className="rounded-xl bg-mirror-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
      >
        {busy ? "提交中…" : "提交反馈"}
      </button>
      <p className="text-xs text-ink-400">你的反馈仅用于帮助 ta 更真实地认识自己，请真诚、具体。</p>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-ink-200 bg-surface px-3 py-2 text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-1 focus:ring-mirror-400";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-ink-500">{label}</span>
      {children}
    </label>
  );
}
