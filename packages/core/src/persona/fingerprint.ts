/**
 * delphi —— 认知指纹（文档 8.2）
 * 归因指纹 / 抽象指纹 / 确定指纹 / 时间指纹 / 情绪指纹
 */
import { UserCognitiveProfile } from "../models/types";

export interface CognitiveFingerprint {
  attributionPattern: { internal: number; external: number; situational: number };
  abstractionTendency: number;
  certaintyLevel: number;
  timeOrientation: { past: number; present: number; future: number };
  emotionalTone: Record<string, number>;
}

export const EMOTION_LABELS: Record<string, string> = {
  joy: "喜悦",
  frustration: "挫败",
  anxiety: "焦虑",
  anger: "愤怒",
  sadness: "悲伤",
  reflection: "反思",
  resignation: "无奈",
};

export function computeFingerprint(profile: UserCognitiveProfile): CognitiveFingerprint {
  const markers = profile.cognitiveMarkers;

  // 时间指纹：跨会话汇总
  let past = 0, present = 0, future = 0;
  const emotionTone: Record<string, number> = {};
  for (const s of profile.sessions) {
    for (const m of s.messages) {
      if (m.role !== "user" || !m.markers) continue;
      past += m.markers.timeOrientation.past;
      present += m.markers.timeOrientation.present;
      future += m.markers.timeOrientation.future;
      for (const [cat, n] of Object.entries(m.markers.emotionTone)) {
        emotionTone[cat] = (emotionTone[cat] || 0) + n;
      }
    }
  }
  const tTotal = past + present + future;
  const timeOrientation = tTotal
    ? { past: past / tTotal, present: present / tTotal, future: future / tTotal }
    : { past: 0.33, present: 0.34, future: 0.33 };

  return {
    attributionPattern: markers.attributionPattern,
    abstractionTendency: markers.abstractionJumpsPerSession,
    certaintyLevel: markers.certaintyIndex,
    timeOrientation,
    emotionalTone: emotionTone,
  };
}

/** 把情绪指纹转换为中文描述 */
export function describeEmotionalTone(emotionTone: Record<string, number>): string {
  const entries = Object.entries(emotionTone).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return "情绪表达较少（数据不足）";
  return entries
    .slice(0, 3)
    .map(([cat, n]) => `${EMOTION_LABELS[cat] || cat} ${n}次`)
    .join("、");
}
