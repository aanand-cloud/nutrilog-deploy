/**
 * Layer C recipe engine — decompose composite dishes into verified component line items.
 */

import {
  RECIPE_ALIAS_TO_ID,
  RECIPE_BY_ID,
  RECIPE_BY_REF_ID,
  RECIPE_CATALOG_STATS,
} from './recipe-catalog-index.generated.js';
import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import { resolveFoodReferenceById, nutritionForAmount, per100FromReference, attachPer100ToItem } from './nutrition-density.js';
import { enrichReferenceWithVerified, getVerifiedRecord } from './verified-nutrition.js';
import { canonicalFromReference } from './canonical-food-model.js';
import { refDisplayName } from './description-anchor.js';
import { countToNutritionGrams } from './portion-models.js';
import { phraseHasExplicitQuantity } from './quantity-parser.js';
import { isFlagEnabled } from './feature-flags.js';
import {
  applyAuthoritativeNutritionToItem,
  nutritionForAuthoritativeAmount,
} from './authoritative-nutrition.js';
import {
  cookingFatGramsForRecipe,
  sourceScaleForRecipe,
} from './mixed-dish-cooking.js';

export { RECIPE_CATALOG_STATS };

function resolveComponentRef(refId = '') {
  const { ref } = resolveFoodReferenceById(refId);
  if (ref) return enrichReferenceWithVerified(ref);

  const verified = getVerifiedRecord(refId);
  if (verified) {
    return enrichReferenceWithVerified({
      id: refId,
      kcal100: verified.kcal100,
      protein100: verified.protein100,
      carbs100: verified.carbs100,
      fat100: verified.fat100,
      fibre100: verified.fibre100,
      sugar100: verified.sugar100,
      salt100: verified.salt100,
    });
  }
  return null;
}

