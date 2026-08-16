/**
 * Insights page — dashboard, persona and timeline merged
 */
import { getProfile, getAgent } from "@/lib/server";
import {
  DIMENSION_LABELS,
  UP_IS_GOOD,
  PERSONA_STAGE_LABELS,
  INFLECTION_LABELS,
  canGeneratePersona,
  updatePersona,
  llmEnrichPersona,
} from "@delphi/core";
import MetricBar from "@/components/MetricBar";
import Sparkline from "@/components/Sparkline";
import Link from "next/link";

export const dynamic = "force-dynamic";

const GROUPS = [
  { label: "元认知能力", dims: ["selfReflectionDepth", "emotionFactClarity", "attributionFlexibility", "abstractionBalance", "uncertaintyTolerance"] },
  { label: "思维净化", dims: ["shouldTyrannyFreq", "catastrophizingFreq", "mindReadingFreq", "confirmationBiasFreq", "overgeneralizationFreq"] },
  { label: "自我认知清晰度", dims: ["valueClarity", "talentRecognition", "dreamPurity", "selfExternalAlignment"] },
  { label: "能量管理", dims: ["energyClarity", "decisionSatisfactionRate", "intrinsicDriveRatio"] },
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
    ["selfReflectionDepth", "自我反思深度"],
    ["emotionFactClarity", "情绪-事实区分"],
    ["uncertaintyTolerance", "不确定性耐受"],
  ] as const;
  const downDims = [
    ["shouldTyrannyFreq", "应该暴政频率"],
    ["catastrophizingFreq", "灾难化想象频率"],
    ["mindReadingFreq", "读心术频率"],
  ] as const;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-6 py-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink-900">📊 洞察</h1>
          <p className="mt-1 text-sm text-ink-400">
            {PERSONA_STAGE_LABELS[g.growthStage]} · {profile.sessions.length} 次会话 · 首次 {firstUse}
          </p>
        </div>
        {!llm && (
          <Link href="/settings" className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs text-rose-500">
            ⚠ 未配置 API Key
          </Link>
        )}
      </div>

      {/* ===== 仪表盘 ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">关键指标（越高越好）</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {upDims.map(([k, label]) => <MetricBar key={k} label={label} value={g.dimensions[k]?.currentLevel ?? 0.5} up />)}
        </div>
        <p className="mt-4 text-xs text-ink-400">频率类指标（越低越好）</p>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {downDims.map(([k, label]) => <MetricBar key={k} label={label} value={g.dimensions[k]?.currentLevel ?? 0.5} down />)}
        </div>
      </section>

      {/* ===== 画像 ===== */}
      {persona && (
        <section className="mirror-card">
          <h2 className="mirror-title">个人画像 {persona.version}</h2>
          {narratives && (
            <div className="mb-4 space-y-2 rounded-xl bg-mirror-50 p-4 text-sm leading-relaxed text-ink-700">
              {narratives.fingerprint && <p>🧠 {narratives.fingerprint}</p>}
              {narratives.energyMap && <p>⚡ {narratives.energyMap}</p>}
              {narratives.terrain && <p>⛰️ {narratives.terrain}</p>}
              {narratives.growth && <p>📈 {narratives.growth}</p>}
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
            <Field k="归因" v={`内 ${Math.round(persona.cognitiveFingerprint.attributionPattern.internal * 100)}% · 外 ${Math.round(persona.cognitiveFingerprint.attributionPattern.external * 100)}% · 情境 ${Math.round(persona.cognitiveFingerprint.attributionPattern.situational * 100)}%`} />
            <Field k="确定性" v={`${(persona.cognitiveFingerprint.certaintyLevel * 100).toFixed(0)}%`} />
            <Field k="能量源" v={persona.energyMap.sources.join("、") || "数据积累中"} />
            <Field k="能量黑洞" v={persona.energyMap.blackHoles.join("、") || "数据积累中"} />
            <Field k="思维高地" v={persona.thinkingTerrain.highlands.join("、") || "数据积累中"} />
            <Field k="当前瓶颈" v={persona.growthTrajectory.currentBottleneck} />
          </div>
        </section>
      )}

      {/* ===== 时间线 ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">成长时间线</h2>
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
                        <span>{arrow} {DIMENSION_LABELS[k]}</span>
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

      {/* ===== 转折点 ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">转折点</h2>
        {g.inflectionPoints.length === 0 ? (
          <p className="text-sm text-ink-400">暂无转折点，完成工具或出现显著变化后自动记录。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {g.inflectionPoints.slice(-10).reverse().map((ip, i) => (
              <li key={i} className="flex gap-2 text-ink-600">
                <span className="text-mirror-500">{ICONS[ip.type] || "•"}</span>
                <span>
                  <span className="text-ink-400">{ip.timestamp.slice(0, 10)}</span>{" "}
                  <span className="rounded bg-ink-100 px-1.5 py-0.5 text-xs text-ink-500">[{INFLECTION_LABELS[ip.type]}]</span>{" "}
                  {ip.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ===== 外部反馈（360°） ===== */}
      <section className="mirror-card">
        <h2 className="mirror-title">外部反馈（360°）</h2>
        {profile.frameworkData.feedback.records.length === 0 ? (
          <p className="text-sm text-ink-400">
            暂无反馈。前往 <Link href="/settings" className="text-mirror-600 underline">⚙️ 设置</Link> 生成分享链接，邀请亲友填写。
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
                <span key={rel} className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-600">{rel} · {n} 条</span>
              ))}
            </div>

            {profile.frameworkData.feedback.consensusReport && (
              <div className="rounded-xl bg-mirror-50 p-4 text-sm leading-relaxed text-ink-700">
                <p className="mb-1 text-xs font-medium text-mirror-600">外部认知共识报告</p>
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
                    {r.evidence ? ` · 依据: ${r.evidence.slice(0, 50)}` : ""}
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
      <span className="w-20 shrink-0 text-ink-400">{k}</span>
      <span className="text-ink-700">{v}</span>
    </div>
  );
}
