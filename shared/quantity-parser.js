/**
 * Universal meal-description quantity parser.
 * Separates "how much" from "what food" — nutrition scaling uses portion-models + per-100g refs.
 */

import { parseSizeModifier, countToNutritionGrams } from './portion-models.js';
import { normalizeCanonicalFoodText } from './canonical-food-identity.js';

export const WORD_NUMBERS = {
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  half: 0.5,
  quarter: 0.25,
};

const FRACTION_RE = /\b(\d+)\s*\/\s*(\d+)\b/;

function wordToNumber(token = '') {
  const t = String(token).trim().toLowerCase();
  if (WORD_NUMBERS[t] != null) return WORD_NUMBERS[t];
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseFraction(text = '') {
  const m = String(text).match(FRACTION_RE);
  if (!m) return null;
  const den = Number(m[2]);
  if (!den) return null;
  return Number(m[1]) / den;
}

/** Side dishes / accompaniments — split "curry with rice" into separate phrases. */
const ACCOMPANIMENT_HEAD_RE = /(?:\d+\s*(?:g|ml|piece|pieces|slice|slices|cup|cups|bowl|tbsp|tsp|ladle|katori)\b|\d+\s+(?:roti|rotis|chapati|chapatis|naan|idli|idlis)\b|[\d/]|\b(?:two|three|four|one|a|an|half|quarter)\b|\b(?:basmati|brown|white|jeera|fried|steamed|cooked|plain|tomato|coconut|onion|cucumber|mint|boondi|wholemeal|baked)\s+)?(?:rice|raita|raitha|chutney|sambar|dal|daal|roti|rotis|naan|chapati|chapatis|bread|toast|fries|chips|peas|potatoes?|carrots?|salad|sabzi|bhaji|gravy|sauce|pickle|papad|poppadom|curd|yogurt|yoghurt|peanuts?|butter|salna|rasam|edamame|soy\s+sauce|puri|idli|dosa|bhatura|pav|raitha|injera|beans?)/i;

/** Connectors that may separate independent meal components. */
const FOOD_CONNECTOR_RE = /\s+(?:with|and|plus|alongside)\s+/i;

/** Food signals for bidirectional connector splitting — order-independent. */
const FOOD_SEGMENT_SIGNAL_RE = /\d+\s*(?:g|ml|kg|l)\b|\d+\s+(?:roti|rotis|chapati|chapatis|naan|idli|idlis|dosas?|slices?|pieces?|bhaturas?|bhature|eggs?)\b|\b(?:two|three|four|five|six|seven|eight|nine|ten|\d+)\s+(?:chapati|chapatis|roti|rotis|idli|idlis|dosa|dosas|bhature|bhaturas|slice|slices|piece|pieces|egg|eggs)\b|\b(?:korma|curry|masala|tikka|biryani|chutney|sambar|raita|raitha|rice|chole|bhature|bhatura|poha|paneer|dal|daal|naan|dosa|idli|fish|cod|chips|toast|beans|butter|oats|milk|peanut|peanuts|sabzi|bhaji|pav|paratha|roti|soup|porridge|yogurt|cheese|chicken|lamb|beef|egg|salmon|tuna|peas|mushy|battered|vegetable|veg|puri|sambar|rasam|edamame|mushy\s+peas|jacket\s+potato|baked\s+beans)\b/i;

/** Main dish + side — "uttapam with chutney", "biryani with raita". */
const MAIN_DISH_WITH_SIDE_RE = /\b(uttapam|uthappam|masala\s+dosa|plain\s+dosa|idli|idlis?|idly|idlies|biryani|pulao|pulav|tikka\s+masala|chole\s+bhature|pav\s+bhaji|poha|palak\s+paneer|saag\s+paneer|doro\s+wat|jacket\s+potato|baked\s+potato|(?:veg|vegetable|paneer|chicken|lamb|mutton|beef|fish|prawn|paneer)\s+(?:korma|curry|masala))\b\s+with\s+/i;

/** Compound dishes — never split "on" inside these phrases. */
const COMPOUND_ON_DISH_RE = /\bbeans\s+on\s+toast\b|\bscrambled\s+eggs?\s+on\s+toast\b|\bavocado\s+on\s+toast\b|\bcheese\s+on\s+toast\b|\begg\s+on\s+toast\b/i;

/** Keep butter on beans-on-toast as one phrase for recipe decomposition. */
const COMPOUND_DISH_WITH_BUTTER_RE = /\bbeans\s+on\s+toast\s+with\s+butter\b/i;
const COMPOUND_RICE_STEW_RE = /\brice\s+and\s+stew\b|\brice\s+with\s+stew\b|\bwhite\s+rice\s+and\s+stew\b/i;

/** Space-separated lists without commas — "toast beans butter". */
const SPACE_SEPARATED_FOOD_WORDS = new Set([
  'toast', 'bread', 'beans', 'butter', 'milk', 'oats', 'oat', 'banana', 'egg', 'eggs',
  'peanuts', 'peanut', 'rice', 'raita', 'raitha', 'biryani', 'poha', 'sambar', 'chutney',
  'dal', 'daal', 'roti', 'rotis', 'naan', 'coffee', 'tea', 'cheese', 'yogurt', 'yoghurt',
  'curd', 'peas', 'chips', 'fries', 'salad', 'soup', 'chicken', 'fish', 'paneer',
]);

const PREP_STATE_PATTERNS = [
  { state: 'raw', re: /\b(?:dry|raw|uncooked|unsoaked)\b/i },
  { state: 'cooked', re: /\b(?:cooked|boiled|steamed|prepared|made|overnight)\b/i },
  { state: 'cooked', re: /\bporridge\b(?!\s+oats\b)/i },
  { state: 'fried', re: /\b(?:fried|deep[\s-]?fried|pan[\s-]?fried|saut[eé]ed)\b/i },
  { state: 'drained', re: /\b(?:drained|well[\s-]?drained)\b/i },
];

/**
 * Detect preparation state and strip modifier tokens from food text.
 * @param {string} text
 * @returns {{ state: 'raw'|'cooked'|'fried'|'drained'|'dry'|null, foodText: string }}
 */
export function parsePreparationState(text = '') {
  const raw = String(text).trim();
  if (!raw) return { state: null, foodText: raw };

  let state = null;
  let foodText = raw;
  for (const rule of PREP_STATE_PATTERNS) {
    if (!rule.re.test(raw)) continue;
    state = rule.state === 'raw' ? 'dry' : rule.state;
    foodText = foodText.replace(rule.re, ' ').replace(/\s+/g, ' ').trim();
    break;
  }
  return { state, foodText: foodText || raw };
}

export function segmentLooksLikeFood(segment = '') {
  const s = String(segment).trim();
  if (!s) return false;
  if (COMPOUND_ON_DISH_RE.test(s)) return false;
  if (/\bmade\s+with\b/i.test(s)) return false;
  return FOOD_SEGMENT_SIGNAL_RE.test(s);
}

/**
 * Split on with/and/plus/alongside when both sides look like food — order-independent.
 * @param {string} text
 */
function splitBidirectionalFoodConnectors(text = '') {
  let working = String(text).trim();
  if (!working || !FOOD_CONNECTOR_RE.test(working)) return working;
  if (COMPOUND_DISH_WITH_BUTTER_RE.test(working)) return working;
  if (COMPOUND_RICE_STEW_RE.test(working)) return working;
  if (/\b(?:porridge|oats|oatmeal)\b[^,]*\bmade\s+with\s+(?:water|milk)\b/i.test(working)) return working;

  let safety = 0;
  while (FOOD_CONNECTOR_RE.test(working) && safety < 8) {
    safety += 1;
    const match = working.match(FOOD_CONNECTOR_RE);
    if (!match || match.index == null) break;
    const left = working.slice(0, match.index).trim();
    const right = working.slice(match.index + match[0].length).trim();
    if (segmentLooksLikeFood(left) && segmentLooksLikeFood(right)) {
      working = `${left}, ${right}`;
      continue;
    }
    break;
  }
  return working;
}

function preSplitCompoundPhrases(text = '') {
  let working = String(text).trim();
  if (!working) return working;
  if (COMPOUND_DISH_WITH_BUTTER_RE.test(working)) return working;
  if (COMPOUND_RICE_STEW_RE.test(working)) return working;

  working = splitBidirectionalFoodConnectors(working);

  const compoundOn = COMPOUND_ON_DISH_RE.test(working) ? working.match(COMPOUND_ON_DISH_RE)?.[0] : null;
  const compoundPlaceholder = compoundOn ? compoundOn.replace(/\s+/g, ' ') : null;
  if (compoundPlaceholder) {
    working = working.replace(COMPOUND_ON_DISH_RE, '__COMPOUND_ON__');
  }

  if (!/\b(?:porridge|oats|oatmeal)\b[^,]*\bmade\s+with\s+(?:water|milk)\b/i.test(working)) {
    working = working.replace(/\s+made\s+with\s+/i, ', ');
  }
  working = working.replace(MAIN_DISH_WITH_SIDE_RE, '$1, ');
  working = working.replace(/\b(jacket\s+potato|baked\s+potato)\s+with\s+/i, '$1, ');
  working = working.replace(
    /\b((?:\d+\s+)?(?:plain\s+)?(?:dosa|dosas|idli|idlis|idly|idlies))\s+with\s+(?=(?:meat|chicken|lamb|mutton|beef|fish|prawn|paneer|veg|vegetable)\s+curry\b)/i,
    '$1, ',
  );
  working = working.replace(
    new RegExp(`\\s+with\\s+(?=${ACCOMPANIMENT_HEAD_RE.source})`, 'i'),
    ', ',
  );
  working = working.replace(
    /\s+with\s+(?=\d+\s*(?:g|ml|l|litre|liter)\b|\bmilk\b|\b(?:semi|skim|whole|semi-skimmed|semi skimmed)\s*milk\b)/i,
    ', ',
  );
  working = working.replace(
    /\s+with\s+(?=potatoes?\b)/i,
    ', ',
  );
  working = working.replace(/\bbratwurst\s+with\s+/i, 'bratwurst, ');
  working = working.replace(
    /\s+on\s+(?=\d|\b(?:two|three|four|one|a|an|half|quarter)\b|\bslice|\bslices)/i,
    ', ',
  );

  if (compoundPlaceholder) {
    working = working.replace('__COMPOUND_ON__', compoundPlaceholder);
  }
  return working;
}

function isSpaceSeparatedFoodWord(token = '') {
  const lower = String(token).toLowerCase();
  if (SPACE_SEPARATED_FOOD_WORDS.has(lower)) return true;
  if (lower.endsWith('s') && SPACE_SEPARATED_FOOD_WORDS.has(lower.slice(0, -1))) return true;
  return false;
}

/** Split "200g chole 2 bhature" style inline multi-quantity phrases. */
function trySplitInlineQuantitySegments(text = '') {
  const raw = String(text).trim();
  if (!raw || /[,;+]|(?:^|\s)and(?:\s|$)/i.test(raw)) return null;

  const segments = raw
    .split(/\s+(?=(?:(?:two|three|four|\d+(?:\.\d+)?)\s*(?:g|ml|kg|l|piece|pieces|slice|slices)\b))/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return segments.length > 1 ? segments : null;
}

/** Split "toast beans butter" style lists when no commas/and/with are present. */
function trySplitSpaceSeparatedList(text = '') {
  const raw = String(text).trim();
  if (!raw || /[,;+]|(?:^|\s)and(?:\s|$)|\bwith\b/i.test(raw)) return null;
  if (/\d+\s*(?:g|ml|kg|l|piece|pieces|slice|slices|cup|cups|tbsp|tsp|bowl)\b/i.test(raw)) return null;

  const leadCount = raw.match(/^((?:two|three|four|\d+(?:\.\d+)?)\s+(\w+))\s+(.+)$/i);
  if (leadCount) {
    const firstFood = leadCount[2].toLowerCase();
    const rest = leadCount[3].split(/\s+/).filter(Boolean);
    if (isSpaceSeparatedFoodWord(firstFood) && rest.length >= 1 && rest.every(isSpaceSeparatedFoodWord)) {
      return [leadCount[1].trim(), ...rest];
    }
  }

  const tokens = raw.split(/\s+/).filter(Boolean);
  if (tokens.length < 2 || tokens.length > 8) return null;
  if (!tokens.every((token) => isSpaceSeparatedFoodWord(token))) return null;
  return tokens;
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function splitMealPhrases(text = '') {
  const raw = String(text).trim();
  if (!raw) return [];

  const normalized = preSplitCompoundPhrases(raw);
  const parts = normalized
    .split(/\s*[,;+]+\s*|\s+\+\s+|\s+\band\b\s+(?=[\d\w(])/i)
    .map((p) => p.trim())
    .filter(Boolean);

  if (parts.length > 1) return parts;

  const inlineSplit = trySplitInlineQuantitySegments(parts[0] || normalized);
  if (inlineSplit?.length) return inlineSplit;

  const spaceSplit = trySplitSpaceSeparatedList(parts[0] || normalized);
  if (spaceSplit?.length) return spaceSplit;

  return parts.length ? parts : [raw];
}

/**
 * Parse quantity + unit from free text.
 * @param {string} text
 * @returns {{
 *   foodText: string,
 *   quantity: number|null,
 *   amount: number|null,
 *   unit: string,
 *   kind: 'weight'|'volume'|'count',
 *   size: 'small'|'medium'|'large'|null,
 *   explicit: boolean,
 *   phrase: string,
 * }}
 */
export function parseQuantityFromText(text = '') {
  const raw = String(text).trim();
  const size = parseSizeModifier(raw);
  let foodText = raw;
  let quantity = null;
  let unit = 'serving';
  let kind = 'weight';
  let explicit = false;

  const colon = raw.match(/^([^:]+):\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l|litre|liter|litres|liters|pieces?|pcs?|slices?)\b/i);
  if (colon) {
    const token = colon[3].toLowerCase();
    quantity = Number(colon[2]);
    if (token === 'kg') {
      quantity *= 1000;
      unit = 'g';
      kind = 'weight';
    } else if (/^l|litre|liter/.test(token)) {
      quantity *= 1000;
      unit = 'ml';
      kind = 'volume';
    } else if (/ml/.test(token)) {
      unit = 'ml';
      kind = 'volume';
    } else if (/piece|pc|slice/.test(token)) {
      unit = 'piece';
      kind = 'count';
    } else {
      unit = 'g';
      kind = 'weight';
    }
    explicit = true;
    foodText = colon[1].trim();
    return wrapParsed({ foodText, quantity, unit, kind, size, explicit, phrase: raw });
  }

  const dashPiece = raw.match(/(\d+(?:\.\d+)?)\s*-\s*piece/i);
  if (dashPiece) {
    explicit = true;
    quantity = Number(dashPiece[1]);
    unit = 'piece';
    kind = 'count';
    foodText = raw.replace(dashPiece[0], '').trim() || raw;
    return wrapParsed({ foodText, quantity, unit, kind, size, explicit, phrase: raw });
  }

  const wordCup = raw.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|\d+(?:\.\d+)?)\s*(?:cups?)\b/i,
  );
  if (wordCup) {
    quantity = (wordToNumber(wordCup[1]) ?? Number(wordCup[1])) * 240;
    if (quantity > 0) {
      explicit = true;
      unit = 'g';
      kind = 'weight';
      foodText = raw.replace(wordCup[0], '').trim() || raw;
      return wrapParsed({ foodText, quantity, unit, kind, size, explicit, phrase: raw });
    }
  }

  const units = [
    { re: /(\d+(?:\.\d+)?)\s*ml\b/i, unit: 'ml', kind: 'volume' },
    { re: /(\d+(?:\.\d+)?)\s*(?:litre|liter|litres|liters|l)\b/i, unit: 'ml', kind: 'volume', scale: 1000 },
    { re: /(\d+(?:\.\d+)?)\s*kg\b/i, unit: 'g', kind: 'weight', scale: 1000 },
    { re: /(\d+(?:\.\d+)?)\s*g\b/i, unit: 'g', kind: 'weight' },
    { re: /(\d+(?:\.\d+)?)\s*(?:tbsp|tablespoons?)\b/i, unit: 'g', kind: 'weight', scale: 15 },
    { re: /(\d+(?:\.\d+)?)\s*(?:tsp|teaspoons?)\b/i, unit: 'g', kind: 'weight', scale: 5 },
    { re: /(\d+(?:\.\d+)?)\s*(?:cups?)\b/i, unit: 'g', kind: 'weight', scale: 240 },
    { re: /(\d+(?:\.\d+)?)\s*(?:bowls?)\b/i, unit: 'g', kind: 'weight', scale: 180 },
    { re: /(\d+(?:\.\d+)?)\s*(?:pieces?|pcs?|slices?)\b/i, unit: 'piece', kind: 'count' },
  ];

  for (const rule of units) {
    const m = raw.match(rule.re);
    if (!m) continue;
    explicit = true;
    quantity = Number(m[1]) * (rule.scale || 1);
    unit = rule.unit;
    kind = rule.kind;
    foodText = raw.replace(m[0], '').trim() || raw;
    return wrapParsed({ foodText, quantity, unit, kind, size, explicit, phrase: raw });
  }

  const frac = parseFraction(raw);
  if (frac != null) {
    const fracMatch = raw.match(FRACTION_RE);
    if (fracMatch) {
      explicit = true;
      quantity = frac;
      unit = 'piece';
      kind = 'count';
      foodText = raw.replace(fracMatch[0], '').trim() || raw;
      return wrapParsed({ foodText, quantity, unit, kind, size, explicit, phrase: raw });
    }
  }

  const halfPortion = raw.match(/\b(half|quarter)\s+(?!english\b)([a-z][a-z\s-]{1,30})\b/i);
  if (halfPortion && !/\begg/i.test(halfPortion[0])) {
    quantity = wordToNumber(halfPortion[1]);
    if (quantity > 0) {
      explicit = true;
      unit = 'piece';
      kind = 'count';
      foodText = halfPortion[2].trim();
      return wrapParsed({ foodText, quantity, unit, kind, size, explicit, phrase: raw });
    }
  }

  const countWord = raw.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|half|\d+(?:\.\d+)?)\s+(?:(?:small|medium|large|boiled|fried|scrambled|poached|hard[\s-]?boiled|soft[\s-]?boiled)\s+)*eggs?\b/i,
  );
  if (countWord) {
    quantity = wordToNumber(countWord[1]) ?? Number(countWord[1]);
    if (quantity > 0) {
      explicit = true;
      unit = 'piece';
      kind = 'count';
      return wrapParsed({ foodText: raw, quantity, unit, kind, size, explicit, phrase: raw });
    }
  }

  const countBread = raw.match(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|\d+(?:\.\d+)?)\s+(?:small|medium|large)?\s*(?:chapati|chapatis|rotis?|naans?|dosas?|idlis?|idlies|idlys?|idly|puris?|bhaturas?|bhature|slices?|pieces?)\b/i,
  );
  if (countBread) {
    quantity = wordToNumber(countBread[1]) ?? Number(countBread[1]);
    if (quantity > 0) {
      explicit = true;
      unit = 'piece';
      kind = 'count';
      foodText = raw;
      return wrapParsed({ foodText, quantity, unit, kind, size, explicit, phrase: raw });
    }
  }

  const banana = raw.match(/\b(one|two|three|four|five|six|\d+(?:\.\d+)?)\s+(?:medium|large|small)?\s*bananas?\b/i);
  if (banana) {
    quantity = wordToNumber(banana[1]) ?? Number(banana[1]);
    if (quantity > 0) {
      explicit = true;
      unit = 'piece';
      kind = 'count';
      return wrapParsed({ foodText: raw, quantity, unit, kind, size, explicit, phrase: raw });
    }
  }

  if (/\b(chapati|roti|naan|dosa|idli|idly|idlies|idlys|puri|bhatura|egg|banana|slice|piece)\b/i.test(raw)) {
    kind = 'count';
    unit = 'piece';
  } else if (/\b(soup|sambar|rasam|drink|coffee|tea|juice|sauce|gravy|ml)\b/i.test(raw)) {
    kind = 'volume';
    unit = 'ml';
  }

  return wrapParsed({ foodText: raw, quantity: null, unit, kind, size, explicit: false, phrase: raw });
}

