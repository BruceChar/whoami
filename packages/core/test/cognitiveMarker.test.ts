import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeMessage, emotionFactScore } from "../src/analyzer/cognitiveMarker";

test("归因分析：内/外/情境", () => {
  assert.equal(analyzeMessage("都是老板的错，他们不配合").attribution, "external");
  assert.equal(analyzeMessage("我的错，我没做好，我能力不够").attribution, "internal");
  assert.equal(analyzeMessage("正好赶上运气不好，时机不对").attribution, "situational");
  assert.equal(analyzeMessage("今天天气不错").attribution, null);
});

test("确定性：高确定性词占比", () => {
  assert.ok(analyzeMessage("他肯定是故意的，绝对没错").certainty >= 0.7);
  assert.ok(analyzeMessage("可能吧，也许不太确定").certainty <= 0.3);
});

test("时间取向分布", () => {
  const t = analyzeMessage("以前我很焦虑，现在好多了，以后想试试").timeOrientation;
  assert.ok(t.past > 0 && t.present > 0 && t.future > 0);
});

test("情绪基调识别", () => {
  const m = analyzeMessage("我好开心，也很满足");
  assert.ok(m.emotionTone.joy >= 2);
  const m2 = analyzeMessage("我很难过，特别焦虑");
  assert.ok(m2.emotionTone.sadness >= 1 && m2.emotionTone.anxiety >= 1);
});

test("自我反思信号", () => {
  assert.ok(analyzeMessage("我突然意识到我总是在逃避").selfReflection);
  assert.ok(!analyzeMessage("今天吃了午饭").selfReflection);
});

test("抽象层级跳跃", () => {
  assert.ok(analyzeMessage("今天我写了代码，思考人生的意义").abstractionJump);
  assert.ok(!analyzeMessage("今天写了代码，开了会议").abstractionJump);
});

test("情绪-事实区分评分", () => {
  assert.equal(emotionFactScore("我太难过了"), 0);
  assert.equal(emotionFactScore("今天开会很烦躁"), 1);
  assert.equal(emotionFactScore("今天天气很好"), 0.5);
});
