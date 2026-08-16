/** delphi — Energy sources (satisfying themes) / black holes (unsatisfying themes) */
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

    // disguises: listed as a strength (self-claimed) but low achievement energy
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

    // fluctuations: satisfying themes aggregated per day
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
