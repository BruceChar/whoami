/**
 * delphi 仪表盘（文档 7.2 认知仪表盘）
 */
import { getProfile, getAgent } from "@/lib/server";
import {
  DIMENSION_LABELS,
  UP_IS_GOOD,
  PERSONA_STAGE_LABELS,
} from "@delphi/core";
import MetricBar from "@/components/MetricBar";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const profile = getProfile();
  const llm = getAgent();
  const g = profile.growthTracking;
  const firstUse = profile.sessions[0]?.startedAt?.slice(0, 10) || profile.createdAt.slice(0, 10);

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
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">🧭 认知仪表盘</h1>
          <p className="mt-1 text-sm text-slate-400">
            当前成长阶段: <span className="text-mirror">{PERSONA_STAGE_LABELS[g.growthStage]}</span>
            {" · "}已积累会话 {profile.sessions.length} 次 · 首次使用 {firstUse}
          </p>
        </div>
        {llm ? (
          <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
            ⚡ LLM Agent: {llm.id}/{llm.model}
          </span>
        ) : (
          <Link
            href="/settings"
            className="rounded-full border border-rose-500/50 bg-rose-500/10 px-3 py-1 text-xs text-rose-300 transition hover:bg-rose-500/20"
          >
            ⚠ 未配置 API Key · 去设置
          </Link>
        )}
      </div>

      {!llm && (
        <div className="rounded-xl border border-rose-500/40 bg-rose-500/5 p-4 text-sm text-rose-200">
          离线模式已取消：需要配置 LLM API Key 才能使用对话与深度分析。
          前往 <Link href="/settings" className="underline">⚙️ 设置</Link> 配置，或设置环境变量（DELPHI_LLM_PROVIDER + &lt;PROVIDER&gt;_API_KEY）。
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {upDims.map(([k, label]) => (
          <MetricBar key={k} label={label} value={g.dimensions[k]?.currentLevel ?? 0.5} up />
        ))}
      </div>
      <p className="text-xs text-slate-500">频率类指标（越低越好）</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {downDims.map(([k, label]) => (
          <MetricBar key={k} label={label} value={g.dimensions[k]?.currentLevel ?? 0.5} down />
        ))}
      </div>

      <div className="mirror-card">
        <h2 className="mirror-title mb-3">最近洞察</h2>
        {profile.insights.length === 0 ? (
          <p className="text-sm text-slate-500">暂无洞察，完成对话或工具后自动生成。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {profile.insights.slice(-5).reverse().map((i) => (
              <li key={i.id} className="flex gap-2">
                <span className="text-mirror">•</span>
                <span>
                  <span className="text-slate-400">{i.timestamp.slice(0, 10)}: </span>
                  {i.analysis}
                  {i.tags.length > 0 && (
                    <span className="ml-2 text-xs text-slate-500">[{i.tags.join(", ")}]</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="mirror-card">
          <h2 className="mirror-title mb-3">价值观锚点</h2>
          {profile.frameworkData.vtd.values.anchors.length === 0 ? (
            <p className="text-sm text-slate-500">未完成 V-T-D 探索</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {profile.frameworkData.vtd.values.anchors.map((a) => (
                <span key={a} className="rounded-full bg-ink-800 px-3 py-1 text-sm text-mirror">{a}</span>
              ))}
            </div>
          )}
        </div>
        <div className="mirror-card">
          <h2 className="mirror-title mb-3">能量地图</h2>
          {profile.currentPersona ? (
            <div className="space-y-2 text-sm">
              <p>⚡ 能量源: <span className="text-emerald-300">{profile.currentPersona.energyMap.sources.join("、") || "数据积累中"}</span></p>
              <p>🪫 能量黑洞: <span className="text-rose-300">{profile.currentPersona.energyMap.blackHoles.join("、") || "数据积累中"}</span></p>
            </div>
          ) : (
            <p className="text-sm text-slate-500">积累 ≥3 次会话与工具后生成画像</p>
          )}
        </div>
      </div>
    </div>
  );
}
