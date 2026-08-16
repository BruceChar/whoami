import { test } from "node:test";
import assert from "node:assert/strict";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import { createDailyFlow, buildDailyEntry } from "../src/frameworks/dailyFeedback";
import { createVFlow, buildVResult, createDFlow, buildDResult } from "../src/frameworks/vtd";
import { createSwotFlow, buildSwotResult } from "../src/frameworks/swot";
import { createInterestFlow, buildInterestMatrix } from "../src/frameworks/interestMatrix";
import { buildCareerAnalysis, canAnalyzeCareer } from "../src/outputs/careerAnalysis";
import { createEmptyProfile } from "../src/models/types";

test("daily feedback: themes extracted by the LLM", async () => {
  const llm = new ScriptedLLMProvider([{ text: '{"themes":["work"]}' }]);
  const runner = createDailyFlow();
  runner.submit("完成了项目汇报");
  runner.submit("因为讲得清楚，大家认可");
  runner.submit("加班到很晚");
  runner.submit("计划全被打乱");
  const entry = await buildDailyEntry(runner, llm, "2025-01-02");
  assert.equal(entry.satisfied.event, "完成了项目汇报");
  assert.deepEqual(entry.themes, ["work"]);
});

test("V-T-D: value anchors extracted by the LLM", async () => {
  const llm = new ScriptedLLMProvider([{ text: '{"anchors":["自由","真实"],"conflicts":["自由 vs 稳定"]}' }]);
  const runner = createVFlow();
  runner.submit("做自己想做的事很有成就感");
  runner.submit("自由地安排时间");
  runner.submit("不自由毋宁死");
  runner.submit("我欣赏真实坦诚的人");
  runner.submit("和家人在一起");
  const v = await buildVResult(runner, llm);
  assert.deepEqual(v.anchors, ["自由", "真实"]);
  assert.deepEqual(v.conflicts, ["自由 vs 稳定"]);
});

test("V-T-D: intrinsic drives extracted by the LLM", async () => {
  const llm = new ScriptedLLMProvider([{ text: '{"pureDrives":["写"],"externalMotives":["赚钱"]}' }]);
  const runner = createDFlow();
  runner.submit("我想写小说，哪怕没人看");
  runner.submit("写东西不赚钱我也愿意");
  runner.submit("小时候想当画家");
  const d = await buildDResult(runner, llm);
  assert.deepEqual(d.pureDrives, ["写"]);
  assert.deepEqual(d.externalMotivesFiltered, ["赚钱"]);
});

test("SWOT: control-circle split by the LLM", async () => {
  const llm = new ScriptedLLMProvider([{ text: '{"gravity":["行业下行"],"anchor":["公司裁员"]}' }]);
  const runner = createSwotFlow();
  runner.submit("分析问题、写作");
  runner.submit("即兴表达");
  runner.submit("AI 时代的转型机会");
  runner.submit("行业下行；公司裁员");
  const r = await buildSwotResult(runner, llm);
  assert.equal(r.strengths.length, 2);
  assert.deepEqual(r.gravityProblems, ["行业下行"]);
  assert.deepEqual(r.anchorProblems, ["公司裁员"]);
});

test("interest matrix: numeric ratings and quadrants", () => {
  const runner = createInterestFlow();
  runner.submit("5");
  runner.submit("1");
  runner.submit("4");
  runner.submit("2");
  const r = buildInterestMatrix(runner);
  assert.ok(r.highEnergyQuadrants.length >= 2);
});

test("career analysis: unavailable without data, generated once enough data exists", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  assert.equal(canAnalyzeCareer(profile), false);
  profile.frameworkData.dailyFeedback.push(
    { date: "d1", satisfied: { event: "写作", reason: "创造" }, unsatisfied: { event: "开会", reason: "被打断" }, themes: ["创造"] },
    { date: "d2", satisfied: { event: "研究", reason: "深度" }, unsatisfied: { event: "琐事", reason: "烦" }, themes: ["自我"] },
    { date: "d3", satisfied: { event: "教别人", reason: "连接" }, unsatisfied: { event: "加班", reason: "累" }, themes: ["工作"] },
  );
  assert.equal(canAnalyzeCareer(profile), true);
  const report = buildCareerAnalysis(profile);
  assert.ok(report.workForm.length > 0);
  assert.ok(report.contentDirection.length > 0);
});
