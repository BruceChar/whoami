/**
 * delphi —— 能量地图（文档 8.3）
 * 能量源（满意事件主题）/ 能量黑洞（不满意事件主题）
 */
import { UserCognitiveProfile } from "../models/types";
import { satisfiedDrivers, unsatisfiedDrivers } from "../frameworks/dailyFeedback";

export interface EnergyMap {
  sources: string[];
  blackHoles: string[];
  disguises: Array<{ activity: string; perceived: "charging"; actual: "draining" }>;
  fluctuations: Array<{ period: string; pattern: string }>;
}

export function computeEnergyMap(profile: UserCognitiveProfile): EnergyMap {
  const entries = profile.frameworkData.dailyFeedback;
  const sources = satisfiedDrivers(entries);
  const blackHoles = unsatisfiedDrivers(entries);

  // 能量伪装：SWOT 中列为优势（自认擅长）但成就事件能量低 → 疑似伪装
  const disguises: EnergyMap["disguises"] = [];
  const lowEnergyAchievements = profile.frameworkData.achievements.filter((a) => a.energyLevel === "low");
  for (const ach of lowEnergyAchievements) {
    for (const skill of ach.skills) {
      const inStrengths = profile.frameworkData.swot.strengths.some((s) => s.includes(skill) || skill.includes(s));
      if (inStrengths) {
        disguises.push({ activity: skill, perceived: "charging", actual: "draining" });
        break;
      }
    }
    if (disguises.length >= 2) break;
  }

  // 能量波动：按天聚合满意主题数量
  const fluctuations: EnergyMap["fluctuations"] = [];
  const byDate = new Map<string, number>();
  for (const e of entries) {
    byDate.set(e.date, (byDate.get(e.date) || 0) + 1);
  }
  const dates = [...byDate.keys()].sort();
  if (dates.length >= 3) {
    fluctuations.push({ period: `${dates[0]} ~ ${dates[dates.length - 1]}`, pattern: `共 ${entries.length} 条回馈记录，数据积累中` });
  }

  return { sources, blackHoles, disguises, fluctuations };
}
