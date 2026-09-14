/**
 * UK/USDA-style per-100g reference values for calibrating AI estimates.
 * Used when item name matches — nutrition scales linearly with grams/ml.
 */

import { FOOD_REFERENCES } from './food-references.js';
import {
  matchFoodReferenceDetailed,
  matchFoodReference,
  resolveFoodReferenceById,
  matchFoodReferenceTier1,
  clearFoodMatchCache,
  getFoodMatchCacheSize,
} from './food-match-engine.js';
import { parseGramsFromText as parseGramsFromQuantityParser } from './quantity-parser.js';
import { canonicalFromReference } from './canonical-food-model.js';
import { enrichReferenceWithVerified, getVerifiedRecord } from './verified-nutrition.js';
import { defaultPieceGramsForCanonical, normalizeCanonicalFoodText } from './canonical-food-identity.js';

export {
  matchFoodReferenceDetailed,
  matchFoodReference,
  resolveFoodReferenceById,
  matchFoodReferenceTier1,
  clearFoodMatchCache,
  getFoodMatchCacheSize,
};

export { FOOD_REFERENCES };

const COUNTABLE_BREAD_GRAMS = {
  dosa: 170,
  egg_dosa: 200,
  ghee_roast: 185,
  idli: 60,
  rava_idli: 65,
  parotta: 75,
  kerala_parotta: 75,
  kulcha: 80,
  rumali_roti: 45,
  tandoori_roti: 55,
  roti: 60,
  naan: 90,
  paratha: 85,
  puri: 45,
  bhatura: 120,
  pav: 50,
  bread: 35,
  wrap: 120,
};

function parseBreadCountFromText(text = '') {
  const t = normalizeCanonicalFoodText(text);
  const named = t.match(/(\d+)\s*(?:piece|pieces|dosa|dosas?|idli|idlis?|roti|naan|puri|pav)/);
  if (named) return Number(named[1]);
  if (/\b2\b|two\b/.test(t)) return 2;
  if (/\b3\b|three\b/.test(t)) return 3;
  return 1;
}

