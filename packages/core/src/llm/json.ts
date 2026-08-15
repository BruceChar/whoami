/**
 * delphi —— LLM 输出的健壮 JSON 提取
 * 处理代码围栏、前后缀文本、嵌套括号等常见噪音。
 */

/** 提取文本中第一个平衡的 JSON 对象/数组 */
export function extractJSON(text: string): unknown | null {
  if (!text) return null;
  // 去掉代码围栏
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

/** 提取并尝试解析为指定类型；失败返回 null */
export function extractJSONAs<T>(text: string): T | null {
  const value = extractJSON(text);
  return value === null || value === undefined ? null : (value as T);
}
