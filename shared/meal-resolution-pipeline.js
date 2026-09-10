/**
 * Unified meal resolution pipeline — parse → match → calculate → validate.
 * AI identifies structure; this module retrieves verified per-100g values deterministically.
 */

import { parseMealDescription, phraseHasExplicitQuantity, splitMealPhrases, parseQuantityFromText, parsePreparationState } from './quantity-parser.js';
import { countToNutritionGrams } from './portion-models.js';
import {
  parseEggCount,
  eggSummary,
  nutritionForEggs,
  UK_MEDIUM_EGG_G,
} from './nutrition-reference.js';
import {
  matchFoodReferenceDetailed,
  nutritionForAmount,
  per100FromReference,
  attachPer100ToItem,
} from './nutrition-density.js';
import { refDisplayName, isStrongDescriptionMatch, servingGramsForReference, dishRefCoversCompound } from './description-anchor.js';
import { applyMealValidation, sanitizeAnalysisTotals, sumItemNutritionTotals, reconcileTotalNutrition } from './nutrition-sanitize.js';
import { scoreMealConfidence } from './nutrition-confidence.js';
import { enforceRangeIntegrity } from './range-integrity.js';
import { attachWeightProvenance } from './weight-provenance.js';
import { canonicalFromReference, isAllowedZeroKcal } from './canonical-food-model.js';
import { enrichReferenceWithVerified } from './verified-nutrition.js';
import { tryResolveRecipePhrase, recipeKcalRangeForItems } from './recipe-engine.js';
import { isFlagEnabled } from './feature-flags.js';
import { applyParsingIntegrity } from './parsing-integrity.js';
import { sanityCheckMeal } from './nutrition-sanity.js';
import {
  applyPreparationRefOverride,
  applyAuthoritativeNutritionToItem,
  nutritionForAuthoritativeAmount,
} from './authoritative-nutrition.js';

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

function attachItemBindings(items, phrase, parsed) {
  const prep = parsePreparationState(parsed?.foodText || phrase);
  return items.map((item) => ({
    ...item,
    _sourcePhrase: phrase,
    _boundQuantity: phraseHasExplicitQuantity(parsed)
      ? {
        amount: parsed.amount,
        unit: parsed.unit,
        kind: parsed.kind,
        size: parsed.size ?? null,
      }
      : null,
    _preparationState: prep.state,
  }));
}

function portionLabelFromQuantity(q, name = '') {
  if (!phraseHasExplicitQuantity(q)) return '1 serving';
  if (q.unit === 'g') return `${q.amount}g`;
  if (q.unit === 'ml') return `${q.amount}ml`;
  if (q.unit === 'piece') {
    const grams = countToNutritionGrams(q.amount, name, { size: q.size });
    return `${q.amount} piece${q.amount > 1 ? 's' : ''} (~${grams}g)`;
  }
  return '1 serving';
}

function displayNameFromRef(ref, foodText = '', q = null) {
  const lower = String(foodText).toLowerCase();
  if (ref?.id === 'dosa' && /\bmasala\b/.test(lower)) return 'Masala dosa';
  if (ref?.id === 'white_fish' && /\bbattered\b/.test(lower)) return 'Battered cod';
  if (ref?.id === 'battered_fish') return /\bcod\b/.test(lower) ? 'Battered cod' : 'Battered fish';
  if (ref?.id === 'chole_bhature') return 'Chole bhature';
  if (ref?.id === 'nuts' && /\bpeanut/.test(lower)) return 'Peanuts';
  if (ref?.id === 'fries' && /\bchips\b/.test(lower)) return 'Chips';
  if (ref?.id === 'gravy') return 'Gravy';
  if (ref?.id === 'carrots') return 'Carrots';
  if (ref?.id === 'peas' && !/\bmushy\b/.test(lower)) return 'Peas';
  if (ref?.id === 'baked_beans') return 'Baked beans';
  if (ref?.id === 'jacket_potato') return 'Jacket potato';
  if (ref?.id === 'butter') return 'Butter';
  if (ref?.id === 'roti' && /\bchapati/.test(lower)) {
    const n = q?.quantity || parseQuantityFromText(foodText).quantity;
    return n > 1 ? `${Math.round(n)} chapatis` : 'Chapati';
  }
  if (ref?.id === 'oats' && /\bporridge\b/.test(lower)) return 'Porridge oats';
  if (ref?.id === 'uttapam') return 'Uttapam';
  return refDisplayName(ref?.id || '') || foodText.slice(0, 48);
}

