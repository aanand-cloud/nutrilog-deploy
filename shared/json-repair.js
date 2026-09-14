/**
 * Best-effort parse of model JSON. Gemini occasionally drops commas or
 * truncates output when thinking tokens eat the maxOutputTokens budget.
 */

function stripFences(text = '') {
  return String(text || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonObject(text = '') {
  const s = stripFences(text);
  const start = s.indexOf('{');
  if (start < 0) return s;
  const end = s.lastIndexOf('}');
  if (end > start) return s.slice(start, end + 1);
  return s.slice(start);
}

function repairJsonText(text = '') {
  let s = String(text || '');
  s = s.replace(/,\s*([}\]])/g, '$1');
  s = s.replace(/}\s*{/g, '},{');
  s = s.replace(/]\s*\[/g, '],[');
  s = s.replace(/}\s*\[/g, '},[');
  s = s.replace(/]\s*{/g, '],{');
  s = s.replace(/"\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '","$1":');
  s = s.replace(/"\s+"/g, '","');
  s = s.replace(/(\d+(?:\.\d+)?)\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '$1,"$2":');
  s = s.replace(/(true|false|null)\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '$1,"$2":');
  s = s.replace(/"\s+(?=[{\[])/g, '",');
  s = s.replace(/(\d+(?:\.\d+)?)\s+(?=[{\[])/g, '$1,');
  s = s.replace(/(true|false|null)\s+(?=[{\[])/g, '$1,');
  return s;
}

function closeTruncatedJson(text = '') {
  let s = repairJsonText(String(text || '').trim());
  if (!s) return s;
  const stack = [];
  let inString = false;
  let escape = false;
  for (const ch of s) {
    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }
  if (inString) s += '"';
  s = s.replace(/,\s*$/, '');
  while (stack.length) s += stack.pop();
  return s;
}

export function parseLooseJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Could not parse model JSON');
  const extracted = extractJsonObject(raw);
  const candidates = [
    raw,
    extracted,
    repairJsonText(extracted),
    closeTruncatedJson(extracted),
  ];
  const seen = new Set();
  let lastErr;
  for (const candidate of candidates) {
    if (!candidate || seen.has(candidate)) continue;
    seen.add(candidate);
    try {
      return JSON.parse(candidate);
    } catch (err) {
      lastErr = err;
    }
  }
  const err = lastErr || new Error('Could not parse model JSON');
  err.userMessage = 'Could not finish that scan — try again, or type coffee in Describe.';
  throw err;
}

export function isJsonParseError(message = '') {
  return /JSON|parse model JSON|after array element|after property value|Unexpected token|truncated/i.test(String(message || ''));
}
