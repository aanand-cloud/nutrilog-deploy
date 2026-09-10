/**
 * P1 — lightweight rename / closest-dish fallback when match rate is low (no re-scan).
 */

import { refDisplayName } from './description-anchor.js';
import { FOOD_REFERENCES } from './food-references.js';
import { getItemNutritionTrust } from './nutrition-item-trust.js';
import {
  matchableItems,
  needsMatchCheckEmphasis,
} from './nutrition-match-confidence.js';
import {
  calibrateItemWithReference,
  matchFoodReference,
} from './nutrition-density.js';
import { sanitizeAnalysisTotals } from './nutrition-sanitize.js';

const VAGUE_STOP = new Set([
  'side', 'mystery', 'unknown', 'mixed', 'plate', 'food', 'item', 'sauce',
  'with', 'and', 'the', 'some', 'portion', 'dish', 'rough', 'estimate',
]);

const POPULAR_FALLBACK_IDS = [
  'chicken_curry',
  'plain_rice',
  'dal_tadka',
  'mixed_veg',
  'salad',
];

/** Photo AI scan — not barcode, search, or voice describe. */
export function isPhotoScanAnalysis(analysis = {}) {
  if (analysis._labelBacked || analysis._voiceEstimate) return false;
  const source = analysis.source || '';
  if (source === 'barcode' || source === 'food_search' || source === 'voice') return false;
  if (analysis.barcode) return false;
  return source === 'photo' || Boolean(analysis.photo_path);
}

/** Show rename / pick-closest UI on adjust and review. */
export function needsP1FallbackUi(analysis = {}) {
  if (!isPhotoScanAnalysis(analysis)) return false;
  return needsMatchCheckEmphasis(analysis);
}

/** Estimate items with their index in analysis.items. */
export function listEstimateItemEntries(analysis = {}) {
  const entries = [];
  (analysis.items || []).forEach((item, index) => {
    if (item?._visionOil) return;
    if (getItemNutritionTrust(item, analysis) !== 'estimate') return;
    entries.push({ index, item });
  });
  return entries;
}

function tokenizeItemName(name = '') {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !VAGUE_STOP.has(token));
}

/**
 * Suggest closest database dishes for a vague item name.
 * @param {string} name
 * @param {{ limit?: number }} [opts]
 * @returns {{ refId: string, label: string }[]}
 */
export function suggestDishNamesForItem(name = '', { limit = 4 } = {}) {
  const raw = String(name || '').trim();
  if (!raw) return [];

  const tokens = tokenizeItemName(raw);
  const rawLower = raw.toLowerCase();
  const scored = [];

  for (const ref of FOOD_REFERENCES) {
    const display = refDisplayName(ref.id);
    const idText = ref.id.replace(/_/g, ' ');
    let score = 0;

    if (ref.re.test(rawLower)) score += 45;
    if (display.toLowerCase() === rawLower) score += 60;

    for (const token of tokens) {
      if (idText.includes(token)) score += 10;
      if (display.toLowerCase().includes(token)) score += 8;
    }

    if (/\b(stew|curry|gravy|dal|sauce|soup)\b/i.test(raw)
      && /\b(curry|dal|masala|stew|soup|gravy)\b/i.test(ref.id)) {
      score += 6;
    }

    if (score > 0) {
      scored.push({ refId: ref.id, label: display, score });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  const seen = new Set();
  const out = [];
  for (const row of scored) {
    if (seen.has(row.refId)) continue;
    if (row.label.toLowerCase() === rawLower) continue;
    seen.add(row.refId);
    out.push({ refId: row.refId, label: row.label });
    if (out.length >= limit) break;
  }

  if (out.length) return out;

  return POPULAR_FALLBACK_IDS
    .map((id) => FOOD_REFERENCES.find((ref) => ref.id === id))
    .filter(Boolean)
    .slice(0, limit)
    .map((ref) => ({ refId: ref.id, label: refDisplayName(ref.id) }));
}

/**
 * Rename one item and recalibrate from the food database.
 * @param {object} analysis
 * @param {number} itemIndex
 * @param {string | { refId?: string, label?: string }} choice
 */
export function applyItemDishRename(analysis = {}, itemIndex, choice) {
  const items = [...(analysis.items || [])];
  const item = items[itemIndex];
  if (!item) return analysis;

  const label = typeof choice === 'object' && choice?.label
    ? String(choice.label).trim()
    : String(choice || '').trim();
  if (!label) return analysis;

  let refId = typeof choice === 'object' && choice?.refId ? choice.refId : undefined;
  if (!refId) {
    const matched = matchFoodReference(label);
    refId = matched?.id;
  }

  const renamed = {
    ...item,
    name: label,
    _nutritionFallback: undefined,
    _refId: refId || undefined,
    _per100: undefined,
  };

  items[itemIndex] = calibrateItemWithReference(renamed);
  return sanitizeAnalysisTotals({
    ...analysis,
    items,
    _p1FallbackApplied: true,
  });
}

/** Count estimate items after fallback (for tests). */
export function countEstimateItemsAfterFallback(analysis = {}) {
  return matchableItems(analysis.items).filter(
    (item) => getItemNutritionTrust(item, analysis) === 'estimate',
  ).length;
}