/**
 * Resolve one phrase to a line item via canonical per-100g calculation.
 * @param {string} phrase
 * @param {ReturnType<parseMealDescription>[0]} parsed
 */
/**
 * Resolve one phrase to line item(s) — recipe decomposition returns multiple components.
 * @param {string} phrase
 * @param {ReturnType<parseMealDescription>[0]} parsed
 * @returns {object[]}
 */
export function resolvePhraseToItems(phrase, parsed = null) {
  const q = parsed || { phrase, ...parseQuantityFromText(phrase) };
  const foodText = q.foodText || phrase;

  const eggCount = parseEggCount(foodText);
  if (eggCount > 0 && /\begg/.test(foodText.toLowerCase())) {
    const nutritionGrams = phraseHasExplicitQuantity(q)
      ? (q.unit === 'g'
        ? q.amount
        : q.unit === 'ml'
          ? q.amount
          : countToNutritionGrams(q.amount || eggCount, foodText, { size: q.size }))
      : UK_MEDIUM_EGG_G * eggCount;
    const nutrition = nutritionForEggs(eggCount);
    const sizePrefix = q.size && q.size !== 'medium' ? `${q.size} ` : '';
    const name = phraseHasExplicitQuantity(q) && q.unit === 'piece'
      ? `${eggCount} ${sizePrefix}boiled eggs`.replace(/\s+/g, ' ').trim()
      : eggSummary(eggCount);
    return attachItemBindings([{
      name,
      portion_estimate: phraseHasExplicitQuantity(q)
        ? portionLabelFromQuantity(q, foodText)
        : `${eggCount} medium egg${eggCount > 1 ? 's' : ''} (~${nutritionGrams}g)`,
      calories_kcal: nutrition.kcal,
      nutrition: {
        protein_g: nutrition.protein_g,
        carbs_g: nutrition.carbs_g,
        fat_g: nutrition.fat_g,
        fibre_g: nutrition.fibre_g,
        sugar_g: nutrition.sugar_g,
        salt_mg: nutrition.salt_mg,
      },
      confidence: 0.72,
      _refId: 'boiled_egg',
      _hiddenGrams: nutritionGrams,
      _baselineWeightGrams: nutritionGrams,
      _weightSource: phraseHasExplicitQuantity(q) ? 'measured' : 'default',
    }], phrase, q);
  }

  const prepFoodText = parsePreparationState(foodText).foodText || foodText;
  const match = matchFoodReferenceDetailed(phrase) || matchFoodReferenceDetailed(prepFoodText) || matchFoodReferenceDetailed(foodText);
  let ref = applyPreparationRefOverride(enrichReferenceWithVerified(match?.ref), foodText);

  if (isFlagEnabled('recipeEngine')) {
    const recipeItems = tryResolveRecipePhrase(prepFoodText, {
      phrase,
      parsed: q,
      ref,
      matchMeta: match?.meta,
      cookingSource: q.cookingSource,
      oilLevel: q.oilLevel,
    });
    if (recipeItems?.length) return attachItemBindings(recipeItems, phrase, q);
  }

  return attachItemBindings([resolvePhraseToItemCore(phrase, q, match, ref)], phrase, q);
}

