/** delphi — cognitive bias detection (7 basic biases). */
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
    /** Per-bias trigger threshold per message (count); a hit only counts above it */
  threshold: number;
}

const SENSITIVITY: Record<"low" | "medium" | "high", BiasSensitivityConfig> = {
  low: { threshold: 3 },
  medium: { threshold: 1 },
  high: { threshold: 1 },
};

/**
  * Detect cognitive biases in a message.
  * @param text user input
  * @param sensitivity low requires repeated keywords before marking
  * @param text user input
  * @param sensitivity low requires repeated keywords before marking
 */
export function detectBiases(text: string, sensitivity: "low" | "medium" | "high" = "medium"): BiasHit[] {
  const { threshold } = SENSITIVITY[sensitivity];
  const hits: BiasHit[] = [];

  for (const type of BIAS_TYPES) {
    const patterns = BIAS_PATTERNS[type];
    const found: KeywordHit[] = findHits(text, patterns);
    if (found.length === 0) continue;

        // same keyword repeated in one message -> decide by threshold
    if (found.length < threshold) continue;

        // de-dup: keep the first occurrence per keyword
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
