/**
 * Insights page — dashboard, persona and timeline merged
 */
import { getProfile, getAgent } from "@/lib/server";
import {
  canGeneratePersona,
  updatePersona,
  llmEnrichPersona,
} from "@delphi/core";
import MetricBar from "@/components/MetricBar";
import Sparkline from "@/components/Sparkline";
import Link from "next/link";
import { InsightsIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

const DIMENSION_LABELS_EN: Record<string, string> = {
  selfReflectionDepth: "Self-reflection depth",
  emotionFactClarity: "Emotion–fact clarity",
  attributionFlexibility: "Attribution flexibility",
  abstractionBalance: "Abstract–concrete balance",
  uncertaintyTolerance: "Uncertainty tolerance",
  shouldTyrannyFreq: "Should-tyranny frequency",
  catastrophizingFreq: "Catastrophizing frequency",
  mindReadingFreq: "Mind-reading frequency",
  confirmationBiasFreq: "Confirmation-bias frequency",
  overgeneralizationFreq: "Overgeneralization frequency",
  valueClarity: "Value clarity",
  talentRecognition: "Talent recognition",
  dreamPurity: "Dream purity",
  selfExternalAlignment: "Self–external alignment",
  energyClarity: "Energy clarity",
  decisionSatisfactionRate: "Decision satisfaction",
  intrinsicDriveRatio: "Intrinsic-drive ratio",
};

const STAGE_LABELS_EN: Record<string, string> = {
  exploration: "Exploration",
  consolidation: "Consolidation",
  breakthrough: "Breakthrough",
  integration: "Integration",
};

const INFLECTION_LABELS_EN: Record<string, string> = {
  milestone: "Milestone",
  bias_breakthrough: "Bias breakthrough",
  cognitive_reconstruction: "Cognitive reconstruction",
  external_validation: "External validation",
  energy_shift: "Energy shift",
  prototype_insight: "Prototype insight",
  crisis_recovery: "Crisis / low point",
};

const GROUPS = [
  { label: "Metacognition", dims: ["selfReflectionDepth", "emotionFactClarity", "attributionFlexibility", "abstractionBalance", "uncertaintyTolerance"] },
  { label: "Thinking hygiene", dims: ["shouldTyrannyFreq", "catastrophizingFreq", "mindReadingFreq", "confirmationBiasFreq", "overgeneralizationFreq"] },
  { label: "Self-knowledge clarity", dims: ["valueClarity", "talentRecognition", "dreamPurity", "selfExternalAlignment"] },
  { label: "Energy management", dims: ["energyClarity", "decisionSatisfactionRate", "intrinsicDriveRatio"] },
];

const ICONS: Record<string, string> = {
  milestone: "▲", bias_breakthrough: "●", cognitive_reconstruction: "◆",
  external_validation: "■", energy_shift: "★", prototype_insight: "◇", crisis_recovery: "▼",
};

export default async function InsightsPage() {
  const { getStore } = await import("@/lib/server");
  const store = getStore();
  const profile = store.get();
  const llm = getAgent();
  const g = profile.growthTracking;
  const firstUse = profile.sessions[0]?.startedAt?.slice(0, 10) || profile.createdAt.slice(0, 10);

  // persona generation / LLM narratives
  let persona = profile.currentPersona;
  let narratives = persona?.narratives;
  if (canGeneratePersona(profile) && persona && !narratives && llm) {
    narratives = (await llmEnrichPersona(llm, profile, persona)) || undefined;
    if (narratives) { persona.narratives = narratives; store.save(); }
  }
  if (canGeneratePersona(profile) && !persona) {
    persona = updatePersona(profile) || null;
    store.save();
  }

  const upDims = [
    ["selfReflectionDepth", "Self-reflection depth"],
    ["emotionFactClarity", "Emotion–fact clarity"],
    ["uncertaintyTolerance", "Uncertainty tolerance"],
  ] as const;
  const downDims = [
    ["shouldTyrannyFreq", "Should-tyranny frequency"],
    ["catastrophizingFreq", "Catastrophizing frequency"],
    ["mindReadingFreq", "Mind-reading frequency"],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-ink-900">
            <InsightsIcon size={22} className="text-mirror-600" />
            Insights
          </h1>
          <p className="mt-1 text-sm text-ink-400">
            {STAGE_LABELS_EN[g.growthStage] || g.growthStage} · {profile.sessions.length} sessions · first use {firstUse}
          </p>
        </div>
        {!llm && (
          <Link href="/settings" className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-500">
            ⚠ No API key configured
          </Link>
        )}
      </div>

      {/* ===== dashboard ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">Key metrics (higher is better)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {upDims.map(([k, label]) => <MetricBar key={k} label={label} value={g.dimensions[k]?.currentLevel ?? 0.5} up />)}
        </div>
        <p className="mt-4 text-xs text-ink-400">Frequency metrics (lower is better)</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {downDims.map(([k, label]) => <MetricBar key={k} label={label} value={g.dimensions[k]?.currentLevel ?? 0.5} down />)}
        </div>
      </section>

      {/* ===== persona ===== */}
      {persona && (
        <section className="mirror-card">
          <h2 className="mirror-title">Persona {persona.version}</h2>
          {narratives && (
            <div className="mb-4 space-y-2 rounded-xl bg-mirror-50 p-4 text-sm leading-relaxed text-ink-700">
              {narratives.fingerprint && <p>🧠 {narratives.fingerprint}</p>}
              {narratives.energyMap && <p>⚡ {narratives.energyMap}</p>}
              {narratives.terrain && <p>⛰️ {narratives.terrain}</p>}
              {narratives.growth && <p>📈 {narratives.growth}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Field k="Attribution" v={`In ${Math.round(persona.cognitiveFingerprint.attributionPattern.internal * 100)}% · Out ${Math.round(persona.cognitiveFingerprint.attributionPattern.external * 100)}% · Situational ${Math.round(persona.cognitiveFingerprint.attributionPattern.situational * 100)}%`} />
            <Field k="Certainty" v={`${(persona.cognitiveFingerprint.certaintyLevel * 100).toFixed(0)}%`} />
            <Field k="Energy sources" v={persona.energyMap.sources.join(", ") || "collecting data"} />
            <Field k="Energy black holes" v={persona.energyMap.blackHoles.join(", ") || "collecting data"} />
            <Field k="Highlands" v={persona.thinkingTerrain.highlands.join(", ") || "collecting data"} />
            <Field k="Current bottleneck" v={persona.growthTrajectory.currentBottleneck} />
          </div>
        </section>
      )}

      {/* ===== timeline ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">Growth timeline</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <p className="mb-2 text-xs font-medium text-ink-500">{group.label}</p>
              <div className="space-y-2">
                {group.dims.map((k) => {
                  const dim = g.dimensions[k];
                  const values = dim?.dataPoints.map((p) => (p as unknown as Record<string, number>)[k]) || [];
                  const trend = dim?.adjustedTrendSlope || 0;
                  const arrow = trend > 0.005 ? "▲" : trend < -0.005 ? "▼" : "—";
                  return (
                    <div key={k}>
                      <div className="flex items-baseline justify-between text-xs text-ink-500">
                        <span>{arrow} {DIMENSION_LABELS_EN[k] || k}</span>
                        <span>{(dim?.currentLevel ?? 0.5).toFixed(2)}</span>
                      </div>
                      <Sparkline values={values} />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== inflections ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">Inflection points</h2>
        {g.inflectionPoints.length === 0 ? (
          <p className="text-sm text-ink-400">No inflection points yet — they are recorded after tools or notable changes.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {g.inflectionPoints.slice(-10).reverse().map((ip, i) => (
              <li key={i} className="flex gap-2 text-ink-600">
                <span className="text-mirror-500">{ICONS[ip.type] || "•"}</span>
                <span>
                  <span className="text-ink-400">{ip.timestamp.slice(0, 10)}</span>{" "}
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500">[{INFLECTION_LABELS_EN[ip.type] || ip.type}]</span>{" "}
                  {ip.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== external feedback (360°) ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">360° external feedback</h2>
        {profile.frameworkData.feedback.records.length === 0 ? (
          <p className="text-sm text-ink-400">
            No feedback yet. Generate a share link in <Link href="/settings" className="text-mirror-600 underline">⚙️ Settings</Link> and invite friends to fill it in.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(
                profile.frameworkData.feedback.records.reduce<Record<string, number>>((acc, r) => {
                  acc[r.relationship] = (acc[r.relationship] || 0) + 1;
                  return acc;
                }, {})
              ).map(([rel, n]) => (
                <span key={rel} className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-600">{rel} · {n}</span>
              ))}
            </div>

            {profile.frameworkData.feedback.consensusReport && (
              <div className="rounded-xl bg-mirror-50 p-4 text-sm leading-relaxed text-ink-700">
                <p className="mb-1 text-xs font-medium text-mirror-600">External consensus report</p>
                {profile.frameworkData.feedback.consensusReport}
              </div>
            )}

            {profile.frameworkData.feedback.selfExternalGaps.length > 0 && (
              <ul className="space-y-1 text-sm text-amber-600">
                {profile.frameworkData.feedback.selfExternalGaps.map((gap, i) => (
                  <li key={i}>⚠ {gap}</li>
                ))}
              </ul>
            )}

            <ul className="space-y-2 text-sm">
              {profile.frameworkData.feedback.records.slice(-8).reverse().map((r) => (
                <li key={r.id} className="rounded-xl bg-ink-50 p-3">
                  <p className="text-ink-800">{r.impression}</p>
                  <p className="mt-1 text-xs text-ink-400">
                    [{r.relationship}·{r.author}] {r.knownFor}
                    {r.evidence ? ` · evidence: ${r.evidence.slice(0, 50)}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <span className="w-28 shrink-0 text-ink-400">{k}</span>
      <span className="text-ink-700">{v}</span>
    </div>
  );
}
