/** delphi */
import { BiasType } from "../models/types";

// ---------------------------------------------------------------------------

export const BIAS_PATTERNS: Record<BiasType, string[]> = {
    // overgeneralization: always / never / everyone
  overgeneralization: [
    "总是", "从不", "从来都", "永远", "所有人", "每个人", "没有人", "根本", "彻底",
    "一点都", "每次都", "一直", "全都", "凡是", "从来", "压根",
    "always", "never", "everyone", "nobody", "everything", "nothing",
  ],
    // should tyranny: should / must / have to
  should_tyranny: [
    "应该", "必须", "不该", "不应该", "不得不", "一定要", "非得", "理应", "应当",
    "怎么能", "怎么可以", "规定", "必须得",
    "should", "must", "ought to", "have to", "supposed to",
  ],
    // catastrophizing: ruined / unbearable / can't go on
  catastrophizing: [
    "完蛋", "毁了", "全完了", "崩溃", "受不了", "活不下去", "糟糕透", "世界末日",
    "没救了", "彻底失败", "最坏", "灾难", "死定", "天塌", "完了", "不行了",
    "disaster", "ruined", "worst", "unbearable", "end of the world", "doomed", "catastrophe",
  ],
    // mind reading: they must think...
  mind_reading: [
    "他肯定觉得", "她肯定觉得", "他们肯定", "大家都觉得", "别人都认为", "他肯定想",
    "她肯定想", "我知道他肯定", "我知道她肯定", "他一定觉得", "她一定觉得",
    "他们一定认为", "肯定讨厌", "一定不喜欢", "肯定觉得", "肯定认为", "肯定想",
    "一定觉得", "一定认为", "一定想", "他以为我", "她以为我",
    "he thinks i", "she thinks i", "they think i", "i know he", "i know she",
  ],
    // emotional reasoning: I feel that means...
  emotional_reasoning: [
    "感觉就是", "我感觉是", "我觉得就是", "因为我觉得", "所以我觉得", "我感到",
    "我感觉到", "直觉告诉我", "心里觉得", "潜意识觉得", "莫名觉得", "总觉得",
    "就是感觉", "感觉好像", "我感觉好像",
    "i feel like it", "i feel that means", "because i feel",
  ],
    // confirmation bias: I knew it / as expected
  confirmation_bias: [
    "果然", "我就知道", "早就说", "不出所料", "果真", "我就说", "看吧", "我早就知道",
    "印证了", "证明我是对的", "和我预想的一样", "果然如此", "意料之中",
    "i knew it", "as expected", "told you", "proves my point", "just as i thought",
  ],
    // all-or-nothing: either/or, must be perfect
  all_or_nothing: [
    "要么", "非黑即白", "不是", "就是", "只能", "没有中间", "必须完美", "不完美就是失败",
    "二选一", "全有或全无", "非此即彼",
    "either or", "all or nothing", "black or white", "perfect or",
  ],
};

// ---------------------------------------------------------------------------
// attribution
// ---------------------------------------------------------------------------

export const ATTRIBUTION_PATTERNS: Record<"internal" | "external" | "situational", string[]> = {
  internal: [
    "我的错", "我做得不够", "我没做好", "是我的问题", "怪我", "我能力不够",
    "我不够努力", "我太差", "我不行", "我的责任", "我该", "我本该", "我自己", "我太",
  ],
  external: [
    "都怪", "怪他", "怪他们", "怪老板", "老板", "公司", "领导", "同事", "别人",
    "都是他们的错", "都是他的错", "他们不", "被逼", "害的", "都是命", "社会",
    "环境不好", "他先", "她先",
  ],
  situational: [
    "运气", "时机", "碰巧", "偶然", "客观原因", "环境因素", "刚好", "正好",
    "条件所限", "时运", "阴差阳错", "天意",
  ],
};

// ---------------------------------------------------------------------------
// certainty
// ---------------------------------------------------------------------------

export const CERTAINTY_HIGH = [
  "一定", "肯定", "绝对", "必须", "当然", "毫无疑问", "百分之百", "必然", "确定",
  "definitely", "certainly", "absolutely", "must",
];
export const CERTAINTY_LOW = [
  "可能", "也许", "大概", "或许", "说不定", "说不准", "不一定", "未必", "估计",
  "似乎", "好像", "差不多", "应该吧", "可能吧", "也许吧",
  "maybe", "perhaps", "probably", "might", "possibly",
];

// ---------------------------------------------------------------------------
// time orientation
// ---------------------------------------------------------------------------

