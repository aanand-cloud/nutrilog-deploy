/**
 * Phase 2 — Authoritative nutrition foundation.
 * V4/Tier-1 refs are for recognition; CoFID/IFCT/USDA verified records supply nutrition.
 */

import { parsePreparationState } from './quantity-parser.js';
import { resolveFoodReferenceById } from './nutrition-density.js';
import {
  getVerifiedRecord,
  enrichReferenceWithVerified,
  isVerifiedFoodId,
  verifiedProvenanceLabel,
} from './verified-nutrition.js';
import {
  nutrientsForEdibleWeight,
  estimatedKcalFromMacros,
  isAllowedZeroKcal,
} from './canonical-food-model.js';

export const PHASE2_TARGETS = {
  nutritionArithmetic: 0.999,
  falseZeroKcal: 0,
  commonFoodCoverage: 0.95,
  weighedSimpleFoodsWithin10Pct: 0.95,
};

/** Source priority — lower index wins when multiple authoritative records exist. */
export const SOURCE_PRIORITY = [
  'cofid',
  'ifct',
  'usda',
  'manufacturer',
  'restaurant',
  'recipe',
];

function resolveRefRow(refId = '') {
  const resolved = resolveFoodReferenceById(refId);
  return resolved?.ref || resolved || null;
}

function refWithVerified(refId = '') {
  const row = resolveRefRow(refId);
  if (row?.id) return enrichReferenceWithVerified(row);
  const verified = getVerifiedRecord(refId);
  if (!verified) return null;
  return enrichReferenceWithVerified({
    id: verified.id,
    kcal100: verified.kcal100,
    protein100: verified.protein100,
    carbs100: verified.carbs100,
    fat100: verified.fat100,
    fibre100: verified.fibre100,
    sugar100: verified.sugar100,
    salt100: verified.salt100,
    canonicalName: verified.canonicalName,
    preparationState: verified.preparationState,
  });
}

/**
 * Canonical verified id for a matched ref (handles Tier-1 → verified aliases).
 * @param {string} refId
 */
export function canonicalRefIdForMatch(refId = '') {
  const verified = getVerifiedRecord(refId);
  return verified?.id || refId;
}

/**
 * @param {string} dataSource
 * @returns {boolean}
 */
export function isAuthoritativeSource(dataSource = '') {
  const src = String(dataSource || '').toLowerCase();
  return ['cofid', 'ifct', 'usda', 'manufacturer', 'restaurant'].includes(src);
}

/**
 * Route matched ref to verified raw/cooked variant using preparation state.
 * @param {object|null} ref
 * @param {string} foodText
 */
export function applyPreparationRefOverride(ref, foodText = '') {
  if (!ref?.id) return ref;
  const prep = parsePreparationState(foodText);
  const lower = String(foodText).toLowerCase();

  const oatsFamily = ref.id === 'porridge' || ref.id === 'porridge_water' || ref.id === 'oats'
    || ref.id === 'overnight_oats' || /\boats\b|\boatmeal\b|\bporridge\b/.test(lower);

  if (oatsFamily) {
    if (prep.state === 'dry' || /\bdry\b|\braw\b|\buncooked\b|\brolled\b/.test(lower)) {
      return refWithVerified('oats') || ref;
    }
    if (/\bporridge\s+oats\b/.test(lower) && !/\bcooked\b|\bprepared\b|\bready\b|\bwith\s+(water|milk)\b/.test(lower)) {
      return refWithVerified('oats') || ref;
    }
    if (/\bwith\s+water\b|\bwater\s+only\b|\bno\s+milk\b/.test(lower)) {
      return refWithVerified('porridge_water') || ref;
    }
    const finishedPorridge = prep.state === 'cooked'
      || /\bporridge\b(?!\s+oats\b)|\bcooked\s+porridge\b|\bprepared\s+porridge\b|\bovernight\b/.test(lower);
    if (finishedPorridge) {
      if (/\bwith\s+milk\b|\bmilk\b/.test(lower)) {
        return refWithVerified('porridge') || ref;
      }
      if (/\bwater\b/.test(lower)) {
        return refWithVerified('porridge_water') || ref;
      }
      if (/\bporridge\b(?!\s+oats\b)/.test(lower)) {
        return refWithVerified('porridge') || ref;
      }
    }
    if (ref.id === 'porridge' && /\boats\b|\boatmeal\b/.test(lower) && !/\bcooked\b/.test(lower)) {
      return refWithVerified('oats') || ref;
    }
  }

  const NAMED_RICE_REF_IDS = new Set([
    'jollof_rice', 'party_jollof', 'ofada_rice', 'rice_and_stew', 'waakye',
    'biryani', 'pilau', 'pilaf', 'fried_rice', 'jambalaya',
  ]);
  const NAMED_RICE_DISH_RE = /\b(?:jollof|ofada|waakye|pilau|pilaf|biryani|fried\s+rice|risotto|paella|congee|kedgeree|rice\s+and\s+stew|designer|ayamase)\b/i;

  if (NAMED_RICE_REF_IDS.has(ref.id) || NAMED_RICE_DISH_RE.test(lower)) {
    return ref;
  }

  const riceFamily = ref.id === 'rice' || ref.id === 'plain_rice' || ref.id === 'basmati_rice'
    || ref.id === 'white_rice' || ref.id === 'cooked_rice'
    || (/\brice\b|\bbasmati\b|\bchawal\b/.test(lower) && !/\bfried\s+rice\b|\bbiryani\b/.test(lower));
  if (riceFamily) {
    if (prep.state === 'dry' || /\bdry\b|\braw\b|\buncooked\b/.test(lower)) {
      return ref;
    }
    if (/\bbasmati\b/.test(lower)) {
      return refWithVerified('basmati_rice') || ref;
    }
    return refWithVerified('cooked_rice') || refWithVerified('white_rice') || ref;
  }

  const potatoFamily = ref.id === 'potatoes' || ref.id === 'potato'
    || /\bpotato/.test(lower);
  if (potatoFamily) {
    if (prep.state === 'fried' || /\bfried\b|\bchips\b|\bwedges\b/.test(lower)) {
      return refWithVerified('fries') || ref;
    }
    if (prep.state === 'cooked' || /\bboiled\b|\bmash\b|\broast\b|\bbaked\b/.test(lower)) {
      return refWithVerified('potatoes') || ref;
    }
  }

  return ref;
}

