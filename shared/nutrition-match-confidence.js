/**
 * Phase 4 — match-rate confidence + optional vision retry.
 */

import { getItemNutritionTrust, summarizeItemTrust } from './nutrition-item-trust.js';

export const MATCH_RATE_THRESHOLD = 0.7;

/** Items that count toward match rate (exclude synthetic oil lines). */
export function matchableItems(items = []) {
  return (items || []).filter((item) => !item?._visionOil);
}

export function matchRateFromAnalysis(analysis = {}) {
  const items = matchableItems(analysis.items);
  if (!items.length) return 1;
  let matched = 0;
  for (const item of items) {
    if (getItemNutritionTrust(item, analysis) === 'matched') matched += 1;
  }
  return matched / items.length;
}

export function countEstimateItems(analysis = {}) {
  return matchableItems(analysis.items).filter(
    (item) => getItemNutritionTrust(item, analysis) === 'estimate',
  ).length;
}

/** True when user should see stronger portion / match checking copy. */
export function needsMatchCheckEmphasis(analysis = {}) {
  const items = matchableItems(analysis.items);
  if (!items.length) return false;
  if (matchRateFromAnalysis(analysis) >= MATCH_RATE_THRESHOLD) return false;
  return countEstimateItems(analysis) > 0;
}

/**
 * Server: run a second Gemini pass when reference matching was weak.
 * @param {object} vision — raw first-pass vision JSON
 * @param {object} composed — composed analysis after reference matching
 */
export function needsVisionRetryPass(vision = {}, composed = {}) {
  const items = matchableItems(composed.items);
  if (!items.length) return false;
  if (matchRateFromAnalysis(composed) >= MATCH_RATE_THRESHOLD) return false;
  if (countEstimateItems(composed) === 0) return false;

  const visionScore = Number(vision.confidence_score);
  const lowOverall = Number.isFinite(visionScore) && visionScore > 0 && visionScore < 0.72;
  const lowItemVision = (vision.items || []).some((item) => {
    const c = Number(item.confidence);
    return Number.isFinite(c) && c > 0 && c < 0.65;
  });

  return lowOverall || lowItemVision || matchRateFromAnalysis(composed) < MATCH_RATE_THRESHOLD;
}

/** Context for a focused second vision call. */
export function buildRetryVisionContext(vision = {}, composed = {}) {
  const unmatched = matchableItems(composed.items)
    .filter((item) => getItemNutritionTrust(item, composed) === 'estimate')
    .map((item) => item.name)
    .filter(Boolean);

  return {
    retry_reason:
      'Some items did not match our reference database. Re-examine the photo and use specific traditional dish names.',
    unmatched_item_names: unmatched,
    first_pass: {
      meal_summary: vision.meal_summary || composed.meal_summary || '',
      confidence_score: vision.confidence_score ?? composed.confidence_score,
      items: vision.items || [],
    },
  };
}

/** Keep retry result only when matching improved. */
export function isRetryImprovement(before = {}, after = {}) {
  const rateBefore = matchRateFromAnalysis(before);
  const rateAfter = matchRateFromAnalysis(after);
  if (rateAfter > rateBefore + 0.001) return true;

  const estBefore = countEstimateItems(before);
  const estAfter = countEstimateItems(after);
  if (estAfter < estBefore) return true;

  const summaryBefore = summarizeItemTrust(before.items || [], before);
  const summaryAfter = summarizeItemTrust(after.items || [], after);
  if (summaryAfter.matched > summaryBefore.matched) return true;

  return false;
}

export function matchCheckLeadText(analysis = {}) {
  const { matched, estimate, total } = summarizeItemTrust(
    matchableItems(analysis.items),
    analysis,
  );
  if (!needsMatchCheckEmphasis(analysis)) return '';
  const pct = Math.round(matchRateFromAnalysis(analysis) * 100);
  if (estimate === 1) {
    return `${matched} of ${total} matched (${pct}%) — one item is a rough estimate. Check grams or ml, or rename it if you know the dish.`;
  }
  return `${matched} of ${total} matched (${pct}%) — ${estimate} rough estimate${estimate === 1 ? '' : 's'}. Check portions before saving.`;
}
