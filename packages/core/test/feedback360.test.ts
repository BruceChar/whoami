import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createShareLink,
  submitFeedback,
  feedbackSummary,
  llmAnalyzeFeedback,
  applyFeedbackAnalysis,
  linkStatus,
} from "../src/frameworks/feedback360";
import { createCapabilityFlow, buildCapabilityResult, getCapabilities } from "../src/frameworks/capability";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import { createEmptyProfile } from "../src/models/types";

test("share link: create + submit + limit/expiry", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  const link = createShareLink(profile, { maxEntries: 1 });
  assert.equal(profile.frameworkData.feedback.shareLinks.length, 1);

  const r1 = submitFeedback(profile, link.id, {
    author: "张三", relationship: "同事", knownFor: "3年",
    impression: "很有主见，但有时过于坚持", evidence: "项目讨论",
  });
  assert.equal(r1.ok, true);
  assert.equal(profile.frameworkData.feedback.records.length, 1);

  // limit reached -> closed
  assert.equal(linkStatus(profile, link), "closed");
  const r2 = submitFeedback(profile, link.id, {
    author: "李四", relationship: "朋友", knownFor: "5年", impression: "很靠谱",
  });
  assert.equal(r2.ok, false);
});

test("share link: invalid id returns not ok", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  const r = submitFeedback(profile, "no-such-link", { author: "x", relationship: "朋友", knownFor: "1", impression: "好" });
  assert.equal(r.ok, false);
  assert.ok(r.reason);
});

test("feedbackSummary: count and byRelationship", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  const link = createShareLink(profile);
  submitFeedback(profile, link.id, { author: "a", relationship: "同事", knownFor: "1", impression: "可靠" });
  submitFeedback(profile, link.id, { author: "b", relationship: "家人", knownFor: "20", impression: "温暖" });
  const summary = feedbackSummary(profile);
  assert.equal(summary.count, 2);
  assert.equal(summary.byRelationship["同事"], 1);
  assert.equal(summary.byRelationship["家人"], 1);
});

test("llmAnalyzeFeedback: consensus + gaps via LLM", async () => {
  const llm = new ScriptedLLMProvider([
    { text: '{"consensusReport":"大家普遍认为你靠谱且有主见。","gaps":[{"trait":"坚持","selfPerception":"灵活","externalPerception":"坚持"}],"consistency":"high"}' },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  const link = createShareLink(profile);
  submitFeedback(profile, link.id, { author: "a", relationship: "同事", knownFor: "1", impression: "靠谱有主见" });
  const analysis = await llmAnalyzeFeedback(llm, profile);
  assert.ok(analysis);
  assert.ok(analysis!.consensusReport!.includes("靠谱"));
  assert.equal(analysis!.consistency, "high");
  applyFeedbackAnalysis(profile, analysis!);
  assert.ok(profile.frameworkData.feedback.consensusReport);
  assert.equal(profile.frameworkData.feedback.selfExternalGaps.length, 1);
  assert.equal(profile.insights.length, 1);
});

test("llmAnalyzeFeedback: no records returns null", async () => {
  const llm = new ScriptedLLMProvider([]);
  const profile = createEmptyProfile("u1", "/tmp");
  assert.equal(await llmAnalyzeFeedback(llm, profile), null);
});

test("capability: catalog + flow + cross-validation", () => {
  assert.ok(getCapabilities("产品经理").length >= 4);

  const profile = createEmptyProfile("u1", "/tmp");
  // archive evidence: "沟通协调" appears in achievement skills
  profile.frameworkData.achievements.push({
    eventId: "a1",
    star: { situation: "跨部门项目", task: "", action: "负责沟通协调", result: "顺利交付" },
    skills: ["沟通协调", "分析"],
    energyLevel: "high",
  });

  const runner = createCapabilityFlow("产品经理");
  // skip field step then rate: 沟通协调 low (2) but evidenced -> hiddenStrength
  runner.submit("产品经理");
  runner.submit("2"); // 需求分析
  runner.submit("2"); // 沟通协调 (rated low, but in archive)
  runner.submit("3");
  runner.submit("4");
  runner.submit("4");
  runner.submit("3");

  const result = buildCapabilityResult(profile, runner);
  assert.equal(result.field, "产品经理");
  assert.equal(result.ratings.length, 6);
  assert.ok(result.hiddenStrengths.includes("沟通协调"), "low rating but archived skill -> hidden strength");
});
