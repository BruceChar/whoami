import { test } from "node:test";
import assert from "node:assert/strict";
import { ThinkingEngine } from "../src/engine/thinkingEngine";
import { resolveModeSwitch, detectCrisis } from "../src/engine/modeSwitcher";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import { createEmptyProfile } from "../src/models/types";
import { buildProfileSummaryJSON, searchMemoryJSON } from "../src/llm/agent";

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

test("隐式模式：LLM 生成回复，标记由规则引擎产出", async () => {
  const llm = new ScriptedLLMProvider([{ text: "嗯，我在听。" }]);
  const engine = new ThinkingEngine("stealth", { llm });
  const r1 = await engine.process("今天工作好累");
  assert.equal(r1.modeAfter, "stealth");
  assert.ok(r1.reply.length > 0);
  assert.equal(r1.llmGenerated, true);
  assert.ok(r1.markers);
});

test("显式模式：LLM 输出 metacog 思维快照，标记仍由规则引擎产出", async () => {
  const engine = new ThinkingEngine("transparent", {
    llm: new ScriptedLLMProvider([
      { text: "嗯，我听到了。\n\nmetacog:\n  我注意到你用了「总是」——这是你本次对话里第 1 次用到这个词。" },
    ]),
  });
  const r1 = await engine.process("他总是这样，所有人都不理解我");
  assert.ok(r1.reply.includes("metacog"), `应包含思维快照，实际: ${r1.reply}`);
  assert.ok(r1.markers.biases.length > 0);
});

test("引导式模式：输出引导策略", async () => {
  const engine = new ThinkingEngine("meta_guide", { llm: new ScriptedLLMProvider([{ text: "【引导】你刚才说的应该，是谁定的标准？" }]) });
  const r = await engine.process("我应该更努力，必须做到完美");
  assert.ok(r.reply.includes("【引导"));
});

test("模式切换命令生效", async () => {
  const engine = new ThinkingEngine("stealth", { llm: new ScriptedLLMProvider([{ text: "我在听。" }]) });
  const r = await engine.process("/guide");
  assert.equal(r.isCommand, true);
  assert.equal(r.modeAfter, "meta_guide");
});

// ---------------------------------------------------------------------------
// LLM agent path
// ---------------------------------------------------------------------------

test("LLM Agent：回复由 LLM 生成，标记仍由规则引擎产出", async () => {
  const llm = new ScriptedLLMProvider([{ text: "我注意到你用了「总是」这个词。" }]);
  const profile = createEmptyProfile("u1", "/tmp");
  const engine = new ThinkingEngine("transparent", { llm });
  engine.llmProfile = profile;
  const r = await engine.process("他总是这样，所有人都不理解我");
  assert.equal(r.llmGenerated, true);
  assert.equal(r.llmModel, "scripted-1");
  assert.ok(r.reply.includes("总是"));
    // rule markers still produced
  assert.ok(r.markers.biases.some((b) => b.type === "overgeneralization"));
  assert.ok(r.usage !== undefined);
});

test("LLM Agent：工具调用（get_cognitive_profile）", async () => {
  const llm = new ScriptedLLMProvider([
    { text: "TOOL:get_cognitive_profile" },
    { text: "根据你的档案，你处于探索期，最近焦虑较多。" },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  profile.sessions.push({} as never); // 造点数据
  const engine = new ThinkingEngine("stealth", { llm });
  engine.llmProfile = profile;
  const r = await engine.process("看看我的档案吧");
  assert.equal(r.llmGenerated, true);
  assert.deepEqual(engine.getLastToolCalls(), ["get_cognitive_profile"]);
  assert.ok(r.reply.includes("探索期"));
});

test("LLM Agent：LLM 失败时回退规则引擎", async () => {
  const llm = new ScriptedLLMProvider([]); // 无脚本响应 → 消耗完
  const engine = new ThinkingEngine("stealth", { llm });
  engine.llmProfile = createEmptyProfile("u1", "/tmp");
  const r = await engine.process("今天有点累");
    // no script left -> placeholder text is used
  assert.equal(r.llmGenerated, true);
  assert.ok(r.reply.length > 0);
});

test("LLM Agent：情绪崩溃走陪伴模式（不调用 LLM）", async () => {
  const llm = new ScriptedLLMProvider([{ text: "不应该出现的回复" }]);
  const engine = new ThinkingEngine("stealth", { llm });
  const r = await engine.process("我真的快崩溃了");
  assert.equal(r.companion, true);
  assert.ok(r.reply.includes("不容易"));
  assert.equal(r.llmGenerated, false);
  assert.equal(llm.calls.length, 0, "陪伴模式不应调用 LLM");
});

// ---------------------------------------------------------------------------
// tool implementations
// ---------------------------------------------------------------------------

test("buildProfileSummaryJSON：包含成长阶段与锚点", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  profile.frameworkData.vtd.values.anchors = ["自由", "创造"];
  const json = buildProfileSummaryJSON(profile);
  const parsed = JSON.parse(json);
  assert.ok(parsed["成长阶段"]);
  assert.deepEqual(parsed["价值观锚点"], ["自由", "创造"]);
});

test("searchMemoryJSON：命中对话与洞察", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  profile.sessions.push({
    id: "s1", startedAt: "2025-01-01", endedAt: "2025-01-01", mode: "stealth",
    messages: [{ role: "user", text: "我最近在纠结要不要转行", timestamp: "2025-01-01" }],
  } as never);
  const json = searchMemoryJSON(profile, "转行");
  const parsed = JSON.parse(json);
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.some((h: any) => h.source === "对话" && h.snippet.includes("转行")));
});
