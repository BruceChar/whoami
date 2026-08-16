/** delphi — milestone / bias breakthrough / cognitive reconstruction / external */
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
    // snapshot: changes in affected dimensions
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
  * Bias-breakthrough detection: a bias frequency drops >25% from early to
  * recent sessions. Run after recomputeProfile; de-dupes per dimension (30d).
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
            // de-dup: same dimension already has a breakthrough within 30 days
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
