/**
 * Best-effort parse of model JSON. Gemini occasionally drops commas between
 * array/object elements, which otherwise fails the whole photo scan.
 */

function extractJsonObject(text = '') {
  let s = String(text || '').trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start >= 0 && end > start) return s.slice(start, end + 1);
  return s;
}

function repairJsonText(text = '') {
  let s = String(text || '');
  // trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // missing commas between values
  s = s.replace(/}\s*{/g, '},{');
  s = s.replace(/]\s*\[/g, '],[');
  s = s.replace(/}\s*\[/g, '},[');
  s = s.replace(/]\s*{/g, '],{');
  // "Coffee"\n      "unit":
  s = s.replace(/"\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '","$1":');
  // "Small cup"\n      "Regular mug"
  s = s.replace(/"\s+"/g, '","');
  // 250\n      "unit":
  s = s.replace(/(\d+(?:\.\d+)?)\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '$1,"$2":');
  s = s.replace(/(true|false|null)\s+"([A-Za-z_][A-Za-z0-9_]*)"\s*:/g, '$1,"$2":');
  s = s.replace(/"\s+(?=[{\[])/g, '",');
  s = s.replace(/(\d+(?:\.\d+)?)\s+(?=[{\[])/g, '$1,');
  s = s.replace(/(true|false|null)\s+(?=[{\[])/g, '$1,');
  return s;
}

export function parseLooseJson(text) {
  const raw = String(text || '').trim();
  if (!raw) throw new Error('Could not parse model JSON');
  const extracted = extractJsonObject(raw);
  const candidates = [raw, extracted, repairJsonText(extracted)];
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
  err.userMessage = 'Could not read that photo — try again, or type the drink in Describe.';
  throw err;
}

export function isJsonParseError(message = '') {
  return /JSON|parse model JSON|after array element|after property value|Unexpected token/i.test(String(message || ''));
}
