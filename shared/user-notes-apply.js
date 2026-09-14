/**
 * Deterministic application of customer meal notes to nutrition estimates.
 * Parses hidden / off-plate ingredients (oil, sugar, sauces, eggs, cheese, etc.)
 * and applies them to calories — not only AI guesswork.
 */

import { sanitizeAnalysisTotals } from './nutrition-sanitize.js';
import { applyClarificationsLocally } from './clarification-apply.js';
import { parseCookingMethod } from './cooking-methods.js';
import { isChutneyItemText, matchChutneyRef } from './chutney-catalog.js';
import { matchBiryaniSideRef } from './biryani-side-catalog.js';
import { matchIndianBreadSideRef } from './indian-bread-catalog.js';
import { matchIndianStarterRef } from './indian-starter-catalog.js';
import { parseQuantityFromText, splitMealPhrases } from './quantity-parser.js';
import { matchFoodReference } from './nutrition-density.js';
import { rescaleItemToGrams } from './photo-log-flow.js';

export { MEAL_COOKING_CHIPS, parseCookingMethod } from './cooking-methods.js';

const WORD_NUM = {
  half: 0.5,
  '½': 0.5,
  quarter: 0.25,
  '¼': 0.25,
  one: 1,
  a: 1,
  an: 1,
  two: 2,
  three: 3,
  four: 4,
};

