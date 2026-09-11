/**
 * Canonical food record model — evidence-based nutrition engine types and utilities.
 * Layer A/B/C records map into this shape; calculation is always per 100 g or 100 ml.
 */

/** @typedef {'verified' | 'manufacturer' | 'restaurant_reviewed' | 'estimated' | 'recipe_derived'} VerificationStatus */

/** @typedef {'cofid' | 'ifct' | 'usda' | 'manufacturer' | 'restaurant' | 'internal_estimated' | 'recipe'} DataSource */

/**
 * @typedef {object} CanonicalFoodRecord
 * @property {string} id
 * @property {string} canonicalName
 * @property {string[]} aliases
 * @property {string} [country]
 * @property {string} [cuisine]
 * @property {'raw' | 'cooked' | 'drained' | 'fried' | 'baked' | 'roasted' | 'boiled'} [preparationState]
 * @property {number} [ediblePortionPct]
 * @property {{ label: string, grams?: number, ml?: number }[]} [standardPortions]
 * @property {number} kcal100
 * @property {number} protein100
 * @property {number} carbs100
 * @property {number} fat100
 * @property {number} [fibre100]
 * @property {number} [sugar100]
 * @property {number} [satFat100]
 * @property {number} [salt100]
 * @property {number} [sodiumMg100]
 * @property {DataSource} dataSource
 * @property {string} [sourceRecordId]
 * @property {VerificationStatus} verificationStatus
 * @property {number} dataQualityScore
 * @property {string} [lastReviewedAt]
 * @property {string} [regionalVariant]
 * @property {number} [densityGPerMl]
 * @property {'existing_reference' | 'estimated_reference' | 'verified_cofid' | 'verified_ifct' | 'verified_usda' | 'recipe_derived'} [nutritionBasis]
 */

export const VERIFICATION_META = {
  verified: { label: 'Reference match verified by MealNova', score: 95 },
  manufacturer: { label: 'Manufacturer label', score: 90 },
  restaurant_reviewed: { label: 'Reviewed restaurant data', score: 75 },
  recipe_derived: { label: 'Recipe model', score: 70 },
  estimated: { label: 'Estimated reference', score: 45 },
};

/** Zero-calorie items that legitimately have no energy. */
export const ZERO_KCAL_ALLOWLIST = new Set([
  'water',
  'black_tea',
  'black_coffee',
  'diet_cola',
  'sparkling_water',
]);

/** Convert sodium (mg) to salt (mg) — UK FSA factor. */
export function sodiumMgToSaltMg(sodiumMg) {
  return Math.round(num(sodiumMg) * 2.5);
}

/** Convert salt (mg) to sodium (mg). */
export function saltMgToSodiumMg(saltMg) {
  return Math.round(num(saltMg) / 2.5);
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Atwater energy with optional fibre term (UK/EU often uses 2 kcal/g fibre).
 * @param {object} nutrition
 * @param {{ includeFibre?: boolean }} [opts]
 */
export function estimatedKcalFromMacros(nutrition = {}, { includeFibre = true } = {}) {
  let kcal = num(nutrition.protein_g) * 4
    + num(nutrition.carbs_g) * 4
    + num(nutrition.fat_g) * 9;
  if (includeFibre) kcal += num(nutrition.fibre_g) * 2;
  return Math.round(kcal);
}

/**
 * Deterministic nutrient total from verified per-100g values.
 * @param {CanonicalFoodRecord|object} ref
 * @param {number} edibleGrams
 */
export function nutrientsForEdibleWeight(ref, edibleGrams) {
  const g = Math.max(0, num(edibleGrams));
  const factor = g / 100;
  const hasSalt = ref.salt100 != null;
  const hasFibre = ref.fibre100 != null;
  const hasSugar = ref.sugar100 != null;
  const salt100 = hasSalt
    ? ref.salt100
    : (ref.sodiumMg100 != null ? sodiumMgToSaltMg(ref.sodiumMg100) : null);

  const nutrition = {
    protein_g: round1(num(ref.protein100) * factor),
    carbs_g: round1(num(ref.carbs100) * factor),
    fat_g: round1(num(ref.fat100) * factor),
    fibre_g: hasFibre ? round1(num(ref.fibre100) * factor) : null,
    sugar_g: hasSugar ? round1(num(ref.sugar100) * factor) : null,
    salt_mg: hasSalt || ref.sodiumMg100 != null ? Math.round(num(salt100) * factor) : null,
  };

  return {
    calories_kcal: Math.round(num(ref.kcal100) * factor),
    nutrition,
    _nutrientAvailability: {
      fibre_g: hasFibre ? 'known' : 'not_available',
      sugar_g: hasSugar ? 'known' : 'not_available',
      salt_mg: (hasSalt || ref.sodiumMg100 != null) ? 'known' : 'not_available',
    },
  };
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

/**
 * Map Tier-1 / V4 ref row to canonical shape.
 * @param {object} ref
 * @param {object} [meta]
 * @returns {CanonicalFoodRecord}
 */
export function canonicalFromReference(ref, meta = {}) {
  if (!ref) return null;
  const basis = ref.nutrition_basis || meta.nutrition_basis || 'existing_reference';
  const verificationStatus = ref.verificationStatus
    || (basis === 'estimated_reference' ? 'estimated' : 'verified');
  const dataSource = ref.dataSource
    || (basis.startsWith('verified_') ? basis.replace('verified_', '') : 'internal_estimated');

  return {
    id: ref.id,
    canonicalName: ref.canonicalName || ref.id.replace(/_/g, ' '),
    aliases: meta.matched_alias ? [meta.matched_alias] : [],
    country: ref.country || meta.country,
    cuisine: ref.cuisine || meta.cuisine,
    preparationState: ref.preparationState,
    kcal100: ref.kcal100,
    protein100: ref.protein100,
    carbs100: ref.carbs100,
    fat100: ref.fat100,
    fibre100: ref.fibre100,
    sugar100: ref.sugar100,
    salt100: ref.salt100,
    dataSource,
    sourceRecordId: ref.sourceRecordId || ref.id,
    verificationStatus,
    dataQualityScore: ref.dataQualityScore
      ?? VERIFICATION_META[verificationStatus]?.score
      ?? 50,
    lastReviewedAt: ref.lastReviewedAt,
    nutritionBasis: basis,
  };
}

/**
 * Check macro/kcal consistency — returns issue or null.
 * @param {object} nutrition
 * @param {number} statedKcal
 * @param {{ tolerance?: number }} [opts]
 */
export function checkEnergyMacroConsistency(nutrition = {}, statedKcal = 0, { tolerance = 0.15 } = {}) {
  const macroKcal = estimatedKcalFromMacros(nutrition);
  const stated = num(statedKcal);
  if (stated <= 20 || macroKcal <= 0) return null;
  if (Math.abs(macroKcal - stated) > stated * tolerance) {
    return {
      code: 'macro_kcal_drift',
      stated,
      macroKcal,
      message: `Stated ${stated} kcal vs macro estimate ${macroKcal} kcal.`,
    };
  }
  return null;
}

/**
 * Block zero-kcal for matched foods unless allowlisted.
 * @param {string} refId
 * @param {number} kcal
 */
export function isAllowedZeroKcal(refId = '', kcal = 0) {
  if (num(kcal) > 0) return true;
  return ZERO_KCAL_ALLOWLIST.has(String(refId).toLowerCase());
}

/**
 * Implausible kcal per 100g for solid foods (outside water/diet drinks).
 * @param {number} kcal100
 */
export function isImplausibleKcalPer100(kcal100) {
  const k = num(kcal100);
  return k > 900 || (k < 5 && k > 0);
}
