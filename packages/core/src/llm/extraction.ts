/**
 * delphi — LLM-driven structured extraction.
 * Replaces the former rule-based keyword extraction: all cognitive content
 * (values, talents, skills, themes, drives, threat control-split) is now
 * extracted by the LLM from the user's raw answers.
 */
import { LLMAgent } from "./agent";

/** Generic schema-driven extraction; null on failure. */
async function extract<T>(
  provider: LLMAgent,
  instruction: string,
  schema: string,
  input: string
): Promise<T | null> {
  try {
    return await provider.completeJSON<T>({
      messages: [{ role: "user", content: `${instruction}\n\n${input}` }],
      schema,
      temperature: 0.2,
    });
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// V-T-D values
// ---------------------------------------------------------------------------

export interface ValuesExtraction {
  anchors: string[];
  conflicts: string[];
}

const VALUES_SCHEMA = `{
  anchors: string[],    // 2-6 value anchors (short phrases like "freedom", "growth")
  conflicts: string[]   // value tensions, e.g. "freedom vs stability"
}`;

export async function llmExtractValues(provider: LLMAgent, text: string): Promise<ValuesExtraction | null> {
  return extract<ValuesExtraction>(
    provider,
    "You are delphi's value analyst. Extract the user's core value anchors and any tensions between them from their answers. Keep anchors short and concrete.",
    VALUES_SCHEMA,
    `User's answers:\n${text.slice(0, 4000)}`
  );
}

// ---------------------------------------------------------------------------
// V-T-D dreams (intrinsic drives)
// ---------------------------------------------------------------------------

export interface DrivesExtraction {
  pureDrives: string[];
  externalMotives: string[];
}

const DRIVES_SCHEMA = `{
  pureDrives: string[],       // intrinsic drives (activities done for their own sake)
  externalMotives: string[]   // external motives to filter out (money, status, others' expectations)
}`;

export async function llmExtractDrives(provider: LLMAgent, text: string): Promise<DrivesExtraction | null> {
  return extract<DrivesExtraction>(
    provider,
    "You are delphi's dream analyst. Separate intrinsic drives (things the user would do even without money, recognition, or approval) from external motives (money, status, others' expectations).",
    DRIVES_SCHEMA,
    `User's answers:\n${text.slice(0, 4000)}`
  );
}

// ---------------------------------------------------------------------------
// SIGN talent areas
// ---------------------------------------------------------------------------

export interface TalentExtraction {
  areas: string[];
}

const TALENT_SCHEMA = `{
  areas: string[]   // 1-4 talent domains inferred from the four SIGN signals
}`;

export async function llmExtractTalentAreas(provider: LLMAgent, signals: Record<string, string>): Promise<TalentExtraction | null> {
  const text = Object.entries(signals)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return extract<TalentExtraction>(
    provider,
    "You are delphi's talent analyst. From the four SIGN signals (Success, Instinct, Growth, Needs), infer the user's talent domains. Cross-validate across the four signals.",
    TALENT_SCHEMA,
    text.slice(0, 4000)
  );
}

// ---------------------------------------------------------------------------
// SWOT control-circle split (gravity vs anchor)
// ---------------------------------------------------------------------------

export interface ThreatSplitExtraction {
  gravity: string[];
  anchor: string[];
}

const THREAT_SCHEMA = `{
  gravity: string[],   // threats the user cannot control (accept as environment)
  anchor: string[]     // threats the user can control (actionable problems)
}`;

export async function llmSplitThreats(provider: LLMAgent, threats: string[]): Promise<ThreatSplitExtraction | null> {
  return extract<ThreatSplitExtraction>(
    provider,
    "You are delphi's SWOT analyst. Split the user's listed threats into two groups: gravity problems (uncontrollable, accept as environment) and anchor problems (controllable, actionable). Keep the original wording.",
    THREAT_SCHEMA,
    threats.map((t, i) => `${i + 1}. ${t}`).join("\n")
  );
}

// ---------------------------------------------------------------------------
// Achievement skills
// ---------------------------------------------------------------------------

export interface SkillsExtraction {
  skills: string[];
}

const SKILLS_SCHEMA = `{
  skills: string[]   // 2-6 transferable skills evidenced by the STAR story
}`;

export async function llmExtractSkills(provider: LLMAgent, text: string): Promise<SkillsExtraction | null> {
  return extract<SkillsExtraction>(
    provider,
    "You are delphi's achievement analyst. Extract the transferable skills evidenced by the user's STAR story — including skills they may not realize they used.",
    SKILLS_SCHEMA,
    `STAR story:\n${text.slice(0, 4000)}`
  );
}

// ---------------------------------------------------------------------------
// Daily-feedback themes
// ---------------------------------------------------------------------------

export interface ThemesExtraction {
  themes: string[];
}

const THEMES_SCHEMA = `{
  themes: string[]   // 1-4 recurring themes (e.g. "work", "relationships", "autonomy")
}`;

export async function llmExtractThemes(provider: LLMAgent, texts: string[]): Promise<ThemesExtraction | null> {
  return extract<ThemesExtraction>(
    provider,
    "You are delphi's daily-feedback analyst. Extract the recurring themes behind the user's satisfying and unsatisfying events.",
    THEMES_SCHEMA,
    texts.map((t) => `- ${t}`).join("\n").slice(0, 4000)
  );
}

// ---------------------------------------------------------------------------
// Life-design multiple-lives common elements
// ---------------------------------------------------------------------------

export interface CommonElementsExtraction {
  commonElements: string[];
  coreDrive: string;
}

const COMMON_SCHEMA = `{
  commonElements: string[],   // elements shared across the three life scenarios
  coreDrive: string           // the single core intrinsic drive (one short phrase)
}`;

export async function llmExtractCommonElements(
  provider: LLMAgent,
  answers: Record<string, string>
): Promise<CommonElementsExtraction | null> {
  const text = Object.entries(answers)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  return extract<CommonElementsExtraction>(
    provider,
    "You are delphi's life-design analyst. The user described three alternative life scenarios. Find the elements shared across all three (what they want regardless of conditions) and identify the single core intrinsic drive. Write the core drive in the user's language.",
    COMMON_SCHEMA,
    text.slice(0, 4000)
  );
}

// ---------------------------------------------------------------------------
// Capability hidden-strength cross-validation
// ---------------------------------------------------------------------------

export interface HiddenStrengthExtraction {
  hiddenStrengths: string[];
}

const HIDDEN_SCHEMA = `{
  hiddenStrengths: string[]   // capabilities rated low but evidenced in the archive
}`;

export async function llmFindHiddenStrengths(
  provider: LLMAgent,
  selfRatings: string,
  evidence: string
): Promise<HiddenStrengthExtraction | null> {
  return extract<HiddenStrengthExtraction>(
    provider,
    "You are delphi's capability analyst. The user self-rated their capabilities and some scored low. Cross-check the low-rated capabilities against the evidence from their achievement stories, SIGN signals and SWOT strengths. Return capabilities they rated low but actually evidence suggests they have.",
    HIDDEN_SCHEMA,
    `Self-ratings (low):\n${selfRatings}\n\nEvidence:\n${evidence.slice(0, 4000)}`
  );
}
