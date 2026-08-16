/**
 * delphi — external feedback (360°) service.
 * Share links + structured feedback records + LLM analysis of the
 * self-perception vs external-perception gap.
 */
import {
  FeedbackRecord,
  ShareLink,
  UserCognitiveProfile,
} from "../models/types";
import { LLMAgent } from "../llm/agent";
import { newInsightId } from "../services/profileService";

export const RELATIONSHIPS = ["同事", "朋友", "家人", "前领导", "同学", "其他"] as const;

export interface ShareLinkOptions {
  expiresAt?: string;
  maxEntries?: number;
}

export function newShareLinkId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function newFeedbackId(): string {
  return `fb-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

/** Create a share link for collecting external feedback. */
export function createShareLink(profile: UserCognitiveProfile, opts: ShareLinkOptions = {}): ShareLink {
  const link: ShareLink = {
    id: newShareLinkId(),
    createdAt: new Date().toISOString(),
    expiresAt: opts.expiresAt,
    maxEntries: opts.maxEntries,
    status: "active",
  };
  profile.frameworkData.feedback.shareLinks.push(link);
  return link;
}

/** Resolve the live status of a link (expired by time, or reached its limit). */
export function linkStatus(profile: UserCognitiveProfile, link: ShareLink): ShareLink["status"] {
  if (link.status !== "active") return link.status;
  if (link.expiresAt && new Date(link.expiresAt).getTime() < Date.now()) return "expired";
  if (link.maxEntries) {
    const count = profile.frameworkData.feedback.records.filter((r) => r.linkId === link.id).length;
    if (count >= link.maxEntries) return "closed";
  }
  return "active";
}

/** Resolve a link by id (public form lookup). */
export function findShareLink(profile: UserCognitiveProfile, linkId: string): ShareLink | null {
  const link = profile.frameworkData.feedback.shareLinks.find((l) => l.id === linkId);
  return link || null;
}

export interface SubmitFeedbackInput {
  author: string;
  relationship: string;
  knownFor: string;
  impression: string;
  evidence?: string;
}

export interface SubmitFeedbackResult {
  ok: boolean;
  reason?: string;
  record?: FeedbackRecord;
}

/** Submit one feedback record against a share link. */
export function submitFeedback(
  profile: UserCognitiveProfile,
  linkId: string,
  input: SubmitFeedbackInput
): SubmitFeedbackResult {
  const link = findShareLink(profile, linkId);
  if (!link) return { ok: false, reason: "分享链接不存在或已失效" };
  const status = linkStatus(profile, link);
  if (status !== "active") {
    return { ok: false, reason: status === "expired" ? "分享链接已过期" : "分享链接已关闭" };
  }
  if (!input.impression.trim()) {
    return { ok: false, reason: "评价内容不能为空" };
  }
  const record: FeedbackRecord = {
    id: newFeedbackId(),
    linkId,
    author: input.author.trim(),
    relationship: input.relationship.trim() || "其他",
    knownFor: input.knownFor.trim(),
    impression: input.impression.trim(),
    evidence: (input.evidence || "").trim(),
    createdAt: new Date().toISOString(),
  };
  profile.frameworkData.feedback.records.push(record);
  profile.frameworkData.feedback.externalPerception.push(record.impression);
  return { ok: true, record };
}

/** Rule-based feedback summary (fallback when no LLM is configured). */
export function feedbackSummary(profile: UserCognitiveProfile): {
  count: number;
  byRelationship: Record<string, number>;
  impressions: string[];
} {
  const records = profile.frameworkData.feedback.records;
  const byRelationship: Record<string, number> = {};
  for (const r of records) {
    byRelationship[r.relationship] = (byRelationship[r.relationship] || 0) + 1;
  }
  return {
    count: records.length,
    byRelationship,
    impressions: records.map((r) => r.impression),
  };
}

const FEEDBACK_SCHEMA = `{
  consensusReport: string,  // 2-4 sentences of external-perception consensus (no labels)
  gaps: [{
    trait: string,          // trait keyword
    selfPerception: string, // how the user sees themselves
    externalPerception: string // how others see them
  }],
  consistency: "high" | "medium" | "low"  // consistency across respondents
}`;

export interface FeedbackAnalysis {
  consensusReport?: string;
  gaps: Array<{ trait: string; selfPerception: string; externalPerception: string }>;
  consistency: "high" | "medium" | "low";
}

/** LLM analysis of collected feedback: consensus + self/external gap. */
export async function llmAnalyzeFeedback(
  provider: LLMAgent,
  profile: UserCognitiveProfile
): Promise<FeedbackAnalysis | null> {
  const records = profile.frameworkData.feedback.records;
  if (records.length === 0) return null;

  const feedbackText = records
    .map((r) => `[${r.relationship}·${r.author}] ${r.impression}${r.evidence ? `（依据：${r.evidence}）` : ""}`)
    .join("\n");

  const selfText = profile.frameworkData.vtd.values.anchors.join("、") || "（尚未完成价值观探索）";

  const result = await provider.completeJSON<FeedbackAnalysis>({
    messages: [
      {
        role: "user",
        content:
          "You are delphi's external-perception analyst. Given the user's 360° feedback from friends/family and their self-perception, analyze the consensus and the self-vs-external gaps. Use the second person, describe without labeling, and write in the user's language. Output JSON:\n\n" +
          `Feedback:\n${feedbackText.slice(0, 4000)}\n\nUser self-perception (value anchors): ${selfText}`,
      },
    ],
    schema: FEEDBACK_SCHEMA,
    temperature: 0.4,
  });
  if (!result || typeof result.consensusReport !== "string") return null;
  return {
    consensusReport: result.consensusReport,
    gaps: Array.isArray(result.gaps) ? result.gaps.slice(0, 5) : [],
    consistency: result.consistency || "medium",
  };
}

/** Persist LLM feedback analysis into the profile and create an insight. */
export function applyFeedbackAnalysis(
  profile: UserCognitiveProfile,
  analysis: FeedbackAnalysis
): void {
  profile.frameworkData.feedback.consensusReport = analysis.consensusReport;
  for (const gap of analysis.gaps) {
    const text = `${gap.trait}: 自认「${gap.selfPerception}」vs 他人「${gap.externalPerception}」`;
    if (!profile.frameworkData.feedback.selfExternalGaps.includes(text)) {
      profile.frameworkData.feedback.selfExternalGaps.push(text);
    }
  }
  if (analysis.consensusReport) {
    profile.insights.push({
      id: newInsightId(),
      timestamp: new Date().toISOString(),
      source: "external_feedback",
      quote: "",
      analysis: analysis.consensusReport,
      note: "",
      tags: ["feedback"],
      userMarked: false,
      agentDetected: true,
    });
  }
}
