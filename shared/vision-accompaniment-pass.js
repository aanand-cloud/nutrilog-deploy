/**
 * Phase 4 — detect and fill missing plate accompaniments in vision flow.
 */

import { normalizeFoodAlias } from './food-ref-v4-normalize.js';
import { isFlagEnabled } from './feature-flags.js';
import { lookupRecipeByText, resolveRecipeToItems, lookupRecipeByRefId } from './recipe-engine.js';
import { sanitizeAnalysisTotals, applyMealValidation } from './nutrition-sanitize.js';
import { scoreMealConfidence } from './nutrition-confidence.js';
import { applyAuthoritativeNutritionToItem } from './authoritative-nutrition.js';
import { resolveFoodReferenceById } from './nutrition-density.js';
import { stubsCoverRecipe } from './vision-recipe-compose.js';

const SIDE_ALIASES = {
  rice: ['rice', 'basmati', 'jeera', 'pilau', 'plain rice', 'steamed rice', 'white rice'],
  raita: ['raita', 'raitha', 'cucumber raita', 'curd', 'yoghurt side'],
  sambar: ['sambar', 'sambhar'],
  chutney: ['chutney', 'coconut chutney', 'tomato chutney', 'mint chutney'],
  bread: ['roti', 'chapati', 'naan', 'pav', 'toast', 'bread', 'bhatura'],
  dal: ['dal', 'daal', 'lentil'],
  chips: ['chips', 'fries'],
  gravy: ['gravy'],
};

const PLATE_RULES = [
  {
    id: 'biryani_raita',
    plateRe: /\bbiryani\b/i,
    expectSides: ['raita'],
    requireSummarySide: true,
  },
  {
    id: 'curry_rice',
    plateRe: /\b(tikka|masala|curry|korma|saag|paneer)\b/i,
    excludeRe: /\b(biryani|wrap|burger|sandwich|pie|pizza|burrito|pav bhaji|chole|dosa|idli)\b/i,
    expectSides: ['rice'],
    maxItems: 1,
  },
  {
    id: 'dosa_plate',
    plateRe: /\b(masala\s+dosa(?:\s+plate)?|dosa\s+plate|dosa\s+with\s+(?:sambar|sambhar|chutney)|(?:sambar|sambhar|chutney)\s+with\s+dosa)\b/i,
    expectSides: ['sambar', 'chutney'],
    requireSummarySide: true,
    maxItems: 1,
  },
  {
    id: 'idli_plate',
    plateRe: /\b(idli|idlis|idly|idlies)\b/i,
    expectSides: ['sambar'],
    requireSummarySide: true,
    maxItems: 1,
  },
  {
    id: 'fish_chips',
    plateRe: /\b(fish and chips|fish & chips|fish supper)\b/i,
    expectSides: ['chips'],
    maxItems: 1,
  },
];

/** User logged separate mains (e.g. dosa + meat curry) — do not inject default plate sides. */
function isSeparateCompoundMeal(items = [], text = '') {
  const blob = `${text} ${items.map((item) => item.name || '').join(' ')}`.toLowerCase();
  const hasSouthIndianBread = /\b(dosa|dosas|idli|idlis|idly|idlies|uttapam)\b/.test(blob);
  const hasUnrelatedCurry = /\b(meat|chicken|lamb|mutton|beef|fish|prawn|paneer|veg|vegetable)\s+curry\b/.test(blob)
    || (/\bcurry\b/.test(blob) && hasSouthIndianBread && /\b(and|with)\b/.test(blob));
  if (hasSouthIndianBread && hasUnrelatedCurry && items.length >= 2) return true;
  return false;
}

function itemMatchesSide(item = {}, sideKey = '') {
  const norm = normalizeFoodAlias(item.name || '');
  if (!norm) return false;
  return (SIDE_ALIASES[sideKey] || []).some((alias) => {
    const a = normalizeFoodAlias(alias);
    return norm.includes(a) || a.includes(norm);
  });
}

function itemMatchesComponent(item = {}, comp = {}) {
  if (item._refId && comp.refId) {
    if (item._refId === comp.refId) return true;
    if (item._refId.endsWith(`_${comp.refId}`) || comp.refId.endsWith(`_${item._refId}`)) return true;
    if (item._refId.includes(comp.refId) || comp.refId.includes(item._refId)) return true;
  }
  return componentNameHit(item.name, comp);
}

function componentNameHit(name = '', comp = {}) {
  const norm = normalizeFoodAlias(name);
  if (!norm) return false;
  const label = normalizeFoodAlias(comp.label || '');
  const ref = normalizeFoodAlias(String(comp.refId || '').replace(/_/g, ' '));
  return (label && (norm.includes(label) || label.includes(norm)))
    || (ref && (norm.includes(ref) || ref.includes(norm)));
}

function inferRecipeScale(items = [], recipe = {}) {
  let best = 1;
  for (const comp of recipe.components) {
    const item = items.find((row) => itemMatchesComponent(row, comp));
    if (!item?._hiddenGrams || !comp.grams) continue;
    const candidate = item._hiddenGrams / comp.grams;
    if (candidate > 0.4 && candidate < 2.5) best = candidate;
  }
  return best;
}

function recipeLookupCandidates(text = '') {
  const norm = normalizeFoodAlias(text);
  if (!norm) return [];
  const candidates = [text, norm];
  const withoutProtein = norm.replace(/^(chicken|lamb|mutton|veg|vegetable|paneer|beef|fish|prawn|goat)\s+/, '');
  if (withoutProtein && withoutProtein !== norm) candidates.push(withoutProtein);
  return [...new Set(candidates.filter(Boolean))];
}

