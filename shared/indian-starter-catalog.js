/**
 * Indian restaurant starters / dry fries / Indo-Chinese dishes.
 * Matched before generic chicken, mutton, fish, paneer refs.
 * Nutrition ≈ typical fried starter per 100 g (restaurant).
 */

const STARTER_BASE = { fibre100: 1 };

function starter(entry) {
  return { ...STARTER_BASE, ...entry };
}

/** @type {Array<{ id: string, label: string, re: RegExp, kcal100: number, protein100: number, carbs100: number, fat100: number, sugar100: number, salt100: number, fibre100?: number, defaultGrams?: number }>} */
export const INDIAN_STARTER_CATALOG = [
  // ── 65 family (TN / Andhra / restaurant) ──
  starter({
    id: 'chicken_65',
    label: 'Chicken 65',
    re: /\bchicken\s+65\b|\bchicken\s+sixty\s+five\b/i,
    kcal100: 245, protein100: 16, carbs100: 10, fat100: 16, sugar100: 2, salt100: 620,
    defaultGrams: 180,
  }),
  starter({
    id: 'gobi_65',
    label: 'Gobi 65',
    re: /\bgobi\s+65\b|\bcauliflower\s+65\b/i,
    kcal100: 195, protein100: 4, carbs100: 14, fat100: 14, sugar100: 2, salt100: 580,
    defaultGrams: 160,
  }),
  starter({
    id: 'paneer_65',
    label: 'Paneer 65',
    re: /\bpaneer\s+65\b/i,
    kcal100: 265, protein100: 12, carbs100: 12, fat100: 18, sugar100: 2, salt100: 600,
    defaultGrams: 170,
  }),
  starter({
    id: 'mushroom_65',
    label: 'Mushroom 65',
    re: /\bmushroom\s+65\b|\bkaalan\s+65\b/i,
    kcal100: 175, protein100: 5, carbs100: 12, fat100: 12, sugar100: 2, salt100: 560,
    defaultGrams: 150,
  }),
  starter({
    id: 'prawn_65',
    label: 'Prawn 65',
    re: /\b(prawn|shrimp)\s+65\b|\beral\s+65\b/i,
    kcal100: 210, protein100: 18, carbs100: 8, fat100: 12, sugar100: 2, salt100: 640,
    defaultGrams: 160,
  }),
  starter({
    id: 'baby_corn_65',
    label: 'Baby corn 65',
    re: /\bbaby\s+corn\s+65\b/i,
    kcal100: 185, protein100: 3, carbs100: 16, fat100: 12, sugar100: 3, salt100: 560,
    defaultGrams: 150,
  }),
  starter({
    id: 'fish_65',
    label: 'Fish 65',
    re: /\bfish\s+65\b|\bmeen\s+65\b/i,
    kcal100: 220, protein100: 17, carbs100: 9, fat100: 14, sugar100: 2, salt100: 620,
    defaultGrams: 170,
  }),

  // ── Indo-Chinese chilli / manchurian ──
  starter({
    id: 'chilli_chicken',
    label: 'Chilli chicken',
    re: /\bchilli\s+chicken\b|\bchili\s+chicken\b|\bindo\s+chinese\s+chicken\b/i,
    kcal100: 205, protein100: 16, carbs100: 8, fat100: 12, sugar100: 4, salt100: 640,
    defaultGrams: 200,
  }),
  starter({
    id: 'chilli_paneer',
    label: 'Chilli paneer',
    re: /\bchilli\s+paneer\b|\bchili\s+paneer\b/i,
    kcal100: 230, protein100: 11, carbs100: 10, fat100: 16, sugar100: 4, salt100: 620,
    defaultGrams: 180,
  }),
  starter({
    id: 'chilli_gobi',
    label: 'Chilli gobi',
    re: /\bchilli\s+gobi\b|\bchili\s+gobi\b|\bchilli\s+cauliflower\b/i,
    kcal100: 185, protein100: 4, carbs100: 14, fat100: 12, sugar100: 5, salt100: 600,
    defaultGrams: 170,
  }),
  starter({
    id: 'chilli_mushroom',
    label: 'Chilli mushroom',
    re: /\bchilli\s+mushroom\b|\bchili\s+mushroom\b/i,
    kcal100: 170, protein100: 5, carbs100: 10, fat100: 11, sugar100: 4, salt100: 580,
    defaultGrams: 160,
  }),
  starter({
    id: 'chilli_fish',
    label: 'Chilli fish',
    re: /\bchilli\s+fish\b|\bchili\s+fish\b|\bmeen\s+chilli\b/i,
    kcal100: 195, protein100: 16, carbs100: 8, fat100: 11, sugar100: 4, salt100: 620,
    defaultGrams: 180,
  }),
  starter({
    id: 'chicken_manchurian',
    label: 'Chicken manchurian',
    re: /\bchicken\s+manchurian\b|\bmanchurian\s+chicken\b/i,
    kcal100: 215, protein100: 15, carbs100: 12, fat100: 13, sugar100: 6, salt100: 660,
    defaultGrams: 200,
  }),
  starter({
    id: 'gobi_manchurian',
    label: 'Gobi manchurian',
    re: /\bgobi\s+manchurian\b|\bmanchurian\s+gobi\b|\bcauliflower\s+manchurian\b/i,
    kcal100: 190, protein100: 4, carbs100: 16, fat100: 12, sugar100: 6, salt100: 640,
    defaultGrams: 180,
  }),
  starter({
    id: 'paneer_manchurian',
    label: 'Paneer manchurian',
    re: /\bpaneer\s+manchurian\b|\bmanchurian\s+paneer\b/i,
    kcal100: 240, protein100: 10, carbs100: 14, fat100: 16, sugar100: 6, salt100: 620,
    defaultGrams: 180,
  }),
  starter({
    id: 'veg_manchurian',
    label: 'Veg manchurian',
    re: /\bveg\s+manchurian\b|\bvegetable\s+manchurian\b|\bmanchurian\s+dry\b/i,
    kcal100: 185, protein100: 4, carbs100: 18, fat100: 10, sugar100: 6, salt100: 640,
    defaultGrams: 170,
  }),
  starter({
    id: 'dragon_chicken',
    label: 'Dragon chicken',
    re: /\bdragon\s+chicken\b/i,
    kcal100: 235, protein100: 15, carbs100: 10, fat100: 15, sugar100: 5, salt100: 650,
    defaultGrams: 200,
  }),
  starter({
    id: 'chicken_lollipop',
    label: 'Chicken lollipop',
    re: /\bchicken\s+lollipop\b|\blollipop\s+chicken\b|\bdrums\s+of\s+heaven\b/i,
    kcal100: 250, protein100: 17, carbs100: 12, fat100: 16, sugar100: 4, salt100: 660,
    defaultGrams: 200,
  }),
  starter({
    id: 'schezwan_chicken',
    label: 'Schezwan chicken',
    re: /\b(schezwan|szechuan|schezuan)\s+chicken\b/i,
    kcal100: 210, protein100: 16, carbs100: 7, fat100: 13, sugar100: 3, salt100: 680,
    defaultGrams: 190,
  }),
  starter({
    id: 'garlic_chicken',
    label: 'Garlic chicken',
    re: /\bgarlic\s+chicken\b(?!\s+naan)/i,
    kcal100: 200, protein100: 17, carbs100: 6, fat100: 12, sugar100: 2, salt100: 620,
    defaultGrams: 190,
  }),
  starter({
    id: 'crispy_chicken',
    label: 'Crispy chicken',
    re: /\bcrispy\s+chicken\b(?!\s+wings)/i,
    kcal100: 230, protein100: 16, carbs100: 12, fat100: 14, sugar100: 3, salt100: 620,
    defaultGrams: 200,
  }),
  starter({
    id: 'salt_pepper_chicken',
    label: 'Salt and pepper chicken',
    re: /\bsalt\s+(?:and\s+)?pepper\s+chicken\b/i,
    kcal100: 210, protein100: 16, carbs100: 8, fat100: 12, sugar100: 2, salt100: 680,
    defaultGrams: 190,
  }),

  // ── South Indian dry fry / sukka / varuval ──
  starter({
    id: 'mutton_sukka',
    label: 'Mutton sukka',
    re: /\b(mutton\s+sukka|chicken\s+sukka|sukka\s+varuval|aattu\s+kari\s+sukka|mutton\s+dry\s+fry)\b/i,
    kcal100: 205, protein100: 18, carbs100: 3, fat100: 13, sugar100: 1, salt100: 560,
    defaultGrams: 180,
  }),
  starter({
    id: 'mutton_chukka',
    label: 'Mutton chukka',
    re: /\b(mutton\s+chukka|chicken\s+chukka|chukka\s+varuval|mutton\s+chukka\s+varuval)\b/i,
    kcal100: 205, protein100: 18, carbs100: 3, fat100: 13, sugar100: 1, salt100: 560,
    defaultGrams: 180,
  }),
  starter({
    id: 'chicken_varuval',
    label: 'Chicken varuval',
    re: /\b(chicken\s+varuval|kozhi\s+varuval|kozhi\s+roast|chicken\s+dry\s+fry|chicken\s+pepper\s+fry)\b/i,
    kcal100: 195, protein100: 19, carbs100: 3, fat100: 12, sugar100: 1, salt100: 540,
    defaultGrams: 180,
  }),
  starter({
    id: 'mutton_varuval',
    label: 'Mutton varuval',
    re: /\b(mutton\s+varuval|aattu\s+kari\s+varuval|mutton\s+pepper\s+fry|lamb\s+dry\s+fry)\b/i,
    kcal100: 210, protein100: 17, carbs100: 3, fat100: 14, sugar100: 1, salt100: 560,
    defaultGrams: 180,
  }),
  starter({
    id: 'pepper_chicken',
    label: 'Pepper chicken',
    re: /\bpepper\s+chicken\b|\bmilagu\s+kozhi\b|\bkozhi\s+milagu\b/i,
    kcal100: 185, protein100: 18, carbs100: 4, fat100: 11, sugar100: 1, salt100: 580,
    defaultGrams: 180,
  }),
  starter({
    id: 'fish_fry',
    label: 'Fish fry',
    re: /\b(fish\s+fry|meen\s+varuval|meen\s+fry|nethili\s+fry|anchovy\s+fry)\b/i,
    kcal100: 195, protein100: 18, carbs100: 6, fat100: 11, sugar100: 1, salt100: 560,
    defaultGrams: 170,
  }),
  starter({
    id: 'prawn_fry',
    label: 'Prawn fry',
    re: /\b(prawn\s+fry|shrimp\s+fry|eral\s+fry|chemmeen\s+fry|konju\s+fry)\b/i,
    kcal100: 185, protein100: 19, carbs100: 4, fat100: 10, sugar100: 1, salt100: 600,
    defaultGrams: 160,
  }),
  starter({
    id: 'chicken_fry',
    label: 'Chicken fry',
    re: /\bchicken\s+fry\b|\bkozhi\s+fry\b|\bfried\s+chicken\s+indian\b/i,
    kcal100: 220, protein100: 18, carbs100: 5, fat100: 14, sugar100: 1, salt100: 580,
    defaultGrams: 190,
  }),
];

