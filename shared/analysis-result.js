/** Shared analysis-result helpers — safe for client, tests, and Netlify functions. */

import { parseLooseJson } from './json-repair.js';

export function parseAnalysisPayload(analysis) {
  if (!analysis) return null;
  if (typeof analysis === 'string') {
    try {
      return parseLooseJson(analysis);
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
