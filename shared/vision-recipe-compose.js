/**
 * Phase 4 — recipe decomposition for photo / vision payloads.
 */

import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import { isFlagEnabled } from './feature-flags.js';
import { lookupRecipeByText, resolveRecipeToItems } from './recipe-engine.js';

function stubEdibleGrams(stub = {}) {
  const meta = stub._visionMeta || {};
  const amount = Number(meta.amount) || 0;
  if (amount <= 0) return 0;
  return meta.unit === 'ml' ? amount : amount;
}

function stubTotalGrams(stubs = []) {
  const total = stubs.reduce((sum, stub) => sum + stubEdibleGrams(stub), 0);
  return total > 0 ? total : 0;
}

function visionScaleForRecipe(stubs = [], recipe = {}) {
  const total = stubTotalGrams(stubs);
  if (total > 40 && recipe.defaultServingGrams > 0) {
    return total / recipe.defaultServingGrams;
  }
  return 1;
}

function componentNameHit(name = '', comp = {}) {
  const norm = normalizeFoodAlias(name);
  if (!norm) return false;
  const label = normalizeFoodAlias(comp.label || '');
  const ref = normalizeFoodAlias(String(comp.refId || '').replace(/_/g, ' '));
  return (label && (norm.includes(label) || label.includes(norm)))
    || (ref && (norm.includes(ref) || ref.includes(norm)));
}

/** True when vision already lists most recipe components separately. */
export function stubsCoverRecipe(stubs = [], recipe = null) {
  if (!recipe?.components?.length || !stubs.length) return false;
  if (stubs.length < recipe.components.length - 1) return false;

  let hits = 0;
  for (const comp of recipe.components) {
    if (stubs.some((stub) => componentNameHit(stub.name, comp))) hits += 1;
  }
  return hits >= Math.max(2, recipe.components.length - 1);
}

function recipeItemsFromVision(recipe, phrase, stubs, matchMeta = {}) {
  const scale = visionScaleForRecipe(stubs, recipe);
  const items = resolveRecipeToItems(recipe, {
    phrase,
    visionScale: scale,
    matchMeta: { ...matchMeta, matchType: 'recipe_vision' },
  });
  if (items.length < 2) return [];

  for (const item of items) {
    item._visionMeta = {
      unit: 'g',
      amount: item._hiddenGrams || 0,
      cooking_method: 'unknown',
      visible_oil: false,
    };
    item._weightSource = item._weightSource || 'recipe';
  }
  return items;
}

/**
 * Decompose collapsed vision items via recipe catalog.
 * @returns {{ recipeItems: object[], remainingStubs: object[], recipeId: string|null, decomposed: boolean }}
 */
export function decomposeVisionWithRecipes(stubs = [], vision = {}) {
  if (!isFlagEnabled('recipeEngine') || !stubs.length) {
    return { recipeItems: [], remainingStubs: stubs, recipeId: null, decomposed: false };
  }

  const candidates = [
    vision.meal_summary,
    stubs.length === 1 ? stubs[0].name : null,
    stubs.map((stub) => stub.name).join(' and '),
  ].filter(Boolean);

  for (const text of candidates) {
    const recipe = lookupRecipeByText(text);
    if (!recipe || stubsCoverRecipe(stubs, recipe)) continue;

    const collapsed = stubs.length <= 2 || stubs.length < recipe.components.length;
    if (!collapsed && !lookupRecipeByText(vision.meal_summary || '')) continue;

    const items = recipeItemsFromVision(recipe, text, stubs);
    if (items.length >= 2) {
      return {
        recipeItems: items,
        remainingStubs: [],
        recipeId: recipe.id,
        decomposed: true,
      };
    }
  }

  return { recipeItems: [], remainingStubs: stubs, recipeId: null, decomposed: false };
}
