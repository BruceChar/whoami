/**
 * 个人画像页（文档 8.x）：六维画像 + LLM 叙事
 */
import { getProfile, getAgent } from "@/lib/server";
import {
  canGeneratePersona,
  updatePersona,
  llmEnrichPersona,
  PERSONA_STAGE_LABELS,
  EMOTION_LABELS,
} from "@delphi/core";
import { revalidatePath } from "next/cache";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function PersonaPage() {
  const store = await import("@/lib/server").then((m) => m.getStore());
  const profile = store.get();

  if (!canGeneratePersona(profile)) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">🧬 个人画像</h1>
        <div className="mirror-card text-sm text-slate-300">
          <p className="text-slate-400">🧬 个人画像需要更多数据（≥3 次会话 + 1 个完整方法论工具）。</p>
          <p className="mt-2">先完成 <Link href="/chat" className="text-mirror">对话</Link>、每日回馈或 V-T-D 探索，画像会自动生成。</p>
        </div>
      </div>
    );
  }

  let persona = profile.currentPersona;
  let narratives = persona?.narratives;
  if (persona && !narratives) {
    const llm = getAgent();
    if (llm) {
      narratives = (await llmEnrichPersona(llm, profile, persona)) || undefined;
      if (narratives) {
        persona.narratives = narratives;
        store.save();
        revalidatePath("/persona");
      }
    }
  }
  if (!persona) {
    persona = updatePersona(profile) || null;
    store.save();
  }

  const fp = persona!.cognitiveFingerprint;
  const topEmotions = Object.entries(fp.emotionalTone)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, v]) => `${EMOTION_LABELS[k] || k} ${v}次`)
    .join(" | ") || "数据积累中";

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">🧬 个人画像 {persona!.version}</h1>
          <p className="mt-1 text-sm text-slate-400">
            生成于 {persona!.generatedAt.slice(0, 10)} · 基于 {persona!.basedOnSessions} 次会话
          </p>
        </div>
        {narratives && <span className="rounded-full border border-mirror/40 px-3 py-1 text-xs text-mirror">LLM 叙事已生成</span>}
      </div>

      {narratives && (
        <div className="mirror-card border-mirror/30">
          <h2 className="mirror-title mb-3">LLM 叙事</h2>
          <div className="space-y-2 text-sm leading-relaxed text-slate-300">
            {narratives.fingerprint && <p>🧠 {narratives.fingerprint}</p>}
            {narratives.energyMap && <p>⚡ {narratives.energyMap}</p>}
            {narratives.terrain && <p>⛰️ {narratives.terrain}</p>}
            {narratives.relationship && <p>🤝 {narratives.relationship}</p>}
            {narratives.decision && <p>🧭 {narratives.decision}</p>}
            {narratives.growth && <p>📈 {narratives.growth}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="mirror-card">
          <h2 className="mirror-title mb-3">认知指纹</h2>
          <dl className="space-y-2 text-sm">
            <Row k="归因模式" v={`内 ${Math.round(fp.attributionPattern.internal * 100)}% · 外 ${Math.round(fp.attributionPattern.external * 100)}% · 情境 ${Math.round(fp.attributionPattern.situational * 100)}%`} />
            <Row k="确定性" v={`${(fp.certaintyLevel * 100).toFixed(0)}%`} />
            <Row k="时间取向" v={`过去 ${Math.round(fp.timeOrientation.past * 100)}% · 现在 ${Math.round(fp.timeOrientation.present * 100)}% · 未来 ${Math.round(fp.timeOrientation.future * 100)}%`} />
            <Row k="情绪基调" v={topEmotions} />
          </dl>
        </div>

        <div className="mirror-card">
          <h2 className="mirror-title mb-3">思维地形</h2>
          <dl className="space-y-2 text-sm">
            <Row k="高地" v={persona!.thinkingTerrain.highlands.join("、") || "数据积累中"} />
            <Row k="洼地" v={persona!.thinkingTerrain.lowlands.join("、") || "数据积累中"} />
            <Row k="峡谷" v={persona!.thinkingTerrain.canyons.map((c) => c.tension).join("；") || "—"} />
          </dl>
        </div>

        <div className="mirror-card">
          <h2 className="mirror-title mb-3">能量地图</h2>
          <dl className="space-y-2 text-sm">
            <Row k="能量源" v={<span className="text-emerald-300">{persona!.energyMap.sources.join("、") || "数据积累中"}</span>} />
            <Row k="能量黑洞" v={<span className="text-rose-300">{persona!.energyMap.blackHoles.join("、") || "数据积累中"}</span>} />
            {persona!.energyMap.disguises.map((d, i) => (
              <Row key={i} k="能量伪装" v={`${d.activity}（你以为充电，实际耗电）`} />
            ))}
          </dl>
        </div>

        <div className="mirror-card">
          <h2 className="mirror-title mb-3">成长轨迹</h2>
          <dl className="space-y-2 text-sm">
            <Row k="阶段" v={PERSONA_STAGE_LABELS[persona!.growthTrajectory.currentStage]} />
            <Row k="最快成长" v={persona!.growthTrajectory.fastestDimension} />
            <Row k="当前瓶颈" v={persona!.growthTrajectory.currentBottleneck} />
            <Row k="突破建议" v={persona!.growthTrajectory.breakthroughSuggestion} />
          </dl>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <dt className="w-24 shrink-0 text-slate-500">{k}</dt>
      <dd className="text-slate-200">{v}</dd>
    </div>
  );
}
