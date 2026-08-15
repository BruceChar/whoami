/**
 * delphi —— 档案服务层
 * 把 引擎分析 / 工具产出 / 成长追踪 / 画像 串成完整的数据流：
 *   每次对话、每个工具 → 更新档案 → 重算成长 → 检测转折 → 更新画像
 */
import {
  AnalysisMode,
  ChatMessage,
  InflectionPoint,
  PersonaSnapshot,
  SessionRecord,
  UserCognitiveProfile,
} from "../models/types";
import { recomputeProfile } from "../profiler/growthTracker";
import { detectBiasBreakthroughs, addInflection } from "../profiler/inflectionDetector";
import { updatePersona } from "../persona/persona";
import { buildCareerAnalysis, canAnalyzeCareer } from "../outputs/careerAnalysis";
import { buildLifeDesign } from "../outputs/lifeDesign";

let sessionCounter = 0;

export function newSessionId(): string {
  sessionCounter++;
  return `s-${Date.now()}-${sessionCounter}`;
}

export function newInsightId(): string {
  return `ins-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** 开启一条会话记录（加入档案） */
export function beginSession(profile: UserCognitiveProfile, mode: AnalysisMode, title?: string): SessionRecord {
  const session: SessionRecord = {
    id: newSessionId(),
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    mode,
    messages: [],
    title,
  };
  profile.sessions.push(session);
  return session;
}

/** 追加消息到会话 */
export function appendMessage(session: SessionRecord, msg: ChatMessage): void {
  session.messages.push(msg);
  session.endedAt = new Date().toISOString();
}

/**
 * 档案更新后的统一收尾：
 * 1. 重算成长追踪  2. 偏差突破检测  3. 自动更新画像  4. 重算分析输出
 */
export function afterProfileUpdate(profile: UserCognitiveProfile): {
  inflections: InflectionPoint[];
  persona: PersonaSnapshot | null;
} {
  recomputeProfile(profile);
  const inflections: InflectionPoint[] = [];
  if (profile.settings.autoDetectInflections) {
    inflections.push(...detectBiasBreakthroughs(profile));
  }
  const persona = updatePersona(profile);
  if (canAnalyzeCareer(profile)) {
    profile.analysisOutputs.careerAnalysis = buildCareerAnalysis(profile);
  }
  profile.analysisOutputs.lifeDesign = buildLifeDesign(profile);
  return { inflections, persona };
}

/** 工具完成里程碑（转折点） */
export function markMilestone(
  profile: UserCognitiveProfile,
  title: string,
  description: string
): InflectionPoint {
  return addInflection(profile, "milestone", title, description, [], false);
}
