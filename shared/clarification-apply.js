/**
 * Apply clarify answers locally — no second AI round trip.
 */

import {
  sanitizeAnalysisTotals,
  matchFoodReference,
  parseGramsFromText,
  nutritionForAmount,
  per100FromReference,
} from './nutrition-sanitize.js';
import {
  applyBreadCountToItems,
  canonicalPieceGrams,
  isCountableBreadRef,
  parseBreadCountFromAnswer,
} from './bread-piece-grams.js';
import {
  matchIndianStarterRef,
  starterDefaultGrams,
} from './indian-starter-catalog.js';
import {
  cookingMethodMultiplier,
  cookingMethodReviewHint,
  itemMatchesCookingMethod,
  resolveCookingMethodFromAnswer,
} from './cooking-methods.js';
import { resolveMealFromText } from './meal-resolution-pipeline.js';
import { cookingOptsFromClarifyAnswers, parseCookingSourceFromAnswer } from './mixed-dish-cooking.js';

function round1(v) {
  return Math.round(v * 10) / 10;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function itemText(item = {}) {
  return `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
}

function mealText(analysis = {}) {
  return [
    analysis.meal_summary,
    ...(analysis.items || []).map((i) => `${i.name || ''} ${i.portion_estimate || ''}`),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function inferItemGrams(item) {
  const parsed = parseGramsFromText(item.portion_estimate) || parseGramsFromText(item.name);
  if (parsed > 0) return parsed;
  const ref = matchFoodReference(itemText(item));
  if (ref?.id === 'egg') return 58;
  if (ref && /^(coffee|tea|beer|wine|soft_drink|juice|lassi|chai|water)/.test(ref.id)) return 250;
  if (ref && isCountableBreadRef(ref.id)) {
    const count = parseBreadCountFromAnswer(item.portion_estimate || item.name) || 1;
    return canonicalPieceGrams(ref.id, itemText(item)) * count;
  }
  if (ref?.id === 'samosa' || ref?.id === 'dumpling') return 80;
  const starterRef = matchIndianStarterRef(itemText(item));
  if (starterRef) return starterDefaultGrams(starterRef);
  if (ref?.id === 'roti' || ref?.id === 'naan' || ref?.id === 'paratha' || ref?.id === 'kerala_parotta') return 60;
  if (ref?.id === 'rice' || /rice|biryani|pulao/.test(itemText(item))) return 200;
  return 150;
}

function formatPortionEstimate(previous = '', grams, unit = 'g') {
  const name = String(previous).replace(/\([^)]*\)/, '').trim() || 'Portion';
  return `${name} (~${Math.round(grams)}${unit})`;
}

const PORTION_TARGETED_TOPICS = new Set([
  'portion_rice',
  'portion_starter',
  'portion_solid',
  'portion_takeaway',
  'portion_snack',
  'dessert_portion',
  'generic_portion',
  'portion_item',
  'bread_count',
]);

function itemTextLower(item = {}) {
  return `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
}

function buildAdjustedHint(topic, answer, itemName = '') {
  const { amount, unit } = parsePresetAmount(answer);
  const label = amount > 0
    ? `~${Math.round(amount)}${unit === 'ml' ? 'ml' : 'g'}`
    : String(answer).replace(/\([^)]*\)/, '').trim();
  switch (topic) {
    case 'portion_rice':
      return `${itemName || 'Rice'} set to ${label} from your rice answer`;
    case 'bread_count':
      return `${itemName || 'Bread'} updated from your count answer`;
    case 'portion_starter':
      return `${itemName || 'Starter'} set to ${label} from your starter answer`;
    case 'portion_solid':
    case 'portion_item':
      return `${itemName || 'Portion'} set to ${label} from your answer`;
    case 'portion_takeaway':
      return `Takeaway portion set to ${label} from your answer`;
    case 'portion_snack':
      return `Snack portion set to ${label} from your answer`;
    case 'dessert_portion':
      return `Dessert set to ${label} from your answer`;
    default:
      return `${itemName || 'Item'} adjusted from your answer (${label})`;
  }
}

