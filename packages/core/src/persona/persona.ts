/** delphi — six-dimension persona assembly (data-driven; narratives come from the LLM). */
import {
  PersonaSnapshot,
  UserCognitiveProfile,
} from "../models/types";
import { computeFingerprint } from "./fingerprint";
import { computeEnergyMap } from "./energyMap";
import { DIMENSION_LABELS, UP_IS_GOOD } from "../profiler/growthTracker";
import { aggregateSkills } from "../frameworks/achievement";

export const PERSONA_STAGE_LABELS: Record<string, string> = {
  exploration: "探索期 (Exploration)",
  consolidation: "巩固期 (Consolidation)",
  breakthrough: "突破期 (Breakthrough)",
  integration: "整合期 (Integration)",
};

export function canGeneratePersona(profile: UserCognitiveProfile): boolean {
  const fw = profile.frameworkData;
  const toolDone =
    fw.vtd.values.anchors.length > 0 ||
    fw.swot.strengths.length > 0 ||
    fw.achievements.length > 0 ||
    fw.dailyFeedback.length > 0 ||
    Object.values(fw.sign.signals).some((s) => s) ||
    fw.interestMatrix.highEnergyQuadrants.length > 0;
  return profile.sessions.length >= 3 && toolDone;
}

export function buildPersona(profile: UserCognitiveProfile, version?: string): PersonaSnapshot {
  const fingerprint = computeFingerprint(profile);
  const energyMap = computeEnergyMap(profile);

  const fw = profile.frameworkData;
  const talentAreas = fw.sign.areas;
  const skills = aggregateSkills(fw.achievements);
  const highlands = [...new Set([...talentAreas, ...skills])].slice(0, 4);
  const lowlands = fw.swot.weaknesses.slice(0, 3);

  const canyons = fw.vtd.values.conflicts.map((c) => ({
    tension: c,
    description: "价值观张力：两条同样重要的原则在具体情境中打架",
  }));
  if (fw.interestMatrix.conflicts.length > 0) {
    for (const c of fw.interestMatrix.conflicts.slice(0, 2)) {
      canyons.push({ tension: c.split("——")[0], description: c });
    }
  }

  // relational pattern (data-driven; nuanced narrative comes from the LLM)
  const coreNeeds = fw.vtd.values.anchors.slice(0, 3);
  if (coreNeeds.length === 0) coreNeeds.push("被理解（数据积累中）");

  // decision style (marker- and data-driven; no content rules)
  const certainty = fingerprint.certaintyLevel;
  const speed = certainty > 0.65 ? "fast" : certainty < 0.35 ? "slow" : "moderate";
  const riskRaw = fw.swot.gravityProblems.length + fw.swot.anchorProblems.length;
  const riskTendency = riskRaw > 3 ? "conservative" : riskRaw === 0 ? "adventurous" : "moderate";
  const anchors = fw.vtd.values.anchors;
  const decisionAnchors = anchors.length >= 3 ? anchors.slice(0, 3) : ["价值观（数据积累中）", "逻辑", "情感"];

  // growth trajectory
  const g = profile.growthTracking;
  const dims = Object.entries(g.dimensions)
    .map(([k, d]) => ({ k, ...d }))
    .sort((a, b) => Math.abs(b.adjustedTrendSlope) - Math.abs(a.adjustedTrendSlope));
  const fastest = dims[0] && Math.abs(dims[0].adjustedTrendSlope) > 0 ? dims[0].k : "";
  const bottleneck = [...dims]
    .filter((d) => !UP_IS_GOOD[d.k])
    .sort((a, b) => a.currentLevel - b.currentLevel)[0];
  const bottleneckLabel = bottleneck ? DIMENSION_LABELS[bottleneck.k] : "不确定性耐受（数据积累中）";
  const bottleneckSuggestion =
    bottleneck && !UP_IS_GOOD[bottleneck.k]
      ? "尝试「原型设计」模块，用低成本试验暴露于不确定性"
      : "继续积累数据，画像会随数据演化";

  const basedOnSessions = profile.sessions.length;
  const v = version || `v${(profile.personaHistory.length + 1)}.0`;

  return {
    version: v,
    generatedAt: new Date().toISOString(),
    basedOnSessions,
    cognitiveFingerprint: fingerprint,
    energyMap,
    thinkingTerrain: {
      highlands,
      lowlands,
      canyons: canyons.slice(0, 3),
      recurringThemes: profile.frameworkData.dailyFeedback
        .flatMap((d) => d.themes)
        .filter((t, i, arr) => arr.indexOf(t) === i)
        .slice(0, 4),
    },
    relationalPattern: {
      selfBoundary: "moderate",
      coreNeeds,
      conflictReaction: fw.dailyFeedback.length >= 3 ? "先内化（自我怀疑），后外化（解释/辩解）" : "数据积累中",
      givingValue: skills.slice(0, 3),
    },
    decisionStyle: {
      speed,
      infoPreference: "depth",
      riskTendency,
      regretPattern: "mixed",
      decisionAnchors,
    },
    growthTrajectory: {
      currentStage: g.growthStage,
      growthSpeed: 0.08,
      fastestDimension: fastest ? DIMENSION_LABELS[fastest] : "数据积累中",
      currentBottleneck: bottleneckLabel,
      breakthroughSuggestion: bottleneckSuggestion,
    },
  };
}

/** Generate/update the persona (with version history) */
export function updatePersona(profile: UserCognitiveProfile): PersonaSnapshot | null {
  if (!canGeneratePersona(profile)) return null;
  const prev = profile.currentPersona;
  const next = buildPersona(profile, prev ? bumpVersion(prev.version) : undefined);
  profile.currentPersona = next;
  profile.personaHistory.push(next);
  return next;
}

function bumpVersion(v: string): string {
  const m = /v(\d+)\.(\d+)/.exec(v);
  if (!m) return "v1.1";
  return `v${m[1]}.${parseInt(m[2], 10) + 1}`;
}

export function comparePersonas(a: PersonaSnapshot, b: PersonaSnapshot): Array<{ dimension: string; change: string }> {
  const changes: Array<{ dimension: string; change: string }> = [];
  const fmt = (n: number) => n.toFixed(2);
  const attrDims: Array<[string, keyof PersonaSnapshot["cognitiveFingerprint"]["attributionPattern"]]> = [
    ["内归因", "internal"],
    ["外归因", "external"],
    ["情境归因", "situational"],
  ];
  for (const [label, key] of attrDims) {
    const x = a.cognitiveFingerprint.attributionPattern[key];
    const y = b.cognitiveFingerprint.attributionPattern[key];
    if (Math.abs(y - x) > 0.03) changes.push({ dimension: `归因·${label}`, change: `${fmt(x)} → ${fmt(y)}` });
  }
  if (Math.abs(b.cognitiveFingerprint.certaintyLevel - a.cognitiveFingerprint.certaintyLevel) > 0.05) {
    changes.push({
      dimension: "确定性指数",
      change: `${fmt(a.cognitiveFingerprint.certaintyLevel)} → ${fmt(b.cognitiveFingerprint.certaintyLevel)}`,
    });
  }
  for (const key of ["sources", "blackHoles"] as const) {
    const x = a.energyMap[key].join(",");
    const y = b.energyMap[key].join(",");
    if (x !== y) changes.push({ dimension: key === "sources" ? "能量源" : "能量黑洞", change: `${x || "—"} → ${y || "—"}` });
  }
  return changes;
}
