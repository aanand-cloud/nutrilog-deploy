/**
 * Level 2.3 India nutrition override layer.
 *
 * Fast O(1) maps only. Full pack JSON is never loaded on the meal path.
 * Does not change matcher, recognition, portion defaults, or food-ref-v4.
 *
 * Priority: exact_brand → researched_generic → caller falls back to V4.
 * Branded Grade-A values apply only for an exact branded name or branded id.
 */

import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import {
  INDIA_L23_EXACT_BRAND_BY_ID,
  INDIA_L23_EXACT_BRAND_BY_NAME,
  INDIA_L23_GENERIC_BY_NAME,
  INDIA_L23_GENERIC_BY_V4_ID,
  INDIA_L23_STATS,
} from './india-nutrition-l23-index.generated.js';

export { INDIA_L23_STATS };

function brandKey(name = '') {
  return normalizeFoodAlias(name) || String(name || '').trim().toLowerCase();
}

export function getLevel23ExactBrand(id = '', exactName = '') {
  if (exactName) {
    return INDIA_L23_EXACT_BRAND_BY_NAME[brandKey(exactName)]
      || INDIA_L23_EXACT_BRAND_BY_NAME[String(exactName).trim().toLowerCase()]
      || null;
  }
  if (id && INDIA_L23_EXACT_BRAND_BY_ID[id]) return INDIA_L23_EXACT_BRAND_BY_ID[id];
  return null;
}

export function getLevel23Generic(id = '', exactName = '') {
  if (exactName) {
    const named = INDIA_L23_GENERIC_BY_NAME[brandKey(exactName)]
      || INDIA_L23_GENERIC_BY_NAME[String(exactName).trim().toLowerCase()];
    if (named) return named;
  }
  if (!id || !INDIA_L23_STATS.genericOverrideCount) return null;
  return INDIA_L23_GENERIC_BY_V4_ID[id] || null;
}

/**
 * @param {string} id
 * @param {{ exactName?: string }} [opts]
 * @returns {object|null}
 */
export function resolveLevel23Nutrition(id = '', opts = {}) {
  const exactName = opts.exactName || '';
  const exact = getLevel23ExactBrand(id, exactName);
  if (exact) return exact;
  return getLevel23Generic(id, exactName);
}

export function applyLevel23Overlay(ref, overlay) {
  if (!ref || !overlay) return ref;
  const next = {
    ...ref,
    kcal100: overlay.kcal100,
    nutrition_source: overlay.nutrition_source,
    nutrition_confidence: overlay.nutrition_confidence || null,
    preparation_confidence: overlay.preparation_confidence || null,
    portion_confidence: overlay.portion_confidence || null,
    evidence_grade: overlay.evidence_grade || null,
    nutrition_basis: overlay.nutrition_basis || ref.nutrition_basis,
    dataSource: overlay.dataSource || overlay.nutrition_source,
    _level23: overlay.nutrition_source,
  };
  if (overlay.protein100 != null) next.protein100 = overlay.protein100;
  if (overlay.carbs100 != null) next.carbs100 = overlay.carbs100;
  if (overlay.fat100 != null) next.fat100 = overlay.fat100;
  if (overlay.fibre100 != null) next.fibre100 = overlay.fibre100;
  if (overlay.kcal100Low != null) next.kcal100Low = overlay.kcal100Low;
  if (overlay.kcal100High != null) next.kcal100High = overlay.kcal100High;
  return next;
}

/**
 * Recognition / portion / preparation / nutrition stay independent.
 * @param {object} [overlay]
 * @param {object} [matchMeta]
 */
export function level23ConfidenceSignals(overlay = {}, matchMeta = {}) {
  return {
    recognition: matchMeta.confidence || matchMeta.recognition_confidence || null,
    portion: matchMeta.portion_confidence || overlay.portion_confidence || null,
    preparation: matchMeta.preparation_confidence || overlay.preparation_confidence || null,
    nutrition: overlay.nutrition_confidence || matchMeta.nutrition_confidence || null,
  };
}
