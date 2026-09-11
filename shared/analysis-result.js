/** Shared analysis-result helpers — safe for client, tests, and Netlify functions. */

export function parseAnalysisPayload(analysis) {
  if (!analysis) return null;
  if (typeof analysis === 'string') {
    const match = analysis.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
  return analysis;
}

/** True when analysis contains at least one named food component. */
export function hasUsefulFoodItems(analysis) {
  const parsed = parseAnalysisPayload(analysis);
  const items = parsed?.items;
  if (!Array.isArray(items) || !items.length) return false;
  return items.some((item) => item && String(item.name || '').trim());
}
