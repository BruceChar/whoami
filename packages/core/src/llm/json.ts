/** delphi — robust JSON extraction from LLM output. */

/** Extract the first balanced JSON object/array from text */
export function extractJSON(text: string): unknown | null {
  if (!text) return null;
    // strip code fences
  const fenced = text.replace(/```(?:json)?\s*([\s\S]*?)```/g, "$1");
  const start = fenced.search(/[[{]/);
  if (start === -1) return null;
  const open = fenced[start];
  const close = open === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < fenced.length; i++) {
    const ch = fenced[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) {
        const candidate = fenced.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Extract and parse as T; null on failure */
export function extractJSONAs<T>(text: string): T | null {
  const value = extractJSON(text);
  return value === null || value === undefined ? null : (value as T);
}
