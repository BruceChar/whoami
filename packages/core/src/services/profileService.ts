/** delphi — profile service layer. */
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

/** Start a session record (added to the profile) */
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

/** Append a message to a session */
export function appendMessage(session: SessionRecord, msg: ChatMessage): void {
  session.messages.push(msg);
  session.endedAt = new Date().toISOString();
}

/**
  * Unified finalization after a profile update:
  * 1. recompute growth  2. bias-breakthrough detection  3. auto-update persona
  * 4. recompute analysis outputs
  * 1. recompute growth  2. bias-breakthrough detection  3. auto-update persona
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

/** Framework-completion milestone (inflection point) */
export function markMilestone(
  profile: UserCognitiveProfile,
  title: string,
  description: string
): InflectionPoint {
  return addInflection(profile, "milestone", title, description, [], false);
}
