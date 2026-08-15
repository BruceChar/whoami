/**
 * delphi —— SIGN 模型（天赋信号探测，文档 4.2.2）
 * S-Success / I-Instinct / G-Growth / N-Needs
 */
import { FlowRunner, FlowStep } from "./flow";

export const SIGN_STEPS: FlowStep[] = [
  {
    id: "s",
    prompt: "【S - Success】什么事你做起来比别人轻松、结果还更好？",
    answerKey: "s",
  },
  {
    id: "i",
    prompt: "【I - Instinct】什么事你会主动想做，甚至忍不住就去做？",
    answerKey: "i",
  },
  {
    id: "g",
    prompt: "【G - Growth】学什么你比别人快？做什么事最容易进入「心流」？",
    answerKey: "g",
  },
  {
    id: "n",
    prompt: "【N - Needs】做完什么事后，你感到的是满足而非空虚？",
    answerKey: "n",
  },
];

export function createSignFlow(): FlowRunner {
  return new FlowRunner(SIGN_STEPS);
}

export interface SignResult {
  signals: Record<string, string>;
}

export function buildSignResult(runner: FlowRunner): SignResult {
  return {
    signals: {
      success: runner.answers.s || "",
      instinct: runner.answers.i || "",
      growth: runner.answers.g || "",
      needs: runner.answers.n || "",
    },
  };
}

/** 从 SIGN 结果提取天赋领域关键词（供画像/从业分析交叉验证） */
export function signAreas(result: SignResult): string[] {
  const combined = Object.values(result.signals).join("\n");
  const areas: string[] = [];
  const map: Array<[string, string[]]> = [
    ["分析研究", ["研究", "分析", "数据", "推理", "拆解", "逻辑", "代码", "编程"]],
    ["表达创作", ["写", "写作", "表达", "讲", "创作", "画", "设计", "内容"]],
    ["连接沟通", ["沟通", "交流", "倾听", "理解", "陪伴", "帮", "协调"]],
    ["执行落地", ["执行", "落地", "完成", "推进", "组织", "管理", "计划"]],
    ["技术构建", ["技术", "开发", "搭建", "系统", "工具", "修复", "手工"]],
    ["学习探索", ["学习", "探索", "新事物", "研究", "好奇", "吸收"]],
  ];
  for (const [area, words] of map) {
    if (words.some((w) => combined.includes(w))) areas.push(area);
  }
  return areas;
}
