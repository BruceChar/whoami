import { test } from "node:test";
import assert from "node:assert/strict";
import { detectBiases, BIAS_TYPES } from "../src/analyzer/biasDetector";

test("检测 7 种基础偏差", () => {
  const cases: Array<[string, string]> = [
    ["他总是不回我消息，所有人都这样", "overgeneralization"],
    ["我应该更努力，必须按计划来", "should_tyranny"],
    ["这下完蛋了，我彻底失败了", "catastrophizing"],
    ["他肯定觉得我很差劲", "mind_reading"],
    ["我感觉就是他不喜欢我", "emotional_reasoning"],
    ["我就知道会这样，果然不出所料", "confirmation_bias"],
    ["要么完美，要么就别做", "all_or_nothing"],
  ];
  for (const [text, expectType] of cases) {
    const hits = detectBiases(text);
    assert.ok(
      hits.some((h) => h.type === expectType),
      `"${text}" 应检测到 ${expectType}，实际: ${hits.map((h) => h.type).join(",")}`
    );
  }
});

test("低敏感度下需要高频词多次出现才标记", () => {
  const hits = detectBiases("总是", "low");
  assert.equal(hits.length, 0);
  const hits2 = detectBiases("总是总是总是", "low");
  assert.ok(hits2.some((h) => h.type === "overgeneralization"));
});

test("所有偏差类型都被 BIAS_LABELS 覆盖", () => {
  const { BIAS_LABELS } = require("../src/analyzer/biasDetector");
  for (const t of BIAS_TYPES) {
    assert.ok(BIAS_LABELS[t], `缺少 ${t} 的中文标签`);
  }
});
