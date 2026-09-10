/**
 * Controlled fuzzy alias fallback — prefix-bucketed, threshold-gated, unique-best only.
 */

import { V4_FUZZY_BUCKETS } from './food-ref-v4-index.generated.js';

function levenshtein(a, b) {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  return 1 - dist / Math.max(a.length, b.length);
}

/** Minimum similarity to accept a fuzzy alias hit. */
export const FUZZY_MATCH_THRESHOLD = 0.9;

/**
 * @param {string} normalized
 * @param {number} [threshold]
 * @returns {{ id: string, alias: string, score: number } | null}
 */
export function fuzzyAliasLookup(normalized = '', threshold = FUZZY_MATCH_THRESHOLD) {
  if (!normalized || normalized.length < 4) return null;

  const prefix = normalized.slice(0, 4);
  const bucket = V4_FUZZY_BUCKETS[prefix];
  if (!bucket?.length) return null;

  let best = null;
  let secondBest = 0;

  for (const [alias, id] of bucket) {
    const score = similarity(normalized, alias);
    if (score < threshold) continue;
    if (!best || score > best.score) {
      secondBest = best?.score || 0;
      best = { id, alias, score };
    } else if (score > secondBest) {
      secondBest = score;
    }
  }

  if (!best) return null;
  if (secondBest >= threshold && Math.abs(best.score - secondBest) < 0.02) return null;
  return best;
}