function resolvePhraseToItemCore(phrase, q, match, ref) {
  const foodText = q.foodText || phrase;

  if (ref && (phraseHasExplicitQuantity(q) || isStrongDescriptionMatch(foodText, ref))) {
    let nutritionGrams = 0;
    let volumeMl = null;

    if (phraseHasExplicitQuantity(q)) {
      if (q.unit === 'g') nutritionGrams = q.amount;
      else if (q.unit === 'ml') {
        volumeMl = q.amount;
        nutritionGrams = q.amount;
      } else if (q.unit === 'piece') {
        nutritionGrams = countToNutritionGrams(q.amount, foodText, { size: q.size });
      }
    } else {
      nutritionGrams = servingGramsForReference(ref, foodText);
    }

    const scaled = nutritionForAuthoritativeAmount(ref, nutritionGrams)
      || nutritionForAmount(per100FromReference(ref), nutritionGrams);
    if (!isAllowedZeroKcal(ref.id, scaled.calories_kcal)) {
      return buildUnmatchedItem(phrase, `Matched "${ref.id}" returned no calories — check the name or amount.`);
    }

    let item = attachPer100ToItem({
      name: displayNameFromRef(ref, foodText, q),
      portion_estimate: phraseHasExplicitQuantity(q)
        ? portionLabelFromQuantity(q, foodText)
        : `1 serving (~${Math.round(nutritionGrams)}g)`,
      calories_kcal: scaled.calories_kcal,
      nutrition: scaled.nutrition,
      confidence: match.meta?.confidence === 'high' ? 0.85 : 0.68,
      _refId: ref.id,
      _hiddenGrams: nutritionGrams,
      _baselineWeightGrams: nutritionGrams,
      _volumeMl: volumeMl,
      _weightSource: phraseHasExplicitQuantity(q) ? 'measured' : 'default',
      _matchMeta: match.meta,
    });
    item._canonical = canonicalFromReference(ref, match.meta);
    if (isFlagEnabled('authoritativeNutrition')) {
      item = applyAuthoritativeNutritionToItem(item, ref);
    }
    return item;
  }

  if (ref) {
    const grams = servingGramsForReference(ref, foodText);
    const scaled = nutritionForAuthoritativeAmount(ref, grams)
      || nutritionForAmount(per100FromReference(ref), grams);
    let item = attachPer100ToItem({
      name: displayNameFromRef(ref, foodText, q),
      portion_estimate: `1 serving (~${grams}g)`,
      calories_kcal: scaled.calories_kcal,
      nutrition: scaled.nutrition,
      confidence: 0.55,
      _refId: ref.id,
      _hiddenGrams: grams,
      _baselineWeightGrams: grams,
      _weightSource: 'default',
      _matchMeta: match?.meta,
    });
    if (isFlagEnabled('authoritativeNutrition')) {
      item = applyAuthoritativeNutritionToItem(item, ref);
    }
    return item;
  }

  return buildUnmatchedItem(phrase);
}

/** @param {string} phrase @param {object} [parsed] */
export function resolvePhraseToItem(phrase, parsed = null) {
  return resolvePhraseToItems(phrase, parsed)[0];
}

function buildAnalysisFromItems(items, raw, phrases, source = 'describe') {
  const summed = sumItemNutritionTotals(items);
  const total_nutrition = reconcileTotalNutrition(
    {
      protein_g: summed.protein_g,
      carbs_g: summed.carbs_g,
      fat_g: summed.fat_g,
      fibre_g: summed.fibre_g,
      sugar_g: summed.sugar_g,
      salt_mg: summed.salt_mg,
    },
    {},
  );

  let analysis = {
    meal_summary: items.map((i) => i.name).join(' + '),
    total_calories_kcal: Math.round(summed.calories_kcal),
    total_nutrition,
    confidence_score: items.some((i) => i._unmatched) ? 0.35 : 0.65,
    items,
    clarification_questions: [],
    _voiceEstimate: true,
    _pipelineResolved: true,
    _recipeDecomposed: items.some((i) => i._recipeDerived),
    source,
    _sourceText: raw,
    _sourcePhrases: phrases,
  };

  analysis = sanitizeAnalysisTotals(analysis);
  analysis = applyMealValidation(analysis, { sourceText: raw, sourcePhrases: phrases });
  if (isFlagEnabled('parsingIntegrity')) {
    analysis = applyParsingIntegrity(analysis, raw);
  }
  const recipeRange = recipeKcalRangeForItems(analysis.items);
  if (recipeRange) {
    analysis._recipeKcalRange = recipeRange;
  } else {
    const refIds = new Set((analysis.items || []).map((i) => i._refId));
    if (refIds.has('white_fish') && refIds.has('fries')) {
      analysis._recipeKcalRange = {
        min: 750,
        max: 1100,
        reason: 'Chip-shop portion and oil absorption',
      };
    } else if ([...refIds].some((id) => /biryani/i.test(id))) {
      analysis._recipeKcalRange = {
        min: 520,
        max: 750,
        reason: 'Restaurant biryani portion and oil',
      };
    }
  }
  const sanityWarnings = sanityCheckMeal(analysis);
  if (sanityWarnings.length) {
    analysis._sanityWarnings = sanityWarnings;
    analysis._mealValidation = {
      ...(analysis._mealValidation || {}),
      warnings: [...(analysis._mealValidation?.warnings || []), ...sanityWarnings],
    };
  }
  analysis._confidence = scoreMealConfidence(analysis);
  analysis = attachWeightProvenance(analysis);
  const rangeResult = enforceRangeIntegrity(analysis, analysis._confidence);
  analysis = rangeResult.analysis;
  return analysis;
}

