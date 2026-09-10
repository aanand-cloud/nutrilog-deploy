/**
 * Phase 5 — structured weight provenance for every meal component.
 */

import { phraseHasExplicitQuantity } from './quantity-parser.js';
import { getVerifiedRecord } from './verified-nutrition.js';
import { defaultPieceGramsForCanonical } from './canonical-food-identity.js';

export const WEIGHT_ORIGINS = {
  USER_MEASURED: 'user_measured',
  USER_DECLARED: 'user_declared',
  PIECE_COUNT_INFERRED: 'piece_count_inferred',
  PHOTO_ESTIMATED: 'photo_estimated',
  DEFAULT_PORTION: 'default_portion',
  RECIPE_ESTIMATED: 'recipe_estimated',
};

export const WEIGHT_SCOPES = {
  WHOLE_FINISHED_DISH: 'whole_finished_dish',
  INDIVIDUAL_COMPONENT: 'individual_component',
};

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * Infer weight origin from pipeline item fields.
 * @param {object} item
 * @param {object} [parsed]
 */
export function inferWeightOrigin(item = {}, parsed = null) {
  if (item._weightOrigin) return item._weightOrigin;
  if (item._recipeDerived) return WEIGHT_ORIGINS.RECIPE_ESTIMATED;
  if (item._visionMeta || item._weightSource === 'photo') return WEIGHT_ORIGINS.PHOTO_ESTIMATED;
  if (item._weightSource === 'measured' || item._userWeightConfirmed) return WEIGHT_ORIGINS.USER_MEASURED;

  const bound = item._boundQuantity || parsed;
  if (bound && phraseHasExplicitQuantity(bound)) {
    if (bound.unit === 'piece' || bound.kind === 'count') {
      return WEIGHT_ORIGINS.PIECE_COUNT_INFERRED;
    }
    return WEIGHT_ORIGINS.USER_MEASURED;
  }

  if (item._weightSource === 'recipe') return WEIGHT_ORIGINS.RECIPE_ESTIMATED;
  if (item._weightSource === 'default' || !item._boundQuantity) return WEIGHT_ORIGINS.DEFAULT_PORTION;
  return WEIGHT_ORIGINS.USER_DECLARED;
}

/**
 * Infer whether weight applies to whole dish or one component.
 * @param {object} item
 * @param {object} [analysis]
 */
export function inferWeightScope(item = {}, analysis = {}) {
  if (item._weightScope) return item._weightScope;
  const phrases = analysis._sourcePhrases || [];
  const isSinglePhrase = phrases.length <= 1 && (analysis.items || []).length <= 1;
  const blob = `${analysis._sourceText || ''} ${item.name || ''}`.toLowerCase();
  if (isSinglePhrase && /\b\d+\s*g\b/.test(blob)
    && /\b(biryani|curry|korma|masala|biryani|risotto|paella|lasagne|stew|soup|porridge|poha)\b/.test(blob)) {
    return WEIGHT_SCOPES.WHOLE_FINISHED_DISH;
  }
  return WEIGHT_SCOPES.INDIVIDUAL_COMPONENT;
}

/**
 * Build structured weight provenance for one item.
 * @param {object} item
 * @param {object} [opts]
 */
export function buildWeightProvenance(item = {}, opts = {}) {
  const parsed = opts.parsed || null;
  const analysis = opts.analysis || {};
  const bound = item._boundQuantity || (parsed && phraseHasExplicitQuantity(parsed) ? {
    amount: parsed.amount ?? parsed.quantity,
    unit: parsed.unit,
    kind: parsed.kind,
  } : null);

  const convertedWeightGrams = num(item._hiddenGrams);
  const baselineWeightGrams = num(item._baselineWeightGrams ?? item._hiddenGrams);
  const currentScale = num(item._currentScale ?? 1) || 1;
  const weightOrigin = inferWeightOrigin(item, parsed);
  const weightScope = inferWeightScope(item, analysis);

  let portionDescription = item.portion_estimate || '';
  if (weightOrigin === WEIGHT_ORIGINS.PIECE_COUNT_INFERRED && bound?.unit === 'piece') {
    const pieceG = defaultPieceGramsForCanonical(item._refId, getVerifiedRecord(item._refId))
      || (convertedWeightGrams > 0 && bound.amount > 0 ? convertedWeightGrams / bound.amount : 0);
    if (pieceG > 0 && bound.amount > 0) {
      portionDescription = `Estimated from ${bound.amount} piece${bound.amount > 1 ? 's' : ''} at ${Math.round(pieceG)} g each`;
    }
  } else if (weightOrigin === WEIGHT_ORIGINS.USER_MEASURED) {
    portionDescription = bound?.unit === 'ml'
      ? `Amount entered by user (${Math.round(bound.amount)} ml)`
      : `Amount entered by user (${Math.round(convertedWeightGrams)} g)`;
  } else if (weightOrigin === WEIGHT_ORIGINS.DEFAULT_PORTION) {
    portionDescription = `Default portion (~${Math.round(convertedWeightGrams)} g)`;
  }

  return {
    enteredAmount: bound?.amount ?? null,
    enteredUnit: bound?.unit ?? null,
    convertedWeightGrams,
    baselineWeightGrams,
    currentScale,
    weightOrigin,
    weightScope,
    portionDescription,
    isEditable: !item._labelBacked && !item._unmatched,
  };
}

/**
 * Attach weight provenance to all items and compute total meal weight.
 * @param {object} analysis
 */
export function attachWeightProvenance(analysis = {}) {
  const items = (analysis.items || []).map((item, index) => {
    const parsed = item._sourcePhrase
      ? { phrase: item._sourcePhrase, ...item._boundQuantity }
      : null;
    const weightProvenance = buildWeightProvenance(item, { analysis, parsed });
    return {
      ...item,
      _weightProvenance: weightProvenance,
      _weightOrigin: weightProvenance.weightOrigin,
      _weightScope: weightProvenance.weightScope,
      _baselineWeightGrams: item._baselineWeightGrams ?? weightProvenance.baselineWeightGrams,
    };
  });

  const totalMealWeightGrams = items.reduce(
    (sum, item) => sum + num(item._weightProvenance?.convertedWeightGrams),
    0,
  );

  return {
    ...analysis,
    items,
    _totalMealWeightGrams: Math.round(totalMealWeightGrams),
    _weightProvenanceComplete: items.every((item) => Boolean(item._weightProvenance)),
  };
}

/**
 * Human-readable weight origin label for review UI.
 * @param {string} origin
 */
export function weightOriginLabel(origin = '') {
  const labels = {
    [WEIGHT_ORIGINS.USER_MEASURED]: 'Entered by you',
    [WEIGHT_ORIGINS.USER_DECLARED]: 'Declared amount',
    [WEIGHT_ORIGINS.PIECE_COUNT_INFERRED]: 'Estimated from piece count',
    [WEIGHT_ORIGINS.PHOTO_ESTIMATED]: 'Estimated from photo',
    [WEIGHT_ORIGINS.DEFAULT_PORTION]: 'Default portion',
    [WEIGHT_ORIGINS.RECIPE_ESTIMATED]: 'Recipe estimate',
  };
  return labels[origin] || 'Estimated';
}
