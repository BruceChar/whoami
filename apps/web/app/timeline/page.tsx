/**
 * 成长时间线页（文档 7.3）：指标曲线（SVG 折线）+ 转折点
 */
import { getProfile } from "@/lib/server";
import {
  DIMENSION_LABELS,
  INFLECTION_LABELS,
  UP_IS_GOOD,
} from "@delphi/core";
import Sparkline from "@/components/Sparkline";

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

export default function TimelinePage() {
  const profile = getProfile();
  const g = profile.growthTracking;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">🕰️ 认知成长时间线</h1>

      {GROUPS.map((group) => (
        <div key={group.label} className="mirror-card">
          <h2 className="mirror-title mb-4">{group.label}</h2>
          <div className="space-y-4">
            {group.dims.map((k) => {
              const dim = g.dimensions[k];
              const values = dim?.dataPoints.map((p) => (p as unknown as Record<string, number>)[k]) || [];
              const trend = dim?.adjustedTrendSlope || 0;
              const arrow = trend > 0.005 ? "▲" : trend < -0.005 ? "▼" : "—";
              const up = UP_IS_GOOD[k] === undefined || !UP_IS_GOOD[k] ? undefined : UP_IS_GOOD[k];
              void up;
              return (
                <div key={k}>
                  <div className="mb-1 flex items-baseline justify-between text-sm">
                    <span className="text-slate-300">{arrow} {DIMENSION_LABELS[k]}</span>
                    <span className="text-slate-500">{(dim?.currentLevel ?? 0.5).toFixed(2)}</span>
                  </div>
                  <Sparkline values={values} />
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="mirror-card">
        <h2 className="mirror-title mb-3">转折点记录</h2>
        {g.inflectionPoints.length === 0 ? (
          <p className="text-sm text-slate-500">暂无转折点，完成方法论工具或出现显著变化后自动记录。</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {g.inflectionPoints.slice(-10).reverse().map((ip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-mirror">{ICONS[ip.type] || "•"}</span>
                <span>
                  <span className="text-slate-500">{ip.timestamp.slice(0, 10)}</span>{" "}
                  <span className="rounded bg-ink-800 px-1.5 py-0.5 text-xs text-slate-400">[{INFLECTION_LABELS[ip.type]}]</span>{" "}
                  {ip.title}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