export const TIME_PAST = [
  "以前", "当时", "曾经", "过去", "那时候", "回想", "记得", "之前", "上个月", "去年",
  "小时候", "往事", "已经", "早就", "当年", "从前", "昨天",
];
export const TIME_PRESENT = [
  "现在", "目前", "当下", "正在", "最近", "今天", "此刻", "如今", "眼下", "现阶段",
];
export const TIME_FUTURE = [
  "以后", "将来", "未来", "打算", "计划", "准备", "明天", "下周", "明年", "希望",
  "想要", "考虑", "将", "会", "憧憬",
];

// ---------------------------------------------------------------------------
// emotional tones (category -> words)
// ---------------------------------------------------------------------------

export const EMOTION_TONES: Record<string, string[]> = {
  joy: ["开心", "高兴", "快乐", "兴奋", "满足", "幸福", "喜欢", "享受", "愉快", "欣喜", "感激", "感谢", "爽", "欣慰", "轻松"],
  frustration: ["挫败", "沮丧", "失败", "失望", "灰心", "泄气", "受挫", "郁闷", "苦恼", "烦", "烦躁", "不甘"],
  anxiety: ["焦虑", "担心", "害怕", "紧张", "不安", "恐慌", "忧虑", "着急", "忐忑", "压力", "恐惧", "慌"],
  anger: ["生气", "愤怒", "恼火", "火大", "气死", "讨厌", "恨", "不满", "窝火", "愤愤", "忍不了"],
  sadness: ["难过", "伤心", "悲伤", "痛苦", "失落", "孤独", "委屈", "心酸", "难受", "绝望", "低落", "丧"],
  reflection: ["平静", "冷静", "思考", "反思", "明白", "理解", "想通", "领悟", "觉察", "意识到", "清晰", "释然"],
  resignation: ["无奈", "没办法", "算了", "认命", "只能", "就这样吧", "无所谓"],
};

// ---------------------------------------------------------------------------
// self-reflection signals
// ---------------------------------------------------------------------------

export const SELF_REFLECTION_SIGNALS = [
  "我意识到", "我突然意识到", "我发现", "我明白", "我理解", "我想通", "我觉察", "反思", "原来我",
  "其实我", "我好像", "我似乎", "为什么我会", "我是不是", "我后来才", "我逐渐",
  "我注意到", "我突然想到", "仔细想想", "回头看", "我试着", "我决定", "我想了想",
  "我醒悟", "我体会到", "我悟到",
];

// ---------------------------------------------------------------------------
// abstraction levels (for jump detection)
// ---------------------------------------------------------------------------

export const ABSTRACT_WORDS = [
  "人生", "意义", "价值", "本质", "命运", "自由", "幸福", "自我", "灵魂", "存在",
  "真理", "格局", "境界", "终极", "哲学", "人性", "原则", "信念", "使命", "爱",
  "世界", "生命", "宇宙", "永恒", "理想", "追求",
];
export const CONCRETE_WORDS = [
  "今天", "昨天", "明天", "早上", "晚上", "下午", "中午", "周一", "周二", "周三",
  "周四", "周五", "周六", "周日", "饭", "咖啡", "电脑", "手机", "代码", "会议",
  "文件", "钱", "房子", "车", "地铁", "公交", "工资", "项目", "客户", "邮件",
  "床", "桌子", "电脑", "键盘", "鼠标", "屏幕", "电话", "微信",
];

// ---------------------------------------------------------------------------
// question markers (meta-guide: whether to follow up)
// ---------------------------------------------------------------------------

export const QUESTION_MARKERS = [
  "？", "?", "为什么", "怎么办", "怎么", "如何", "是不是", "会不会", "该不该",
  "要不要", "能不能", "吗", "呢", "what", "why", "how", "should i", "can i",
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export interface KeywordHit {
  keyword: string;
  quote: string; // 上下文片段
}

const QUOTE_RADIUS = 8;

/** Find all keyword hits in text (with surrounding quote fragments) */
export function findHits(text: string, keywords: string[]): KeywordHit[] {
  const hits: KeywordHit[] = [];
  for (const kw of keywords) {
    let idx = text.indexOf(kw);
    while (idx !== -1) {
      const start = Math.max(0, idx - QUOTE_RADIUS);
      const end = Math.min(text.length, idx + kw.length + QUOTE_RADIUS);
      hits.push({ keyword: kw, quote: text.slice(start, end).trim() });
      idx = text.indexOf(kw, idx + kw.length);
    }
  }
  return hits;
}
