/** delphi — tool templates (methodology templates triggered by "/" in chat). */
export interface ToolTemplate {
  id: string;
  label: string;
  emoji: string;
  description: string;
  /** System prompt for conducting this tool (appended after the mirror principle). */
  prompt: string;
}

const MIRROR_NOTE =
  "Conduct rule: ask one question at a time and wait for the answer; never judge or interrupt. After all questions, reflect back the patterns that emerged from the user's answers. Write in the user's language.";

export const TOOL_TEMPLATES: ToolTemplate[] = [
  {
    id: "vtd",
    label: "V-T-D Exploration",
    emoji: "🧭",
    description: "Values-talents-dreams: deep three-layer exploration",
    prompt: `Run the V-T-D exploration tool. Ask in order: values (admired people, non-negotiables, what matters most), talents (SIGN: what comes easily / what you instinctively do / what you learn fast / what feels fulfilling), then dreams (what you would do without money or recognition).\n${MIRROR_NOTE}\nAfter all questions, extract the user's value anchors and intrinsic drives, and reflect them back (e.g. "I notice you keep returning to freedom and creation — these may be your value anchors").`,
  },
  {
    id: "sign",
    label: "SIGN Talent detection",
    emoji: "✨",
    description: "Success/Instinct/Growth/Needs signals",
    prompt: `Run the SIGN talent-detection tool. Ask about the four signals: Success (what you do better than others), Instinct (what you're drawn to do), Growth (what you learn fast / enter flow in), Needs (what leaves you fulfilled rather than empty).\n${MIRROR_NOTE}\nAfterward, cross-validate the four signals and reflect the user's talent domains back.`,
  },
  {
    id: "swot",
    label: "SWOT Analysis",
    emoji: "🔍",
    description: "Strengths/Weaknesses/Opportunities/Threats (enhanced)",
    prompt: `Run the SWOT analysis tool. Ask about Strengths, Weaknesses, Opportunities, and Threats, probing each quadrant (e.g. "what is the shadow side of this strength?", "is this a fact or your interpretation?").\n${MIRROR_NOTE}\nAfterward, split threats into controllable (anchor problems) and uncontrollable (gravity problems), and reflect both back.`,
  },
  {
    id: "achievement",
    label: "Achievement extraction",
    emoji: "🏆",
    description: "STAR deep dive + skill extraction",
    prompt: `Run the achievement-event (STAR) extraction. Ask about Situation/Task, Action, Result, and long-term impact.\n${MIRROR_NOTE}\nAfterward, extract the transferable skills evidenced by the story — including skills the user may not realize they used — and reflect them back.`,
  },
  {
    id: "interest",
    label: "Interest matrix",
    emoji: "🎨",
    description: "Four-quadrant energy rating",
    prompt: `Run the interest matrix. Ask the user to rate (0-5) their energy on four activity types: creative, analytical, independent, and social.\n${MIRROR_NOTE}\nAfterward, point out their high-energy quadrants and any energy conflicts.`,
  },
  {
    id: "daily",
    label: "Daily feedback",
    emoji: "📝",
    description: "Today's satisfying/unsatisfying + why",
    prompt: `Run the daily-feedback tool. Ask about one satisfying event and why, then one unsatisfying event and why.\n${MIRROR_NOTE}\nAfterward, record the recurring themes behind the satisfying and unsatisfying drivers.`,
  },
  {
    id: "career",
    label: "Career analysis",
    emoji: "💼",
    description: "Employment vs startup fit",
    prompt: `Run the career analysis. First call get_cognitive_profile to read the cognitive profile, then based on value anchors, energy flows, and talent signals, output: work-form recommendation (employment / startup / freelance), content directions, and pitfalls to avoid. Use the second person "you" and the user's language.`,
  },
  {
    id: "life",
    label: "Life design",
    emoji: "🌱",
    description: "Connect The Dots / multiple lives",
    prompt: `Run the life-design tool. Call get_cognitive_profile to read the profile, then: 1) Connect The Dots — align "what you believe" with "what you do" and point out gaps; 2) multiple-life hypotheses — ask: what if you continue the current path for 5 years / what if your core skill were replaced by AI / what would you choose if money and reputation didn't exist; 3) find the common element across the three = the core intrinsic drive.`,
  },
];

export function getToolTemplate(id: string): ToolTemplate | undefined {
  return TOOL_TEMPLATES.find((t) => t.id === id);
}
