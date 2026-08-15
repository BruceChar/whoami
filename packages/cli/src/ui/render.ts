/**
 * delphi —— CLI 渲染工具（ASCII 艺术 + 盒式边框 + 进度条）
 */
import chalk from "chalk";

export const c = chalk;

/** 显示宽度：CJK 全角字符按 2 列计（终端渲染宽度） */
export function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const code = ch.codePointAt(0) || 0;
    if (code >= 0x2e80 && code <= 0x9fff) w += 2; // CJK 部首/汉字
    else if (code >= 0xf900 && code <= 0xfaff) w += 2; // CJK 兼容
    else if (code >= 0xff00 && code <= 0xff60) w += 2; // 全角符号
    else if (code >= 0x1f300 && code <= 0x1faff) w += 2; // emoji
    else if (code >= 0x20000 && code <= 0x2ffff) w += 2; // 扩展汉字
    else w += 1;
  }
  return w;
}

/** 按显示宽度截断 */
export function truncate(s: string, maxWidth: number): string {
  let w = 0;
  let out = "";
  for (const ch of s) {
    const cw = displayWidth(ch);
    if (w + cw > maxWidth) break;
    out += ch;
    w += cw;
  }
  return out;
}

/** 盒式边框 */
export function box(title: string, lines: string[], width = 60): string {
  const inner = width - 4;
  const titleLine = title ? ` ${title} ` : "";
  const pad = Math.max(0, width - 2 - displayWidth(titleLine));
  const head = `┌${titleLine}${"─".repeat(pad)}┐`;
  const body = lines.map((l) => {
    const visible = displayWidth(l) > inner ? truncate(l, inner - 1) + "…" : l;
    return `│ ${visible}${" ".repeat(inner - displayWidth(visible))} │`;
  });
  const foot = `└${"─".repeat(width - 2)}┘`;
  return [head, ...body, foot].join("\n");
}

/** 横线 */
export function hr(width = 60, char = "━"): string {
  return char.repeat(width);
}

/** 进度条 */
export function progressBar(value: number, width = 20): string {
  const v = Math.max(0, Math.min(1, value));
  const filled = Math.round(v * width);
  const bar = "█".repeat(filled) + "░".repeat(width - filled);
  const pct = `${(v * 100).toFixed(0)}%`;
  return `${bar} ${pct}`;
}

/** ASCII 火花线（成长曲线迷你图） */
export function sparkline(values: number[], width = 20): string {
  if (values.length === 0) return "(数据不足)";
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const chars = "▁▂▃▄▅▆▇█";
  const step = Math.max(1, Math.floor(values.length / width));
  const sampled = values.filter((_, i) => i % step === 0 || i === values.length - 1);
  return sampled
    .map((v) => chars[Math.min(7, Math.max(0, Math.floor(((v - min) / range) * 7)))])
    .join("");
}

/** 分节标题 */
export function section(title: string): string {
  return `${hr(20, "─")} ${title} ${hr(20, "─")}`;
}

/** 简单柱状对比（两个时间点的维度对比） */
export function deltaBar(before: number, after: number, width = 12): string {
  const max = Math.max(before, after, 0.01);
  const b = Math.round((before / max) * width);
  const a = Math.round((after / max) * width);
  return `前 ${"█".repeat(b)}${"░".repeat(width - b)} → 后 ${"█".repeat(a)}${"░".repeat(width - a)}`;
}
