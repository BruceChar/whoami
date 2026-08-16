import { test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { extractJSON, extractJSONAs } from "../src/llm/json";
import { ScriptedLLMProvider } from "../src/llm/scriptedProvider";
import { PiAiProvider } from "../src/llm/piAiProvider";
import {
  resolveLLMConfig,
  resetLLMProvider,
  getLLMProvider,
  requireLLMProvider,
  LLMNotConfiguredError,
  saveLLMConfigFile,
  loadLLMConfigFile,
  getConfigStatus,
} from "../src/llm/registry";
import { LLMError } from "../src/llm/types";
import { dynamicImport } from "../src/llm/dynamicImport";

function tmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "delphi-llm-"));
}

// ---------------------------------------------------------------------------
// JSON extraction
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
// PiAiProvider (faux provider injection; real pi-ai pipeline)
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
        // cannot reach the faux handle here; look up via getModel
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

test("PiAiProvider: assistant string content does not break the converter", async () => {
  // Regression: pi-ai's wire converter calls content.flatMap on assistant
  // messages, so a plain string content used to throw "assistantMsg.content.
  // flatMap is not a function". Assistant content must reach pi-ai as arrays.
  let seen = false;
  const provider = new PiAiProvider({
    providerId: "faux",
    modelId: "faux-1",
    setup: async (models) => {
      const mod = await dynamicImport("@earendil-works/pi-ai/providers/faux");
      const faux = mod.fauxProvider({ models: [{ id: "faux-1" }] });
      models.setProvider(faux.provider);
      faux.setResponses([
        (context: any) => {
          const asst = context.messages.find((m: any) => m.role === "assistant");
          if (asst) {
            seen = true;
            if (!Array.isArray(asst.content)) {
              throw new Error(`assistant content must be an array, got: ${typeof asst.content}`);
            }
          }
          return mod.fauxAssistantMessage("好的，继续。");
        },
      ]);
    },
    resolveModel: (models, _providerId, modelId) => models.getModel("faux", modelId),
  });
  const res = await provider.agentChat({
    messages: [
      { role: "user", content: "我最近很焦虑" },
      { role: "assistant", content: "我注意到你提到了焦虑。" },
      { role: "user", content: "我总是担心做不好" },
    ],
  });
  assert.equal(seen, true, "assistant message should reach pi-ai");
  assert.ok(res.text.includes("继续"));
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
  assert.equal(resolveLLMConfig(tmpDir()), null);
});

test("resolveLLMConfig：显式提供商 + 自动探测；无 Key 时抛错", () => {
  process.env.DELPHI_LLM_PROVIDER = "deepseek";
  process.env.DEEPSEEK_API_KEY = "test-key";
  assert.equal(resolveLLMConfig()?.provider, "deepseek");
  assert.equal(resolveLLMConfig()?.apiKey, "test-key");
    // no key -> throws LLMNotConfiguredError
  delete process.env.DEEPSEEK_API_KEY;
  assert.throws(() => resolveLLMConfig(), LLMNotConfiguredError);
    // auto-detect
  process.env.OPENAI_API_KEY = "sk-test";
  delete process.env.DELPHI_LLM_PROVIDER;
  assert.equal(resolveLLMConfig()?.provider, "openai");
  delete process.env.OPENAI_API_KEY;
  resetLLMProvider();
});

test("配置文件：保存/读取/优先级/脱敏/缓存失效", () => {
  const dir = tmpDir();
  saveLLMConfigFile({ provider: "deepseek", model: "deepseek-v4-flash", apiKey: "sk-file-key" }, dir);
  const file = loadLLMConfigFile(dir);
  assert.equal(file?.provider, "deepseek");

  const config = resolveLLMConfig(dir);
  assert.equal(config?.provider, "deepseek");
  assert.equal(config?.apiKey, "sk-file-key");
  assert.equal(config?.source, "file");

    // env vars override the file
  process.env.DELPHI_LLM_PROVIDER = "openai";
  process.env.OPENAI_API_KEY = "sk-env-key";
  const envConfig = resolveLLMConfig(dir);
  assert.equal(envConfig?.provider, "openai");
  assert.equal(envConfig?.source, "env");
  delete process.env.DELPHI_LLM_PROVIDER;
  delete process.env.OPENAI_API_KEY;

  const status = getConfigStatus(dir);
  assert.equal(status.configured, true);
  assert.ok(status.apiKeyMasked!.includes("****"));

  resetLLMProvider();
  const p1 = getLLMProvider(dir);
  assert.ok(p1 instanceof PiAiProvider);
  saveLLMConfigFile({ provider: "openrouter", model: "openrouter/auto", apiKey: "sk-or-key" }, dir);
  resetLLMProvider();
  const p2 = getLLMProvider(dir);
  assert.equal(p2?.id, "openrouter");
});

test("requireLLMProvider：未配置抛错（帮助信息），配置后返回实例", () => {
  const dir = tmpDir();
  delete process.env.DELPHI_LLM_PROVIDER;
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.GOOGLE_API_KEY;
  resetLLMProvider();
  assert.throws(() => requireLLMProvider(dir), (err: unknown) => {
    assert.ok(err instanceof LLMNotConfiguredError);
    assert.ok((err as Error).message.includes("DEEPSEEK_API_KEY"));
    return true;
  });
  saveLLMConfigFile({ provider: "deepseek", apiKey: "sk-key" }, dir);
  resetLLMProvider();
  const p = requireLLMProvider(dir);
  assert.ok(p instanceof PiAiProvider);
  resetLLMProvider();
});
