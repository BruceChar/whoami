/**
 * delphi —— 个人画像（我是谁？）
 */
import {
  ProfileStore,
  canGeneratePersona,
  updatePersona,
  comparePersonas,
  PERSONA_STAGE_LABELS,
  describeEmotionalTone,
  EMOTION_LABELS,
  getLLMProvider,
  llmEnrichPersona,
} from "@delphi/core";
import { askLine, EOF_INPUT } from "../ui/ask";
import { c, box, hr, progressBar } from "../ui/render";

export async function runPersona(store: ProfileStore): Promise<void> {
  const profile = store.get();

  if (!canGeneratePersona(profile)) {
    console.log(c.yellow("\n🧬 个人画像需要更多数据（≥3 次会话 + 1 个完整方法论工具）。"));
    console.log(c.dim("先完成 [d] 每日回馈 或 [v] V-T-D，画像会自动生成。"));
    return;
  }

  if (!profile.currentPersona) {
    updatePersona(profile);
    store.save();
  }

  // LLM 画像叙事增强（已生成过则跳过）
  const llm = getLLMProvider();
  if (llm && profile.currentPersona && !profile.currentPersona.narratives) {
    console.log(c.dim("\n⚡ 正在生成画像叙事（LLM）..."));
    try {
      const narratives = await llmEnrichPersona(llm, profile, profile.currentPersona);
      if (narratives) {
        profile.currentPersona.narratives = narratives;
        store.save();
      }
    } catch (err) {
      console.log(c.dim(`  ↳ 叙事生成失败（画像本身不受影响）: ${(err as Error).message.slice(0, 80)}`));
    }
  }

  let running = true;
  while (running) {
    const persona = profile.currentPersona;
    if (!persona) return;
    console.log("\n" + renderPersona(persona, profile));

    console.log("");
    console.log("[1] 导出画像报告  [2] 对比历史版本  [3] 查看详细数据  [q] 返回");
    const choice = await askLine("> ");
    if (choice === EOF_INPUT) break;
    switch (choice.trim().toLowerCase()) {
      case "1":
        store.backup("persona");
        console.log(c.green(`✓ 画像报告已备份至 ${profile.settings.dataDir}/backups/`));
        break;
      case "2":
        renderVersionCompare(profile);
        break;
      case "3":
        renderDetailed(profile);
        break;
      case "q":
        running = false;
        break;
      default:
        console.log(c.dim("无效选择"));
    }
  }
}

