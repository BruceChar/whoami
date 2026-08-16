/**
 * delphi —— 工具模板（对话框输入 / 触发的方法论模板）
 * 每个模板复用 frameworks 的问题序列，由 LLM 以对话方式主持流程：
 * 一次一个问题（镜子原则），收集回答，结束时反射/总结。
 */
import { V_STEPS, D_STEPS } from "./vtd";
import { SIGN_STEPS } from "./sign";
import { SWOT_STEPS } from "./swot";
import { ACHIEVEMENT_STEPS } from "./achievement";
import { INTEREST_STEPS } from "./interestMatrix";
import { DAILY_STEPS } from "./dailyFeedback";

export interface ToolTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** 主持该工具的系统提示（追加在镜子原则之后） */
  prompt: string;
}

function questions(steps: Array<{ prompt: string }>): string {
  return steps.map((s, i) => `${i + 1}. ${s.prompt.replace(/\n/g, " ")}`).join("\n");
}

const MIRROR_NOTE =
  "主持原则：一次只问一个问题，等用户回答后再问下一个；不评判、不打断；全部问完后，用一段话反射用户回答中浮现的模式。";

export const TOOL_TEMPLATES: ToolTemplate[] = [
  {
    id: "vtd",
    label: "V-T-D 探索",
    emoji: "🧭",
    description: "价值观-天赋-梦想：三层深度探索",
    prompt: `现在运行【V-T-D 探索】工具。按顺序提问（先价值观 5 题，再天赋 4 题，最后梦想 3 题）：\n价值观：\n${questions(V_STEPS)}\n天赋（SIGN）：\n${questions(SIGN_STEPS)}\n梦想：\n${questions(D_STEPS)}\n${MIRROR_NOTE}\n全部完成后，从回答中提取价值观锚点与内驱源，反馈给用户（如：「我注意到你反复提到自由与创造——这两个词可能是你的价值观锚点」）。`,
  },
  {
    id: "sign",
    label: "SIGN 天赋探测",
    emoji: "✨",
    description: "成功/本能/成长/需求 四信号",
    prompt: `现在运行【SIGN 天赋探测】工具。按顺序提问：\n${questions(SIGN_STEPS)}\n${MIRROR_NOTE}\n完成后交叉验证用户的天赋领域，反馈给用户。`,
  },
  {
    id: "swot",
    label: "SWOT 分析",
    emoji: "🔍",
    description: "优势/劣势/机会/威胁（增强版）",
    prompt: `现在运行【SWOT 分析】工具。按顺序提问：\n${questions(SWOT_STEPS)}\n${MIRROR_NOTE}\n完成后，把「威胁」分成可控（锚定问题）与不可控（重力问题）两部分反馈给用户。`,
  },
  {
    id: "achievement",
    label: "成就事件萃取",
    emoji: "🏆",
    description: "STAR 深度挖掘 + 技能萃取",
    prompt: `现在运行【成就事件萃取（STAR）】工具。按顺序提问：\n${questions(ACHIEVEMENT_STEPS)}\n${MIRROR_NOTE}\n完成后，萃取该事件中的可迁移技能，反馈给用户（「你以为没有、其实有」的能力）。`,
  },
  {
    id: "interest",
    label: "兴趣矩阵",
    emoji: "🎨",
    description: "四象限能量评分",
    prompt: `现在运行【兴趣矩阵】工具。依次问用户为四类活动打分（0-5）：创造性、分析性、独立性、社交性。\n${MIRROR_NOTE}\n完成后，指出高能象限与能量冲突。`,
  },
  {
    id: "daily",
    label: "每日回馈",
    emoji: "📝",
    description: "今日满意/不满意 + 原因",
    prompt: `现在运行【每日回馈】工具。按顺序提问：\n${questions(DAILY_STEPS)}\n${MIRROR_NOTE}\n完成后记录满意/不满意驱动的主题。`,
  },
  {
    id: "career",
    label: "从业分析",
    emoji: "💼",
    description: "上班 vs 创业适配度",
    prompt: `现在运行【从业分析】。先调用工具 get_cognitive_profile 读取认知档案，然后基于价值观锚点、能量流向、天赋信号，输出：工作形态建议（上班/创业/自由职业）、工作内容方向、避坑提醒。用第二人称「你」。`,
  },
  {
    id: "life",
    label: "人生设计",
    emoji: "🌱",
    description: "Connect The Dots / 多重人生",
    prompt: `现在运行【人生设计】。调用 get_cognitive_profile 读取档案，然后依次进行：\n1) Connect The Dots——把「你相信的」与「你做的事」对齐，指出断裂点；\n2) 多重人生假设——依次问三个问题：继续当前路径 5 年会怎样 / 如果核心技能被 AI 取代你还有什么价值 / 如果钱和面子都不存在你会选什么；\n3) 找三者的共同元素 = 你的内驱核心。`,
  },
];

export function getToolTemplate(id: string): ToolTemplate | undefined {
  return TOOL_TEMPLATES.find((t) => t.id === id);
}
