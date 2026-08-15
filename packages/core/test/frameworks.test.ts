import { test } from "node:test";
import assert from "node:assert/strict";
import { createDailyFlow, buildDailyEntry } from "../src/frameworks/dailyFeedback";
import { createVFlow, buildVResult, createDFlow, buildDResult } from "../src/frameworks/vtd";
import { createSwotFlow, buildSwotResult } from "../src/frameworks/swot";
import { createInterestFlow, buildInterestMatrix } from "../src/frameworks/interestMatrix";
import { extractValues, extractSkills, extractPureDrives } from "../src/frameworks/keywordExtract";
import { buildCareerAnalysis, canAnalyzeCareer } from "../src/outputs/careerAnalysis";
import { createEmptyProfile } from "../src/models/types";

test("每日回馈流程与主题提取", () => {
  const runner = createDailyFlow();
  runner.submit("完成了项目汇报");
  runner.submit("因为讲得清楚，大家认可");
  runner.submit("加班到很晚");
  runner.submit("计划全被打乱");
  const entry = buildDailyEntry(runner, "2025-01-02");
  assert.equal(entry.satisfied.event, "完成了项目汇报");
  assert.ok(entry.themes.length >= 1);
});

test("V-T-D：价值观锚点与冲突提取", () => {
  const runner = createVFlow();
  runner.submit("做自己想做的事很有成就感");
  runner.submit("自由地安排时间");
  runner.submit("不自由毋宁死");
  runner.submit("我欣赏真实坦诚的人");
  runner.submit("和家人在一起");
  const v = buildVResult(runner);
  assert.ok(v.anchors.includes("自由"));
  assert.ok(v.anchors.includes("真实"));
  assert.ok(v.anchors.length >= 2);
});

test("V-T-D：内驱源与外部动机过滤", () => {
  const runner = createDFlow();
  runner.submit("我想写小说，哪怕没人看");
  runner.submit("写东西不赚钱我也愿意");
  runner.submit("小时候想当画家");
  const d = buildDResult(runner);
  assert.ok(d.pureDrives.includes("写"));
  assert.ok(d.externalMotivesFiltered.includes("赚钱"));
});

test("SWOT：控制圈分离识别重力问题", () => {
  const runner = createSwotFlow();
  runner.submit("分析问题、写作");
  runner.submit("即兴表达");
  runner.submit("AI 时代的转型机会");
  runner.submit("行业下行我控制不了，公司裁员的客观大势");
  const r = buildSwotResult(runner);
  assert.equal(r.strengths.length, 2);
  assert.ok(r.gravityProblems.length >= 1, "应识别出重力问题");
});

test("兴趣矩阵：评分与象限", () => {
  const runner = createInterestFlow();
  runner.submit("5");
  runner.submit("1");
  runner.submit("4");
  runner.submit("2");
  const r = buildInterestMatrix(runner);
  assert.ok(r.highEnergyQuadrants.length >= 2);
});

test("技能提取", () => {
  const skills = extractSkills("我负责分析数据、写报告、组织团队会议");
  assert.ok(skills.includes("分析"));
  assert.ok(skills.includes("表达") || skills.includes("协调"));
});

test("从业分析：数据不足时不可用，足够后生成报告", () => {
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
