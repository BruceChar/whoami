/**
 * delphi —— 关键词提取工具
 * 从自由文本中提取价值观锚点、技能、主题、内驱源等结构化信息。
 * 全部为可解释的规则，后续可替换为 LLM Provider。
 */

// ---------------------------------------------------------------------------
// 价值观锚点
// ---------------------------------------------------------------------------

export const VALUE_KEYWORDS: Array<{ value: string; words: string[] }> = [
  { value: "自由", words: ["自由", "自主", "自己说了算", "不被管", "独立", "做主"] },
  { value: "成长", words: ["成长", "进步", "学习", "提升", "变强", "突破", "进化"] },
  { value: "创造", words: ["创造", "创作", "创新", "发明", "从无到有", "搭建", "构建"] },
  { value: "真实", words: ["真实", "真诚", "诚实", "不装", "做自己", "坦率", "本色"] },
  { value: "连接", words: ["连接", "陪伴", "朋友", "家人", "关系", "交流", "倾听", "分享", "在一起"] },
  { value: "意义", words: ["意义", "使命", "价值感", "影响", "帮助", "贡献", "改变世界", "有用于人"] },
  { value: "成就", words: ["成就", "成功", "结果", "赢", "第一", "认可", "证明自己", "目标达成"] },
  { value: "稳定", words: ["稳定", "安全", "保障", "确定性", "踏实", "可靠", "规律"] },
  { value: "美", words: ["美", "审美", "艺术", "设计感", "优雅", "精致"] },
  { value: "智慧", words: ["智慧", "洞察", "看透", "深刻", "明白", "通透"] },
  { value: "责任", words: ["责任", "担当", "靠谱", "负责", "承诺", "守信"] },
  { value: "公正", words: ["公正", "公平", "正义", "平等", "规则"] },
  { value: "冒险", words: ["冒险", "刺激", "挑战", "新鲜", "探索", "未知"] },
  { value: "被认可", words: ["认可", "夸奖", "表扬", "欣赏", "尊重", "崇拜", "羡慕"] },
  { value: "掌控", words: ["掌控", "控制", "安排", "计划", "秩序", "条理"] },
  { value: "平静", words: ["平静", "宁静", "松弛", "放松", "慢", "休息", "平衡"] },
];

/** 从文本中提取价值观锚点 */
export function extractValues(text: string): string[] {
  const found: string[] = [];
  for (const { value, words } of VALUE_KEYWORDS) {
    if (words.some((w) => text.includes(w)) && !found.includes(value)) {
      found.push(value);
    }
  }
  return found;
}

/** 价值观冲突检测：常见张力对 */
export const VALUE_CONFLICT_PAIRS: Array<[string, string]> = [
  ["自由", "稳定"],
  ["创造", "被认可"],
  ["真实", "被认可"],
  ["冒险", "稳定"],
  ["意义", "成就"],
  ["掌控", "平静"],
  ["独立", "连接"],
  ["成就", "平静"],
];

