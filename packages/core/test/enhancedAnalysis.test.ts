import { test } from "node:test";
import assert from "node:assert/strict";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import {
  llmAnalyzeSession,
  applySessionDeepAnalysis,
  llmEnrichPersona,
  llmRefineCareer,
  llmExtractMarkers,
} from "../src/llm/enhancedAnalysis";
import { createEmptyProfile } from "../src/models/types";
import { buildPersona } from "../src/persona/persona";
import { buildCareerAnalysis } from "../src/outputs/careerAnalysis";

test("llmAnalyzeSession: session summary + auto insights written to the profile", async () => {
  const llm = new ScriptedLLMProvider([
    { text: '{"summary":"You used absolutist wording several times and showed self-reflection.","insights":[{"title":"Absolutist wording","analysis":"You used the word always three times","quote":"I am always ignored"}]}' },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  const session = {
    id: "s1",
    startedAt: "2025-01-01T00:00:00Z",
    endedAt: "2025-01-01T00:10:00Z",
    mode: "stealth" as const,
    messages: [
      { role: "user" as const, text: "I am always ignored", timestamp: "2025-01-01T00:00:00Z" },
    ],
  };
  const deep = await llmAnalyzeSession(llm, profile, session as any);
  assert.ok(deep);
  assert.ok(deep.summary.includes("absolutist"));
  const created = applySessionDeepAnalysis(profile, session as any, deep);
  assert.equal(created.length, 1);
  assert.equal(profile.insights.length, 1);
  assert.equal((session as any).summary, deep.summary);
  assert.equal(profile.insights[0].agentDetected, true);
});

test("llmAnalyzeSession: non-JSON response returns null", async () => {
  const llm = new ScriptedLLMProvider([{ text: "I cannot analyze this" }]);
  const profile = createEmptyProfile("u1", "/tmp");
  const session = { id: "s1", messages: [{ role: "user", text: "hi" }] } as any;
  const deep = await llmAnalyzeSession(llm, profile, session);
  assert.equal(deep, null);
});

test("llmEnrichPersona: six-dimension narratives", async () => {
  const llm = new ScriptedLLMProvider([
    {
      text: '{"fingerprint":"You tend to check external feedback before confirming your own judgment.","energyMap":"Deep thinking charges you.","terrain":"Analysis is your highland.","relationship":"You value being understood.","decision":"You prefer deep information.","growth":"You have room to grow in uncertainty tolerance."}',
    },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  profile.sessions.push({
    id: "s1", startedAt: "2025-01-01", endedAt: "2025-01-01", mode: "stealth",
    messages: [{ role: "user", text: "I've been anxious lately", timestamp: "2025-01-01", markers: { biases: [], attribution: null, certainty: 0.5, timeOrientation: { past: 0, present: 0, future: 0 }, emotionTone: {}, selfReflection: false, abstractionJump: false, emotionFact: 0.5 } }],
  } as never);
  const persona = buildPersona(profile);
  const narratives = await llmEnrichPersona(llm, profile, persona);
  assert.ok(narratives);
  assert.ok(narratives!.fingerprint!.includes("You tend to"));
});

test("llmRefineCareer: narrative and extra directions", async () => {
  const llm = new ScriptedLLMProvider([
    {
      text: '{"narrative":"Overall, your need for autonomy and deep thinking points toward an independent research role.","extraDirections":["Knowledge-paywall content creation"],"extraAvoid":["High-pressure sales"]}',
    },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  profile.frameworkData.vtd.values.anchors = ["自由"];
  const career = buildCareerAnalysis(profile);
  const refined = await llmRefineCareer(llm, profile, career);
  assert.ok(refined);
  assert.equal(refined!.extraDirections[0], "Knowledge-paywall content creation");
  assert.equal(refined!.extraAvoid[0], "High-pressure sales");
});

test("llmExtractMarkers: full marker extraction (no rule fallback)", async () => {
  const llm = new ScriptedLLMProvider([
    { text: '{"attribution":"external","certainty":0.8,"timeOrientation":{"past":0.2,"present":0.5,"future":0.3},"emotionTone":{"anxiety":1},"selfReflection":false,"abstractionJump":false,"emotionFact":0.6,"biases":[{"type":"mind_reading","keyword":"they think","quote":"they think"}]}' },
  ]);
  const markers = await llmExtractMarkers(llm, "they definitely think poorly of me");
  assert.ok(markers);
  assert.equal(markers.attribution, "external");
  assert.equal(markers.certainty, 0.8);
  assert.equal(markers.emotionTone["anxiety"], 1);
  assert.equal(markers.emotionFact, 0.6);
  assert.ok(markers.biases.some((b) => b.type === "mind_reading"));
});

test("llmExtractMarkers: non-JSON response returns null", async () => {
  const llm = new ScriptedLLMProvider([{ text: "not json" }]);
  const markers = await llmExtractMarkers(llm, "hello");
  assert.equal(markers, null);
});
