/**
 * Phase 4 — recipe decomposition for photo / vision payloads.
 * Composes full analysis from Gemini identification + portions using the same
 * canonical pipeline as Describe (verified per-100g, null micros, confidence).
 */

import {
  attachPer100ToItem,
  calibrateItemWithReference,
  kcalFromAtwater,
  matchFoodReference,
  matchFoodReferenceDetailed,
  nutritionForAmount,
  parseGramsFromText,
  resolveFoodReferenceById,
} from './nutrition-density.js';
import { cookingMethodMultiplier } from './cooking-methods.js';
import { applyMealValidation, sanitizeAnalysisTotals } from './nutrition-sanitize.js';
import { decomposeVisionWithRecipes } from './vision-recipe-compose.js';
import { scoreMealConfidence } from './nutrition-confidence.js';
import { applyAuthoritativeNutritionToItem } from './authoritative-nutrition.js';
import { normalizeCanonicalFoodText } from './canonical-food-identity.js';
import { itemProvenanceSummary } from './nutrition-provenance.js';
import {
  canonicalPieceGrams,
  isBreadItemText,
  parseExplicitPieceCount,
  resolveBreadReference,
} from './bread-piece-grams.js';
import { countToNutritionGrams } from './portion-models.js';

const FALLBACK_PER100 = {
  kcal: 130,
  protein_g: 8,
  carbs_g: 10,
  fat_g: 6,
  fibre_g: null,
  sugar_g: null,
  salt_mg: null,
  refId: null,
  source: 'fallback',
};

