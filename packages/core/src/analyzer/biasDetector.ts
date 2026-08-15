/**
 * delphi —— 思维漏洞检测（7 种基础偏差）
 * 检测逻辑只记录、不评价（镜子原则），具体是否提示由模式层决定。
 */
import { BiasType } from "../models/types";
import { BIAS_PATTERNS, findHits, KeywordHit } from "./lexicons";

export interface BiasHit {
  type: BiasType;
  keyword: string;
  quote: string;
}

export const BIAS_LABELS: Record<BiasType, string> = {
  overgeneralization: "过度概括",
  should_tyranny: "应该暴政",
  catastrophizing: "灾难化想象",
  mind_reading: "读心术",
  emotional_reasoning: "情绪推理",
  confirmation_bias: "确认偏误",
  all_or_nothing: "非黑即白",
};

export const BIAS_TYPES: BiasType[] = [
  "overgeneralization",
  "should_tyranny",
  "catastrophizing",
  "mind_reading",
  "emotional_reasoning",
  "confirmation_bias",
  "all_or_nothing",
];

export interface BiasSensitivityConfig {
  /** 每个偏差在单条消息中的触发阈值（次数），超过才计为一次命中 */
  threshold: number;
}

const SENSITIVITY: Record<"low" | "medium" | "high", BiasSensitivityConfig> = {
  low: { threshold: 3 },
  medium: { threshold: 1 },
  high: { threshold: 1 },
};

/**
 * 检测一条消息中的思维偏差。
 * @param text 用户输入
 * @param sensitivity 敏感度：low 需要同一关键词多次出现才标记
 */
export function detectBiases(text: string, sensitivity: "low" | "medium" | "high" = "medium"): BiasHit[] {
  const { threshold } = SENSITIVITY[sensitivity];
  const hits: BiasHit[] = [];

  for (const type of BIAS_TYPES) {
    const patterns = BIAS_PATTERNS[type];
    const found: KeywordHit[] = findHits(text, patterns);
    if (found.length === 0) continue;

    // 同一关键词在同一消息中重复出现 → 按阈值决定是否标记
    if (found.length < threshold) continue;

    // 去重：同一关键词只保留第一条（避免"总是……总是……"刷屏）
    const seen = new Set<string>();
    const unique: KeywordHit[] = [];
    for (const hit of found) {
      if (seen.has(hit.keyword)) continue;
      seen.add(hit.keyword);
      unique.push(hit);
      if (unique.length >= 3) break; // 单条消息最多展示 3 处
    }
    for (const hit of unique) {
      hits.push({ type, keyword: hit.keyword, quote: hit.quote });
    }
  }
  return hits;
}
