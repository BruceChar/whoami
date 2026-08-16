"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface InsightItem {
  id: string;
  timestamp: string;
  analysis: string;
  source: string;
  tags: string[];
}

interface InflectionItem {
  timestamp: string;
  type: string;
  title: string;
}

export interface InsightsData {
  nickname: string;
  growthStage: string;
  sessions: number;
  personaVersion: string | null;
  narratives: Record<string, string> | null;
  insights: InsightItem[];
  inflectionPoints: InflectionItem[];
  dimensions: Array<{ key: string; currentLevel: number; trendSlope: number; volatility: number }>;
  feedbackCount: number;
  feedbackConsensus: string | null;
}

const STAGE_LABELS: Record<string, string> = {
  exploration: "探索期",
  consolidation: "巩固期",
  breakthrough: "突破期",
  integration: "整合期",
};

const INFLECTION_ICONS: Record<string, string> = {
  milestone: "▲", bias_breakthrough: "●", cognitive_reconstruction: "◆",
  external_validation: "■", energy_shift: "★", prototype_insight: "◇", crisis_recovery: "▼",
};

export default function InsightsPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<InsightsData | null>(null);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-ink-200/70 bg-surface/70">
      <div className="flex items-center justify-between border-b border-ink-200/70 px-4 py-3">
        <span className="text-sm font-semibold text-ink-800">📊 洞察</span>
        <div className="flex items-center gap-1.5">
          <Link
            href="/insights"
            className="rounded-lg border border-ink-200 px-2.5 py-1 text-xs text-ink-500 transition hover:border-mirror-300 hover:text-mirror-700"
          >
            展开 ↗
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="rounded-lg border border-ink-200 px-2 py-1 text-xs text-ink-400 transition hover:border-rose-300 hover:text-rose-500"
              title="收起"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 text-sm">
        {!data ? (
          <p className="text-xs text-ink-400">加载中…</p>
        ) : (
          <>
            {/* overview */}
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-600">阶段 {STAGE_LABELS[data.growthStage] || data.growthStage}</span>
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-600">会话 {data.sessions}</span>
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-600">画像 {data.personaVersion || "未生成"}</span>
              <span className="rounded-full bg-ink-100 px-2.5 py-1 text-ink-600">反馈 {data.feedbackCount}</span>
            </div>

            {/* LLM narratives */}
            {data.narratives && (
              <div className="space-y-2 rounded-xl bg-mirror-50 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-mirror-600">画像叙事</p>
                {data.narratives.fingerprint && <p className="leading-relaxed text-ink-700">🧠 {data.narratives.fingerprint}</p>}
                {data.narratives.energyMap && <p className="leading-relaxed text-ink-700">⚡ {data.narratives.energyMap}</p>}
              </div>
            )}

            {/* recent insights */}
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">最近洞察</p>
              {data.insights.length === 0 ? (
                <p className="text-xs text-ink-400">暂无洞察，继续对话后自动生成。</p>
              ) : (
                <ul className="space-y-2">
                  {data.insights.slice(0, 5).map((i) => (
                    <li key={i.id} className="rounded-xl bg-ink-50 p-2.5">
                      <p className="leading-snug text-ink-700">{i.analysis}</p>
                      <p className="mt-1 text-[11px] text-ink-400">{i.timestamp.slice(0, 10)} · {i.source}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* inflection points */}
            {data.inflectionPoints.length > 0 && (
              <div>
                <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">转折点</p>
                <ul className="space-y-1.5 text-xs text-ink-600">
                  {data.inflectionPoints.map((ip, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-mirror-500">{INFLECTION_ICONS[ip.type] || "•"}</span>
                      <span>
                        <span className="text-ink-400">{ip.timestamp.slice(0, 10)}</span> {ip.title}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* feedback consensus */}
            {data.feedbackConsensus && (
              <div className="rounded-xl bg-mirror-50 p-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-mirror-600">外部认知共识</p>
                <p className="leading-relaxed text-ink-700">{data.feedbackConsensus}</p>
              </div>
            )}

            <Link href="/insights" className="block rounded-xl border border-ink-200 px-3 py-2 text-center text-xs text-ink-500 transition hover:border-mirror-300 hover:text-mirror-700">
              在分析面板中查看全部 →
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