export const INDIAN_STARTER_IDS = new Set(INDIAN_STARTER_CATALOG.map((c) => c.id));

export function isIndianStarterRefId(id = '') {
  return INDIAN_STARTER_IDS.has(id);
}

export function matchIndianStarterRef(text = '') {
  const t = String(text).trim();
  if (t.length < 3) return null;
  for (const ref of INDIAN_STARTER_CATALOG) {
    if (ref.re.test(t)) return ref;
  }
  return null;
}

export function resolveIndianStarterFromAnalysis(analysis = {}) {
  const text = [
    analysis?.meal_summary,
    ...(analysis?.items || []).map((i) => `${i.name || ''} ${i.portion_estimate || ''}`),
  ]
    .filter(Boolean)
    .join(' ');

  const refId = analysis?._refId || '';
  if (isIndianStarterRefId(refId)) {
    return INDIAN_STARTER_CATALOG.find((c) => c.id === refId) || null;
  }
  return matchIndianStarterRef(text);
}

export function starterDefaultGrams(ref) {
  return ref?.defaultGrams || 180;
}

/** Portion clarify chips — tuned to each starter's typical restaurant serving. */
export function starterPortionOptions(ref) {
  if (!ref) {
    return [
      'Small / half plate (~120 g)',
      'Regular starter plate (~180 g)',
      'Large plate (~250 g)',
      'Extra large (~320 g+)',
    ];
  }
  if (ref.id === 'chicken_lollipop') {
    return [
      '4 pieces (~150 g)',
      '6 pieces (~200 g)',
      '8 pieces (~260 g)',
      '10+ pieces (~320 g+)',
    ];
  }
  const g = starterDefaultGrams(ref);
  const small = Math.round((g * 0.65) / 10) * 10;
  const large = Math.round((g * 1.35) / 10) * 10;
  const xl = Math.round((g * 1.75) / 10) * 10;
  return [
    `Small / half plate (~${small} g)`,
    `Regular starter plate (~${g} g)`,
    `Large plate (~${large} g)`,
    `Extra large (~${xl} g+)`,
  ];
}

export const INDIAN_STARTER_FOOD_REFERENCES = INDIAN_STARTER_CATALOG.map((c) => ({
  id: c.id,
  re: c.re,
  kcal100: c.kcal100,
  protein100: c.protein100,
  carbs100: c.carbs100,
  fat100: c.fat100,
  fibre100: c.fibre100 ?? 1,
  sugar100: c.sugar100,
  salt100: c.salt100,
}));