function buildUnmatchedItem(phrase, hint = '') {
  const label = phrase.length > 48 ? `${phrase.slice(0, 45)}…` : phrase;
  return {
    name: label,
    portion_estimate: 'Check amount',
    calories_kcal: 0,
    nutrition: {
      protein_g: 0,
      carbs_g: 0,
      fat_g: 0,
      fibre_g: null,
      sugar_g: null,
      salt_mg: null,
    },
    confidence: 0.2,
    _unmatched: true,
    _nutrientAvailability: {
      fibre_g: 'not_available',
      sugar_g: 'not_available',
      salt_mg: 'not_available',
    },
    _reviewHint: hint || `We could not confidently match: ${label}. Select a food or edit it.`,
  };
}

/**
 * Split resolution when explicit per-component weights or comma-separated foods are present.
 * Accompaniment-only splits (biryani with raita) stay on full-phrase recipe path.
 * @param {string} raw
 * @param {string[]} phrases
 */
function shouldUseSplitResolution(raw = '', phrases = []) {
  if (phrases.length <= 1) return false;
  if (/[,;+]/.test(raw)) return true;
  const explicitCount = phrases.filter((phrase) => phraseHasExplicitQuantity(parseQuantityFromText(phrase))).length;
  if (explicitCount >= 1) return true;
  return false;
}

/**
 * Full pipeline for describe/voice/benchmark text input.
 * @param {string} description
 * @param {{ source?: string, cookingSource?: string, oilLevel?: string }} [opts]
 */
export function resolveMealFromText(description = '', { source = 'describe', cookingSource, oilLevel } = {}) {
  const raw = String(description || '').trim();
  if (raw.length < 2) return null;

  const recipeOpts = { cookingSource, oilLevel };
  const phrases = splitMealPhrases(raw);
  const useSplit = shouldUseSplitResolution(raw, phrases);

  if (!useSplit) {
    const fullParsed = parseQuantityFromText(raw);
    const fullMatch = matchFoodReferenceDetailed(raw);
    const fullRef = enrichReferenceWithVerified(fullMatch?.ref);

    if (isFlagEnabled('recipeEngine')) {
      const fullRecipeItems = tryResolveRecipePhrase(raw, {
        phrase: raw,
        parsed: fullParsed,
        ref: fullRef,
        matchMeta: fullMatch?.meta,
        ...recipeOpts,
      });
      if (fullRecipeItems?.length >= 2) {
        return buildAnalysisFromItems(
          attachItemBindings(fullRecipeItems, raw, fullParsed),
          raw,
          [raw],
          source,
        );
      }
    }

    if (fullRef && isStrongDescriptionMatch(raw, fullRef) && dishRefCoversCompound(fullRef)) {
      const items = resolvePhraseToItems(raw, fullParsed);
      return buildAnalysisFromItems(items, raw, [raw], source);
    }
  }

  const parsed = parseMealDescription(raw);
  const items = [];

  for (let i = 0; i < phrases.length; i += 1) {
    items.push(...resolvePhraseToItems(phrases[i], parsed[i]));
  }

  return buildAnalysisFromItems(items, raw, phrases, source);
}
