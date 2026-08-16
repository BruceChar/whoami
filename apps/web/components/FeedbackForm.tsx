"use client";

import { useState } from "react";

export default function FeedbackForm({ linkId, ownerName }: { linkId: string; ownerName?: string }) {
  const [author, setAuthor] = useState("");
  const [relationship, setRelationship] = useState("Friend");
  const [knownValue, setKnownValue] = useState("");
  const [knownUnit, setKnownUnit] = useState("years");
  const [impression, setImpression] = useState("");
  const [evidence, setEvidence] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const knownFor = knownValue.trim() ? `${knownValue.trim()} ${knownUnit}` : "";
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId, author, relationship, knownFor, impression, evidence }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submit failed");
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
        Thank you — your feedback has been received and taken seriously.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* row 1: name + relationship */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Your name">
          <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="e.g. Lin" className={inputCls} />
        </Field>
        <Field label="Relationship">
          <select value={relationship} onChange={(e) => setRelationship(e.target.value)} className={inputCls}>
            {["Friend", "Colleague", "Family", "Former manager", "Classmate", "Other"].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </Field>
      </div>

      {/* row 2: how long you've known them, with a selectable time unit */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={`How long have you known ${ownerName || "them"}`}>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              value={knownValue}
              onChange={(e) => setKnownValue(e.target.value)}
              placeholder="e.g. 3"
              className={`${inputCls} w-24`}
            />
            <select value={knownUnit} onChange={(e) => setKnownUnit(e.target.value)} className={inputCls}>
              <option value="years">years</option>
              <option value="months">months</option>
            </select>
          </div>
        </Field>
      </div>

      <Field label="Your overall impression">
        <textarea value={impression} onChange={(e) => setImpression(e.target.value)} rows={3} placeholder="e.g. You're very opinionated, but sometimes you hold onto your views too tightly" className={inputCls} />
      </Field>
      <Field label="Can you recall a specific moment? (optional)">
        <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} rows={2} placeholder="e.g. During our last project discussion…" className={inputCls} />
      </Field>
      {error && <p className="text-sm text-rose-500">{error}</p>}
      <button
        onClick={submit}
        disabled={busy || !impression.trim()}
        className="rounded-xl bg-mirror-500 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-mirror-600 disabled:opacity-40"
      >
        {busy ? "Submitting…" : "Submit feedback"}
      </button>
      <p className="text-xs text-ink-400">Your feedback only helps them see themselves more honestly — please be sincere and specific.</p>
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