function buildUnchangedHint(topic, item = {}) {
  const text = itemTextLower(item);
  const name = item.name || 'This item';
  if (topic === 'portion_rice' && !/\b(rice|biryani|pulao|pilau|fried rice|chawal|sadam)\b/.test(text)) {
    return `${name} — photo estimate (unchanged by your rice answer)`;
  }
  if (topic === 'bread_count' && !/\b(roti|chapati|naan|dosa|idli|bread|pav|bhature|paratha|puri|wrap|roll)\b/.test(text)) {
    return `${name} — photo estimate (unchanged by bread count)`;
  }
  if (topic === 'portion_solid' || topic === 'portion_starter' || topic === 'portion_takeaway' || topic === 'dessert_portion') {
    return null;
  }
  return null;
}

function markPortionClarifyHints(items, topic, answer) {
  if (!PORTION_TARGETED_TOPICS.has(topic)) return items;
  return items.map((item) => {
    if (item._clarifyAdjusted) {
      return {
        ...item,
        _reviewHint: item._reviewHint || buildAdjustedHint(topic, answer, item.name),
      };
    }
    const unchanged = buildUnchangedHint(topic, item);
    if (unchanged) return { ...item, _reviewHint: unchanged };
    return item;
  });
}

function scaleItem(item, factor, { localClarify = false } = {}) {
  if (!item || !Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.02) return item;
  const n = item.nutrition || {};
  return {
    ...item,
    calories_kcal: Math.round(num(item.calories_kcal) * factor),
    nutrition: {
      protein_g: round1(num(n.protein_g) * factor),
      carbs_g: round1(num(n.carbs_g) * factor),
      fat_g: round1(num(n.fat_g) * factor),
      fibre_g: round1(num(n.fibre_g) * factor),
      sugar_g: round1(num(n.sugar_g) * factor),
      salt_mg: Math.round(num(n.salt_mg) * factor),
    },
    ...(localClarify ? { _localClarify: true } : {}),
  };
}

function rescaleItemToAmount(item, targetAmount, unit = 'g') {
  const current = inferItemGrams(item);
  const factor = targetAmount / current;
  return {
    ...scaleItem(item, factor),
    portion_estimate: formatPortionEstimate(item.portion_estimate || item.name, targetAmount, unit),
  };
}

function multiplierFromAnswer(answer = '', topic = '') {
  if (topic === 'cooking_method') {
    return cookingMethodMultiplier(answer);
  }
  const t = String(answer).toLowerCase();
  if (/^not sure$/i.test(t)) return null;
  if (/^none$|no additional oil|without (oil|butter|ghee)/.test(t)) return 1.0;
  if (/more than 1 tablespoon|more than one tablespoon/.test(t)) return 1.28;
  if (/1 tablespoon|one tablespoon|1 tbsp/.test(t)) return 1.15;
  if (/1 teaspoon|one teaspoon|1 tsp/.test(t)) return 1.08;
  if (/mayonnaise/.test(t)) return 1.2;
  if (/yoghurt|yogurt/.test(t)) return 0.95;
  if (/tomato-based|tomato based/.test(t)) return 1.0;
  if (/curry sauce/.test(t)) return 1.12;
  if (/deep.?fried|deep fried/.test(t)) return 1.5;
  if (/oily|restaurant|greasy|lots of (oil|ghee)/.test(t)) return 1.25;
  if (/very little|light|minimal|dry/.test(t)) return 0.85;
  if (/normal|regular|home/.test(t)) return 1.0;
  if (/lots of|thick|heavy|extra/.test(t)) return 1.25;
  if (/mostly dry|little sauce/.test(t)) return 0.85;
  if (/extra cheesy|extra cream|very creamy/.test(t)) return 1.35;
  if (/light|little cheese/.test(t)) return 0.9;
  if (/grill|baked|steamed|boiled|tandoori|air.?fry/.test(t)) return 0.9;
  if (/pan.?fry|stir.?fry/.test(t)) return 1.05;
  if (/deep.?fry|fried/.test(t)) return 1.35;
  if (/diet|zero|sugar.?free/.test(t)) return 0.15;
  if (/regular|full sugar/.test(t)) return 1.0;
  return null;
}