/** Per-100g reference + aliases for hidden additions. */
const HIDDEN_CATALOG = [
  { id: 'ghee', re: /\bghee\b|\bney\b|\bneyi\b/i, label: 'Ghee', kcal100: 900, protein100: 0, carbs100: 0, fat100: 100, sugar100: 0, salt100: 0 },
  { id: 'butter', re: /\bbutter\b|\bmakhan\b/i, label: 'Butter', kcal100: 717, protein100: 0.9, carbs100: 0.1, fat100: 81, sugar100: 0.1, salt100: 640 },
  { id: 'oil', re: /\b(?:olive|vegetable|coconut|sesame|mustard|sunflower|groundnut|peanut|canola|rapeseed)\s+oil\b|\bcooking\s+oil\b|\boil\b/i, label: 'Cooking oil', kcal100: 884, protein100: 0, carbs100: 0, fat100: 100, sugar100: 0, salt100: 0 },
  { id: 'margarine', re: /\bmargarine\b|\bspread\b(?!\s+sauce)/i, label: 'Margarine', kcal100: 720, protein100: 0.5, carbs100: 0.5, fat100: 80, sugar100: 0, salt100: 680 },
  { id: 'mayo', re: /\bmayonnaise\b|\bmayo\b/i, label: 'Mayonnaise', kcal100: 680, protein100: 1, carbs100: 3, fat100: 75, sugar100: 2, salt100: 620 },
  { id: 'ketchup', re: /\bketchup\b|\btomato\s+sauce\b(?!\s+curry)/i, label: 'Ketchup', kcal100: 110, protein100: 1.5, carbs100: 26, fat100: 0.5, sugar100: 22, salt100: 900 },
  { id: 'sugar', re: /\bsugar\b|\bshakkar\b|\bchini\b/i, label: 'Sugar', kcal100: 387, protein100: 0, carbs100: 100, fat100: 0, sugar100: 100, salt100: 0 },
  { id: 'honey', re: /\bhoney\b|\bshahad\b/i, label: 'Honey', kcal100: 304, protein100: 0.3, carbs100: 82, fat100: 0, sugar100: 82, salt100: 4 },
  { id: 'jaggery', re: /\bjaggery\b|\bgur\b|\bgud\b/i, label: 'Jaggery', kcal100: 383, protein100: 0.5, carbs100: 95, fat100: 0, sugar100: 85, salt100: 20 },
  { id: 'syrup', re: /\b(maple\s+syrup|golden\s+syrup|chocolate\s+syrup|sugar\s+syrup)\b/i, label: 'Syrup', kcal100: 260, protein100: 0, carbs100: 67, fat100: 0, sugar100: 60, salt100: 40 },
  { id: 'cream', re: /\b(double\s+cream|whipping\s+cream|heavy\s+cream|fresh\s+cream)\b|\bcream\b(?!\s+tea)/i, label: 'Cream', kcal100: 340, protein100: 2, carbs100: 3, fat100: 36, sugar100: 3, salt100: 30 },
  { id: 'sour_cream', re: /\bsour\s+cream\b/i, label: 'Sour cream', kcal100: 198, protein100: 2.4, carbs100: 4.6, fat100: 19, sugar100: 3, salt100: 40 },
  { id: 'cheese', re: /\b(cheddar|mozzarella|parmesan|grated\s+cheese|cheese\s+slice|cheese)\b/i, label: 'Cheese', kcal100: 350, protein100: 22, carbs100: 2, fat100: 28, sugar100: 1, salt100: 620 },
  { id: 'paneer', re: /\bpaneer\b/i, label: 'Paneer', kcal100: 265, protein100: 18, carbs100: 4, fat100: 20, sugar100: 3, salt100: 320 },
  { id: 'yogurt', re: /\b(yogurt|yoghurt|curd|dahi)\b/i, label: 'Yogurt', kcal100: 75, protein100: 5, carbs100: 8, fat100: 2.5, sugar100: 6, salt100: 80 },
  { id: 'pickle', re: /\b(pickle|achar|achaar)\b/i, label: 'Pickle', kcal100: 45, protein100: 0.5, carbs100: 8, fat100: 1, sugar100: 4, salt100: 1200 },
  { id: 'tahini', re: /\btahini\b|\bsesame\s+paste\b/i, label: 'Tahini', kcal100: 595, protein100: 17, carbs100: 18, fat100: 54, sugar100: 0.5, salt100: 40 },
  { id: 'peanut_butter', re: /\bpeanut\s+butter\b/i, label: 'Peanut butter', kcal100: 588, protein100: 25, carbs100: 20, fat100: 50, sugar100: 9, salt100: 430 },
  { id: 'nutella', re: /\bnutella\b|\bchocolate\s+spread\b|\bhazelnut\s+spread\b/i, label: 'Chocolate spread', kcal100: 539, protein100: 6, carbs100: 58, fat100: 31, sugar100: 56, salt100: 40 },
  { id: 'coconut_milk', re: /\bcoconut\s+milk\b/i, label: 'Coconut milk', kcal100: 197, protein100: 2, carbs100: 3, fat100: 21, sugar100: 2, salt100: 15 },
  { id: 'gravy', re: /\b(extra\s+)?gravy\b/i, label: 'Gravy', kcal100: 80, protein100: 3, carbs100: 6, fat100: 5, sugar100: 1, salt100: 420 },
  { id: 'sauce', re: /\b(soy\s+sauce|soya\s+sauce|bbq\s+sauce|hot\s+sauce|chilli\s+sauce|sweet\s+chilli)\b/i, label: 'Sauce', kcal100: 120, protein100: 2, carbs100: 22, fat100: 1, sugar100: 16, salt100: 800 },
  { id: 'pesto', re: /\bpesto\b/i, label: 'Pesto', kcal100: 450, protein100: 5, carbs100: 6, fat100: 45, sugar100: 2, salt100: 680 },
  { id: 'nuts', re: /\b(almonds?|cashews?|walnuts?|peanuts?|nuts)\b/i, label: 'Nuts', kcal100: 580, protein100: 18, carbs100: 18, fat100: 50, sugar100: 5, salt100: 280 },
  { id: 'seeds', re: /\b(sesame\s+seeds?|pumpkin\s+seeds?|sunflower\s+seeds?|seeds)\b/i, label: 'Seeds', kcal100: 560, protein100: 20, carbs100: 16, fat100: 48, sugar100: 2, salt100: 20 },
  { id: 'egg', re: /\beggs?\b|\banda\b/i, label: 'Egg', kcal100: 143, protein100: 12.6, carbs100: 0.7, fat100: 9.5, sugar100: 0.4, salt100: 140, unitGrams: 58 },
  { id: 'bacon', re: /\bbacon\b|\brashers?\b/i, label: 'Bacon', kcal100: 540, protein100: 25, carbs100: 0, fat100: 42, sugar100: 0, salt100: 1700, unitGrams: 25 },
  { id: 'avocado', re: /\bavocado\b|\bguacamole\b/i, label: 'Avocado', kcal100: 160, protein100: 2, carbs100: 9, fat100: 15, sugar100: 0.7, salt100: 7, unitGrams: 80 },
];

