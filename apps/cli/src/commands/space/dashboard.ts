/** delphi — cognitive dashboard. */
import { ProfileStore, DIMENSION_LABELS, UP_IS_GOOD, PERSONA_STAGE_LABELS } from "@delphi/core";
import { c, box, progressBar, hr } from "../../ui/render";

export async function runDashboard(store: ProfileStore): Promise<void> {
  const profile = store.get();
  const g = profile.growthTracking;
  const firstUse = profile.sessions[0]?.startedAt?.slice(0, 10) || profile.createdAt.slice(0, 10);

  const upDims = [
    ["selfReflectionDepth", "自我反思深度"],
    ["emotionFactClarity", "情绪-事实区分"],
    ["uncertaintyTolerance", "不确定性耐受"],
  ];
  const downDims = [
    ["shouldTyrannyFreq", "应该暴政频率"],
    ["catastrophizingFreq", "灾难化想象频率"],
    ["mindReadingFreq", "读心术频率"],
  ];

  const metricLines: string[] = [];
  for (const [k, label] of upDims) {
    const dim = g.dimensions[k];
    metricLines.push(`${label.padEnd(10)} ${progressBar(dim?.currentLevel || 0.5, 18)} ${formatTrend(dim?.adjustedTrendSlope || 0, true)}`);
  }
  metricLines.push("─".repeat(30));
  metricLines.push(c.dim("频率类指标（越低越好）"));
  for (const [k, label] of downDims) {
    const dim = g.dimensions[k];
    metricLines.push(`${label.padEnd(10)} ${progressBar(dim?.currentLevel || 0.5, 18)} ${formatTrend(dim?.adjustedTrendSlope || 0, false)}`);
  }

  const insights = profile.insights.slice(-3).reverse();
  const insightLines = insights.length
    ? insights.map((i) => `• ${i.timestamp.slice(0, 10)}: ${i.analysis.slice(0, 40)}`)
    : ["• 暂无洞察，完成工具或对话后自动生成"];

  const lines: string[] = [];
  lines.push(box(" 🧭 认知仪表盘 ", [
    `当前成长阶段: ${PERSONA_STAGE_LABELS[g.growthStage]}`,
    `已积累会话: ${profile.sessions.length}次 | 首次使用: ${firstUse}`,
    "",
    "关键指标（当前值，▲▼ 为趋势）",
    ...metricLines,
  ], 58));
  lines.push("");
  lines.push(box(" 最近洞察 ", insightLines, 58));

  console.log("\n" + lines.join("\n"));
  console.log(c.dim(`\n数据目录: ${profile.settings.dataDir}`));
}

function formatTrend(slope: number, upIsGood: boolean): string {
  const good = upIsGood ? slope > 0.005 : slope < -0.005;
  const bad = upIsGood ? slope < -0.005 : slope > 0.005;
  if (good) return c.green("▲");
  if (bad) return c.red("▼");
  return c.dim("—");
}