function parsePresetAmount(answer = '') {
  const t = String(answer || '').toLowerCase();
  if (/^none$|^no\b|no milk|no sugar|black/.test(t) && !/\d/.test(t)) {
    return { amount: 0, unit: /\bml\b/.test(t) ? 'ml' : 'g' };
  }
  const ml = t.match(/(\d+(?:\.\d+)?)\s*ml\b/);
  if (ml) return { amount: Number(ml[1]), unit: 'ml' };
  const tsp = t.match(/(\d+(?:\.\d+)?)\s*(tsp|teaspoons?)\b/);
  if (tsp) return { amount: Number(tsp[1]) * 4, unit: 'g' };
  const direct = parseGramsFromText(answer);
  if (direct > 0) return { amount: direct, unit: /\bml\b/i.test(answer) ? 'ml' : 'g' };
  const approx = String(answer).match(/~\s*(\d+(?:\.\d+)?)\s*(g|ml)?/i);
  if (approx) {
    return {
      amount: Number(approx[1]),
      unit: (approx[2] || 'g').toLowerCase() === 'ml' ? 'ml' : 'g',
    };
  }
  return { amount: 0, unit: 'g' };
}

function itemMatchesPortionTopic(item, topic, ctxText = '') {
  const text = itemText(item);
  switch (topic) {
    case 'portion_rice':
      return /\b(rice|biryani|pulao|pilau|fried rice|sadam|chawal)\b/.test(text);
    case 'portion_snack':
      return /\b(snack|chip|crisp|nut|biscuit|cookie|samosa|pakora|vada|fries|chips|namkeen|popcorn|chocolate)\b/.test(text);
    case 'portion_takeaway':
      return true;
    case 'portion_starter':
      return Boolean(matchIndianStarterRef(text))
        || /\b(65|manchurian|sukka|chukka|varuval|lollipop|chilli\s+(chicken|paneer|gobi|mushroom|fish)|dragon\s+chicken|schezwan|pepper\s+chicken|fish\s+fry|prawn\s+fry|chicken\s+fry|crispy\s+chicken|garlic\s+chicken|salt\s+(?:and\s+)?pepper\s+chicken)\b/.test(text);
    case 'dessert_portion':
      return /\b(cake|dessert|ice cream|pudding|brownie|cookie|pastry|donut|mithai|kulfi|pie|tart|sweet)\b/.test(text)
        || /\b(dessert|cake|sweet)\b/.test(ctxText);
    default:
      return true;
  }
}

function pickItemsForTopic(items = [], topic, ctxText = '') {
  const matched = items.filter((item) => itemMatchesPortionTopic(item, topic, ctxText));
  if (matched.length) return matched;
  if (topic === 'portion_takeaway' || topic === 'portion_solid' || topic === 'portion_starter') {
    const sorted = [...items].sort((a, b) => num(b.calories_kcal) - num(a.calories_kcal));
    return sorted.slice(0, Math.min(2, sorted.length));
  }
  return items.slice(0, 1);
}

function applyPortionTopic(items, topic, answer, ctxText) {
  const { amount, unit } = parsePresetAmount(answer);
  if (amount <= 0) return items;

  const targets = pickItemsForTopic(items, topic, ctxText);
  if (!targets.length) {
    const totalCurrent = items.reduce((sum, item) => sum + inferItemGrams(item), 0) || 250;
    const factor = amount / totalCurrent;
    return items.map((item) => ({
      ...scaleItem(item, factor, { localClarify: true }),
      _clarifyAdjusted: true,
      _reviewHint: buildAdjustedHint(topic, answer, item.name),
    }));
  }

  const targetSet = new Set(targets);
  const updated = items.map((item) => {
    if (!targetSet.has(item)) return item;
    const share = targets.length > 1 ? amount / targets.length : amount;
    return {
      ...rescaleItemToAmount(item, share, unit),
      _clarifyAdjusted: true,
      _localClarify: true,
    };
  });
  return markPortionClarifyHints(updated, topic, answer);
}