function wrapParsed(parsed) {
  const foodText = normalizeCanonicalFoodText(parsed.foodText || parsed.phrase || '');
  return {
    ...parsed,
    foodText: foodText || parsed.foodText,
    amount: parsed.quantity,
  };
}

/** Backward-compatible alias used by describe flow. */
export function extractQuantityFromPhrase(phrase = '') {
  return parseQuantityFromText(phrase);
}

/** True when user supplied an explicit amount in the phrase. */
export function phraseHasExplicitQuantity(q) {
  if (q?.explicit === true) return true;
  return q?.amount != null && q.amount > 0 && q.unit !== 'serving';
}

/**
 * Gram equivalent for calibration paths (photo AI, clarify answers).
 * @param {string} text
 * @returns {number}
 */
export function parseGramsFromText(text = '') {
  const q = parseQuantityFromText(text);
  if (q.explicit && q.quantity != null) {
    if (q.unit === 'ml' || q.kind === 'volume') return q.quantity;
    if (q.unit === 'g' || q.kind === 'weight') return q.quantity;
    if (q.unit === 'piece' || q.kind === 'count') {
      return countToNutritionGrams(q.quantity, q.foodText || text, { size: q.size });
    }
  }
  const legacyG = String(text).match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (legacyG) return Number(legacyG[1]);
  const legacyMl = String(text).match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (legacyMl) return Number(legacyMl[1]);
  return 0;
}

/**
 * @param {string} description
 * @returns {ReturnType<parseQuantityFromText>[]}
 */
export function parseMealDescription(description = '') {
  return splitMealPhrases(description).map((phrase) => ({
    phrase,
    ...parseQuantityFromText(phrase),
  }));
}
