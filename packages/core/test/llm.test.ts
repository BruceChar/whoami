import { test } from "node:test";
import assert from "node:assert/strict";
import { extractJSON, extractJSONAs } from "../src/llm/json";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import { PiAiProvider } from "../src/llm/piAiProvider";
import { resolveLLMConfig, resetLLMProvider, getLLMProvider } from "../src/llm/registry";
import { LLMError } from "../src/llm/types";
import { dynamicImport } from "../src/llm/dynamicImport";

// ---------------------------------------------------------------------------
// JSON 提取
// ---------------------------------------------------------------------------

test("extractJSON：从围栏/前后缀文本提取对象", () => {
  const obj = extractJSON('好的，结果如下：\n```json\n{"a": 1, "b": [1,2,3]}\n```\n希望对你有帮助');
  assert.deepEqual(obj, { a: 1, b: [1, 2, 3] });
});

test("extractJSON：嵌套字符串中的括号不破坏解析", () => {
  const obj = extractJSON('{"text": "他说：{你好}，然后} 结束", "n": 2}');
  assert.equal((obj as any).n, 2);
});

test("extractJSON：非法 JSON 返回 null", () => {
  assert.equal(extractJSON("这不是 JSON"), null);
  assert.equal(extractJSON('{"a": }'), null);
});

test("extractJSONAs：数组与类型转换", () => {
  const arr = extractJSONAs<string[]>('["a", "b"]');
  assert.deepEqual(arr, ["a", "b"]);
});

// ---------------------------------------------------------------------------
// ScriptedLLMProvider
// ---------------------------------------------------------------------------

test("ScriptedLLMProvider：按顺序返回 + when 匹配", async () => {
  const provider = new ScriptedLLMProvider([
    { text: "第一条" },
    { text: "带匹配", when: "焦虑" },
    { text: "第二条" },
  ]);
  const r1 = await provider.complete({ messages: [{ role: "user", content: "你好" }] });
  assert.equal(r1.text, "第一条");
  const r2 = await provider.complete({ messages: [{ role: "user", content: "我最近很焦虑" }] });
  assert.equal(r2.text, "带匹配");
  const r3 = await provider.complete({ messages: [{ role: "user", content: "再聊" }] });
  assert.equal(r3.text, "第二条");
});

test("ScriptedLLMProvider：JSON 模式", async () => {
  const provider = new ScriptedLLMProvider([{ text: '{"ok": true, "tags": ["a"]}' }]);
  const json = await provider.completeJSON<{ ok: boolean; tags: string[] }>({
    messages: [{ role: "user", content: "分析" }],
    schema: "{ ok: boolean, tags: string[] }",
  });
  assert.deepEqual(json, { ok: true, tags: ["a"] });
});

// ---------------------------------------------------------------------------
// PiAiProvider（faux provider 注入，真实 pi-ai 管道）
// ---------------------------------------------------------------------------

test("PiAiProvider：faux 注入完成对话", async () => {
  const provider = new PiAiProvider({
    providerId: "faux",
    modelId: "faux-1",
    setup: async (models) => {
      const mod = await dynamicImport("@earendil-works/pi-ai/providers/faux");
      const faux = mod.fauxProvider();
      models.setProvider(faux.provider);
      faux.setResponses([mod.fauxAssistantMessage("我注意到你提到了'总是'。")]);
    },
    resolveModel: (models, _providerId, modelId) => {
      // 无法直接拿到 faux handle，用 getModel 查找
      return models.getModel("faux", modelId);
    },
  });
  assert.equal(await provider.isConfigured(), true);
  const res = await provider.complete({ messages: [{ role: "user", content: "我总是很焦虑" }] });
  assert.ok(res.text.includes("总是"));
  assert.ok(res.model.length > 0);
});

test("PiAiProvider：faux 注入 JSON 提取", async () => {
  const provider = new PiAiProvider({
    providerId: "faux",
    modelId: "faux-1",
    setup: async (models) => {
      const mod = await dynamicImport("@earendil-works/pi-ai/providers/faux");
      const faux = mod.fauxProvider();
      models.setProvider(faux.provider);
      faux.setResponses([mod.fauxAssistantMessage('{"attribution":"internal","biases":["overgeneralization"]}')]);
    },
    resolveModel: (models, _providerId, modelId) => models.getModel("faux", modelId),
  });
  const json = await provider.completeJSON<{ attribution: string; biases: string[] }>({
    messages: [{ role: "user", content: "都是我的错" }],
    schema: "{ attribution: string, biases: string[] }",
  });
  assert.deepEqual(json, { attribution: "internal", biases: ["overgeneralization"] });
});

// ---------------------------------------------------------------------------
// registry
// ---------------------------------------------------------------------------

test("resolveLLMConfig：无 Key 时返回 null", () => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  delete process.env.DELPHI_LLM_PROVIDER;
  delete process.env.DELPHI_LLM_MODEL;
  delete process.env.DELPHI_LLM_DISABLED;
  assert.equal(resolveLLMConfig(), null);
});

test("resolveLLMConfig：显式提供商优先；自动探测 API Key", () => {
  process.env.DELPHI_LLM_PROVIDER = "deepseek";
  assert.equal(resolveLLMConfig()?.provider, "deepseek");
  delete process.env.DELPHI_LLM_PROVIDER;
  delete process.env.DEEPSEEK_API_KEY;
  process.env.DEEPSEEK_API_KEY = "test-key";
  assert.equal(resolveLLMConfig()?.provider, "deepseek");
});

test("getLLMProvider：未配置返回 null，配置后返回实例", () => {
  delete process.env.DELPHI_LLM_PROVIDER;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  resetLLMProvider();
  assert.equal(getLLMProvider(), null);
  process.env.DELPHI_LLM_PROVIDER = "deepseek";
  resetLLMProvider();
  const p = getLLMProvider();
  assert.ok(p instanceof PiAiProvider);
  resetLLMProvider();
});
