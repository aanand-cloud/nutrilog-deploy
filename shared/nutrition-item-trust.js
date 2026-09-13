/**
 * Per-item nutrition confidence (Phase 3 — Matched vs Estimate badges).
 */

/** @typedef {'label' | 'matched' | 'estimate'} ItemNutritionTrust */

/**
 * @param {object} item
 * @param {object} [analysis]
 * @returns {ItemNutritionTrust}
 */
export function getItemNutritionTrust(item = {}, analysis = {}) {
  if (item._labelBacked || analysis._labelBacked) return 'label';
  if (analysis.source === 'barcode' || analysis.source === 'food_search' || analysis.barcode) return 'label';

  const per100Source = item._per100?.source;
  if (item._nutritionSource === 'ai_estimate' || per100Source === 'ai_estimate') return 'estimate';
  if (item._nutritionSource === 'decomposed_lookup' || per100Source === 'decomposed_lookup') return 'matched';
  if (item._refId && !item._nutritionFallback && per100Source !== 'fallback' && per100Source !== 'derived') {
    return 'matched';
  }
  if (per100Source === 'label') return 'label';
  if (per100Source === 'reference' || per100Source === 'reference_v4') return 'matched';
  return 'estimate';
}

export const ITEM_TRUST_META = {
  label: {
    badge: 'Label',
    title: 'Nutrition from product label — best for sugar and salt when listed',
  },
  matched: {
    badge: 'Matched',
    title: 'Matched to our food database — tweak grams or ml if the portion looks off',
  },
  estimate: {
    badge: 'Estimate',
    title: 'Rough fallback — adjust portion, rename the dish, or report it if missing from our database',
  },
};

/**
 * @param {object[]} items
 * @param {object} [analysis]
 */
export function summarizeItemTrust(items = [], analysis = {}) {
  let matched = 0;
  let estimate = 0;
  let label = 0;
  for (const item of items) {
    const trust = getItemNutritionTrust(item, analysis);
    if (trust === 'label') label += 1;
    else if (trust === 'matched') matched += 1;
    else estimate += 1;
  }
  return { matched, estimate, label, total: items.length };
}

export function photoScanTrustLead(analysis = {}) {
  const { matched, estimate, label, total } = summarizeItemTrust(analysis.items || [], analysis);
  if (label > 0 && matched === 0 && estimate === 0) {
    return 'Pack label data — best accuracy for sugar and salt when listed.';
  }
  if (total === 0) return 'Check each item before saving.';
  if (estimate === 0 && matched > 0) {
    return `${matched} item${matched === 1 ? '' : 's'} matched to our food database — tweak grams or ml if portions look off.`;
  }
  if (matched === 0) {
    return 'Rough estimates — adjust portions on review; barcode scan is best for packaged foods.';
  }
  return `${matched} matched · ${estimate} estimate — adjust grams or ml if anything looks wrong.`;
}
