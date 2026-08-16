/** delphi — stealth mode. */
import { MessageMarkers } from "../models/types";
import { ATTRIBUTION_LABEL } from "./transparent";

const ACKS = [
  "嗯，我在听。",
  "你继续说。",
  "我在。",
  "嗯。",
  "然后呢？",
  "我听着呢。",
];

const OPEN_QUESTIONS = [
  "你愿意再多说一点吗？",
  "这件事对你来说意味着什么？",
  "你希望我陪你一起看看它，还是先听听就好？",
  "如果你要跟一个完全不了解背景的人讲这件事，你会怎么开头？",
];

/**
  * Stealth-mode companion reply: acknowledge, lightly reflect, never judge.
  * @param round current turn number (0-based)
  * @param withLightTouch allow light-touch markers from round 4 onward
  * @param round current turn number (0-based)
  * @param withLightTouch allow light-touch markers from round 4 onward
 */
export function stealthReply(markers: MessageMarkers, round: number, withLightTouch: boolean): string {
  const ack = ACKS[round % ACKS.length];

    // crisis: companion only
  if (Object.keys(markers.emotionTone).length > 0 && markers.emotionTone.sadness) {
    return `${ack}听起来你有点低落，谢谢你愿意告诉我。`;
  }

    // from round 4, light-touch markers woven into the reply
  if (withLightTouch && round >= 3 && markers.biases.length > 0 && round % 2 === 0) {
    const b = markers.biases[0];
    if (b.type === "overgeneralization") {
      return `${ack}你刚才用了"${b.keyword}"——听起来这件事在你心里已经发生很多次了？`;
    }
    if (b.type === "should_tyranny") {
      return `${ack}我听到"${b.keyword}"——这个标准是你给自己定的，还是别人定的？`;
    }
    if (b.type === "mind_reading") {
      return `${ack}你似乎很确定对方怎么想——有没有可能他们其实没这么想？`;
    }
  }

    // light attribution reflection, no jargon
  if (withLightTouch && round >= 3 && markers.attribution === "external") {
    return `${ack}听起来这件事主要是外界的原因。如果只看你能控制的部分，会有什么不同？`;
  }

    // plain reply
  if (markers.isQuestion || round % 3 === 2) {
    return OPEN_QUESTIONS[round % OPEN_QUESTIONS.length];
  }
  return ack;
}

export { ATTRIBUTION_LABEL };