const ZERO_DRINK_RE = /\b(pepsi\s*max|diet\s+pepsi|coke\s*zero|coca[ -]?cola\s*zero|diet\s+coke|7\s*up\s*free|sprite\s*zero|tango[^,]*sugar[ -]?free|zero[ -]?sugar|sugar[ -]?free|diet\s+(?:cola|soda|soft\s*drink))\b/i;
const PREPARED_FOOD_RE = /\b(pizza|burger|fries|chips|wedges|fried\s+chicken|chicken\s+(?:wings|nuggets|strips)|kfc|mcdonald'?s|pizza\s*hut|domino'?s|burger\s*king|nando'?s|subway|greggs)\b/i;
const OIL_GRAMS_PER_TBSP = 14;
const GENERIC_VISION_IDS = new Set([
  'rice', 'plain_rice', 'cooked_rice', 'dal', 'chicken', 'bread', 'oil',
  'cooking_oil', 'doughnut', 'fritter', 'paneer', 'potato', 'egg', 'pakhala',
  'rice_cakes',
]);
const USDA_DESCRIPTOR = /^(cooked|raw|fried|deep fried|steamed|grilled|baked|boiled|roasted|white|brown|long-grain|short-grain|stuffed|plain)$/i;

// Official UK chain values are per sold item/serving, not generic per-100g foods.
// The catalogue is intentionally small and exact: uncertain product names continue
// through the generic matcher instead of receiving a guessed brand value.
const BRANDED_SERVINGS = [
  {
    id: 'kfc_uk_fillet_burger',
    re: /\bkfc\b.*\b(?:(?:original\s+recipe\s+)?(?:fillet|chicken)\s+burger|original\s+recipe\s+burger)\b/i,
    name: 'KFC Fillet Burger', kcal: 463,
    nutrition: { protein_g: 28.8, carbs_g: 43, fat_g: 18.7, fibre_g: null, sugar_g: 6.5, salt_mg: 2200 },
  },
  {
    id: 'kfc_uk_signature_fries_regular',
    re: /\bkfc\b.*\b(?:signature\s+)?(?:fries|chips|potato\s+wedges)\b/i,
    name: 'KFC Regular Signature Fries', kcal: 261,
    nutrition: { protein_g: 3.1, carbs_g: 38, fat_g: 9.8, fibre_g: null, sugar_g: 0.5, salt_mg: 740 },
  },
];

function round1(v) {
  return Math.round(v * 10) / 10;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function scaleMicro(val, factor) {
  if (val == null || !Number.isFinite(Number(val))) return null;
  return round1(num(val) * factor);
}

function fixedServingItem(item, serving) {
  const amount = item._visionMeta?.amount || item._hiddenGrams || 100;
  const factor = 100 / amount;
  return {
    ...item,
    name: serving.name,
    calories_kcal: serving.kcal,
    nutrition: { ...serving.nutrition },
    _refId: serving.id,
    _authoritative: true,
    _brandedServing: true,
    _nutritionSource: 'official_brand_uk',
    _provenanceLabel: 'Official UK brand serving',
    _per100: {
      kcal: serving.kcal * factor,
      protein_g: num(serving.nutrition.protein_g) * factor,
      carbs_g: num(serving.nutrition.carbs_g) * factor,
      fat_g: num(serving.nutrition.fat_g) * factor,
      fibre_g: serving.nutrition.fibre_g == null ? null : num(serving.nutrition.fibre_g) * factor,
      sugar_g: serving.nutrition.sugar_g == null ? null : num(serving.nutrition.sugar_g) * factor,
      salt_mg: serving.nutrition.salt_mg == null ? null : num(serving.nutrition.salt_mg) * factor,
      refId: serving.id,
    },
  };
}

function safetyNutritionForVisionItem(item) {
  const text = String(item.name || '');
  if (ZERO_DRINK_RE.test(text)) {
    const amount = item._visionMeta?.amount || 250;
    const kcal = Math.max(1, Math.round(amount * 0.008));
    return fixedServingItem(item, {
      id: 'zero_sugar_soft_drink',
      name: text.trim() || 'Zero-sugar soft drink',
      kcal,
      nutrition: { protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, sugar_g: 0, salt_mg: null },
    });
  }
  const serving = BRANDED_SERVINGS.find((row) => row.re.test(text));
  return serving ? fixedServingItem(item, serving) : null;
}

/** True when Gemini returned vision-only items (no AI nutrition). */
export function isVisionAnalysis(raw = {}) {
  if (!Array.isArray(raw.items) || !raw.items.length) return false;
  const first = raw.items[0];
  if (first == null || typeof first !== 'object') return false;
  if (first.estimated_amount != null && first.unit != null) return true;
  return raw.total_calories_kcal == null && first.calories_kcal == null && first.nutrition == null;
}

function looksLikeDrink(item = {}) {
  const unit = String(item.unit || '').toLowerCase();
  const text = `${item.name || ''} ${item.portion_estimate || ''}`;
  return unit === 'ml' || unit === 'l' || /\bml\b/i.test(text) || /\b(coffee|tea|latte|chai|juice|wine|beer|soda|cola|milk|lassi|smoothie|water|drink)\b/i.test(text);
}

const VISION_MASS_SCALE = {
  kg: 1000,
  kilo: 1000,
  kilos: 1000,
  kilogram: 1000,
  kilograms: 1000,
  lb: 453.59237,
  lbs: 453.59237,
  pound: 453.59237,
  pounds: 453.59237,
  oz: 28.349523125,
  ounce: 28.349523125,
  ounces: 28.349523125,
};

const MAX_VISION_GRAMS = 15000;
const BIRYANI_PHOTO_MIN_G = 160;
const BIRYANI_PHOTO_MAX_G = 700;

function looksLikeBiryaniPlate(name = '') {
  return /\b(biryani|biriyani|pulao|pulav|pilau|pilaf)\b/i.test(String(name || ''));
}

/**
 * When vision says "2 pieces" / "3 idlis", convert with food-specific piece grams
 * instead of the generic 120 g/piece default from parseGramsFromText alone.
 */
function visionPieceCountGrams(item = {}) {
  const name = String(item.name || '').trim();
  const estimate = String(item.portion_estimate || '').trim();
  const combined = `${name} ${estimate}`.trim();
  if (!combined) return null;

  const unit = String(item.unit || '').trim().toLowerCase();
  const explicitAmt = Number(item.estimated_amount);
  const countFromUnit = (unit === 'piece' || unit === 'pieces' || unit === 'pc' || unit === 'pcs')
    && Number.isFinite(explicitAmt)
    && explicitAmt > 0
    && explicitAmt <= 12
    ? Math.round(explicitAmt)
    : 0;

  const count = countFromUnit
    || parseExplicitPieceCount(estimate)
    || parseExplicitPieceCount(combined);
  if (!count || count < 1 || count > 12) return null;

  if (isBreadItemText(name) || isBreadItemText(estimate)) {
    const breadRef = resolveBreadReference(name) || resolveBreadReference(estimate);
    const per = canonicalPieceGrams(breadRef?.id || '', name || estimate);
    if (per > 0) return Math.round(count * per);
  }

  return countToNutritionGrams(count, name || estimate);
}

function sanitizeBiryaniPhotoGrams(name, amount) {
  if (!looksLikeBiryaniPlate(name) || !Number.isFinite(amount)) return { amount, adjusted: false };
  if (amount > BIRYANI_PHOTO_MAX_G) {
    return { amount: BIRYANI_PHOTO_MAX_G, adjusted: true, detail: 'photo_biryani_max_clamp' };
  }
  if (amount < BIRYANI_PHOTO_MIN_G) {
    return { amount: BIRYANI_PHOTO_MIN_G, adjusted: true, detail: 'photo_biryani_min_clamp' };
  }
  return { amount, adjusted: false };
}

/** Convert vision estimated_amount + unit into grams or ml. Never keep kg as the stored unit. */
export function normalizeVisionPortion(item = {}) {
  const drink = looksLikeDrink(item);
  const rawUnit = String(item.unit || '').trim().toLowerCase();
  const explicit = Number(item.estimated_amount);
  const pieceGrams = visionPieceCountGrams(item);
  const parsed = parseGramsFromText(item.portion_estimate || '');
  let unit = drink ? 'ml' : 'g';
  let amount;
  let portionDetail = null;

  if (pieceGrams != null && !drink) {
    unit = 'g';
    amount = pieceGrams;
    portionDetail = 'photo_piece_count';
  } else if (Number.isFinite(explicit) && explicit > 0) {
    if (rawUnit === 'ml' || rawUnit === 'millilitre' || rawUnit === 'millilitres' || rawUnit === 'milliliter' || rawUnit === 'milliliters') {
      unit = 'ml';
      amount = explicit;
    } else if (rawUnit === 'l' || rawUnit === 'litre' || rawUnit === 'liter' || rawUnit === 'litres' || rawUnit === 'liters') {
      unit = 'ml';
      amount = explicit * 1000;
    } else if (VISION_MASS_SCALE[rawUnit]) {
      unit = 'g';
      amount = explicit * VISION_MASS_SCALE[rawUnit];
      // 2500 kg is almost certainly grams mislabelled as kg.
      if (/^kilos?$|^kilograms?$/.test(rawUnit) && amount > MAX_VISION_GRAMS && explicit <= MAX_VISION_GRAMS) {
        amount = explicit;
      }
    } else {
      amount = explicit;
    }
  } else if (parsed > 0) {
    amount = parsed;
    if (/\bml\b/i.test(item.portion_estimate || '')) unit = 'ml';
  } else {
    amount = unit === 'ml' ? 250 : 120;
  }

  amount = Math.max(1, Math.round(amount));
  if (amount > MAX_VISION_GRAMS) amount = MAX_VISION_GRAMS;

  if (unit === 'g') {
    const clamped = sanitizeBiryaniPhotoGrams(item.name || '', amount);
    if (clamped.adjusted) {
      amount = clamped.amount;
      portionDetail = clamped.detail;
    }
  }

  return { unit, amount, portionDetail };
}

function visionTokens(text = '') {
  return new Set(
    String(text)
      .toLowerCase()
      .replace(/[_,"]/g, ' ')
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length > 2 && token !== 'and' && token !== 'with'),
  );
}

function tokensOverlap(a = '', b = '') {
  const left = visionTokens(a);
  const right = visionTokens(b);
  for (const token of left) {
    if (right.has(token)) return true;
  }
  return false;
}

function matchStrength(hit = {}) {
  if (!hit?.ref?.id || hit.meta?.confidence === 'none') return 0;
  const method = hit.meta?.match_method;
  if (method === 'canonical_id' || method === 'alias_exact' || method === 'regex') {
    return hit.meta?.confidence === 'high' ? 4 : 3;
  }
  if (method === 'disambiguated') return 2;
  if (method === 'fuzzy') return 1;
  return 0;
}

function usdaCandidatePhrases(term = '') {
  return String(term)
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 2 && !USDA_DESCRIPTOR.test(part));
}

/**
 * Prefer the Gemini display name. Use comma-split usda_search_term phrases
 * only to fill a miss or upgrade a generic staple — never the raw USDA string.
 */
export function resolveVisionFoodMatch(name = '', usdaSearchTerm = '') {
  const nameHit = matchFoodReferenceDetailed(name, { useCache: false, logV4: false });
  const nameScore = matchStrength(nameHit);
  const nameGeneric = nameHit?.ref?.id ? GENERIC_VISION_IDS.has(nameHit.ref.id) : false;

  if (nameScore >= 3 && !nameGeneric) {
    return { ...nameHit, source: 'name' };
  }

  let best = nameScore > 0 ? { ...nameHit, source: 'name' } : { ref: null, meta: null, source: null };

  for (const phrase of usdaCandidatePhrases(usdaSearchTerm)) {
    const hit = matchFoodReferenceDetailed(phrase, { useCache: false, logV4: false });
    const score = matchStrength(hit);
    if (score < 3) continue;

    const overlapsName = tokensOverlap(name, hit.ref.id) || tokensOverlap(name, phrase);
    if (nameScore >= 3 && !nameGeneric && !overlapsName) continue;
    if (GENERIC_VISION_IDS.has(hit.ref.id) && nameScore >= 3 && !nameGeneric) continue;
    if (!overlapsName && nameScore >= 2) continue;

    const betterSpecific = nameGeneric && !GENERIC_VISION_IDS.has(hit.ref.id) && overlapsName;
    const fillsMiss = !best.ref && (overlapsName || !GENERIC_VISION_IDS.has(hit.ref.id));
    const longerSpecific = best.ref
      && overlapsName
      && !GENERIC_VISION_IDS.has(hit.ref.id)
      && hit.ref.id.length > best.ref.id.length;

    if (betterSpecific || fillsMiss || longerSpecific) {
      best = { ...hit, source: 'usda_phrase' };
    }
  }

  return best.ref ? best : (nameHit.ref ? { ...nameHit, source: 'name' } : { ref: null, meta: null, source: null });
}

/** Keep identification + grams only. Discard any model calories/macros. */
export function toVisionIdentification(raw = {}) {
  return {
    meal_summary: raw.meal_summary || '',
    confidence_score: raw.confidence_score,
    notes: raw.notes || '',
    clarification_questions: raw.clarification_questions || [],
    items: (raw.items || []).map((item = {}) => {
      const name = String(item.name || 'Food').trim() || 'Food';
      const { unit, amount, portionDetail } = normalizeVisionPortion(item);
      const oilTbsp = Number(item.estimated_oil_tbsp);
      return {
        name,
        usda_search_term: String(item.usda_search_term || '').trim(),
        estimated_amount: amount,
        unit,
        cooking_method: item.cooking_method || '',
        estimated_oil_tbsp: Number.isFinite(oilTbsp) ? oilTbsp : 0,
        visible_oil: Boolean(item.visible_oil),
        confidence: item.confidence,
        ...(portionDetail ? { _portionSourceDetail: portionDetail } : {}),
        // Keep original piece text so stub can re-derive food-specific grams if needed.
        ...(item.portion_estimate && !item.estimated_amount ? { portion_estimate: item.portion_estimate } : {}),
      };
    }),
  };
}

function scaleItemNutrition(item, factor) {
  if (!item || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.02) return item;
  const n = item.nutrition || {};
  const nutrition = {
    protein_g: round1(num(n.protein_g) * factor),
    carbs_g: round1(num(n.carbs_g) * factor),
    fat_g: round1(num(n.fat_g) * factor),
    fibre_g: scaleMicro(n.fibre_g, factor),
    sugar_g: scaleMicro(n.sugar_g, factor),
    salt_mg: n.salt_mg != null ? Math.round(num(n.salt_mg) * factor) : null,
  };
  const calories_kcal = item._authoritative
    ? Math.round(num(item.calories_kcal) * factor)
    : (num(item.calories_kcal) > 0
      ? Math.round(num(item.calories_kcal) * factor)
      : kcalFromAtwater(nutrition));
  return {
    ...item,
    calories_kcal,
    nutrition,
  };
}

function applyCookingMethod(item, cookingMethod = '') {
  // Authoritative references already describe the stated preparation state
  // (for example steamed idli or cooked rice). Applying another multiplier
  // would double-adjust both calories and macros.
  if (item?._authoritative) return item;
  const factor = cookingMethodMultiplier(cookingMethod);
  if (factor == null) return item;
  return attachPer100ToItem(scaleItemNutrition(item, factor));
}

function buildOilLineItem(grams = 7) {
  const g = Math.max(1, Math.round(grams));
  const nutrition = {
    protein_g: 0,
    carbs_g: 0,
    fat_g: round1(g),
    fibre_g: null,
    sugar_g: null,
    salt_mg: null,
  };
  return attachPer100ToItem({
    name: 'Cooking oil',
    portion_estimate: `~${g}g`,
    calories_kcal: Math.round(g * 9),
    nutrition,
    confidence: 0.6,
    _visionOil: true,
    _nutritionSource: 'estimated',
  });
}

function oilGramsForMethod(cookingMethod = '') {
  const t = String(cookingMethod).toLowerCase();
  if (/deep/.test(t)) return 10;
  if (/pan|stir|saut|shallow|fried/.test(t)) return 7;
  return 7;
}

function calibratedVisionAmount(name = '', amount = 0, unit = 'g') {
  if (unit === 'ml') return { amount, capped: false };
  const text = String(name).toLowerCase();
  const rules = [
    { pattern: /\b(chutney|pickle|relish)\b/, max: 60 },
    { pattern: /\b(butter|ghee|mayonnaise|mayo|jam)\b/, max: 40 },
    { pattern: /\b(dip|dressing)\b/, max: 100 },
    { pattern: /\b(basil|coriander|cilantro|parsley|mint garnish|herb garnish)\b/, max: 15 },
  ];
  const rule = rules.find((candidate) => candidate.pattern.test(text));
  if (!rule || amount <= rule.max) return { amount, capped: false };
  return { amount: rule.max, capped: true, originalAmount: amount };
}

function oilGramsFromVision(meta = {}) {
  const tbsp = num(meta.estimated_oil_tbsp);
  if (tbsp >= 0.25 && tbsp <= 4) return Math.round(tbsp * OIL_GRAMS_PER_TBSP);
  if (!meta.visible_oil) return 0;
  if (/steam|boil|raw|salad/.test(String(meta.cooking_method).toLowerCase())) return 0;
  return oilGramsForMethod(meta.cooking_method);
}

function visionItemToStub(visionItem = {}) {
  const normalized = normalizeVisionPortion(visionItem);
  const unit = normalized.unit;
  const rawAmount = normalized.amount;
  const calibrated = calibratedVisionAmount(visionItem.name, rawAmount, unit);
  const amount = calibrated.amount;
  const portionDetail = calibrated.capped
    ? 'photo_small_accompaniment_cap'
    : (normalized.portionDetail || visionItem._portionSourceDetail || null);
  return {
    name: String(visionItem.name || 'Food').trim() || 'Food',
    portion_estimate: unit === 'ml' ? `~${amount}ml` : `~${amount}g`,
    calories_kcal: 0,
    nutrition: {
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fibre_g: null,
      sugar_g: null,
      salt_mg: null,
    },
    confidence: num(visionItem.confidence) || 0.7,
    _usdaSearchTerm: String(visionItem.usda_search_term || '').trim() || undefined,
    _visionMeta: {
      unit,
      amount,
      cooking_method: visionItem.cooking_method || '',
      visible_oil: Boolean(visionItem.visible_oil),
      estimated_oil_tbsp: num(visionItem.estimated_oil_tbsp),
      usda_search_term: String(visionItem.usda_search_term || '').trim(),
    },
    _portionSource: 'photo_estimated',
    ...(portionDetail ? { _portionSourceDetail: portionDetail } : {}),
    ...(calibrated.capped ? {
      _portionCapped: true,
      _visionOriginalAmount: calibrated.originalAmount,
    } : {}),
    ...(visionItem._refId ? { _refId: visionItem._refId } : {}),
    ...(visionItem._visionDetectedName ? { _visionDetectedName: visionItem._visionDetectedName } : {}),
    _hiddenGrams: unit === 'g' ? amount : undefined,
    ...(unit === 'ml' ? { _volumeMl: amount } : {}),
  };
}

function displayNameFromRefId(refId = '') {
  const value = String(refId).replace(/_/g, ' ').trim();
  return value ? value.replace(/\b\w/g, (letter) => letter.toUpperCase()) : '';
}

function preserveRegionalRiceIdentity(vision = {}) {
  const summaryRef = matchFoodReference(vision.meal_summary || '');
  if (!summaryRef?.id || !/(jollof|biryani|pilau|pilaf|paella|kabsa|mandi|nasi_goreng|arroz)/i.test(summaryRef.id)) {
    return vision.items || [];
  }

  let promoted = false;
  return (vision.items || []).map((item) => {
    if (promoted || !/\brice\b/i.test(item.name || '')) return item;
    const itemRef = matchFoodReference(item.name || '');
    if (itemRef?.id && !/^(rice|plain_rice|cooked_rice|basmati_rice|jasmine_rice|brown_rice|red_rice)$/i.test(itemRef.id)) {
      return item;
    }
    promoted = true;
    return {
      ...item,
      name: displayNameFromRefId(summaryRef.id),
      _refId: summaryRef.id,
      _visionDetectedName: item.name,
    };
  });
}

function enrichVisionItemProvenance(item = {}) {
  if (item._provenanceLabel) return item;
  const summary = itemProvenanceSummary(item);
  if (!summary) return item;
  return {
    ...item,
    _provenanceLabel: summary.split('\n').find((l) => l.startsWith('Source:'))?.replace('Source: ', '') || undefined,
  };
}

function calibrateVisionItem(item) {
  const safetyItem = safetyNutritionForVisionItem(item);
  if (safetyItem) return safetyItem;
  const picked = resolveVisionFoodMatch(item.name, item._visionMeta?.usda_search_term);
  if (picked?.ref?.id) {
    item = {
      ...item,
      _refId: picked.ref.id,
      _matchMeta: picked.meta || item._matchMeta,
      _matchSource: picked.source,
    };
  }
  let result = calibrateItemWithReference(item);

  if (result._refId) {
    const { ref } = resolveFoodReferenceById(result._refId);
    result = applyAuthoritativeNutritionToItem(result, ref);
  }

  if (result._refId && (result._authoritative || num(result.calories_kcal) > 0)) {
    result = applyCookingMethod(result, item._visionMeta?.cooking_method);
    return enrichVisionItemProvenance(result);
  }

  const normalized = normalizeCanonicalFoodText(item.name || '');
  const ref = matchFoodReference(item.name || '')
    || (normalized !== item.name?.toLowerCase() ? matchFoodReference(normalized) : null);
  if (ref) {
    result = calibrateItemWithReference({ ...item, _refId: ref.id });
    const { ref: refRow } = resolveFoodReferenceById(ref.id);
    result = applyAuthoritativeNutritionToItem(result, refRow);
    if (result._refId && num(result.calories_kcal) > 0) {
      result = applyCookingMethod(result, item._visionMeta?.cooking_method);
      return enrichVisionItemProvenance(result);
    }
  }

  const amount = item._visionMeta?.amount
    || item._hiddenGrams
    || parseGramsFromText(item.portion_estimate)
    || 120;
  const scaled = nutritionForAmount(FALLBACK_PER100, amount);
  result = attachPer100ToItem({
    ...item,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    _nutritionFallback: true,
    _hiddenGrams: item._hiddenGrams || (item._visionMeta?.unit === 'g' ? amount : undefined),
  });
  result = applyCookingMethod(result, item._visionMeta?.cooking_method);
  return enrichVisionItemProvenance(result);
}

/** Compose only newly detected side items from an accompaniment Gemini pass. */
export function composeAccompanimentAdditions(accompanimentVision = {}, existingItems = []) {
  const existing = new Set(
    (existingItems || []).map((item) => String(item.name || '').toLowerCase().trim()),
  );
  const stubs = (accompanimentVision.items || [])
    .filter((row) => {
      const key = String(row.name || '').toLowerCase().trim();
      return key && !existing.has(key);
    })
    .map(visionItemToStub);

  return stubs.map(calibrateVisionItem).map((item) => ({
    ...item,
    _accompanimentGeminiPass: true,
  }));
}

/**
 * @param {object} vision — Gemini vision-only JSON
 * @returns {object} full analysis for existing client flow
 */
export function composeAnalysisFromVision(vision = {}) {
  const stubs = preserveRegionalRiceIdentity(vision).map(visionItemToStub);
  const { recipeItems, remainingStubs, decomposed } = decomposeVisionWithRecipes(stubs, vision);
  const oilItems = [];

  // Oil is a meal-level uncertainty, not one extra serving per detected dish.
  // Recipe decompositions already include their cooking fat.
  if (!decomposed) {
    const oilyStub = remainingStubs.find((stub) => {
      const grams = oilGramsFromVision(stub._visionMeta || {});
      return grams > 0 && !PREPARED_FOOD_RE.test(stub.name || '');
    });
    if (oilyStub) {
      oilItems.push(buildOilLineItem(oilGramsFromVision(oilyStub._visionMeta || {})));
    }
  }

  const calibratedRest = decomposed ? [] : remainingStubs.map(calibrateVisionItem);
  const recipeItemsEnriched = recipeItems.map((item) => {
    const { ref } = resolveFoodReferenceById(item._refId);
    return enrichVisionItemProvenance(applyAuthoritativeNutritionToItem(item, ref));
  });
  const items = [...recipeItemsEnriched, ...calibratedRest, ...oilItems];

  const sourceText = vision.meal_summary || stubs.map((s) => s.name).filter(Boolean).join(', ');

  let analysis = sanitizeAnalysisTotals({
    meal_summary: vision.meal_summary || 'Meal',
    confidence_score: num(vision.confidence_score) || 0.7,
    clarification_questions: vision.clarification_questions || [],
    items,
    total_calories_kcal: 0,
    total_nutrition: {
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fibre_g: null,
      sugar_g: null,
      salt_mg: null,
    },
    _visionComposed: true,
    _visionNotes: vision.notes || '',
    _recipeDecomposed: decomposed || items.some((item) => item._recipeDerived),
    _pipelineResolved: true,
    source: 'photo',
    _sourceText: sourceText,
  });

  analysis = applyMealValidation(analysis, { sourceText });
  analysis._confidence = scoreMealConfidence(analysis);
  return analysis;
}

/** Always compose photos from identification + grams. Never keep model nutrition. */
export function normalizePhotoAnalysis(raw = {}, { forceVision = false } = {}) {
  if (!raw || raw._visionComposed) return raw;
  if (isVisionAnalysis(raw)) return composeAnalysisFromVision(toVisionIdentification(raw));
  if (forceVision && Array.isArray(raw.items) && raw.items.length) {
    return composeAnalysisFromVision(toVisionIdentification(raw));
  }
  if (Array.isArray(raw.items) && raw.items.length && raw.total_calories_kcal != null) {
    return composeAnalysisFromVision(toVisionIdentification(raw));
  }
  return raw;
}
