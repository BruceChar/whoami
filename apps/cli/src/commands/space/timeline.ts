/**
 * delphi —— 成长时间线（文档 7.3）
 * 维度选择 → ASCII 火花线 + 阶段划分 + 转折点记录
 */
import { ProfileStore, DIMENSION_LABELS, INFLECTION_LABELS, UP_IS_GOOD } from "@delphi/core";
import { askLine } from "../../ui/ask";
import { c, sparkline, hr } from "../../ui/render";

const DIM_GROUPS: Array<{ key: string; label: string; dims: string[] }> = [
  { key: "1", label: "元认知能力", dims: ["selfReflectionDepth", "emotionFactClarity", "attributionFlexibility", "abstractionBalance", "uncertaintyTolerance"] },
  { key: "2", label: "思维净化", dims: ["shouldTyrannyFreq", "catastrophizingFreq", "mindReadingFreq", "confirmationBiasFreq", "overgeneralizationFreq"] },
  { key: "3", label: "自我认知清晰度", dims: ["valueClarity", "talentRecognition", "dreamPurity", "selfExternalAlignment"] },
  { key: "4", label: "能量管理", dims: ["energyClarity", "decisionSatisfactionRate", "intrinsicDriveRatio"] },
  { key: "5", label: "全部", dims: Object.keys(DIMENSION_LABELS) },
];

export async function runTimeline(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const g = profile.growthTracking;

  console.log(c.cyan(`\n🕰️ 认知成长时间线 (${profile.sessions[0]?.startedAt?.slice(0, 10) || "—"} 至 ${new Date().toISOString().slice(0, 10)})`));
  console.log("");
  console.log("维度选择: [1]元认知能力 [2]思维净化 [3]自我认知清晰度 [4]能量管理 [5]全部");
  const choice = (await askLine("> ")).trim() || "5";
  const group = DIM_GROUPS.find((g2) => g2.key === choice) || DIM_GROUPS[4];

  console.log("");
  console.log(hr(50));
  console.log(`  ${group.label}维度 - 成长曲线`);
  console.log(hr(50));

  for (const dimKey of group.dims) {
    const dim = g.dimensions[dimKey];
    const values = dim?.dataPoints.map((p) => p[dimKey as keyof typeof p] as number) || [];
    const label = (DIMENSION_LABELS[dimKey] || dimKey).padEnd(10);
    const trend = dim?.adjustedTrendSlope || 0;
    const arrow = trend > 0.005 ? "▲" : trend < -0.005 ? "▼" : "—";
    console.log(`  ${arrow} ${label} ${sparkline(values, 24)}  ${dim?.currentLevel.toFixed(2) ?? "—"}`);
  }

  console.log("");
  console.log("  转折点记录:");
  const inflections = g.inflectionPoints;
  if (inflections.length === 0) {
    console.log("  （暂无转折点，完成方法论工具或出现显著变化后自动记录）");
  } else {
    const icons: Record<string, string> = { milestone: "▲", bias_breakthrough: "●", cognitive_reconstruction: "◆", external_validation: "■", energy_shift: "★", prototype_insight: "◇", crisis_recovery: "▼" };
    for (const ip of inflections.slice(-8)) {
      console.log(`  ${icons[ip.type] || "•"} ${ip.timestamp.slice(0, 10)}  [${INFLECTION_LABELS[ip.type]}] ${ip.title}`);
    }
  }
  console.log(hr(50));
}