export function detectValueConflicts(anchors: string[]): string[] {
  const conflicts: string[] = [];
  for (const [a, b] of VALUE_CONFLICT_PAIRS) {
    if (anchors.includes(a) && anchors.includes(b)) {
      conflicts.push(`${a} ↔ ${b}`);
    }
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// 技能提取（成就事件用）
// ---------------------------------------------------------------------------

export const SKILL_KEYWORDS: Array<{ skill: string; words: string[] }> = [
  { skill: "分析", words: ["分析", "拆解", "研究", "推理", "逻辑", "数据", "判断"] },
  { skill: "表达", words: ["表达", "写作", "演讲", "讲", "沟通", "说服", "汇报", "文案"] },
  { skill: "创造", words: ["创造", "设计", "创作", "画画", "写", "构思", "想象"] },
  { skill: "执行", words: ["执行", "落地", "推进", "完成", "交付", "坚持", "效率"] },
  { skill: "协调", words: ["协调", "组织", "管理", "带团队", "统筹", "安排", "领导"] },
  { skill: "共情", words: ["倾听", "共情", "理解别人", "陪伴", "安慰", "体谅"] },
  { skill: "技术", words: ["编程", "代码", "技术", "开发", "系统", "工具", "算法"] },
  { skill: "学习", words: ["学习", "上手快", "学得快", "钻研", "吸收"] },
  { skill: "销售", words: ["销售", "谈成", "拿下", "成交", "说服", "谈判"] },
  { skill: "规划", words: ["规划", "计划", "战略", "布局", "长远", "目标"] },
];

export function extractSkills(text: string): string[] {
  const found: string[] = [];
  for (const { skill, words } of SKILL_KEYWORDS) {
    if (words.some((w) => text.includes(w)) && !found.includes(skill)) {
      found.push(skill);
    }
  }
  return found;
}

// ---------------------------------------------------------------------------
// 内驱源（V-T-D 梦想阶段）
// ---------------------------------------------------------------------------

/** 内驱源活动词 */
export const DRIVE_WORDS = [
  "写", "画", "教", "讲", "研究", "设计", "创造", "做", "帮", "陪伴", "整理",
  "探索", "旅行", "做饭", "运动", "阅读", "思考", "解决问题", "搭建", "修复",
  "照顾", "分享", "记录", "拍摄", "编程", "手工",
];

/** 外部动机词（需要过滤：钱、面子、他人期待） */
export const EXTERNAL_MOTIVE_WORDS = [
  "钱", "赚钱", "收入", "工资", "面子", "别人", "父母", "家人希望", "应该",
  "体面", "社会地位", "出名", "成功学", "光宗耀祖", "攀比",
];

export function extractPureDrives(text: string): string[] {
  const drives = DRIVE_WORDS.filter((w) => text.includes(w));
  return drives;
}

export function detectExternalMotives(text: string): string[] {
  return EXTERNAL_MOTIVE_WORDS.filter((w) => text.includes(w));
}

// ---------------------------------------------------------------------------
// 主题提取（每日回馈）
// ---------------------------------------------------------------------------

export const THEME_KEYWORDS: Array<{ theme: string; words: string[] }> = [
  { theme: "工作", words: ["工作", "上班", "项目", "客户", "开会", "老板", "同事", "任务", "加班", "KPI"] },
  { theme: "学习", words: ["学习", "读书", "课程", "考试", "论文", "知识", "培训"] },
  { theme: "关系", words: ["朋友", "家人", "伴侣", "对象", "恋爱", "吵架", "聚会", "父母", "孩子", "沟通"] },
  { theme: "健康", words: ["健康", "运动", "跑步", "健身", "睡觉", "失眠", "生病", "身体", "饮食"] },
  { theme: "创造", words: ["写", "画", "设计", "创作", "作品", "灵感", "拍摄", "音乐"] },
  { theme: "财务", words: ["钱", "收入", "存款", "投资", "房租", "账单", "预算", "涨薪"] },
  { theme: "自我", words: ["自己", "成长", "反思", "迷茫", "焦虑", "决定", "选择", "目标", "计划"] },
  { theme: "兴趣", words: ["游戏", "电影", "小说", "动漫", "旅游", "美食", "综艺", "追剧"] },
];

export function extractThemes(...texts: string[]): string[] {
  const combined = texts.join("\n");
  const themes: string[] = [];
  for (const { theme, words } of THEME_KEYWORDS) {
    if (words.some((w) => combined.includes(w))) themes.push(theme);
  }
  return themes;
}

/** 通用高频词统计（去停用词） */
const STOP_WORDS = new Set([
  "我", "你", "他", "她", "它", "我们", "你们", "他们", "的", "了", "是", "在",
  "有", "和", "就", "都", "而", "及", "与", "着", "或", "一个", "没有", "不是",
  "这个", "那个", "什么", "怎么", "为什么", "因为", "所以", "但是", "然后", "觉得",
]);

export function topKeywords(text: string, n = 5): string[] {
  const counts = new Map<string, number>();
  // 简单分词：按 2-3 字滑动窗口 + 已知词优先
  const knownWords = [
    ...VALUE_KEYWORDS.flatMap((v) => v.words),
    ...SKILL_KEYWORDS.flatMap((s) => s.words),
    ...THEME_KEYWORDS.flatMap((t) => t.words),
    ...DRIVE_WORDS,
  ];
  for (const w of knownWords) {
    if (text.includes(w)) counts.set(w, (counts.get(w) || 0) + 1);
  }
  const cleaned = text.replace(/[，。！？、；：""''（）\s]/g, "");
  for (let len = 2; len <= 3; len++) {
    for (let i = 0; i + len <= cleaned.length; i++) {
      const seg = cleaned.slice(i, i + len);
      if (STOP_WORDS.has(seg)) continue;
      counts.set(seg, (counts.get(seg) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([w]) => w);
}