function round1(v) {
  return Math.round(v * 10) / 10;
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseQuantity(token = '') {
  const t = String(token).trim().toLowerCase();
  if (WORD_NUM[t] != null) return WORD_NUM[t];
  const frac = t.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (frac) {
    const num = Number(frac[1]);
    const den = Number(frac[2]);
    if (num > 0 && den > 0) return num / den;
  }
  const n = Number(t);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Spoon measures: 1 tsp = 5 ml, 1 tbsp = 15 ml (standard kitchen spoons). */
const ML_PER_TSP = 5;
const ML_PER_TBSP = 15;
const ML_PER_CUP = 240;

/** g/ml for liquids logged by spoon or ml. */
const DENSITY_G_PER_ML = {
  oil: 0.92,
  ghee: 0.96,
  coconut_milk: 0.96,
  cream: 1.0,
  sour_cream: 1.02,
  mayo: 0.93,
  ketchup: 1.05,
  sauce: 1.1,
  pesto: 0.95,
  tahini: 0.97,
  honey: 1.42,
  syrup: 1.33,
};

const SPOON_QTY_TOKEN = String.raw`\d+\s*\/\s*\d+|half|quarter|½|¼|one|two|three|four|a|an|(?<![\d/])\d+(?:\.\d+)?`;

function usesVolumeMl(ref) {
  if (!ref) return false;
  return ref.id in DENSITY_G_PER_ML || ref.id === 'oil' || ref.id === 'ghee';
}

function densityForRef(ref) {
  return DENSITY_G_PER_ML[ref?.id] ?? 1;
}

function mlFromSpoon(qty, unit) {
  if (/teaspoon|tsp/.test(unit)) return qty * ML_PER_TSP;
  if (/cup/.test(unit)) return qty * ML_PER_CUP;
  return qty * ML_PER_TBSP;
}

function gramsFromSpoon(qty, unit, ref) {
  if (usesVolumeMl(ref)) {
    return round1(mlFromSpoon(qty, unit) * densityForRef(ref));
  }
  if (/teaspoon|tsp/.test(unit)) return qty * 5;
  if (/cup/.test(unit)) return qty * 240;
  return qty * 14;
}

function mlFromGrams(ref, grams) {
  const d = densityForRef(ref);
  return d > 0 ? round1(grams / d) : round1(grams);
}

function gramsFromMl(ref, ml) {
  return round1(ml * densityForRef(ref));
}

function spoonPortionLabel(qtyToken, qty, isTsp, grams, ref) {
  const unitLabel = isTsp ? 'tsp' : 'tbsp';
  const displayQty = qtyToken === '1' ? '1' : qtyToken;
  if (usesVolumeMl(ref)) {
    const ml = mlFromSpoon(qty, isTsp ? 'tsp' : 'tbsp');
    return `${displayQty} ${unitLabel} (~${round1(ml)} ml)`;
  }
  return `${displayQty} ${unitLabel} (~${Math.round(grams)}g)`;
}

function mlPortionLabel(ml, ref) {
  if (usesVolumeMl(ref)) {
    return `~${round1(ml)} ml`;
  }
  return `~${Math.round(ml)}g`;
}

function scaleItem(item, factor) {
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
    _fromUserNotes: true,
  };
}

function nutritionForGrams(ref, grams) {
  const f = grams / 100;
  return {
    calories_kcal: Math.round(ref.kcal100 * f),
    nutrition: {
      protein_g: round1(ref.protein100 * f),
      carbs_g: round1(ref.carbs100 * f),
      fat_g: round1(ref.fat100 * f),
      fibre_g: round1((ref.fibre100 || 0) * f),
      sugar_g: round1((ref.sugar100 || 0) * f),
      salt_mg: Math.round((ref.salt100 || 0) * f),
    },
  };
}

function buildHiddenItem(ref, { grams, count, portionLabel, volumeMl }) {
  const g = grams || (ref.unitGrams || 15) * (count || 1);
  const { calories_kcal, nutrition } = nutritionForGrams(ref, g);
  return {
    name: ref.label,
    portion_estimate: portionLabel || `~${Math.round(g)}g`,
    grams: g,
    volumeMl: volumeMl ?? (usesVolumeMl(ref) ? mlFromGrams(ref, g) : null),
    calories_kcal,
    nutrition,
  };
}

function gramsForImplicitRef(ref, isTsp) {
  if (ref.defaultGrams) return ref.defaultGrams;
  if (ref.unitGrams) return ref.unitGrams;
  return gramsFromSpoon(1, isTsp ? 'tsp' : 'tbsp', ref);
}

function portionLabelForImplicitRef(ref, grams, isTsp) {
  if (ref.defaultGrams || ref.unitGrams) {
    return `side (~${Math.round(grams)}g)`;
  }
  return spoonPortionLabel('1', 1, isTsp, grams, ref);
}

function matchCatalog(text = '') {
  const chutney = matchChutneyRef(text);
  if (chutney) return chutney;
  const biryaniSide = matchBiryaniSideRef(text);
  if (biryaniSide) return biryaniSide;
  const breadSide = matchIndianBreadSideRef(text);
  if (breadSide) return breadSide;
  const starter = matchIndianStarterRef(text);
  if (starter) return starter;
  for (const ref of HIDDEN_CATALOG) {
    if (ref.re.test(text)) return ref;
  }
  return null;
}

/** Pull raw customer text from wrapped analysis hints sent to Gemini. */
export function extractRawUserNotes(notes = '') {
  const t = String(notes).trim();
  if (!t) return '';
  const match = t.match(/User notes(?: \(must be reflected[^)]*\))?:\s*(.+)$/is);
  if (match) return match[1].trim();
  if (/The user photographed food/i.test(t)) return '';
  return t;
}

function isMeasureContext(text = '') {
  return /\b(half|quarter|½|¼|\d+\s*\/\s*\d+|\d+(?:\.\d+)?)\s*(?:tbsp|tbs|tablespoon|tsp|teaspoon|g|gram|ml|cup|slice|piece|egg)s?\b/i.test(text);
}

