/**
 * delphi —— 转折点检测（文档 7.3）
 * 里程碑 / 偏差突破 / 认知重构 / 外部验证 / 能量转移 / 原型验证 / 危机低谷
 */
import {
  InflectionPoint,
  InflectionType,
  UserCognitiveProfile,
} from "../models/types";
import { UP_IS_GOOD, DIMENSION_LABELS } from "./growthTracker";

const INFLECTION_LABELS: Record<InflectionType, string> = {
  milestone: "里程碑",
  bias_breakthrough: "偏差突破",
  cognitive_reconstruction: "认知重构",
  external_validation: "外部验证",
  energy_shift: "能量转移",
  prototype_insight: "原型验证",
  crisis_recovery: "危机/低谷",
};

export { INFLECTION_LABELS };

export function addInflection(
  profile: UserCognitiveProfile,
  type: InflectionType,
  title: string,
  description: string,
  dimensionsAffected: string[] = [],
  userMarked = false
): InflectionPoint {
  const point: InflectionPoint = {
    timestamp: new Date().toISOString(),
    type,
    title,
    description,
    relatedSessions: profile.sessions.slice(-1).map((s) => s.id),
    dimensionsAffected,
    beforeSnapshot: {},
    afterSnapshot: {},
    userMarked,
    agentDetected: true,
  };
  // 快照：受影响维度变化
  for (const d of dimensionsAffected) {
    const dim = profile.growthTracking.dimensions[d];
    if (dim) {
      const vals = dim.dataPoints.map((p) => (p as unknown as Record<string, number>)[d]);
      point.beforeSnapshot[d] = vals.length >= 4 ? mean(vals.slice(0, -3)) : dim.currentLevel;
      point.afterSnapshot[d] = dim.currentLevel;
    }
  }
  profile.growthTracking.inflectionPoints.push(point);
  return point;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

/**
 * 偏差突破检测：某类思维漏洞频率从早期到近期显著下降（>25%）
 * 在 recomputeProfile 后调用；每个维度避免重复标记（30 天内）。
 */
export function detectBiasBreakthroughs(profile: UserCognitiveProfile): InflectionPoint[] {
  const created: InflectionPoint[] = [];
  const now = Date.now();

  for (const k of Object.keys(profile.growthTracking.dimensions)) {
    if (!UP_IS_GOOD[k]) continue; // 只检测频率类（应下降）维度
    const dim = profile.growthTracking.dimensions[k];
    const vals = dim.dataPoints.map((p) => (p as unknown as Record<string, number>)[k]);
    if (vals.length < 6) continue;

    const earlier = mean(vals.slice(0, Math.floor(vals.length / 2)));
    const recent = mean(vals.slice(-Math.floor(vals.length / 2)));
    if (earlier <= 0.05) continue;
    const drop = (earlier - recent) / earlier;
    if (drop > 0.25) {
      // 去重：30 天内同一维度已有偏差突破则不重复
      const dup = profile.growthTracking.inflectionPoints.some(
        (ip) =>
          ip.type === "bias_breakthrough" &&
          ip.dimensionsAffected.includes(k) &&
          now - new Date(ip.timestamp).getTime() < 30 * 24 * 3600 * 1000
      );
      if (dup) continue;
      const label = DIMENSION_LABELS[k] || k;
      created.push(
        addInflection(
          profile,
          "bias_breakthrough",
          `"${label}"频率显著下降 (${(drop * 100).toFixed(0)}%)`,
          `${label}从 ${earlier.toFixed(2)} 降至 ${recent.toFixed(2)}`,
          [k]
        )
      );
    }
  }
  return created;
}