function isSoftDrinkItem(item) {
  return /\b(coke|cola|pepsi|soda|soft drink|fizzy|lemonade|sprite|fanta|irn.?bru|dr pepper|energy drink)\b/.test(itemText(item));
}

function isHotDrinkItem(item) {
  return /\b(coffee|tea|chai|latte|cappuccino|americano|espresso|mocha|drink|beverage|matcha)\b/.test(itemText(item));
}

function buildVerifiedAddon(name, query, grams, unit, kind) {
  const ref = matchFoodReference(query);
  if (!ref || !(grams > 0)) return null;
  const scaled = nutritionForAmount(per100FromReference(ref), grams);
  return {
    name,
    portion_estimate: `${name} (~${Math.round(grams)}${unit})`,
    calories_kcal: scaled.calories_kcal,
    nutrition: scaled.nutrition,
    grams,
    _refId: ref.id,
    _authoritative: true,
    _clarifyAdjusted: true,
    _localClarify: true,
    _drinkAddon: kind,
    _displayUnit: unit,
    _volumeMl: unit === 'ml' ? grams : undefined,
    _reviewHint: `Added from your ${kind} answer`,
  };
}

function replaceDrinkAddon(items, kind, grams, unit, query, name) {
  const without = (items || []).filter((item) => item._drinkAddon !== kind);
  if (!(grams > 0)) return without;
  const addon = buildVerifiedAddon(name, query, grams, unit, kind);
  return addon ? [...without, addon] : without;
}

function applyDrinkMilk(items, answer) {
  const { amount } = parsePresetAmount(answer);
  return replaceDrinkAddon(items, 'milk', amount, 'ml', 'semi-skimmed milk', 'Semi-skimmed milk');
}

function applyDrinkSugar(items, answer) {
  const { amount } = parsePresetAmount(answer);
  return replaceDrinkAddon(items, 'sugar', amount, 'g', 'sugar', 'Sugar');
}

function applyDrinkStyle(items, answer) {
  const t = String(answer).toLowerCase();
  let sugarG = 0;
  let milkKcal = 0;
  if (/black|no milk|no sugar/.test(t)) {
    sugarG = 0;
    milkKcal = 0;
  } else if (/splash/.test(t)) {
    milkKcal = 15;
  } else if (/oat|almond|plant/.test(t)) {
    milkKcal = 35;
  } else if (/regular milk|semi.?skim|milk/.test(t)) {
    milkKcal = 45;
  }
  if (/2 tsp|two sugar|8 g sugar/.test(t)) sugarG = 8;
  else if (/1 tsp|one sugar|4 g sugar/.test(t)) sugarG = 4;
  else if (/sweetened|chai|karak|latte|15 g sugar/.test(t)) sugarG = 15;

  return items.map((item) => {
    if (!isHotDrinkItem(item)) return item;
    const baseKcal = num(item.calories_kcal);
    const addedKcal = milkKcal + sugarG * 4;
    const factor = baseKcal > 0 ? (baseKcal + addedKcal) / baseKcal : 1 + addedKcal / 40;
    const scaled = scaleItem(item, factor, { localClarify: true });
    const n = scaled.nutrition || {};
    return {
      ...scaled,
      nutrition: {
        ...n,
        carbs_g: round1(num(n.carbs_g) + sugarG),
        sugar_g: round1(num(n.sugar_g) + sugarG),
      },
    };
  });
}