function parsePortionFactor(text = '') {
  const t = String(text).toLowerCase();
  if (isMeasureContext(t) && !/\b(half|½)\s*(portion|plate|serving|bowl)\b/.test(t)) {
    if (!/\b(half|½)\s+of\s+(the|this|my|it)\b/.test(t) && !/\bshared\s+plate\b/.test(t)) {
      return null;
    }
  }
  if (/\b(half|½)\s*(portion|plate|serving|size|bowl)\b/.test(t)) return 0.5;
  if (/\b(half|½)\s+of\s+(the|this|my|it)\b/.test(t)) return 0.5;
  if (/\bshared\s+(plate|meal|dish|pizza|curry)\b/.test(t)) return 0.5;
  if (/\bmy\s+half\b/.test(t)) return 0.5;
  if (/\b(quarter|¼)\s*(portion|plate|serving|bowl)\b/.test(t)) return 0.25;
  if (/\bsmall\s+(portion|plate|serving|bowl)\b/.test(t)) return 0.75;
  if (/\blarge\s+(portion|plate|serving|bowl)\b/.test(t)) return 1.2;
  if (/\b(double\s+portion|extra\s+large|big\s+portion)\b/.test(t)) return 1.5;
  return null;
}

function hiddenItemKey(item) {
  return `${item.name}`.toLowerCase();
}

const DEFAULT_CHUTNEY_SIDE_GRAMS = 30;

function reconcileNotedChutney(items = [], notedRef) {
  if (!notedRef || notedRef.id === 'chutney') return items;

  const chutneyIdx = items.findIndex((item) => isChutneyItemText(`${item.name || ''} ${item.portion_estimate || ''}`));

  const buildChutneyItem = (existing) => {
    const grams = num(parseFloat(String(existing?.portion_estimate).match(/(\d+(?:\.\d+)?)\s*g/i)?.[1]))
      || num(parseFloat(String(existing?.name).match(/(\d+(?:\.\d+)?)\s*g/i)?.[1]))
      || DEFAULT_CHUTNEY_SIDE_GRAMS;
    const { calories_kcal, nutrition } = nutritionForGrams(notedRef, grams);
    return {
      ...(existing || {}),
      name: notedRef.label,
      portion_estimate: existing?.portion_estimate || `side (~${Math.round(grams)}g)`,
      calories_kcal,
      nutrition,
      confidence: 0.85,
      _fromUserNotes: true,
      _reviewHint: existing
        ? `Corrected from your notes (${notedRef.label})`
        : `Added from your notes (${notedRef.label})`,
    };
  };

  if (chutneyIdx >= 0) {
    const existing = items[chutneyIdx];
    const existingRef = matchChutneyRef(`${existing.name || ''}`);
    if (existingRef?.id === notedRef.id) return items;
    const next = [...items];
    next[chutneyIdx] = buildChutneyItem(existing);
    return next;
  }

  const candidate = buildChutneyItem(null);
  if (hiddenAlreadyInItems(items, { name: notedRef.label, grams: DEFAULT_CHUTNEY_SIDE_GRAMS })) {
    return items;
  }
  return [...items, candidate];
}

function hiddenAlreadyInItems(items = [], candidate) {
  const key = hiddenItemKey(candidate);
  return items.some((item) => {
    const text = `${item.name || ''} ${item.portion_estimate || ''}`.toLowerCase();
    if (text.includes(key.split(' ')[0])) {
      const grams = num(parseFloat(String(item.portion_estimate).match(/(\d+(?:\.\d+)?)\s*g/i)?.[1]));
      if (candidate.grams && grams > 0 && Math.abs(grams - candidate.grams) <= 6) return true;
      if (/\b(ghee|butter|oil|mayo|sugar|honey|cheese|cream|egg|chutney|gravy)\b/.test(text) && text.includes(key.split(' ')[0])) return true;
    }
    return false;
  });
}

/**
 * Parse hidden / off-plate additions from customer notes.
 * @returns {Array<{ name, portion_estimate, grams, calories_kcal, nutrition }>}
 */