export function renderPersona(p: import("@delphi/core").PersonaSnapshot, profile: import("@delphi/core").UserCognitiveProfile): string {
  const fp = p.cognitiveFingerprint;
  const em = fp.emotionalTone;
  const topEmotion = Object.entries(em).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => `${EMOTION_LABELS[k] || k} ${v}次`).join(" | ") || "数据积累中";

  const lines: string[] = [];
  lines.push(hr(58));
  lines.push(`            🧬 个人画像 ${p.version}`);
  lines.push(`       生成于 ${p.generatedAt.slice(0, 10)} | 基于 ${p.basedOnSessions} 次会话`);
  lines.push(hr(58));

  lines.push("");
  lines.push("【认知指纹】");
  lines.push(box("", [
    `归因模式: 内归因 ${(fp.attributionPattern.internal * 100).toFixed(0)}% | 外归因 ${(fp.attributionPattern.external * 100).toFixed(0)}% | 情境 ${(fp.attributionPattern.situational * 100).toFixed(0)}%`,
    `抽象倾向: ${fp.abstractionTendency > 1 ? "高（每次对话多次抽象跳跃）" : fp.abstractionTendency > 0.3 ? "中" : "低"}`,
    `确定性: ${fp.certaintyLevel > 0.65 ? "高" : fp.certaintyLevel < 0.35 ? "低" : "中等"} (指数 ${fp.certaintyLevel.toFixed(2)})`,
    `时间取向: 过去 ${(fp.timeOrientation.past * 100).toFixed(0)}% | 现在 ${(fp.timeOrientation.present * 100).toFixed(0)}% | 未来 ${(fp.timeOrientation.future * 100).toFixed(0)}%`,
    `情绪基调: ${topEmotion}`,
  ], 54));

  lines.push("");
  lines.push("【能量地图】");
  lines.push(`  ⚡ 能量源: ${p.energyMap.sources.join("、") || "数据积累中"}`);
  lines.push(`  🪫 能量黑洞: ${p.energyMap.blackHoles.join("、") || "数据积累中"}`);
  if (p.energyMap.disguises.length > 0) {
    for (const d of p.energyMap.disguises) {
      lines.push(`  🔋 能量伪装: ${d.activity}（你以为充电，实际耗电）`);
    }
  }

  lines.push("");
  lines.push("【思维地形】");
  lines.push(`  ⛰️ 高地: ${p.thinkingTerrain.highlands.join("、") || "数据积累中"}`);
  lines.push(`  🕳️ 洼地: ${p.thinkingTerrain.lowlands.join("、") || "数据积累中"}`);
  for (const canyon of p.thinkingTerrain.canyons) {
    lines.push(`  🏔️ 峡谷: ${canyon.tension}`);
  }

  lines.push("");
  lines.push("【关系模式】");
  lines.push(`  自我边界: ${p.relationalPattern.selfBoundary === "clear" ? "清晰" : p.relationalPattern.selfBoundary === "fuzzy" ? "模糊" : "中等清晰"}`);
  lines.push(`  核心需求: ${p.relationalPattern.coreNeeds.join(" > ")}`);
  lines.push(`  冲突反应: ${p.relationalPattern.conflictReaction}`);
  lines.push(`  给予价值: ${p.relationalPattern.givingValue.join("、") || "数据积累中"}`);

  lines.push("");
  lines.push("【决策风格】");
  const speedLabel = { fast: "快速", moderate: "中等", slow: "慢速" }[p.decisionStyle.speed];
  const riskLabel = { adventurous: "冒险型", moderate: "中等", conservative: "保守型" }[p.decisionStyle.riskTendency];
  const regretLabel = { action: "更后悔'做了'", inaction: "更后悔'没做'", mixed: "混合" }[p.decisionStyle.regretPattern];
  lines.push(`  速度: ${speedLabel}决策`);
  lines.push(`  信息偏好: 深度型（喜欢深挖一个维度）`);
  lines.push(`  风险倾向: ${riskLabel}`);
  lines.push(`  后悔模式: ${regretLabel}`);
  lines.push(`  决策锚点: ${p.decisionStyle.decisionAnchors.join(" > ")}`);

  lines.push("");
  lines.push("【成长轨迹】");
  lines.push(`  当前阶段: ${PERSONA_STAGE_LABELS[p.growthTrajectory.currentStage]}`);
  lines.push(`  成长速度: ${p.growthTrajectory.growthSpeed.toFixed(2)}/月`);
  lines.push(`  最快成长: ${p.growthTrajectory.fastestDimension}`);
  lines.push(`  当前瓶颈: ${p.growthTrajectory.currentBottleneck}`);
  lines.push(`  突破建议: ${p.growthTrajectory.breakthroughSuggestion}`);

  if (p.narratives) {
    lines.push("");
    lines.push("【LLM 叙事】");
    if (p.narratives.fingerprint) lines.push(`  🧠 ${p.narratives.fingerprint}`);
    if (p.narratives.energyMap) lines.push(`  ⚡ ${p.narratives.energyMap}`);
    if (p.narratives.terrain) lines.push(`  ⛰️ ${p.narratives.terrain}`);
    if (p.narratives.relationship) lines.push(`  🤝 ${p.narratives.relationship}`);
    if (p.narratives.decision) lines.push(`  🧭 ${p.narratives.decision}`);
    if (p.narratives.growth) lines.push(`  📈 ${p.narratives.growth}`);
  }

  if (profile.personaHistory.length >= 2) {
    lines.push("");
    lines.push("【与上次画像的变化】");
    const changes = comparePersonas(profile.personaHistory[profile.personaHistory.length - 2], p);
    for (const ch of changes) lines.push(`  ${ch.dimension}: ${ch.change}`);
    if (changes.length === 0) lines.push("  无明显变化");
  }

  lines.push(hr(58));
  return lines.join("\n");
}

function renderVersionCompare(profile: import("@delphi/core").UserCognitiveProfile): void {
  const history = profile.personaHistory;
  if (history.length < 2) {
    console.log(c.dim("只有一个画像版本，继续使用工具积累数据后可对比。"));
    return;
  }
  console.log(c.cyan("\n画像版本历史："));
  history.forEach((p, i) => {
    console.log(`  ${p.version}  ${p.generatedAt.slice(0, 10)}  基于 ${p.basedOnSessions} 次会话`);
  });
  const a = history[history.length - 2];
  const b = history[history.length - 1];
  console.log(c.cyan(`\n${a.version} vs ${b.version} 对比：`));
  const changes = comparePersonas(a, b);
  if (changes.length === 0) {
    console.log(c.dim("  无显著变化"));
  } else {
    for (const ch of changes) console.log(`  ${ch.dimension}: ${ch.change}`);
  }
}

function renderDetailed(profile: import("@delphi/core").UserCognitiveProfile): void {
  const g = profile.growthTracking;
  console.log(c.cyan("\n各维度指标（当前值 / 趋势）："));
  for (const [k, dim] of Object.entries(g.dimensions)) {
    const trend = dim.adjustedTrendSlope > 0.005 ? "▲" : dim.adjustedTrendSlope < -0.005 ? "▼" : "—";
    console.log(`  ${trend} ${k}: ${dim.currentLevel.toFixed(2)}  ${progressBar(dim.currentLevel, 16)}`);
  }
  console.log(c.dim(`\n成长阶段: ${g.growthStage} | 转折点: ${g.inflectionPoints.length} 个`));
}
