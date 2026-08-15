import { test } from "node:test";
import assert from "node:assert/strict";
import { ThinkingEngine } from "../src/engine/thinkingEngine";
import { resolveModeSwitch, detectCrisis } from "../src/engine/modeSwitcher";

test("模式切换规则（文档 3.4）", () => {
  assert.equal(resolveModeSwitch("/stealth", "transparent")?.mode, "stealth");
  assert.equal(resolveModeSwitch("/analyze", "stealth")?.mode, "transparent");
  assert.equal(resolveModeSwitch("/deep", "transparent")?.mode, "meta_guide");
  assert.equal(resolveModeSwitch("帮我分析一下", "stealth")?.mode, "transparent");
  assert.equal(resolveModeSwitch("你好", "stealth"), null);
});

test("情绪崩溃信号 → 隐式+陪伴", () => {
  assert.ok(detectCrisis("我真的快崩溃了"));
  const sw = resolveModeSwitch("我撑不下去了", "meta_guide");
  assert.equal(sw?.mode, "stealth");
  assert.equal(sw?.companion, true);
});

test("隐式模式：前 3 轮不分析，只陪伴", () => {
  const engine = new ThinkingEngine("stealth");
  const r1 = engine.process("今天工作好累");
  assert.equal(r1.modeAfter, "stealth");
  assert.ok(r1.reply.length > 0);
});

test("显式模式：输出 metacog 思维快照", () => {
  const engine = new ThinkingEngine("transparent");
  const r1 = engine.process("他总是这样，所有人都不理解我");
  assert.ok(r1.reply.includes("metacog"), `应包含思维快照，实际: ${r1.reply}`);
  assert.ok(r1.markers.biases.length > 0);
});

test("引导式模式：输出引导策略", () => {
  const engine = new ThinkingEngine("meta_guide");
  const r = engine.process("我应该更努力，必须做到完美");
  assert.ok(r.reply.includes("【引导"));
});

test("模式切换命令生效", () => {
  const engine = new ThinkingEngine("stealth");
  const r = engine.process("/guide");
  assert.equal(r.isCommand, true);
  assert.equal(r.modeAfter, "meta_guide");
});