export function parseHiddenAdditions(text = '') {
  const t = String(text).trim();
  if (t.length < 2) return [];
  const found = [];
  const seen = new Set();

  function add(ref, opts) {
    const item = buildHiddenItem(ref, opts);
    const sig = `${item.name}|${Math.round(item.grams)}`;
    if (seen.has(sig)) return;
    seen.add(sig);
    found.push(item);
  }

  // tbsp/tsp of X — fraction-safe (1/2 tsp won't match as "2 tsp")
  const spoonRe = new RegExp(
    String.raw`\b(?:(${SPOON_QTY_TOKEN})\s*)?(?:tablespoons?|tbsp|tbs|teaspoons?|tsp)s?\s*(?:of\s+)?([a-z][a-z\s-]{1,30}?)(?=\s*(?:,|\.|and|on|with|$|\)|~))\b`,
    'gi',
  );
  const spoonSuffixRe = new RegExp(
    String.raw`\b([a-z][a-z\s-]{1,24}?)\s+(${SPOON_QTY_TOKEN})\s*(?:tablespoons?|tbsp|tbs|teaspoons?|tsp)s?\b`,
    'gi',
  );
  let m;
  for (const re of [spoonRe, spoonSuffixRe]) {
    while ((m = re.exec(t)) !== null) {
      const qtyToken = (re === spoonRe ? m[1] : m[2] || '1').trim();
      const nameChunk = (re === spoonRe ? m[2] : m[1] || '').trim();
      if (!nameChunk || nameChunk.length < 2) continue;
      const ref = matchCatalog(nameChunk);
      if (!ref) continue;
      const unitChunk = m[0].toLowerCase();
      const qty = parseQuantity(qtyToken) ?? 1;
      const isTsp = /teaspoon|tsp/.test(unitChunk) && !/tablespoon|tbsp/.test(unitChunk);
      const grams = gramsFromSpoon(qty, isTsp ? 'tsp' : 'tbsp', ref);
      const volumeMl = usesVolumeMl(ref) ? mlFromSpoon(qty, isTsp ? 'tsp' : 'tbsp') : null;
      add(ref, {
        grams,
        volumeMl,
        portionLabel: spoonPortionLabel(qtyToken, qty, isTsp, grams, ref),
      });
    }
  }

  // grams/ml: 15g butter, 2.5 ml oil
  const gramRe = /\b(\d+\s*\/\s*\d+|\d+(?:\.\d+)?|half|quarter|½|¼)\s*(?:g|gram|grams|ml|millilitres?|milliliters?)\s*(?:of\s+)?([a-z][a-z\s-]{1,30}?)(?=\s*(?:,|\.|and|on|with|$|\)|~))\b/gi;
  while ((m = gramRe.exec(t)) !== null) {
    const qty = parseQuantity(m[1]) ?? Number(m[1]);
    if (!qty || qty <= 0) continue;
    const nameChunk = m[2].trim();
    const ref = matchCatalog(nameChunk);
    if (!ref) continue;
    const isMl = /ml|millilitre|milliliter/.test(m[0].toLowerCase());
    const grams = isMl ? gramsFromMl(ref, qty) : qty;
    const volumeMl = isMl ? qty : (usesVolumeMl(ref) ? mlFromGrams(ref, grams) : null);
    add(ref, {
      grams,
      volumeMl,
      portionLabel: isMl ? mlPortionLabel(qty, ref) : `~${Math.round(grams)}g`,
    });
  }

  // count: 2 eggs, 1 egg, 3 slices cheese
  const countRe = /\b(\d+|one|two|three|four|a|an)\s+(eggs?|rashers?|slices?\s+of\s+cheese|cheese\s+slices?|scoops?\s+of\s+ice\s+cream)\b/gi;
  while ((m = countRe.exec(t)) !== null) {
    const count = parseQuantity(m[1]) ?? 1;
    const chunk = m[2].toLowerCase();
    let ref = null;
    if (/egg/.test(chunk)) ref = HIDDEN_CATALOG.find((r) => r.id === 'egg');
    else if (/bacon|rashers?/.test(chunk)) ref = HIDDEN_CATALOG.find((r) => r.id === 'bacon');
    else if (/cheese/.test(chunk)) ref = HIDDEN_CATALOG.find((r) => r.id === 'cheese');
    if (!ref) continue;
    const unitG = ref.unitGrams || 30;
    add(ref, {
      grams: unitG * count,
      count,
      portionLabel: `${count} ${/egg/.test(chunk) ? 'egg' : 'slice'}${count > 1 ? 's' : ''} (~${Math.round(unitG * count)}g)`,
    });
  }

  // "with ghee", "added butter", "extra cheese", "with mint chutney", "handful of nuts"
  const implicitRes = [
    {
      re: /\b(with|added|extra|plus|side\s+of|topped\s+with|drizzle\s+of|dash\s+of)\s+([a-z][a-z\s-]{0,28}?)(?=\s*(?:,|\.|and|on|with|$|\)|~))\b/gi,
      defaultTbsp: true,
    },
    { re: /\bhandful\s+of\s+(nuts|almonds|cashews|peanuts|seeds)\b/gi, grams: 30 },
    { re: /\b(sprinkle|bit)\s+of\s+(sugar|cheese|nuts|seeds)\b/gi, defaultTsp: true },
    { re: /\bbutter\s+on\s+(toast|bread|naan|roti|paratha|dosa)\b/gi, refId: 'butter', tbsp: 1 },
    { re: /\bghee\s+on\s+(rice|roti|naan|paratha|dosa|idli|chapati)\b/gi, refId: 'ghee', tbsp: 0.5 },
  ];

  for (const rule of implicitRes) {
    let im;
    while ((im = rule.re.exec(t)) !== null) {
      if (rule.grams) {
        const ref = matchCatalog(im[1] || im[0]) || HIDDEN_CATALOG.find((r) => r.id === 'nuts');
        if (ref) add(ref, { grams: rule.grams, portionLabel: `handful (~${rule.grams}g)` });
        continue;
      }
      if (rule.refId) {
        const ref = HIDDEN_CATALOG.find((r) => r.id === rule.refId);
        if (ref) {
          const tbspQty = rule.tbsp || 1;
          const grams = gramsFromSpoon(tbspQty, 'tbsp', ref);
          const volumeMl = usesVolumeMl(ref) ? mlFromSpoon(tbspQty, 'tbsp') : null;
          add(ref, {
            grams,
            volumeMl,
            portionLabel: spoonPortionLabel(String(tbspQty), tbspQty, false, grams, ref),
          });
        }
        continue;
      }
      const name = (im[2] || im[1] || '').trim();
      const ref = matchCatalog(name);
      if (!ref) continue;
      const isTsp = Boolean(rule.defaultTsp);
      const grams = gramsForImplicitRef(ref, isTsp);
      const volumeMl = usesVolumeMl(ref) ? mlFromSpoon(1, isTsp ? 'tsp' : 'tbsp') : null;
      add(ref, {
        grams,
        volumeMl,
        portionLabel: portionLabelForImplicitRef(ref, grams, isTsp),
      });
    }
  }

  return found;
}

