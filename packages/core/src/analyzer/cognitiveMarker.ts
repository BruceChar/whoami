/** delphi — cognitive marker extraction (smallest unit of stealth analysis). */
import {
  AttributionType,
  MessageMarkers,
} from "../models/types";
import { detectBiases, BiasHit } from "./biasDetector";
import {
  ATTRIBUTION_PATTERNS,
  CERTAINTY_HIGH,
  CERTAINTY_LOW,
  EMOTION_TONES,
  QUESTION_MARKERS,
  SELF_REFLECTION_SIGNALS,
  ABSTRACT_WORDS,
  CONCRETE_WORDS,
  TIME_PAST,
  TIME_PRESENT,
  TIME_FUTURE,
  findHits,
} from "./lexicons";

export interface AnalyzeOptions {
  sensitivity?: "low" | "medium" | "high";
}

function countHits(text: string, keywords: string[]): number {
  let total = 0;
  for (const kw of keywords) {
    let idx = text.indexOf(kw);
    while (idx !== -1) {
      total += 1;
      idx = text.indexOf(kw, idx + kw.length);
    }
  }
  return total;
}

/** Attribution: count the three types, return the highest; null when none */
function detectAttribution(text: string): AttributionType | null {
  const internal = countHits(text, ATTRIBUTION_PATTERNS.internal);
  const external = countHits(text, ATTRIBUTION_PATTERNS.external);
  const situational = countHits(text, ATTRIBUTION_PATTERNS.situational);
  const max = Math.max(internal, external, situational);
  if (max === 0) return null;
  if (internal === max) return "internal";
  if (external === max) return "external";
  return "situational";
}

/** Certainty: 0-1, share of high-certainty words */
function detectCertainty(text: string): number {
  const high = countHits(text, CERTAINTY_HIGH);
  const low = countHits(text, CERTAINTY_LOW);
  if (high + low === 0) return 0.5;
  return high / (high + low);
}

function detectTimeOrientation(text: string): { past: number; present: number; future: number } {
  const past = countHits(text, TIME_PAST);
  const present = countHits(text, TIME_PRESENT);
  const future = countHits(text, TIME_FUTURE);
  const total = past + present + future;
  if (total === 0) return { past: 0, present: 0, future: 0 };
  return { past: past / total, present: present / total, future: future / total };
}

function detectEmotions(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const [category, words] of Object.entries(EMOTION_TONES)) {
    const n = countHits(text, words);
    if (n > 0) result[category] = n;
  }
  return result;
}

/** Emotion-fact separation: 0=pure emotion 0.5=no emotion 1=both */
export function emotionFactScore(text: string): number {
  const emotions = countHits(text, Object.values(EMOTION_TONES).flat());
  const facts = countHits(text, CONCRETE_WORDS);
  if (emotions === 0) return 0.5;
  return facts > 0 ? 1 : 0;
}

/** Abstraction jump: abstract and concrete words interleaved */
export function detectAbstractionJump(text: string): boolean {
  const absHits = findHits(text, ABSTRACT_WORDS);
  const conHits = findHits(text, CONCRETE_WORDS);
  if (absHits.length === 0 || conHits.length === 0) return false;
  const firstAbs = text.indexOf(absHits[0].keyword);
  const firstCon = text.indexOf(conHits[0].keyword);
  const lastAbs = text.lastIndexOf(absHits[absHits.length - 1].keyword);
  const lastCon = text.lastIndexOf(conHits[conHits.length - 1].keyword);
    // abstract and concrete words interleaved -> treat as a jump
  return (firstAbs < lastCon && firstCon < lastAbs) || absHits.length + conHits.length >= 3;
}

/** Full cognitive-marker analysis of one user message */
export function analyzeMessage(text: string, opts: AnalyzeOptions = {}): MessageMarkers {
  const biases: BiasHit[] = detectBiases(text, opts.sensitivity || "medium");
  return {
    biases: biases.map((b) => ({ type: b.type, keyword: b.keyword, quote: b.quote })),
    attribution: detectAttribution(text),
    certainty: detectCertainty(text),
    timeOrientation: detectTimeOrientation(text),
    emotionTone: detectEmotions(text),
    selfReflection: countHits(text, SELF_REFLECTION_SIGNALS) > 0,
    abstractionJump: detectAbstractionJump(text),
    isQuestion: countHits(text, QUESTION_MARKERS) > 0,
  };
}

/** Aggregate markers from multiple messages into profile cognitiveMarkers */
export function aggregateMarkers(
  markers: MessageMarkers[],
  prev: { attributionPattern: { internal: number; external: number; situational: number }; certaintyIndex: number; abstractionJumpsPerSession: number; selfReflectionRatio: number; emotionFactRatio: number; biasFrequency: Record<string, number> },
) {
  let internal = 0, external = 0, situational = 0;
  let certaintySum = 0, certaintyN = 0;
  let jumps = 0;
  let reflection = 0;
  let emotionFactSum = 0;
  const biasFreq: Record<string, number> = { ...prev.biasFrequency };

  for (const m of markers) {
    if (m.attribution === "internal") internal++;
    else if (m.attribution === "external") external++;
    else if (m.attribution === "situational") situational++;
    certaintySum += m.certainty;
    certaintyN++;
    if (m.abstractionJump) jumps++;
    if (m.selfReflection) reflection++;
    for (const b of m.biases) biasFreq[b.type] = (biasFreq[b.type] || 0) + 1;
    emotionFactSum += 0; // 由上层按消息文本计算
  }

  const n = markers.length || 1;
  const totalAttr = internal + external + situational;
  const merged = {
    attributionPattern: {
      internal: totalAttr ? (internal / totalAttr) : prev.attributionPattern.internal,
      external: totalAttr ? (external / totalAttr) : prev.attributionPattern.external,
      situational: totalAttr ? (situational / totalAttr) : prev.attributionPattern.situational,
    },
    certaintyIndex: certaintyN ? certaintySum / certaintyN : prev.certaintyIndex,
    abstractionJumpsPerSession: prev.abstractionJumpsPerSession + jumps,
    selfReflectionRatio: (prev.selfReflectionRatio * 0.5) + (reflection / n) * 0.5,
    emotionFactRatio: prev.emotionFactRatio,
    biasFrequency: biasFreq,
  };
  return merged;
}