function defaultBreadGrams(refId = '', text = '') {
  const verified = getVerifiedRecord(refId);
  const pieceG = defaultPieceGramsForCanonical(refId, verified);
  if (pieceG > 0) {
    const count = parseBreadCountFromText(text);
    if (count > 1 || /\bidli\b|\bdosa\b|\broti\b|\bnaan\b|\bpuri\b|\bbhatura\b|\bbread\b|\bpav\b/i.test(text)) {
      return pieceG;
    }
  }
  if (!COUNTABLE_BREAD_GRAMS[refId]) return 0;
  if (refId === 'dosa' && /\bmasala\b/.test(text)) return 220;
  return COUNTABLE_BREAD_GRAMS[refId];
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

/** @typedef {{ id: string, re: RegExp, kcal100: number, protein100: number, carbs100: number, fat100: number, fibre100?: number, sugar100?: number, salt100?: number }} FoodRef */

/**
 * @typedef {object} FoodMatchMeta
 * @property {1|2} tier
 * @property {string} food_id
 * @property {string} id
 * @property {string} [matched_alias]
 * @property {'canonical_id'|'alias_exact'|'regex'|'disambiguated'|'fuzzy'} match_method
 * @property {'regex'|'v4_alias'} match_source
 * @property {'high'|'medium'|'low'|'none'} confidence
 * @property {'exact'|'disambiguated'|'fuzzy'|'collision'|'disabled'|'miss'} match_confidence
 * @property {string} [country]
 * @property {string} [food_type]
 * @property {string} [region]
 * @property {string} [cuisine]
 * @property {string} [nutrition_basis]
 * @property {string[]} [collision_ids]
 */

export function parseGramsFromText(text = '') {
  return parseGramsFromQuantityParser(text);
}

/** Build per-100g profile from a reference row. */
export function per100FromReference(ref) {
  if (!ref) return null;
  return {
    kcal: ref.kcal100,
    protein_g: ref.protein100,
    carbs_g: ref.carbs100,
    fat_g: ref.fat100,
    fibre_g: ref.fibre100 != null ? ref.fibre100 : null,
    sugar_g: ref.sugar100 != null ? ref.sugar100 : null,
    salt_mg: ref.salt100 != null ? ref.salt100 : null,
    refId: ref.id,
    dataSource: ref.dataSource,
    nutrition_source: ref.nutrition_source || null,
    sourceRecordId: ref.sourceRecordId,
    verificationStatus: ref.verificationStatus,
    nutritionBasis: ref.nutrition_basis,
    preparationState: ref.preparationState,
    dataVersion: ref.dataVersion,
    standardPortionGrams: ref.standardPortionGrams,
  };
}

/** Build per-100g from current item values (fallback when no reference). */
export function per100FromItemValues(item, grams) {
  if (!grams || grams <= 0) return null;
  const n = item.nutrition || {};
  const kcal = Number(item.calories_kcal) || 0;
  const factor = 100 / grams;
  return {
    kcal: kcal * factor,
    protein_g: (Number(n.protein_g) || 0) * factor,
    carbs_g: (Number(n.carbs_g) || 0) * factor,
    fat_g: (Number(n.fat_g) || 0) * factor,
    fibre_g: (Number(n.fibre_g) || 0) * factor,
    sugar_g: (Number(n.sugar_g) || 0) * factor,
    salt_mg: (Number(n.salt_mg) || 0) * factor,
    refId: null,
  };
}

export function resolvePer100ForItem(item) {
  if (item._per100?.kcal) return item._per100;
  if (item._refId) {
    const byId = resolveFoodReferenceById(item._refId);
    if (byId?.ref) return per100FromReference(enrichReferenceWithVerified(byId.ref));
  }
  const text = `${item.name || ''} ${item.portion_estimate || ''}`;
  const grams = parseGramsFromText(item.portion_estimate) || parseGramsFromText(item.name) || Number(item.grams) || 0;
  const ref = matchFoodReference(text);
  if (ref) return per100FromReference(ref);
  return per100FromItemValues(item, grams);
}

export function nutritionForAmount(per100, amount) {
  if (!per100 || !amount || amount <= 0) {
    return {
      calories_kcal: 0,
      nutrition: { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: null, sugar_g: null, salt_mg: null },
    };
  }
  const f = amount / 100;
  return {
    calories_kcal: Math.round(per100.kcal * f),
    nutrition: {
      protein_g: round1(per100.protein_g * f),
      carbs_g: round1(per100.carbs_g * f),
      fat_g: round1(per100.fat_g * f),
      fibre_g: per100.fibre_g != null ? round1(per100.fibre_g * f) : null,
      sugar_g: per100.sugar_g != null ? round1(per100.sugar_g * f) : null,
      salt_mg: per100.salt_mg != null ? Math.round(per100.salt_mg * f) : null,
    },
  };
}

const DRINK_REF_PREFIX = /^(coffee|tea|beer|wine|soft_drink|juice|lassi|chai|water|irn_bru|pimms|gin_tonic|bubble_tea|hot_chocolate|protein_shake|spirits|milk)/;

/** Strict Atwater 4-4-9 kcal from macro grams. */
export function kcalFromAtwater(nutrition = {}) {
  return Math.round(
    (Number(nutrition.protein_g) || 0) * 4
    + (Number(nutrition.carbs_g) || 0) * 4
    + (Number(nutrition.fat_g) || 0) * 9,
  );
}

function inferPortionUnit(item = {}) {
  if (item._portionUnit === 'ml' || item._portionUnit === 'g') return item._portionUnit;
  if (item._volumeMl > 0) return 'ml';
  const text = `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
  if (item._refId && DRINK_REF_PREFIX.test(item._refId)) return 'ml';
  if (/\b(ml|millilitre|milliliter|cup|glass|pint|shot)\b/i.test(text)) return 'ml';
  if (/\b(coffee|tea|latte|juice|smoothie|cola|wine|beer|water|milk|drink|beverage)\b/i.test(text)) return 'ml';
  return 'g';
}

function inferPortionAmount(item = {}, unit = 'g') {
  if (unit === 'ml') {
    if (item._volumeMl > 0) return Math.round(item._volumeMl);
    const fromPortion = parseGramsFromText(item.portion_estimate);
    if (fromPortion > 0) return Math.round(fromPortion);
    const fromName = parseGramsFromText(item.name);
    if (fromName > 0) return Math.round(fromName);
    return 250;
  }
  const fromPortion = parseGramsFromText(item.portion_estimate);
  if (fromPortion > 0) return Math.round(fromPortion);
  const fromName = parseGramsFromText(item.name);
  if (fromName > 0) return Math.round(fromName);
  if (item._hiddenGrams > 0) return Math.round(item._hiddenGrams);
  return 120;
}

/** Persist per-100g anchor on an item for instant portion rescaling. */
export function attachPer100ToItem(item = {}) {
  if (item._per100?.protein_g != null) {
    return {
      ...item,
      _portionUnit: item._portionUnit || inferPortionUnit(item),
    };
  }

  const unit = inferPortionUnit(item);
  const amount = inferPortionAmount(item, unit);

  if (shouldSkipReferenceCalibration(item)) {
    const per100 = per100FromItemValues(item, amount);
    if (!per100) return item;
    return {
      ...item,
      _per100: {
        kcal: per100.kcal,
        protein_g: per100.protein_g,
        carbs_g: per100.carbs_g,
        fat_g: per100.fat_g,
        fibre_g: per100.fibre_g != null ? per100.fibre_g : null,
        sugar_g: per100.sugar_g != null ? per100.sugar_g : null,
        salt_mg: per100.salt_mg != null ? per100.salt_mg : null,
        refId: null,
        source: 'label',
      },
      _portionUnit: unit,
    };
  }

  const text = `${item.name || ''} ${item.portion_estimate || ''}`;
  let { ref, meta: matchMeta } = item._refId
    ? resolveFoodReferenceById(item._refId)
    : { ref: null, meta: null };
  if (!ref) {
    ({ ref, meta: matchMeta } = matchFoodReferenceDetailed(text));
  }
  ref = enrichReferenceWithVerified(ref);
  const per100 = ref ? per100FromReference(ref) : per100FromItemValues(item, amount);

  if (!per100) return item;

  const per100Source = ref
    ? (matchMeta?.tier === 2 || ref._v4 ? 'reference_v4' : 'reference')
    : 'derived';

  const canonical = item._canonical
    || (ref && matchMeta ? canonicalFromReference(ref, matchMeta) : null);

  return {
    ...item,
    _per100: {
      kcal: per100.kcal,
      protein_g: per100.protein_g,
      carbs_g: per100.carbs_g,
      fat_g: per100.fat_g,
      fibre_g: per100.fibre_g != null ? per100.fibre_g : null,
      sugar_g: per100.sugar_g != null ? per100.sugar_g : null,
      salt_mg: per100.salt_mg != null ? per100.salt_mg : null,
      refId: per100.refId || item._refId || null,
      source: per100Source,
      dataSource: per100.dataSource || canonical?.dataSource,
      sourceRecordId: per100.sourceRecordId || canonical?.sourceRecordId,
      verificationStatus: per100.verificationStatus || canonical?.verificationStatus,
      nutritionBasis: per100.nutritionBasis || canonical?.nutritionBasis,
    },
    _portionUnit: unit,
    _refId: item._refId || per100.refId || undefined,
    ...(matchMeta ? { _matchMeta: matchMeta } : {}),
    ...(canonical ? { _canonical: canonical } : {}),
  };
}

/**
 * Rescale item macros from stored per-100g anchor (instant, no API).
 * Uses Atwater 4-4-9 for kcal when anchored to a reference profile.
 */
export function rescaleItemFromPer100(item = {}, amount, unit = 'g') {
  const enriched = item._per100 ? item : attachPer100ToItem(item);
  const per100 = enriched._per100;
  if (!per100 || !amount || amount <= 0) return null;

  const scaled = nutritionForAmount(per100, amount);
  const nutrition = scaled.nutrition;
  const useAtwater = !item._authoritative
    && per100.source !== 'reference'
    && per100.source !== 'reference_v4'
    && !per100.refId
    && !item._refId;
  const calories_kcal = useAtwater ? kcalFromAtwater(nutrition) : scaled.calories_kcal;

  return {
    ...enriched,
    portion_estimate: unit === 'ml' ? `~${Math.round(amount)}ml` : `~${Math.round(amount)}g`,
    calories_kcal,
    nutrition,
    _per100: per100,
    _portionUnit: unit,
    _refId: enriched._refId || per100.refId || undefined,
    ...(unit === 'ml' ? { _volumeMl: Math.round(amount) } : { _hiddenGrams: Math.round(amount) }),
  };
}

/** Items whose nutrition must not be overwritten by generic food references. */
export function shouldSkipReferenceCalibration(item = {}) {
  return Boolean(
    item._labelBacked
    || item._localClarify
    || item._fromBarcode
    || item._authoritative
    || item._fromUserNotes
    || item._aiNutritionFallback
    || item._aiDecomposed
    || item._recipeDerived,
  );
}

/** Recalibrate one AI item using reference food data when grams are known. */
export function calibrateItemWithReference(item) {
  if (shouldSkipReferenceCalibration(item)) return item;
  const text = `${item.name || ''} ${item.portion_estimate || ''}`;
  const { ref, meta } = item._refId
    ? resolveFoodReferenceById(item._refId)
    : matchFoodReferenceDetailed(text);
  if (!ref) return item;

  let grams = parseGramsFromText(item.portion_estimate) || parseGramsFromText(item.name);
  if (!grams || grams <= 0) {
    if (ref.id === 'egg') grams = 58;
    else if (/^(coffee|tea|beer|wine|soft_drink|juice|lassi|chai|water|irn_bru|pimms|gin_tonic)/.test(ref.id)) grams = 250;
    else if (defaultBreadGrams(ref.id, text)) {
      const count = parseBreadCountFromText(text);
      grams = defaultBreadGrams(ref.id, text) * count;
    }
    else if (ref.id === 'samosa' || ref.id === 'dumpling' || ref.id === 'scotch_egg' || ref.id === 'sausage_roll') grams = 80;
    else if (ref.id === 'crumpet' || ref.id === 'scone') grams = 55;
    else if (ref.id === 'mince_pie' || ref.id === 'eccles_cake') grams = 60;
    else if (/biryani/.test(ref.id) && !/shorba|side/.test(ref.id)) grams = /hyderabadi_/.test(ref.id) ? 380 : 350;
    else grams = 120;
    item = {
      ...item,
      _portionSource: 'default_fallback',
      _portionSourceDetail: /biryani/.test(ref.id) && !/shorba|side/.test(ref.id)
        ? (/hyderabadi_/.test(ref.id) ? 'hyderabadi_biryani_default_380g' : 'biryani_default_350g')
        : 'catalog_default',
      portion_estimate: ref.id === 'egg'
        ? '1 medium egg (~58g)'
        : /^(coffee|tea|beer|wine|soft_drink|juice|lassi|chai|water|irn_bru|pimms|gin_tonic)/.test(ref.id)
          ? `${grams}ml`
          : defaultBreadGrams(ref.id, text)
            ? `${parseBreadCountFromText(text)} piece${parseBreadCountFromText(text) > 1 ? 's' : ''} (~${grams}g)`
            : `${grams}g`,
    };
  }

  const per100 = per100FromReference(ref);
  const scaled = nutritionForAmount(per100, grams);
  const pickMicro = (key) => {
    const fromScaled = scaled.nutrition[key];
    if (fromScaled != null) return key === 'salt_mg' ? Math.round(fromScaled) : round1(fromScaled);
    const fromItem = item.nutrition?.[key];
    if (fromItem != null) return key === 'salt_mg' ? Math.round(Number(fromItem)) : round1(Number(fromItem));
    return null;
  };
  const nutrition = {
    ...(item.nutrition || {}),
    protein_g: scaled.nutrition.protein_g,
    carbs_g: scaled.nutrition.carbs_g,
    fat_g: scaled.nutrition.fat_g,
    fibre_g: pickMicro('fibre_g'),
    sugar_g: pickMicro('sugar_g'),
    salt_mg: pickMicro('salt_mg'),
  };
  const useStatedKcal = per100.kcal > 0;
  return attachPer100ToItem({
    ...item,
    portion_estimate: item.portion_estimate || `${grams}g`,
    calories_kcal: useStatedKcal ? scaled.calories_kcal : kcalFromAtwater(nutrition),
    nutrition,
    _refId: ref.id,
    _matchMeta: meta || undefined,
    _portionUnit: /^(coffee|tea|beer|wine|soft_drink|juice|lassi|chai|water|irn_bru|pimms|gin_tonic)/.test(ref.id) ? 'ml' : 'g',
  });
}