function notedFoodKey(text = '') {
  return String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function isQuantityOnlyFoodText(foodText = '') {
  return !String(foodText || '')
    .replace(/\d+(?:\.\d+)?\s*(?:kg|kilos?|kilograms?|g|grams?|ml|millilitres?|milliliters?|lb|lbs|oz)\b/gi, '')
    .replace(/[~()]/g, ' ')
    .trim();
}

function itemMatchesNotedFood(item, foodText) {
  const noted = notedFoodKey(foodText);
  if (!noted) return false;
  const name = notedFoodKey(item?.name || '');
  if (!name) return false;
  if (name === noted || name.includes(noted) || noted.includes(name)) return true;
  const itemRef = matchFoodReference(item.name || '');
  const noteRef = matchFoodReference(foodText);
  return Boolean(itemRef?.id && noteRef?.id && itemRef.id === noteRef.id);
}

function parseNotedWeights(notes = '') {
  const weights = [];
  for (const phrase of splitMealPhrases(notes)) {
    const q = parseQuantityFromText(phrase);
    if (!q.explicit || !(q.quantity > 0)) continue;
    if (q.kind === 'count') continue;
    const grams = q.quantity;
    if (!(grams >= 5 && grams <= 15000)) continue;
    if (q.kind !== 'weight' && q.unit !== 'g' && q.unit !== 'ml') continue;
    weights.push({
      grams,
      foodText: isQuantityOnlyFoodText(q.foodText) ? '' : String(q.foodText || '').trim(),
      phrase,
    });
  }
  return weights;
}

function titleCaseFood(text = '') {
  return String(text)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function applyNotedWeightToItems(items, noted) {
  if (!items.length || !(noted?.grams > 0)) return items;
  const foodItems = items.filter((item) => !item._visionOil && !/^cooking oil$/i.test(item.name || ''));
  let idx = -1;
  if (noted.foodText) {
    idx = items.findIndex((item) => itemMatchesNotedFood(item, noted.foodText));
  }
  if (idx < 0 && !noted.foodText && foodItems.length === 1) {
    idx = items.indexOf(foodItems[0]);
  }
  if (idx < 0) return items;

  const item = items[idx];
  const noteRef = noted.foodText ? matchFoodReference(noted.foodText) : null;
  let working = { ...item };
  if (noteRef && noteRef.id !== item._refId) {
    working = {
      ...working,
      name: titleCaseFood(noted.foodText) || working.name,
      _refId: noteRef.id,
      _authoritative: false,
      _per100: undefined,
      _fromUserNotes: false,
    };
  }
  const scaled = rescaleItemToGrams(working, noted.grams);
  const next = [...items];
  next[idx] = {
    ...scaled,
    _fromUserNotes: true,
    _userEnteredWeight: true,
    _hiddenGrams: noted.grams,
    grams: noted.grams,
    _reviewHint: `Weight from your notes (${Math.round(noted.grams)}g)`,
  };
  return next;
}

function parseUserMealNotes(notes = '') {
  const text = String(notes).trim();
  if (text.length < 2) return null;

  const t = text.toLowerCase();
  const portionFactor = parsePortionFactor(t);
  const hiddenItems = parseHiddenAdditions(text);
  const notedWeights = parseNotedWeights(text);
  const cookingMethod = parseCookingMethod(text);
  const skipTopics = new Set();
  const clarifyAnswers = [];

  if (cookingMethod) {
    clarifyAnswers.push({ topic: 'cooking_method', answer: cookingMethod.clarifyAnswer });
    skipTopics.add('cooking_method');
    if (cookingMethod.id === 'deep_fried' || cookingMethod.id === 'pan_fried') {
      skipTopics.add('oil_fat');
    }
  }

  const hasHiddenFat = hiddenItems.some((i) => /\b(ghee|butter|oil|mayo|cream|margarine|pesto|tahini|peanut butter|chocolate spread|coconut milk)\b/i.test(i.name));
  const hasHiddenSugar = hiddenItems.some((i) => /\b(sugar|honey|jaggery|syrup|chocolate spread)\b/i.test(i.name));
  const hasHiddenSauce = hiddenItems.some((i) => /\b(ketchup|chutney|gravy|sauce|pickle|raita|gosthu|salan|salna|kurma|pesto)\b/i.test(i.name));
  const hasHiddenCheese = hiddenItems.some((i) => /\b(cheese|paneer|cream|sour cream)\b/i.test(i.name));

  if (/\b(minimal|very little|little|light|no|low)\s+(oil|ghee|butter|fat)\b|\blight\s+on\s+(oil|ghee)\b|\bdry\b(?!\s+fruit)/.test(t)) {
    clarifyAnswers.push({ topic: 'oil_fat', answer: 'Very little oil / butter' });
    skipTopics.add('oil_fat');
  } else if (/\b(extra|lots\s+of|heavy|restaurant|oily|greasy|deep.?fried)\s+(oil|ghee|butter|fat)\b/.test(t)) {
    clarifyAnswers.push({ topic: 'oil_fat', answer: 'Extra oily / greasy' });
    skipTopics.add('oil_fat');
  } else if (hasHiddenFat) {
    skipTopics.add('oil_fat');
  }

  if (/\b(thick|heavy|extra)\s+(gravy|sauce|curry)\b|\blots\s+of\s+(gravy|sauce)\b/.test(t)) {
    clarifyAnswers.push({ topic: 'sauce_gravy', answer: 'Lots of gravy or sauce' });
    skipTopics.add('sauce_gravy');
  } else if (/\b(mostly\s+dry|little\s+sauce|dry\s+curry|little\s+gravy)\b/.test(t)) {
    clarifyAnswers.push({ topic: 'sauce_gravy', answer: 'Mostly dry — little sauce' });
    skipTopics.add('sauce_gravy');
  } else if (hasHiddenSauce) {
    skipTopics.add('sauce_gravy');
  }

  if (/\b(extra|lots\s+of|double)\s+cheese\b|\bvery\s+creamy\b/.test(t) || hasHiddenCheese) {
    clarifyAnswers.push({ topic: 'cheese_cream', answer: 'Extra cheesy / creamy' });
    skipTopics.add('cheese_cream');
  } else if (/\b(light|little)\s+cheese\b|\blight\s+cream\b/.test(t)) {
    clarifyAnswers.push({ topic: 'cheese_cream', answer: 'Light — little cheese or cream' });
    skipTopics.add('cheese_cream');
  }

  if (/\bno\s+sugar\b|\bunsweetened\b|\bzero\s+sugar\b|\bsugar.?free\b/.test(t) || (hasHiddenSugar && /\bno\s+sugar\b/.test(t))) {
    clarifyAnswers.push({ topic: 'drink_coffee_tea_style', answer: 'Black / no sugar' });
    clarifyAnswers.push({ topic: 'drink_coffee_sugar', answer: 'None' });
    skipTopics.add('drink_coffee_tea_style');
    skipTopics.add('drink_coffee_sugar');
  } else if (/\b\d+\s*(tsp|teaspoon)s?\s+sugar\b|\bwith\s+sugar\b|\bsweetened\b/.test(t) || hasHiddenSugar) {
    skipTopics.add('drink_coffee_tea_style');
    skipTopics.add('drink_coffee_sugar');
  }
  if (/\bskim\s+milk\b|\bsemi.?skimmed\b|\bsemi\s+skim\b/.test(t)) {
    clarifyAnswers.push({ topic: 'drink_coffee_tea_style', answer: 'Semi-skimmed milk, no sugar' });
    skipTopics.add('drink_coffee_tea_style');
    skipTopics.add('drink_coffee_milk');
  }
  if (/\boat\s+milk\b/.test(t)) {
    clarifyAnswers.push({ topic: 'drink_coffee_tea_style', answer: 'Oat milk' });
    skipTopics.add('drink_coffee_tea_style');
    skipTopics.add('drink_coffee_milk');
  }
  if (/\b(diet|zero|sugar.?free)\s+(cola|coke|soda|soft\s+drink|fizzy)\b|\bdiet\s+(cola|coke|pepsi)\b/.test(t)) {
    clarifyAnswers.push({ topic: 'drink_soft_type', answer: 'Diet / zero sugar' });
    skipTopics.add('drink_soft_type');
  }

  if (/\b\d+(?:\.\d+)?\s*(kg|kilos?|kilograms?)\b/.test(t)) {
    skipTopics.add('portion_item');
    skipTopics.add('portion_solid');
    skipTopics.add('portion_snack');
    skipTopics.add('generic_portion');
    skipTopics.add('dessert_portion');
  }

  if (/\b\d+\s*(g|gram|grams|ml)\b/.test(t) && /\b(rice|biryani|curry|pasta|noodles|chow\s+mein|portion|plate|serving|65|manchurian|sukka|chukka|varuval|lollipop|starter)\b/.test(t)) {
    skipTopics.add('portion_rice');
    skipTopics.add('portion_starter');
    skipTopics.add('portion_solid');
    skipTopics.add('portion_takeaway');
    skipTopics.add('portion_snack');
    skipTopics.add('dessert_portion');
  }

  if (
    /\b\d+\s*(roti|rotis|naan|naans|chapati|chapatis|dosa|dosas|dosai|idli(?:es|s)?|idly(?:s)?|puri|paratha|parotta)\b/.test(t)
    || (/\b\d+\s*(pieces?|slices?)\b/.test(t) && /\b(roti|naan|idli|idly|dosa|bread|chapati|puri|paratha)\b/.test(t))
  ) {
    const named = t.match(/\b(\d+)\s*(roti|rotis|naan|naans|chapati|chapatis|dosa|dosas|dosai|idli(?:es|s)?|idly(?:s)?|puri|paratha|parotta|pieces?|slices?)\b/);
    if (named) {
      clarifyAnswers.push({ topic: 'bread_count', answer: named[0] });
    }
    skipTopics.add('bread_count');
  }

  return {
    portionFactor,
    hiddenItems,
    notedWeights,
    cookingMethod,
    clarifyAnswers,
    skipTopics,
  };
}

export function getNotesSkipTopics(notes = '') {
  return parseUserMealNotes(notes)?.skipTopics || new Set();
}

export function deriveClarifyAnswersFromNotes(notes = '', analysis = null) {
  const hints = parseUserMealNotes(notes);
  if (!hints) return [];
  return hints.clarifyAnswers.filter((entry) => entry.topic && entry.answer);
}

/**
 * Apply customer notes to an analysis object (idempotent via _userNotesApplied).
 * @param {object} analysis
 * @param {string} rawNotes — customer text only (not Gemini wrapper)
 */
export function applyUserNotesToAnalysis(analysis, rawNotes = '') {
  if (!analysis || analysis._userNotesApplied) return analysis;

  const notes = String(rawNotes).trim();
  const hints = parseUserMealNotes(notes);
  if (!hints) return analysis;

  let items = [...(analysis.items || [])];

  if (hints.portionFactor && Math.abs(hints.portionFactor - 1) > 0.02) {
    items = items.map((item) => scaleItem(item, hints.portionFactor));
  }

  for (const noted of hints.notedWeights || []) {
    items = applyNotedWeightToItems(items, noted);
  }

  const notedChutney = matchChutneyRef(notes);
  if (notedChutney) {
    items = reconcileNotedChutney(items, notedChutney);
  }

  for (const hidden of hints.hiddenItems) {
    if (notedChutney && hidden.name === notedChutney.label) continue;
    if (!hiddenAlreadyInItems(items, hidden)) {
      items.push({
        name: hidden.name,
        portion_estimate: hidden.portion_estimate,
        calories_kcal: hidden.calories_kcal,
        nutrition: hidden.nutrition,
        confidence: 0.85,
        _fromUserNotes: true,
        _hiddenGrams: hidden.grams,
        _volumeMl: hidden.volumeMl ?? null,
        _reviewHint: `Added from your notes (${hidden.portion_estimate})`,
      });
    }
  }

  return sanitizeAnalysisTotals({
    ...analysis,
    items,
    _userNotesApplied: true,
    _userNotesAppliedText: notes.slice(0, 120),
    _hiddenFromNotes: hints.hiddenItems.map((h) => h.name),
  });
}

/** Notes → auto clarify answers → nutrition adjust → filtered steps. */
export function enrichAnalysisWithUserNotes(analysis, rawNotes = '') {
  if (!analysis) return analysis;
  if (analysis._userNotesApplied) return analysis;

  let working = applyUserNotesToAnalysis(analysis, rawNotes);
  const autoAnswers = deriveClarifyAnswersFromNotes(rawNotes, working);
  if (autoAnswers.length) {
    working = applyClarificationsLocally(working, autoAnswers);
  }
  return { ...working, _userNotesApplied: true };
}

export function filterClarificationStepsByNotes(steps = [], rawNotes = '') {
  const skip = getNotesSkipTopics(rawNotes);
  if (!skip.size) return steps;
  return steps.filter((step) => !skip.has(step.topic));
}