function applySoftDrinkType(items, answer) {
  const t = String(answer || '').toLowerCase();
  if (/not sure/.test(t)) return items;
  const wantZero = /diet|zero|sugar.?free/.test(t);
  const wantRegular = /regular|full sugar|normal/.test(t);
  if (!wantZero && !wantRegular) return items;

  return items.map((item, index) => {
    if (!isSoftDrinkItem(item) && items.length > 1 && index > 0) return item;
    const ml = Math.max(1, inferItemGrams(item));
    if (wantZero) {
      return {
        ...item,
        calories_kcal: Math.max(1, Math.round(ml * 0.008)),
        nutrition: {
          ...(item.nutrition || {}),
          protein_g: 0,
          carbs_g: 0,
          fat_g: 0,
          sugar_g: 0,
        },
        grams: ml,
        _displayUnit: 'ml',
        _volumeMl: ml,
        _localClarify: true,
        _clarifyAdjusted: true,
        _refId: 'zero_sugar_soft_drink',
        _authoritative: true,
        _nutritionSource: 'zero_drink_guard',
      };
    }
    const ref = matchFoodReference(String(item.name || '').replace(/\b(diet|zero|sugar[ -]?free)\b/gi, 'cola') || 'cola')
      || matchFoodReference('cola');
    if (!ref) return item;
    const scaled = nutritionForAmount(per100FromReference(ref), ml);
    return {
      ...item,
      calories_kcal: scaled.calories_kcal,
      nutrition: scaled.nutrition,
      grams: ml,
      _displayUnit: 'ml',
      _volumeMl: ml,
      _localClarify: true,
      _clarifyAdjusted: true,
      _refId: ref.id,
      _authoritative: true,
    };
  });
}

function applyFatStyle(items, topic, answer) {
  if (topic === 'cooking_method') {
    const factor = multiplierFromAnswer(answer, topic);
    if (factor == null) return items;
    const method = resolveCookingMethodFromAnswer(answer);
    return items.map((item) => {
      if (!itemMatchesCookingMethod(item, method)) return item;
      if (Math.abs(factor - 1) < 0.02) return item;
      return {
        ...scaleItem(item, factor, { localClarify: true }),
        _clarifyAdjusted: true,
        _reviewHint: cookingMethodReviewHint(method, item.name),
      };
    });
  }

  const factor = multiplierFromAnswer(answer, topic);
  if (factor == null) return items;

  const re = topic === 'oil_fat'
    ? /\b(fried|fry|pakora|samosa|vada|tempura|crisp|chips|fries|katsu|spring roll|prawn toast|bhaji)\b/
    : topic === 'sauce_gravy'
      ? /\b(curry|gravy|masala|korma|sauce|dal|sambar|stew|soup)\b/
      : /\b(cheese|korma|alfredo|carbonara|paneer|cream|mac and cheese|pizza)\b/;

  return items.map((item) => (re.test(itemText(item)) ? scaleItem(item, factor, { localClarify: true }) : item));
}

function proteinRefForAnswer(answer = '') {
  const t = answer.toLowerCase();
  if (/chicken/.test(t)) return matchFoodReference('chicken curry');
  if (/lamb|beef|mutton/.test(t)) return matchFoodReference('lamb curry');
  if (/fish|seafood|prawn|shrimp/.test(t)) return matchFoodReference('fish curry');
  if (/paneer|tofu|veg|dal/.test(t)) return matchFoodReference('paneer curry') || matchFoodReference('dal tadka');
  return null;
}

function applyProteinType(items, answer) {
  const ref = proteinRefForAnswer(answer);
  if (!ref) return items;

  const per100 = per100FromReference(ref);
  return items.map((item, index) => {
    if (index !== 0 && items.length > 1) return item;
    const grams = inferItemGrams(item);
    const scaled = nutritionForAmount(per100, grams);
    return {
      ...item,
      name: item.name?.includes('curry') ? item.name : ref.id.replace(/_/g, ' '),
      portion_estimate: formatPortionEstimate(item.portion_estimate || item.name, grams),
      calories_kcal: scaled.calories_kcal,
      nutrition: scaled.nutrition,
      _refId: ref.id,
    };
  });
}