function num(v) {
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * @param {string} text
 * @returns {object|null}
 */
export function lookupRecipeByText(text = '') {
  if (!isFlagEnabled('recipeEngine')) return null;
  const norm = normalizeFoodAlias(text);
  if (!norm) return null;

  if (RECIPE_ALIAS_TO_ID[norm]) {
    return RECIPE_BY_ID[RECIPE_ALIAS_TO_ID[norm]];
  }

  const stripped = norm.replace(/^\d+\s*(small|medium|large|xl)?\s*/, '').trim();
  if (stripped && RECIPE_ALIAS_TO_ID[stripped]) {
    return RECIPE_BY_ID[RECIPE_ALIAS_TO_ID[stripped]];
  }

  let bestId = null;
  let bestLen = 0;
  for (const [alias, id] of Object.entries(RECIPE_ALIAS_TO_ID)) {
    if (alias.length < 12) continue;
    if (!norm.includes(alias) || alias.length <= bestLen) continue;
    const idx = norm.indexOf(alias);
    const before = norm.slice(0, idx).trim();
    const after = norm.slice(idx + alias.length).trim();
    const allowedPrefix = /^(chicken|lamb|mutton|veg|vegetable|paneer|beef|fish|prawn|goat)$/;
    if (before && !allowedPrefix.test(before)) continue;
    if (after) continue;
    bestId = id;
    bestLen = alias.length;
  }
  return bestId ? RECIPE_BY_ID[bestId] : null;
}

/**
 * @param {string} refId
 * @returns {object|null}
 */
export function lookupRecipeByRefId(refId = '') {
  if (!refId || !isFlagEnabled('recipeEngine')) return null;
  const id = RECIPE_BY_REF_ID[refId];
  return id ? RECIPE_BY_ID[id] : null;
}

/**
 * Pick best recipe for phrase — alias match first, then matched ref id.
 * @param {string} text
 * @param {object|null} ref
 */
export function lookupRecipeForPhrase(text = '', ref = null) {
  const byText = lookupRecipeByText(text);
  if (byText) return byText;
  if (ref?.id) return lookupRecipeByRefId(ref.id);
  return null;
}

/**
 * @param {object} recipe
 * @param {object} [opts]
 * @returns {number}
 */
function recipeScaleFactor(recipe, opts = {}) {
  let base = 1;

  if (Number.isFinite(opts.visionScale) && opts.visionScale > 0) {
    base = Math.max(0.25, Math.min(3, opts.visionScale));
  } else {
    const parsed = opts.parsed;
    if (parsed && phraseHasExplicitQuantity(parsed)) {
      if (parsed.unit === 'g' && parsed.amount > 0 && recipe.defaultServingGrams > 0) {
        base = parsed.amount / recipe.defaultServingGrams;
      } else if (parsed.unit === 'piece' && parsed.amount > 0) {
        base = parsed.amount;
      }
    }
  }

  if (isFlagEnabled('mixedDishCooking') && !phraseHasExplicitQuantity(opts.parsed)) {
    base *= sourceScaleForRecipe(recipe, opts);
  }

  return base;
}

/**
 * @param {object} comp
 * @param {number} scale
 * @param {string} foodText
 */
function componentGrams(comp, scale = 1, foodText = '') {
  if (comp.pieces != null) {
    const count = Math.max(1, Math.round(num(comp.pieces) * scale));
    return {
      grams: countToNutritionGrams(count, comp.label || comp.refId, {}),
      portionLabel: `${count} piece${count > 1 ? 's' : ''}`,
    };
  }
  const grams = Math.max(1, Math.round(num(comp.grams) * scale));
  return { grams, portionLabel: `${grams}g` };
}

/**
 * Resolve recipe to line items with deterministic per-100g math.
 * @param {object} recipe
 * @param {{ parsed?: object, phrase?: string, matchMeta?: object, skipOptional?: boolean }} [opts]
 * @returns {object[]}
 */
export function resolveRecipeToItems(recipe, opts = {}) {
  if (!recipe?.components?.length) return [];

  const scale = recipeScaleFactor(recipe, opts);
  const items = [];

  const only = opts.onlyComponents;
  for (const comp of recipe.components) {
    if (Array.isArray(only) && only.length && !only.includes(comp.refId)) continue;
    if (comp.optional && opts.skipOptional) continue;

    const enriched = resolveComponentRef(comp.refId);
    if (!enriched) continue;

    const { grams, portionLabel } = componentGrams(comp, scale, opts.phrase || '');
    const scaled = nutritionForAuthoritativeAmount(enriched, grams)
      || nutritionForAmount(per100FromReference(enriched), grams);

    let item = attachPer100ToItem({
      name: comp.label || refDisplayName(comp.refId),
      portion_estimate: portionLabel,
      calories_kcal: scaled.calories_kcal,
      nutrition: scaled.nutrition,
      confidence: 0.72,
      _refId: comp.refId,
      _hiddenGrams: grams,
      _weightSource: 'recipe',
      _matchMeta: opts.matchMeta,
      _recipeDerived: true,
      _recipeId: recipe.id,
      _recipeComponent: comp.role || comp.refId,
    });

    item._canonical = {
      ...canonicalFromReference(enriched, opts.matchMeta),
      verificationStatus: 'recipe_derived',
      nutritionBasis: 'recipe_derived',
      dataSource: 'recipe',
      dataQualityScore: 70,
    };
    if (opts.cookingSource || opts.oilLevel) {
      item._mixedDishCooking = {
        source: opts.cookingSource || 'homemade',
        oilLevel: opts.oilLevel || 'normal',
      };
    }
    if (isFlagEnabled('authoritativeNutrition')) {
      item = applyAuthoritativeNutritionToItem(item, enriched);
    }
    items.push(item);
  }

  if (isFlagEnabled('mixedDishCooking')) {
    const fatGrams = cookingFatGramsForRecipe(recipe, opts);
    if (fatGrams > 0) {
      const fatRefId = recipe.cookingFat?.refId || 'butter';
      const enriched = resolveComponentRef(fatRefId);
      if (enriched) {
        const scaled = nutritionForAuthoritativeAmount(enriched, fatGrams)
          || nutritionForAmount(per100FromReference(enriched), fatGrams);
        let fatItem = attachPer100ToItem({
          name: recipe.cookingFat?.label || 'Cooking oil / ghee',
          portion_estimate: `${Math.round(fatGrams)}g`,
          calories_kcal: scaled.calories_kcal,
          nutrition: scaled.nutrition,
          confidence: 0.55,
          _refId: fatRefId,
          _hiddenGrams: fatGrams,
          _weightSource: 'recipe',
          _matchMeta: opts.matchMeta,
          _recipeDerived: true,
          _recipeId: recipe.id,
          _recipeComponent: 'cooking_fat',
          _hiddenOil: true,
        });
        fatItem._canonical = {
          ...canonicalFromReference(enriched, opts.matchMeta),
          verificationStatus: 'recipe_derived',
          nutritionBasis: 'recipe_hidden_fat',
          dataSource: 'recipe',
          dataQualityScore: 55,
        };
        if (opts.cookingSource || opts.oilLevel) {
          fatItem._mixedDishCooking = {
            source: opts.cookingSource || 'homemade',
            oilLevel: opts.oilLevel || 'normal',
          };
        }
        if (isFlagEnabled('authoritativeNutrition')) {
          fatItem = applyAuthoritativeNutritionToItem(fatItem, enriched);
        }
        items.push(fatItem);
      }
    }
  }

  return items;
}

/**
 * Plausible kcal range from recipe catalog metadata when a single recipe decomposed the meal.
 * @param {object[]} items
 */
export function recipeKcalRangeForItems(items = []) {
  const recipeIds = [...new Set(items.map((i) => i._recipeId).filter(Boolean))];
  if (recipeIds.length !== 1) return null;
  const recipe = RECIPE_BY_ID[recipeIds[0]];
  if (!recipe?.kcalRangeMin || !recipe?.kcalRangeMax) return null;
  return {
    min: recipe.kcalRangeMin,
    max: recipe.kcalRangeMax,
    reason: recipe.kcalRangeReason || 'Portion size and cooking oil are the main uncertainty.',
  };
}

/**
 * @param {string} text
 * @param {object|null} ref
 * @returns {boolean}
 */
function recipeAliasMatchesPhrase(text = '', recipe = null) {
  if (!recipe?.id) return false;
  const norm = normalizeFoodAlias(text);
  if (!norm) return false;
  return Object.entries(RECIPE_ALIAS_TO_ID).some(([alias, id]) => {
    if (id !== recipe.id) return false;
    const stripped = norm.replace(/^\d+\s*(?:g|ml|kg|l|piece|pieces|slice|slices)?\s*/, '').trim();
    return norm === alias || stripped === alias;
  });
}

/**
 * @param {string} text
 * @param {object} recipe
 * @returns {boolean}
 */
function phraseMentionsRecipeSide(text = '', recipe = null) {
  if (!recipe?.components?.length) return false;
  const lower = String(text).toLowerCase();
  return recipe.components
    .filter((c) => c.role && c.role !== 'main')
    .some((c) => {
      const label = String(c.label || c.refId || '').toLowerCase();
      const token = label.split(/\s+/)[0];
      return token.length > 2 && (lower.includes(label) || lower.includes(token));
    });
}

/**
 * @param {string} text
 * @param {object} [opts]
 * @returns {object[]|null}
 */
export function tryResolveRecipePhrase(text = '', opts = {}) {
  const recipe = lookupRecipeForPhrase(text, opts.ref);
  if (!recipe) return null;

  const aliasMatch = recipeAliasMatchesPhrase(text, recipe);
  const sideMentioned = phraseMentionsRecipeSide(text, recipe);

  if (recipe.components.length >= 2 && !aliasMatch && !sideMentioned) {
    return null;
  }

  if (phraseHasExplicitQuantity(opts.parsed) && opts.parsed?.unit === 'g') {
    if (recipe.components.length >= 2 && !aliasMatch && !sideMentioned) {
      return null;
    }
    return resolveRecipeToItems(recipe, opts);
  }
  if (phraseHasExplicitQuantity(opts.parsed)) return null;
  const items = resolveRecipeToItems(recipe, opts);
  return items.length >= 2 ? items : null;
}

/**
 * @returns {string[]}
 */
export function listRecipeIds() {
  return Object.keys(RECIPE_BY_ID);
}
