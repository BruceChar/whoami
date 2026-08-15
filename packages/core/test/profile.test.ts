import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileStore } from "../src/storage/store";
import {
  createEmptyProfile,
  beginSession,
  appendMessage,
  afterProfileUpdate,
  ThinkingEngine,
} from "../src/index";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "delphi-test-"));
}

test("ProfileStore 创建/保存/读取往返", () => {
  const dir = tmpDir();
  const store = new ProfileStore({ dataDir: dir });
  const profile = store.get();
  profile.userId = "tester";
  store.save();

  const store2 = new ProfileStore({ dataDir: dir });
  assert.equal(store2.get().userId, "tester");
  assert.ok(fs.existsSync(path.join(dir, "profile.json")));
});

test("对话 → 会话记录 → 指标重算 → 档案更新", async () => {
  const store = new ProfileStore({ dataDir: tmpDir() });
  const profile = store.get();

  const session = beginSession(profile, "stealth", "测试会话");
  const engine = new ThinkingEngine("stealth");
  const r1 = await engine.process("我总是很焦虑，所有人都觉得我不行");
  appendMessage(session, { role: "user", text: "我总是很焦虑，所有人都觉得我不行", timestamp: new Date().toISOString(), markers: r1.markers });
  const r2 = await engine.process("但后来我发现其实我也可以");
  appendMessage(session, { role: "user", text: "但后来我发现其实我也可以", timestamp: new Date().toISOString(), markers: r2.markers });

  afterProfileUpdate(profile);
  store.save();

  assert.equal(profile.sessions.length, 1);
  assert.ok(session.metricPoint, "会话应有指标点");
  assert.ok(profile.growthTracking.dimensions.selfReflectionDepth.currentLevel >= 0);
  // 过度概括频率应 > 0
  assert.ok(profile.growthTracking.dimensions.overgeneralizationFreq.currentLevel > 0);
});

test("成长阶段：会话不足时为探索期", () => {
  const store = new ProfileStore({ dataDir: tmpDir() });
  const profile = store.get();
  const session = beginSession(profile, "stealth");
  appendMessage(session, { role: "user", text: "你好", timestamp: new Date().toISOString(), markers: { biases: [], attribution: null, certainty: 0.5, timeOrientation: { past: 0, present: 0, future: 0 }, emotionTone: {}, selfReflection: false, abstractionJump: false, isQuestion: false } });
  afterProfileUpdate(profile);
  assert.equal(profile.growthTracking.growthStage, "exploration");
});

test("个人画像：数据不足时不生成，足够后生成", () => {
  const store = new ProfileStore({ dataDir: tmpDir() });
  const profile = store.get();

  // 3 次会话
  for (let i = 0; i < 3; i++) {
    const s = beginSession(profile, "stealth");
    appendMessage(s, { role: "user", text: `第${i}次对话，我总觉得自己不够好`, timestamp: new Date().toISOString(), markers: { biases: [], attribution: "internal", certainty: 0.7, timeOrientation: { past: 0.5, present: 0.3, future: 0.2 }, emotionTone: { anxiety: 1 }, selfReflection: true, abstractionJump: false, isQuestion: false } });
  }
  // 一个工具
  profile.frameworkData.dailyFeedback.push({
    date: "2025-01-01",
    satisfied: { event: "完成了写作", reason: "有创造感" },
    unsatisfied: { event: "计划被打乱", reason: "很烦躁" },
    themes: ["创造", "自我"],
  });

  const { persona } = afterProfileUpdate(profile);
  assert.ok(persona, "数据足够时应生成画像");
  assert.ok(profile.currentPersona);
  assert.ok(profile.currentPersona!.cognitiveFingerprint.attributionPattern.internal > 0);
});
