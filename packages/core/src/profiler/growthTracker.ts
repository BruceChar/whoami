/**
 * delphi —— 成长追踪引擎（文档 7.2 / 7.3 / 7.8）
 * 17 项指标的计算、成长曲线、练习效应校正、成长阶段判定。
 * 档案每更新一次，这里全量重算（设计原则 4：迭代进化）。
 */
import {
  CognitiveMetricPoint,
  CognitiveMarkers,
  GrowthStage,
  SessionRecord,
  UserCognitiveProfile,
} from "../models/types";
import { BIAS_TYPES } from "../analyzer/biasDetector";
import { emotionFactScore } from "../analyzer/cognitiveMarker";

export const DIMENSION_LABELS: Record<string, string> = {
  selfReflectionDepth: "自我反思深度",
  emotionFactClarity: "情绪-事实区分",
  attributionFlexibility: "归因灵活性",
  abstractionBalance: "抽象-具体平衡",
  uncertaintyTolerance: "不确定性耐受",
  shouldTyrannyFreq: "应该暴政频率",
  catastrophizingFreq: "灾难化想象频率",
  mindReadingFreq: "读心术频率",
  confirmationBiasFreq: "确认偏误频率",
  overgeneralizationFreq: "过度概括频率",
  valueClarity: "价值观清晰度",
  talentRecognition: "天赋识别度",
  dreamPurity: "梦想纯度",
  selfExternalAlignment: "自我-外部一致性",
  energyClarity: "能量流向清晰度",
  decisionSatisfactionRate: "决策满意度率",
  intrinsicDriveRatio: "内驱/外驱比例",
};

