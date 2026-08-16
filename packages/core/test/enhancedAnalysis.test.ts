import { test } from "node:test";
import assert from "node:assert/strict";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import {
  llmAnalyzeSession,
  applySessionDeepAnalysis,
  llmEnrichPersona,
  llmRefineCareer,
  llmExtractMarkers,
  mergeMarkers,
} from "../src/llm/enhancedAnalysis";
import { createEmptyProfile } from "../src/models/types";
import { buildPersona } from "../src/persona/persona";
import { buildCareerAnalysis } from "../src/outputs/careerAnalysis";

test("llmAnalyzeSession：会话摘要 + 自动洞察写入档案", async () => {
  const llm = new ScriptedLLMProvider([
    { text: '{"summary":"这次对话中你多次使用绝对化表达，并出现了自我反思。","insights":[{"title":"绝对化表达","analysis":"你三次使用「总是」","quote":"我总是被忽略"}]}' },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  const session = {
    id: "s1",
    startedAt: "2025-01-01T00:00:00Z",
    endedAt: "2025-01-01T00:10:00Z",
    mode: "stealth" as const,
    messages: [
      { role: "user" as const, text: "我总是被忽略", timestamp: "2025-01-01T00:00:00Z" },
    ],
  };
  const deep = await llmAnalyzeSession(llm, profile, session as any);
  assert.ok(deep);
  assert.ok(deep.summary.includes("绝对化"));
  const created = applySessionDeepAnalysis(profile, session as any, deep);
  assert.equal(created.length, 1);
  assert.equal(profile.insights.length, 1);
  assert.equal((session as any).summary, deep.summary);
  assert.equal(profile.insights[0].agentDetected, true);
});

test("llmAnalyzeSession：非 JSON 响应返回 null", async () => {
  const llm = new ScriptedLLMProvider([{ text: "我无法分析" }]);
  const profile = createEmptyProfile("u1", "/tmp");
  const session = { id: "s1", messages: [{ role: "user", text: "你好" }] } as any;
  const deep = await llmAnalyzeSession(llm, profile, session);
  assert.equal(deep, null);
});

test("llmEnrichPersona：六维叙事", async () => {
  const llm = new ScriptedLLMProvider([
    {
      text: '{"fingerprint":"你倾向于先关注外部反馈再确认自我判断。","energyMap":"深度思考给你充电。","terrain":"分析是你的高地。","relationship":"你在关系中看重被理解。","decision":"你偏好深度信息。","growth":"你在不确定性耐受上有成长空间。"}',
    },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  profile.sessions.push({
    id: "s1", startedAt: "2025-01-01", endedAt: "2025-01-01", mode: "stealth",
    messages: [{ role: "user", text: "我最近总是很焦虑", timestamp: "2025-01-01", markers: { biases: [], attribution: null, certainty: 0.5, timeOrientation: { past: 0, present: 0, future: 0 }, emotionTone: {}, selfReflection: false, abstractionJump: false, isQuestion: false } }],
  } as never);
  const persona = buildPersona(profile);
  const narratives = await llmEnrichPersona(llm, profile, persona);
  assert.ok(narratives);
  assert.ok(narratives!.fingerprint!.includes("你倾向于"));
});

test("llmRefineCareer：评述与补充方向", async () => {
  const llm = new ScriptedLLMProvider([
    {
      text: '{"narrative":"综合来看，你的自主需求与深度思考倾向指向独立研究型角色。","extraDirections":["知识付费内容创作"],"extraAvoid":["高压销售岗位"]}',
    },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  profile.frameworkData.vtd.values.anchors = ["自由"];
  const career = buildCareerAnalysis(profile);
  const refined = await llmRefineCareer(llm, profile, career);
  assert.ok(refined);
  assert.equal(refined!.extraDirections[0], "知识付费内容创作");
  assert.equal(refined!.extraAvoid[0], "高压销售岗位");
});

test("llmExtractMarkers + mergeMarkers：LLM 增强规则标记", async () => {
  const llm = new ScriptedLLMProvider([
    { text: '{"attribution":"external","certainty":0.8,"selfReflection":false,"abstractionJump":false,"emotionTone":{"焦虑":1},"extraBiases":[{"type":"mind_reading","keyword":"他们肯定","quote":"他们肯定觉得"}]}' },
  ]);
  const ruleMarkers = {
    biases: [{ type: "overgeneralization" as const, keyword: "总是", quote: "总是" }],
    attribution: null,
    certainty: 0.5,
    timeOrientation: { past: 0, present: 0, future: 0 },
    emotionTone: {},
    selfReflection: false,
    abstractionJump: false,
    isQuestion: false,
  };
  const llmMarkers = await llmExtractMarkers(llm, "他们肯定觉得我不好");
  assert.ok(llmMarkers);
  const merged = mergeMarkers(ruleMarkers, llmMarkers!);
  assert.equal(merged.attribution, "external");
  assert.equal(merged.certainty, 0.8);
  assert.equal(merged.emotionTone["焦虑"], 1);
    // biases are unioned
  assert.equal(merged.biases.length, 2);
  assert.ok(merged.biases.some((b) => b.type === "mind_reading"));
});