/**
 * Deterministic nutrition from verified record when available.
 * @param {object|null} ref
 * @param {number} grams
 */
export function nutritionForAuthoritativeAmount(ref, grams = 0) {
  const verified = getVerifiedRecord(ref?.id);
  if (verified && grams > 0) {
    return nutrientsForEdibleWeight(verified, grams);
  }
  return null;
}

/**
 * Attach authoritative metadata and canonical ref id to a line item.
 * @param {object} item
 * @param {object|null} ref
 */
export function applyAuthoritativeNutritionToItem(item, ref = null) {
  if (!item || item._unmatched) return item;

  const canonicalId = canonicalRefIdForMatch(ref?.id || item._refId || '');
  const verified = getVerifiedRecord(ref?.id || item._refId || '');
  const grams = Number(item._hiddenGrams)
    || Number(item.grams)
    || Number(item._visionMeta?.amount)
    || 0;

  let next = {
    ...item,
    _refId: canonicalId,
    _authoritative: Boolean(verified),
    _nutritionSource: ref?.nutrition_source || verified?.dataSource || ref?.dataSource || 'internal_estimated',
    _provenanceLabel: verifiedProvenanceLabel(verified || ref),
  };

  if (verified && grams > 0) {
    const authoritative = nutritionForAuthoritativeAmount(ref || { id: canonicalId }, grams);
    if (authoritative) {
      next = {
        ...next,
        calories_kcal: authoritative.calories_kcal,
        nutrition: authoritative.nutrition,
        _nutrientAvailability: authoritative._nutrientAvailability,
      };
    }
  }

  if (next._canonical) {
    next._canonical = {
      ...next._canonical,
      verificationStatus: verified?.verificationStatus || next._canonical.verificationStatus,
      dataSource: verified?.dataSource || next._canonical.dataSource,
      nutritionBasis: verified?.nutrition_basis || next._canonical.nutritionBasis,
    };
  }

  return next;
}

/**
 * Macro–kcal consistency check for authoritative items.
 * @param {object} item
 * @param {number} [tolerance=0.08]
 */
export function authoritativeArithmeticOk(item, tolerance = 0.08) {
  const stated = Number(item?.calories_kcal) || 0;
  if (stated <= 0) {
    return isAllowedZeroKcal(item?._refId, stated);
  }
  const macroKcal = estimatedKcalFromMacros(item?.nutrition || {});
  if (macroKcal <= 0) return true;
  const tol = item?._authoritative ? 0.2 : tolerance;
  return Math.abs(macroKcal - stated) <= stated * tol;
}

/**
 * @param {string} refId
 * @returns {boolean}
 */
export function hasAuthoritativeNutrition(refId = '') {
  return isVerifiedFoodId(refId);
}
