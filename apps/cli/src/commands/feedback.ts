/**
 * delphi — external feedback (360°).
 */
import {
  ProfileStore,
  createShareLink,
  submitFeedback,
  feedbackSummary,
  llmAnalyzeFeedback,
  applyFeedbackAnalysis,
  requireLLMProvider,
} from "@delphi/core";
import { askLine, EOF_INPUT } from "../ui/ask";
import { c, box, hr } from "../ui/render";

export async function runFeedback(store: ProfileStore): Promise<void> {
  const profile = store.get();
  let running = true;

  while (running) {
    const summary = feedbackSummary(profile);
    console.log(box(" 🧑‍🤝‍🧑 反馈收集（360°外部视角） ", [
      `已收到反馈: ${summary.count} 条`,
      Object.entries(summary.byRelationship).map(([k, v]) => `  ${k}: ${v} 条`).join("  ") || "  （暂无）",
    ], 56));
    console.log("");
    console.log("[1] 生成分享链接  [2] 手动录入反馈  [3] 查看反馈  [4] 生成共识报告  [q] 返回");
    const choice = await askLine("> ");
    if (choice === EOF_INPUT) break;
    switch (choice.trim().toLowerCase()) {
      case "1": {
        const expiresRaw = await askLine("有效期（天，留空=30天）> ");
        const maxRaw = await askLine("填写人数上限（留空=不限）> ");
        const days = parseInt(expiresRaw, 10) || 30;
        const max = parseInt(maxRaw, 10) || undefined;
        const link = createShareLink(profile, {
          expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
          maxEntries: max,
        });
        store.save();
        console.log(c.green(`\n✓ 分享链接已生成：`));
        console.log(`  Web 填写地址: ${c.cyan(`http://localhost:3088/f/${link.id}`)}`);
        console.log(c.dim(`  链接 ID: ${link.id}（有效期 ${days} 天${max ? `，上限 ${max} 条` : ""}）`));
        break;
      }
      case "2": {
        const linkId = await askLine("关联的分享链接 ID（留空=新建）> ");
        const fw = profile.frameworkData.feedback;
        let resolvedLink = linkId || (fw.shareLinks[fw.shareLinks.length - 1]?.id);
        if (!resolvedLink) {
          const link = createShareLink(profile, { expiresAt: new Date(Date.now() + 30 * 86400000).toISOString() });
          resolvedLink = link.id;
        }
        const author = await askLine("填写人（姓名/昵称）> ");
        const relationship = await askLine("与你的关系（同事/朋友/家人/前领导/同学）> ");
        const knownFor = await askLine("认识时长（如 3年）> ");
        const impression = await askLine("对你整体印象的评价 > ");
        const evidence = await askLine("具体事件（可选）> ");
        const res = submitFeedback(profile, resolvedLink, { author, relationship, knownFor, impression, evidence });
        if (res.ok) {
          store.save();
          console.log(c.green("✓ 反馈已录入"));
        } else {
          console.log(c.yellow(`✗ ${res.reason}`));
        }
        break;
      }
      case "3": {
        renderRecords(profile);
        break;
      }
      case "4": {
        if (profile.frameworkData.feedback.records.length === 0) {
          console.log(c.yellow("暂无反馈，先生成链接并收集反馈。"));
          break;
        }
        const llm = requireLLMProvider();
        console.log(c.dim("⚡ 正在分析反馈（LLM）..."));
        try {
          const analysis = await llmAnalyzeFeedback(llm, profile);
          if (analysis) {
            applyFeedbackAnalysis(profile, analysis);
            store.save();
            console.log(c.cyan("\n外部认知共识报告："));
            console.log(`  ${analysis.consensusReport}`);
            if (analysis.gaps.length > 0) {
              console.log(c.yellow("\n自我 vs 外部差异："));
              for (const g of analysis.gaps) {
                console.log(`  ⚠ ${g.trait}: 自认「${g.selfPerception}」vs 他人「${g.externalPerception}」`);
              }
            }
            console.log(c.dim(`\n一致性: ${analysis.consistency}`));
          }
        } catch (err) {
          console.log(c.red(`✗ 分析失败: ${(err as Error).message.slice(0, 120)}`));
        }
        break;
      }
      case "q":
        running = false;
        break;
      default:
        console.log(c.dim("无效选择"));
    }
  }
}

function renderRecords(profile: import("@delphi/core").UserCognitiveProfile): void {
  const records = profile.frameworkData.feedback.records;
  console.log(c.cyan("\n收到的反馈："));
  if (records.length === 0) {
    console.log(c.dim("  （暂无）"));
    return;
  }
  for (const r of records.slice(-10).reverse()) {
    console.log(`  • [${r.relationship}·${r.author}] ${r.impression.slice(0, 60)}`);
    if (r.evidence) console.log(c.dim(`    依据: ${r.evidence.slice(0, 60)}`));
  }
  console.log(hr(40));
}
