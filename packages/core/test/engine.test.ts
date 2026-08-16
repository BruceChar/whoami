import { test } from "node:test";
import assert from "node:assert/strict";
import { ThinkingEngine } from "../src/engine/thinkingEngine";
import { resolveModeSwitch, isModeCommand } from "../src/engine/modeSwitcher";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import { createEmptyProfile } from "../src/models/types";
import { buildProfileSummaryJSON, searchMemoryJSON } from "../src/llm/agent";

const MARKER_JSON =
  '{"attribution":"external","certainty":0.8,"timeOrientation":{"past":0.3,"present":0.4,"future":0.3},"emotionTone":{"anxiety":1},"selfReflection":false,"abstractionJump":false,"emotionFact":0.5,"biases":[{"type":"overgeneralization","keyword":"总是","quote":"总是"}]}';

test("mode switching (explicit commands only)", () => {
  assert.equal(resolveModeSwitch("/stealth")?.mode, "stealth");
  assert.equal(resolveModeSwitch("/analyze")?.mode, "transparent");
  assert.equal(resolveModeSwitch("/deep")?.mode, "meta_guide");
  assert.equal(resolveModeSwitch("你好"), null);
  assert.equal(isModeCommand("/guide"), true);
  assert.equal(isModeCommand("你好"), false);
});

test("stealth mode: LLM reply + LLM markers", async () => {
  const llm = new ScriptedLLMProvider([{ text: MARKER_JSON }, { text: "I'm listening." }]);
  const engine = new ThinkingEngine("stealth", { llm });
  const r = await engine.process("今天工作好累");
  assert.equal(r.modeAfter, "stealth");
  assert.ok(r.reply.length > 0);
  assert.equal(r.llmGenerated, true);
  assert.ok(r.markers.biases.some((b) => b.type === "overgeneralization"));
});

test("transparent mode: LLM emits metacog snapshot", async () => {
  const llm = new ScriptedLLMProvider([
    { text: MARKER_JSON },
    { text: "I hear you.\n\nmetacog:\n  I notice you used \"always\"." },
  ]);
  const engine = new ThinkingEngine("transparent", { llm });
  const r = await engine.process("他总是这样");
  assert.ok(r.reply.includes("metacog"), `expected metacog, got: ${r.reply}`);
});

test("guide mode: LLM asks a guiding question", async () => {
  const llm = new ScriptedLLMProvider([
    { text: MARKER_JSON },
    { text: "Where did that \"should\" come from — is it yours, or someone else's?" },
  ]);
  const engine = new ThinkingEngine("meta_guide", { llm });
  const r = await engine.process("我应该更努力");
  assert.ok(r.reply.includes("should"));
});

test("mode-switch command returns early", async () => {
  const engine = new ThinkingEngine("stealth", { llm: new ScriptedLLMProvider([]) });
  const r = await engine.process("/guide");
  assert.equal(r.isCommand, true);
  assert.equal(r.modeAfter, "meta_guide");
});

// ---------------------------------------------------------------------------
// LLM agent path
// ---------------------------------------------------------------------------

test("LLM agent: tool call (get_cognitive_profile)", async () => {
  const llm = new ScriptedLLMProvider([
    { text: MARKER_JSON },
    { text: "TOOL:get_cognitive_profile" },
    { text: "Based on your profile, you are in the exploration stage." },
  ]);
  const profile = createEmptyProfile("u1", "/tmp");
  const engine = new ThinkingEngine("stealth", { llm });
  engine.llmProfile = profile;
  const r = await engine.process("看看我的档案吧");
  assert.equal(r.llmGenerated, true);
  assert.deepEqual(engine.getLastToolCalls(), ["get_cognitive_profile"]);
  assert.ok(r.reply.includes("exploration"));
});

// ---------------------------------------------------------------------------
// tool implementations
// ---------------------------------------------------------------------------

test("buildProfileSummaryJSON: English keys with stage and anchors", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  profile.frameworkData.vtd.values.anchors = ["自由", "创造"];
  const json = buildProfileSummaryJSON(profile);
  const parsed = JSON.parse(json);
  assert.equal(parsed["growthStage"], "exploration");
  assert.deepEqual(parsed["valueAnchors"], ["自由", "创造"]);
});

test("searchMemoryJSON: matches conversation records with English source labels", () => {
  const profile = createEmptyProfile("u1", "/tmp");
  profile.sessions.push({
    id: "s1", startedAt: "2025-01-01", endedAt: "2025-01-01", mode: "stealth",
    messages: [{ role: "user", text: "我最近在纠结要不要转行", timestamp: "2025-01-01" }],
  } as never);
  const json = searchMemoryJSON(profile, "转行");
  const parsed = JSON.parse(json);
  assert.ok(Array.isArray(parsed));
  assert.ok(parsed.some((h: any) => h.source === "conversation" && h.snippet.includes("转行")));
});