function itemMatchesAbout(item, about = '') {
  const name = String(item?.name || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const target = String(about || '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!name || !target) return false;
  return name === target || name.includes(target) || target.includes(name);
}

function applyNamedPortion(items, about, answer) {
  const { amount, unit } = parsePresetAmount(answer);
  if (amount <= 0) return items;
  let matched = false;
  const updated = items.map((item) => {
    if (!itemMatchesAbout(item, about)) return item;
    matched = true;
    return {
      ...rescaleItemToAmount(item, amount, unit === 'ml' ? 'ml' : 'g'),
      _clarifyAdjusted: true,
      _localClarify: true,
    };
  });
  if (!matched) return applyPortionTopic(items, 'portion_solid', answer, '');
  return markPortionClarifyHints(updated, 'portion_item', answer);
}

function applySingleAnswer(analysis, { topic, answer, about = '', question = '' }) {
  if (!topic || !answer) return analysis;
  const namedAbout = about || (String(question).match(/grams of\s+(.+?)\??$/i) || [])[1] || '';

  const ctxText = mealText(analysis);
  let items = [...(analysis.items || [])];

  if (/^drink_/.test(topic) && topic.endsWith('_size')) {
    const { amount, unit } = parsePresetAmount(answer);
    if (amount > 0) {
      items = items.map((item, index) => {
        const isDrink = /\b(drink|coffee|tea|wine|beer|juice|soda|cola|latte|lassi|smoothie|water|ml\b)\b/.test(itemText(item));
        if (!isDrink && items.length > 1) return item;
        if (items.length === 1 || isDrink || index === 0) {
          return {
            ...rescaleItemToAmount(item, amount, unit === 'ml' ? 'ml' : unit),
            _displayUnit: unit === 'ml' ? 'ml' : item._displayUnit,
            _volumeMl: unit === 'ml' ? amount : item._volumeMl,
            _clarifyAdjusted: true,
            _localClarify: true,
          };
        }
        return item;
      });
    }
  } else if (topic === 'drink_coffee_milk') {
    items = applyDrinkMilk(items, answer);
  } else if (topic === 'drink_coffee_sugar') {
    items = applyDrinkSugar(items, answer);
  } else if (topic === 'drink_coffee_tea_style') {
    items = applyDrinkStyle(items, answer);
  } else if (topic === 'drink_soft_type') {
    items = applySoftDrinkType(items, answer);
  } else if (topic === 'bread_count') {
    items = applyBreadCountToItems(items, answer, analysis);
    items = markPortionClarifyHints(items, topic, answer);
  } else if (
    topic === 'portion_rice'
    || topic === 'portion_starter'
    || topic === 'portion_solid'
    || topic === 'portion_takeaway'
    || topic === 'portion_snack'
    || topic === 'dessert_portion'
    || topic === 'generic_portion'
  ) {
    items = applyPortionTopic(items, topic, answer, ctxText);
  } else if (topic === 'portion_item') {
    items = applyNamedPortion(items, namedAbout, answer);
  } else if (topic === 'meal_source') {
    const source = parseCookingSourceFromAnswer(answer);
    if (source === 'takeaway') {
      items = applyPortionTopic(items, 'portion_takeaway', 'Regular takeaway box (~300 g)', ctxText);
    } else if (source === 'restaurant') {
      items = applyPortionTopic(items, 'portion_solid', 'Takeaway / restaurant (~300 g)', ctxText);
    }
    items = items.map((item) => (item._recipeDerived ? {
      ...item,
      _clarifyAdjusted: true,
      _reviewHint: `Portion scaled for ${source || 'your'} source answer`,
    } : item));
  } else if (topic === 'oil_fat' || topic === 'sauce_gravy' || topic === 'cheese_cream' || topic === 'cooking_method') {
    items = applyFatStyle(items, topic, answer);
  } else if (topic === 'protein_type') {
    items = applyProteinType(items, answer);
  }

  return {
    ...analysis,
    items,
    clarification_questions: [],
  };
}

/**
 * Apply every answer already given — including when later questions are skipped.
 * Empty / missing answers are ignored so Skip does not wipe earlier answers.
 */
export function finalizeClarificationAnswers(analysis, answers = []) {
  if (!analysis) return analysis;
  const collected = (answers || []).filter((entry) => String(entry?.answer || '').trim());
  if (!collected.length) return analysis;
  return applyClarificationsLocally(analysis, collected);
}

/**
 * @param {object} analysis
 * @param {Array<{ topic?: string, answer?: string }>} answers
 */
export function applyClarificationsLocally(analysis, answers = []) {
  if (!analysis || !answers.length) return analysis;

  const cookingOpts = cookingOptsFromClarifyAnswers(answers);
  if (
    analysis._recipeDecomposed
    && analysis._sourceText
    && (cookingOpts.cookingSource || cookingOpts.oilLevel)
  ) {
    const resolved = resolveMealFromText(analysis._sourceText, cookingOpts);
    if (resolved?.items?.some((i) => i._recipeDerived)) {
      return sanitizeAnalysisTotals({
        ...resolved,
        clarification_questions: [],
        _clarifiedLocally: true,
        _clarifyAnswers: answers.map((a) => ({ topic: a.topic, answer: a.answer })),
        _mixedDishClarified: true,
      });
    }
  }

  let working = { ...analysis, items: [...(analysis.items || [])] };
  for (const entry of answers) {
    working = applySingleAnswer(working, entry);
  }

  return sanitizeAnalysisTotals({
    ...working,
    clarification_questions: [],
    _clarifiedLocally: true,
    _clarifyAnswers: answers.map((a) => ({ topic: a.topic, answer: a.answer })),
  });
}

/** Short banner for clarify UI — which lines a portion answer affects. */
export function clarifyScopeHint(steps = [], analysis = null) {
  const topics = new Set(steps.map((s) => s.topic));
  const itemNames = (analysis?.items || []).map((i) => i.name).filter(Boolean);
  const hasRice = itemNames.some((n) => /\brice\b/i.test(n));
  const hasCurry = itemNames.some((n) => /\bcurry\b/i.test(n));
  if (topics.has('portion_rice') && hasRice && hasCurry) {
    return 'Your rice answer updates the rice line only — curry and sides keep their photo estimate until you change them on review.';
  }
  if (topics.has('portion_rice') && itemNames.length > 1) {
    return 'Your rice answer updates rice portions only — other items stay as estimated from the photo.';
  }
  if (topics.has('bread_count') && itemNames.length > 1) {
    return 'Piece count updates only the idli, dosa, or bread line — sides such as sambar stay as estimated until you edit them.';
  }
  if (topics.has('portion_starter')) {
    return 'Your starter answer sets the plate size — sides and drinks keep their photo estimate unless you edit them on review.';
  }
  return 'Answers adjust matching items only — tweak any line on the review screen before saving.';
}

/**
 * Preview kcal impact of a pending answer (for live UI).
 */
export function previewClarificationImpact(analysis, priorAnswers = [], pendingAnswer = '', pendingTopic = '') {
  const base = priorAnswers.length
    ? applyClarificationsLocally(analysis, priorAnswers)
    : analysis;
  const beforeKcal = Math.round(num(base?.total_calories_kcal));
  if (!pendingAnswer) {
    return { beforeKcal, afterKcal: beforeKcal };
  }
  const updated = applyClarificationsLocally(base, [{ topic: pendingTopic, answer: pendingAnswer }]);
  return {
    beforeKcal,
    afterKcal: Math.round(num(updated.total_calories_kcal)),
  };
}