function findPartialRecipe(vision = {}, items = []) {
  const texts = [
    vision.meal_summary,
    items.map((item) => item.name).join(' and '),
  ].filter(Boolean);

  if (isSeparateCompoundMeal(items, texts.join(' '))) return null;

  for (const text of texts) {
    for (const candidate of recipeLookupCandidates(text)) {
      const recipe = lookupRecipeByText(candidate)
        || lookupRecipeByRefId(items[0]?._refId);
      if (!recipe) continue;
      const hits = recipe.components.filter((comp) => items.some((item) => itemMatchesComponent(item, comp)));
      if (hits.length > 0 && hits.length < recipe.components.length) return recipe;
    }
  }
  return null;
}

/**
 * @returns {{ side: string, ruleId: string }[]}
 */
export function detectMissingAccompaniments(vision = {}, analysis = {}) {
  const items = (analysis.items || []).filter((item) => !item?._visionOil);
  const summary = String(vision.meal_summary || analysis.meal_summary || '');
  const names = `${summary} ${items.map((item) => item.name).join(' ')}`;

  if (isSeparateCompoundMeal(items, names)) return [];

  const missing = [];
  for (const rule of PLATE_RULES) {
    if (!rule.plateRe.test(names)) continue;
    if (rule.excludeRe?.test(names)) continue;
    if (rule.maxItems != null && items.length > rule.maxItems) continue;

    for (const side of rule.expectSides) {
      if (rule.requireSummarySide) {
        const sideRe = new RegExp(`\\b${side}\\b`, 'i');
        if (!sideRe.test(summary)) continue;
      }
      if (!items.some((item) => itemMatchesSide(item, side))) {
        missing.push({ side, ruleId: rule.id });
      }
    }
  }
  return missing;
}

/** Deterministic fill from recipe catalog for partially detected composite dishes. */
export function applyDeterministicAccompanimentFill(analysis = {}, vision = {}) {
  if (!isFlagEnabled('visionSecondPass')) return analysis;

  const items = [...(analysis.items || [])];
  const recipe = findPartialRecipe(vision, items);
  if (!recipe) return analysis;

  const missingComponents = recipe.components.filter(
    (comp) => !items.some((item) => itemMatchesComponent(item, comp)),
  );
  if (!missingComponents.length) return analysis;

  const scale = inferRecipeScale(items, recipe);
  const fillItems = resolveRecipeToItems(recipe, {
    phrase: vision.meal_summary || recipe.displayName || recipe.id,
    visionScale: scale,
    onlyComponents: missingComponents.map((comp) => comp.refId),
    skipOptional: true,
    matchMeta: { matchType: 'accompaniment_fill' },
  }).map((item) => {
    const { ref } = resolveFoodReferenceById(item._refId);
    const enriched = applyAuthoritativeNutritionToItem(item, ref);
    return {
      ...enriched,
      _accompanimentFilled: true,
      _visionMeta: {
        unit: 'g',
        amount: enriched._hiddenGrams || 0,
        cooking_method: 'unknown',
        visible_oil: false,
      },
    };
  });

  if (!fillItems.length) return analysis;

  let next = sanitizeAnalysisTotals({
    ...analysis,
    items: [...items, ...fillItems],
    _accompanimentFilled: true,
    _accompanimentFillCount: fillItems.length,
  });
  next = applyMealValidation(next, { sourceText: vision.meal_summary || analysis.meal_summary });
  next._confidence = scoreMealConfidence(next);
  return next;
}

export function needsAccompanimentGeminiPass(vision = {}, analysis = {}) {
  if (!isFlagEnabled('visionSecondPass')) return false;
  if (analysis._accompanimentFilled) {
    const stillMissing = detectMissingAccompaniments(vision, analysis);
    return stillMissing.length > 0;
  }
  const missing = detectMissingAccompaniments(vision, analysis);
  if (!missing.length) return false;

  const recipe = lookupRecipeByText(vision.meal_summary || '');
  if (recipe && stubsCoverRecipe(
    (analysis.items || []).map((item) => ({ name: item.name })),
    recipe,
  )) {
    return missing.some((row) => row.ruleId !== 'curry_rice');
  }
  return true;
}

export function buildAccompanimentPassContext(vision = {}, analysis = {}) {
  const missing = detectMissingAccompaniments(vision, analysis);
  return {
    pass_reason:
      'First pass may have missed side dishes or accompaniments visible on the plate. List ONLY missing items.',
    missing_accompaniments: missing.map((row) => row.side),
    first_pass: {
      meal_summary: vision.meal_summary || analysis.meal_summary || '',
      items: (vision.items || []).map((item) => ({
        name: item.name,
        estimated_amount: item.estimated_amount,
        unit: item.unit,
      })),
    },
  };
}

function visionItemKey(item = {}) {
  return normalizeFoodAlias(item.name || '');
}

/** Merge new vision-only side items into composed analysis (no duplicates). */
export function mergeAccompanimentVisionItems(analysis = {}, accompanimentVision = {}) {
  const existing = new Set((analysis.items || []).map((item) => visionItemKey(item)));
  const additions = [];

  for (const raw of accompanimentVision.items || []) {
    const key = visionItemKey(raw);
    if (!key || existing.has(key)) continue;
    existing.add(key);
    additions.push(raw);
  }

  if (!additions.length) return analysis;

  return {
    ...analysis,
    _accompanimentGeminiPass: true,
    _accompanimentVisionItems: additions,
  };
}

export function isAccompanimentPassImprovement(before = {}, after = {}) {
  const missingBefore = detectMissingAccompaniments({}, before).length;
  const missingAfter = detectMissingAccompaniments({}, after).length;
  if (missingAfter < missingBefore) return true;
  return (after.items || []).length > (before.items || []).length
    && Boolean(after._accompanimentFilled || after._accompanimentGeminiPass);
}
