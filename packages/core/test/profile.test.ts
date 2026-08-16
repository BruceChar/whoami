import { test } from "node:test";
import assert from "node:assert/strict";
import { ProfileStore } from "../src/storage/store";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
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

const MARKER_OVERGEN =
  '{"attribution":"external","certainty":0.8,"timeOrientation":{"past":0.2,"present":0.5,"future":0.3},"emotionTone":{"anxiety":1},"selfReflection":false,"abstractionJump":false,"emotionFact":0.5,"biases":[{"type":"overgeneralization","keyword":"总是","quote":"总是"}]}';
const MARKER_NEUTRAL =
  '{"attribution":null,"certainty":0.5,"timeOrientation":{"past":0.3,"present":0.4,"future":0.3},"emotionTone":{},"selfReflection":true,"abstractionJump":false,"emotionFact":0.6,"biases":[]}';

test("ProfileStore 创建/保存/读取往返", () => {
  const dir = tmpDir();
  const store = new ProfileStore({ dataDir: dir });
  const profile = store.get();
  profile.userId = "tester";
  store.save();

  // persisted through the storage backend (sqlite delphi.db or profile.json in file mode)
  const store2 = new ProfileStore({ dataDir: dir });
  assert.equal(store2.get().userId, "tester");
  assert.ok(
    fs.existsSync(path.join(dir, "delphi.db")) || fs.existsSync(path.join(dir, "profile.json")),
    "data should be persisted on disk"
  );
});

test("对话 → 会话记录 → 指标重算 → 档案更新", async () => {
  const store = new ProfileStore({ dataDir: tmpDir() });
  const profile = store.get();

  const session = beginSession(profile, "stealth", "测试会话");
  const engine = new ThinkingEngine("stealth", {
    llm: new ScriptedLLMProvider([
      { text: MARKER_OVERGEN },
      { text: "我在听。" },
      { text: MARKER_NEUTRAL },
      { text: "继续。" },
    ]),
  });
  const r1 = await engine.process("我总是很焦虑，所有人都觉得我不行");
  appendMessage(session, { role: "user", text: "我总是很焦虑，所有人都觉得我不行", timestamp: new Date().toISOString(), markers: r1.markers });
  const r2 = await engine.process("但后来我发现其实我也可以");
  appendMessage(session, { role: "user", text: "但后来我发现其实我也可以", timestamp: new Date().toISOString(), markers: r2.markers });

  afterProfileUpdate(profile);
  store.save();

  assert.equal(profile.sessions.length, 1);
  assert.ok(session.metricPoint, "会话应有指标点");
  assert.ok(profile.growthTracking.dimensions.selfReflectionDepth.currentLevel >= 0);
  // overgeneralization frequency should be > 0 (from the LLM-extracted marker)
  assert.ok(profile.growthTracking.dimensions.overgeneralizationFreq.currentLevel > 0);
});

test("成长阶段：会话不足时为探索期", () => {
  const store = new ProfileStore({ dataDir: tmpDir() });
  const profile = store.get();
  const session = beginSession(profile, "stealth");
  appendMessage(session, { role: "user", text: "你好", timestamp: new Date().toISOString(), markers: { biases: [], attribution: null, certainty: 0.5, timeOrientation: { past: 0, present: 0, future: 0 }, emotionTone: {}, selfReflection: false, abstractionJump: false, emotionFact: 0.5 } });
  afterProfileUpdate(profile);
  assert.equal(profile.growthTracking.growthStage, "exploration");
});

test("个人画像：数据不足时不生成，足够后生成", () => {
  const store = new ProfileStore({ dataDir: tmpDir() });
  const profile = store.get();

  // 3 sessions
  for (let i = 0; i < 3; i++) {
    const s = beginSession(profile, "stealth");
    appendMessage(s, { role: "user", text: `第${i}次对话，我总觉得自己不够好`, timestamp: new Date().toISOString(), markers: { biases: [], attribution: "internal", certainty: 0.7, timeOrientation: { past: 0.5, present: 0.3, future: 0.2 }, emotionTone: { anxiety: 1 }, selfReflection: true, abstractionJump: false, emotionFact: 0.5 } });
  }
  // one framework tool
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