export const UP_IS_GOOD: Record<string, boolean> = {
  shouldTyrannyFreq: false,
  catastrophizingFreq: false,
  mindReadingFreq: false,
  confirmationBiasFreq: false,
  overgeneralizationFreq: false,
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// ---------------------------------------------------------------------------
// 会话指标计算
// ---------------------------------------------------------------------------

/** 由一条会话记录计算 CognitiveMetricPoint（框架驱动指标取当前档案状态） */
export function computeSessionPoint(profile: UserCognitiveProfile, session: SessionRecord): CognitiveMetricPoint {
  const userMsgs = session.messages.filter((m) => m.role === "user");
  const n = Math.max(1, userMsgs.length);

  let reflection = 0;
  let emotionFactSum = 0;
  let jumps = 0;
  let certaintySum = 0;
  let internal = 0, external = 0, situational = 0;
  const biasCounts: Record<string, number> = {};
  for (const t of BIAS_TYPES) biasCounts[t] = 0;

  for (const m of userMsgs) {
    if (!m.markers) continue;
    reflection += m.markers.selfReflection ? 1 : 0;
    emotionFactSum += emotionFactScore(m.text);
    jumps += m.markers.abstractionJump ? 1 : 0;
    certaintySum += m.markers.certainty;
    if (m.markers.attribution === "internal") internal++;
    else if (m.markers.attribution === "external") external++;
    else if (m.markers.attribution === "situational") situational++;
    for (const b of m.markers.biases) biasCounts[b.type] = (biasCounts[b.type] || 0) + 1;
  }

  const totalAttr = internal + external + situational;
  const attrDist = totalAttr
    ? { internal: internal / totalAttr, external: external / totalAttr, situational: situational / totalAttr }
    : { internal: 0.33, external: 0.34, situational: 0.33 };

  const fw = profile.frameworkData;
  const vtdAnchors = fw.vtd.values.anchors.length;
  const signFilled = Object.values(fw.sign.signals).filter((s) => s && s.trim().length > 0).length;
  const achievementCount = fw.achievements.length;
  const pureDrives = fw.vtd.dreams.pureDrives.length;
  const extMotives = fw.vtd.dreams.externalMotivesFiltered.length;
  const dailyCount = fw.dailyFeedback.length;
  const feedbackDone = fw.feedback.externalPerception.length > 0;

  return {
    timestamp: session.endedAt,
    sessionId: session.id,
    source: (session.messages[0]?.markers ? "free_chat" : "free_chat") as CognitiveMetricPoint["source"],

    selfReflectionDepth: clamp01(reflection / n),
    emotionFactClarity: clamp01(emotionFactSum / n),
    attributionFlexibility: clamp01(1 - Math.abs(attrDist.internal - attrDist.external)),
    abstractionBalance: clamp01(1 - Math.abs((jumps / n) - 0.5) * 2),
    uncertaintyTolerance: clamp01(1 - certaintySum / n),

    shouldTyrannyFreq: clamp01(biasCounts.should_tyranny / n),
    catastrophizingFreq: clamp01(biasCounts.catastrophizing / n),
    mindReadingFreq: clamp01(biasCounts.mind_reading / n),
    confirmationBiasFreq: clamp01(biasCounts.confirmation_bias / n),
    overgeneralizationFreq: clamp01(biasCounts.overgeneralization / n),

    valueClarity: clamp01(vtdAnchors >= 3 ? 0.8 : vtdAnchors >= 1 ? 0.6 : 0.3),
    talentRecognition: clamp01(0.3 + 0.1 * Math.min(3, signFilled) + (achievementCount > 0 ? 0.2 : 0)),
    dreamPurity: clamp01(pureDrives >= 1 ? (extMotives > 0 ? 0.55 : 0.75) : 0.3),
    selfExternalAlignment: feedbackDone ? 0.7 : 0.5,
    energyClarity: clamp01(dailyCount >= 7 ? 0.8 : dailyCount >= 3 ? 0.6 : 0.4),
    decisionSatisfactionRate: 0.5,
    intrinsicDriveRatio: clamp01(pureDrives + extMotives > 0 ? pureDrives / (pureDrives + extMotives) : 0.5),

    practiceEffectEstimate: sessionPracticeEffect(profile, session),
  };
}

/** 练习效应估计：前 5 次会话的"表面提升"更多来自熟悉工具 */
export function sessionPracticeEffect(profile: UserCognitiveProfile, session: SessionRecord): number {
  const idx = profile.sessions.findIndex((s) => s.id === session.id);
  if (idx < 0) return 0;
  const order = Math.max(1, idx + 1);
  if (order > 5) return 0;
  return 0.12 * (1 - (order - 1) / 5);
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function mean(xs: number[]): number {
  if (xs.length === 0) return 0.5;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length);
}

/** 线性回归斜率（x = 序号，y = 数值） */
export function trendSlope(xs: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const xMean = (n - 1) / 2;
  const yMean = mean(xs);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (xs[i] - yMean);
    den += (i - xMean) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

// ---------------------------------------------------------------------------
// 全量重算
// ---------------------------------------------------------------------------

/** 重算档案：指标点、成长追踪、认知标记、成长阶段（每次档案更新后调用） */
export function recomputeProfile(profile: UserCognitiveProfile): void {
  // 1. 为每条会话计算/更新指标点
  for (const session of profile.sessions) {
    if (!session.messages.some((m) => m.role === "user" && m.markers)) continue;
    session.metricPoint = computeSessionPoint(profile, session);
  }

  // 2. 重建各维度数据点
  const dimKeys = Object.keys(DIMENSION_LABELS);
  const series: Record<string, number[]> = {};
  for (const k of dimKeys) series[k] = [];

  const orderedSessions = [...profile.sessions].sort(
    (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime()
  );
  for (const s of orderedSessions) {
    if (!s.metricPoint) continue;
    for (const k of dimKeys) {
      series[k].push((s.metricPoint as unknown as Record<string, number>)[k]);
    }
  }

  // 3. 更新成长追踪
  for (const k of dimKeys) {
    const pts = series[k];
    const dim = profile.growthTracking.dimensions[k] || {
      currentLevel: 0.5, trendSlope: 0, adjustedTrendSlope: 0, volatility: 0, dataPoints: [],
    };
    dim.currentLevel = pts.length ? mean(pts.slice(-10)) : 0.5;
    dim.trendSlope = trendSlope(pts);
    dim.volatility = stddev(pts.slice(-10));
    const practice = profile.growthTracking.practiceEffectBaseline[k] || 0;
    dim.adjustedTrendSlope = UP_IS_GOOD[k] ? dim.trendSlope : dim.trendSlope;
    if (profile.settings.practiceEffectCorrection) {
      dim.adjustedTrendSlope = dim.trendSlope - practice;
    }
    dim.dataPoints = pts.map((v, i) => {
      const s = orderedSessions[i];
      return {
        timestamp: s?.endedAt || new Date().toISOString(),
        sessionId: s?.id || "",
        source: "free_chat" as const,
        // 仅保留数值字段用于图表演示
        ...(Object.fromEntries(dimKeys.map((dk) => [dk, series[dk][i]])) as unknown as Record<string, number>),
        practiceEffectEstimate: s?.metricPoint?.practiceEffectEstimate || 0,
      } as unknown as CognitiveMetricPoint;
    });
    profile.growthTracking.dimensions[k] = dim;
  }

  // 4. 认知标记聚合
  profile.cognitiveMarkers = aggregateCognitiveMarkers(profile);

  // 5. 成长阶段判定
  profile.growthTracking.growthStage = determineStage(profile);

  // 6. 练习效应基线（前 5 次会话的斜率作为基线）
  if (profile.settings.practiceEffectCorrection && orderedSessions.length >= 3) {
    const first5 = orderedSessions.slice(0, Math.min(5, orderedSessions.length));
    for (const k of dimKeys) {
      const pts = first5.map((s) => (s.metricPoint as unknown as Record<string, number> | undefined)?.[k]).filter(
        (v): v is number => typeof v === "number"
      );
      profile.growthTracking.practiceEffectBaseline[k] = trendSlope(pts);
    }
  }
}

function aggregateCognitiveMarkers(profile: UserCognitiveProfile): CognitiveMarkers {
  const prev = profile.cognitiveMarkers;
  let internal = 0, external = 0, situational = 0;
  let certaintySum = 0, certaintyN = 0;
  let jumps = 0, reflection = 0, messages = 0;
  const biasFreq: Record<string, number> = {};
  for (const t of BIAS_TYPES) biasFreq[t] = prev.biasFrequency[t] || 0;

  for (const s of profile.sessions) {
    for (const m of s.messages) {
      if (m.role !== "user" || !m.markers) continue;
      messages++;
      if (m.markers.attribution === "internal") internal++;
      else if (m.markers.attribution === "external") external++;
      else if (m.markers.attribution === "situational") situational++;
      certaintySum += m.markers.certainty;
      certaintyN++;
      if (m.markers.abstractionJump) jumps++;
      if (m.markers.selfReflection) reflection++;
      for (const b of m.markers.biases) biasFreq[b.type] = (biasFreq[b.type] || 0) + 1;
    }
  }

  const totalAttr = internal + external + situational;
  return {
    attributionPattern: totalAttr
      ? { internal: internal / totalAttr, external: external / totalAttr, situational: situational / totalAttr }
      : prev.attributionPattern,
    certaintyIndex: certaintyN ? certaintySum / certaintyN : prev.certaintyIndex,
    abstractionJumpsPerSession: messages ? jumps / Math.max(1, profile.sessions.length) : prev.abstractionJumpsPerSession,
    selfReflectionRatio: messages ? reflection / messages : prev.selfReflectionRatio,
    emotionFactRatio: prev.emotionFactRatio,
    biasFrequency: biasFreq,
  };
}

/** 成长阶段判定（文档 7.8） */
export function determineStage(profile: UserCognitiveProfile): GrowthStage {
  const sessions = profile.sessions.length;
  const g = profile.growthTracking;

  if (sessions < 3) return "exploration";

  // 突破期：任一正向维度近期显著提升（>30%）
  for (const [k, dim] of Object.entries(g.dimensions)) {
    const vals = dim.dataPoints.map((p) => (p as unknown as Record<string, number>)[k]);
    if (vals.length < 4) continue;
    const recent = mean(vals.slice(-3));
    const earlier = mean(vals.slice(0, -3));
    const up = UP_IS_GOOD[k] ? -1 : 1; // 频率类下降是好事
    const delta = up * (recent - earlier) / (earlier || 0.01);
    if (delta > 0.3) return "breakthrough";
  }

  // 整合期：多个维度协同提升且波动小
  let improving = 0;
  for (const dim of Object.values(g.dimensions)) {
    const up = UP_IS_GOOD[Object.keys(g.dimensions).find((k) => g.dimensions[k] === dim) || ""] ? -1 : 1;
    if (up * dim.adjustedTrendSlope > 0.005) improving++;
  }
  if (improving >= 4 && sessions >= 6) return "integration";

  if (sessions >= 10) return "consolidation";
  return "exploration";
}
