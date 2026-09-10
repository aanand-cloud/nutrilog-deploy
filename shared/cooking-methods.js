/**
 * Cooking method notes → clarify answers → calorie multipliers.
 * Single source of truth for meal-details chips and local nutrition adjust.
 */

/** Ordered most-specific first. */
export const COOKING_METHODS = [
  {
    id: 'deep_fried',
    chip: 'Deep fried',
    clarifyAnswer: 'Deep-fried',
    factor: 1.45,
    patterns: [
      /\bdeep[\s-]?fried\b/,
      /\bdouble[\s-]?fried\b/,
      /\btempura\b/,
      /\bbattered\b/,
      /\bbreaded\b/,
    ],
  },
  {
    id: 'air_fried',
    chip: 'Air fried',
    clarifyAnswer: 'Air-fried',
    factor: 0.92,
    patterns: [
      /\bair[\s-]?fried\b/,
      /\bair[\s-]?fry(?:er|ed|ing)?\b/,
      /\bairfry(?:er|ed)?\b/,
    ],
  },
  {
    id: 'oven',
    chip: 'Oven baked',
    clarifyAnswer: 'Grilled / baked / oven',
    factor: 0.92,
    patterns: [
      /\boven[\s-]?(?:baked|bake|roasted|roast|cooked)\b/,
      /\broasted?\b/,
      /\bbaked?\b(?!\s+beans)/,
    ],
  },
  {
    id: 'grilled',
    chip: 'Grilled',
    clarifyAnswer: 'Grilled / baked / oven',
    factor: 0.9,
    patterns: [
      /\bgrill(?:ed|ing)?\b/,
      /\bbarbecue(?:d)?\b/,
      /\bbbq(?:ed)?\b/,
      /\btandoori\b/,
      /\bchar[\s-]?grilled\b/,
    ],
  },
  {
    id: 'steamed',
    chip: 'Steamed',
    clarifyAnswer: 'Steamed / boiled',
    factor: 0.88,
    patterns: [
      /\bsteamed?\b/,
      /\bboiled?\b/,
      /\bpoached\b/,
      /\bblanched\b/,
    ],
  },
  {
    id: 'pan_fried',
    chip: 'Pan fried',
    clarifyAnswer: 'Pan-fried / stir-fried',
    factor: 1.08,
    patterns: [
      /\bsaut[eé]ed\b/,
      /\bshallow[\s-]?fried\b/,
      /\b(?<!air[\s-])pan[\s-]?(?:fried|fry|frying)\b/,
      /\bstir[\s-]?fry(?:ed|ing)?\b/,
      /\b(?<!air[\s-])(?<!deep[\s-])\bfried\b/,
    ],
  },
  {
    id: 'raw',
    chip: 'Raw / salad',
    clarifyAnswer: 'Raw / salad',
    factor: 0.85,
    patterns: [
      /\braw\b/,
      /\buncooked\b/,
      /\bsalad\b(?!\s+dressing)/,
    ],
  },
];

/** Quick-pick chips for meal details UI. */
export const MEAL_COOKING_CHIPS = COOKING_METHODS.filter((m) => m.id !== 'raw').map((m) => m.chip);

export function parseCookingMethod(text = '') {
  const t = String(text).trim();
  if (t.length < 3) return null;
  for (const method of COOKING_METHODS) {
    if (method.patterns.some((re) => re.test(t))) return method;
  }
  return null;
}

export function resolveCookingMethodFromAnswer(answer = '') {
  const t = String(answer).trim().toLowerCase();
  if (!t) return null;
  const exact = COOKING_METHODS.find((m) => m.clarifyAnswer.toLowerCase() === t);
  if (exact) return exact;
  for (const method of COOKING_METHODS) {
    if (method.patterns.some((re) => re.test(t))) return method;
  }
  return null;
}

export function cookingMethodMultiplier(answer = '') {
  const method = resolveCookingMethodFromAnswer(answer);
  if (method) return method.factor;
  const t = String(answer).toLowerCase();
  if (/deep.?fried|deep fried/.test(t)) return 1.45;
  if (/air.?fry|airfried/.test(t)) return 0.92;
  if (/oven|roasted|roast.?ed/.test(t)) return 0.92;
  if (/grill|baked|tandoori/.test(t)) return 0.9;
  if (/steam|steamed|boiled|poached/.test(t)) return 0.88;
  if (/pan.?fry|stir.?fry|saut[eé]ed|shallow.?fry/.test(t)) return 1.08;
  if (/raw|salad/.test(t)) return 0.85;
  if (/deep.?fry|fried/.test(t)) return 1.35;
  return null;
}

function itemText(item = {}) {
  return `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isDrinkItem(text = '') {
  return /\b(tea|coffee|water|juice|cola|pepsi|soda|soft drink|lassi|shake|smoothie|wine|beer|milkshake)\b/.test(text);
}

function isPlainRiceSide(text = '') {
  return /\b(rice|chawal|sadam|pulao|pilau)\b/.test(text)
    && !/\b(fried rice|biryani|risotto|paella)\b/.test(text);
}

function isPlainDalSide(text = '') {
  return /\b(dal|sambar|rasam|raita|pickle|chutney)\b/.test(text)
    && !/\b(fried|pakora|vada|bhaji|bonda)\b/.test(text);
}

function isCookedMain(text = '', fatG = 0) {
  return /\b(chicken|fish|meat|lamb|beef|pork|paneer|tofu|potato|chip|fries|samosa|pakora|vada|nugget|wing|spring roll|katsu|bhaji|bonda|cutlet|steak|sausage|bacon|prawn|shrimp|egg|dosa|paratha|puri|tempura|fritter|falafel|tofu|mushroom|cauliflower|broccoli|burger|nuggets)\b/.test(text)
    || /\b(fried|crisp|grilled|baked|roast)\b/.test(text)
    || fatG >= 8;
}

/** Which lines cooking method should rescale (skip plain sides & drinks). */
export function itemMatchesCookingMethod(item, method = null) {
  const text = itemText(item);
  const fatG = num(item.nutrition?.fat_g);
  if (isDrinkItem(text)) return false;
  if (isPlainRiceSide(text) || isPlainDalSide(text)) return false;
  if (!method) return isCookedMain(text, fatG);

  if (method.factor > 1) {
    return isCookedMain(text, fatG);
  }

  return isCookedMain(text, fatG) || fatG >= 5;
}

export function cookingMethodReviewHint(method, itemName = '') {
  const label = method?.chip || method?.clarifyAnswer || 'cooking method';
  return `${itemName || 'Item'} adjusted for ${label.toLowerCase()} (from your notes)`;
}
