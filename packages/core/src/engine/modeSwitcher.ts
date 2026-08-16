/** delphi — analysis-mode switching. Explicit slash commands only; no content rules. */
import { AnalysisMode } from "../models/types";

export interface ModeSwitchResult {
  mode: AnalysisMode;
  reason: string;
}

const SWITCH_TABLE: Array<{ prefixes: string[]; mode: AnalysisMode; reason: string }> = [
  { prefixes: ["/stealth", "/talk"], mode: "stealth", reason: "switched to stealth mode" },
  { prefixes: ["/transparent", "/analyze"], mode: "transparent", reason: "switched to transparent mode" },
  { prefixes: ["/guide", "/deep"], mode: "meta_guide", reason: "switched to guide mode" },
];

/** All recognized slash-command prefixes (for command detection). */
export const MODE_COMMANDS = SWITCH_TABLE.flatMap((e) => e.prefixes);

/** Resolve an explicit mode-switch command; returns null when input is not a switch. */
export function resolveModeSwitch(input: string): ModeSwitchResult | null {
  const cmd = input.trim().toLowerCase();
  for (const entry of SWITCH_TABLE) {
    if (entry.prefixes.some((p) => cmd.startsWith(p))) {
      return { mode: entry.mode, reason: entry.reason };
    }
  }
  return null;
}

/** Whether the input is a recognized mode command. */
export function isModeCommand(input: string): boolean {
  return resolveModeSwitch(input) !== null;
}
