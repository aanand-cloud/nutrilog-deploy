/**
 * Regional Indian chutney variants for meal-notes hidden additions.
 * Specific types are matched before generic "chutney".
 * Nutrition ≈ typical home/restaurant side chutney per 100 g.
 */

const CHUTNEY_BASE = {
  fibre100: 1,
};

function chutney(entry) {
  return { ...CHUTNEY_BASE, ...entry };
}

/** @type {Array<{ id: string, label: string, re: RegExp, kcal100: number, protein100: number, carbs100: number, fat100: number, sugar100: number, salt100: number, fibre100?: number }>} */
export const CHUTNEY_CATALOG = [
  // ── Coconut-based (TN, Kerala, Andhra, North) ──
  chutney({
    id: 'coconut_chutney',
    label: 'Coconut chutney',
    re: /\b(coconut\s+chutney|thengai\s+chutney|thengai\s+chammanthi|kobbari\s+chutney|kobbari\s+pachadi|nariyal\s+chutney|thenga\s+chammanthi|thenga\s+chutney|coconut\s+chammanthi|kobbari\s+chammanthi)\b/i,
    kcal100: 185, protein100: 2, carbs100: 8, fat100: 16, sugar100: 3, salt100: 420,
  }),

  // ── Peanut / groundnut (Andhra, Karnataka, TN) ──
  chutney({
    id: 'peanut_chutney',
    label: 'Peanut chutney',
    re: /\b(peanut\s+chutney|groundnut\s+chutney|palli\s+chutney|palli\s+pachadi|shenga\s+chutney|moongphali\s+chutney)\b/i,
    kcal100: 220, protein100: 8, carbs100: 12, fat100: 16, sugar100: 3, salt100: 380,
  }),

  // ── Green / herb (North + South) ──
  chutney({
    id: 'mint_chutney',
    label: 'Mint chutney',
    re: /\b(mint\s+chutney|pudina\s+chutney|pudina\s+pachadi)\b/i,
    kcal100: 85, protein100: 2, carbs100: 12, fat100: 2.5, sugar100: 4, salt100: 450,
  }),
  chutney({
    id: 'coriander_chutney',
    label: 'Coriander chutney',
    re: /\b(coriander\s+chutney|kothamalli\s+chutney|dhania\s+chutney|cilantro\s+chutney)\b/i,
    kcal100: 90, protein100: 2.5, carbs100: 13, fat100: 2.5, sugar100: 4, salt100: 460,
  }),
  chutney({
    id: 'green_chutney',
    label: 'Green chutney',
    re: /\b(green\s+chutney|hari\s+chutney|pudina\s+dhania\s+chutney)\b/i,
    kcal100: 88, protein100: 2.5, carbs100: 12, fat100: 2.5, sugar100: 4, salt100: 440,
  }),
  chutney({
    id: 'curry_leaf_chutney',
    label: 'Curry leaf chutney',
    re: /\b(curry\s+leaf\s+chutney|karuveppilai\s+chutney|karivepaku\s+pachadi|curry\s+leaves\s+chutney)\b/i,
    kcal100: 110, protein100: 2, carbs100: 10, fat100: 7, sugar100: 2, salt100: 400,
  }),

  // ── Tomato ──
  chutney({
    id: 'tomato_chutney',
    label: 'Tomato chutney',
    re: /\b(tomato\s+chutney|thakkali\s+chutney|thakkali\s+pachadi|tamatar\s+chutney|tomato\s+pachadi)\b/i,
    kcal100: 75, protein100: 1.5, carbs100: 14, fat100: 1.5, sugar100: 8, salt100: 520,
  }),

  // ── Onion / shallot ──
  chutney({
    id: 'onion_chutney',
    label: 'Onion chutney',
    re: /\b(onion\s+chutney|vengayam\s+chutney|ulli\s+chutney|ulli\s+pachadi|ulli\s+chammanthi|pyaaz\s+chutney|shallot\s+chutney|erulli\s+chutney)\b/i,
    kcal100: 115, protein100: 1.5, carbs100: 16, fat100: 5, sugar100: 6, salt100: 480,
  }),

  // ── Garlic (often oil-heavy) ──
  chutney({
    id: 'garlic_chutney',
    label: 'Garlic chutney',
    re: /\b(garlic\s+chutney|poondu\s+chutney|lasun\s+chutney|lahsun\s+chutney|vellulli\s+chutney|vellulli\s+pachadi|bellulli\s+chutney)\b/i,
    kcal100: 195, protein100: 2, carbs100: 10, fat100: 16, sugar100: 2, salt100: 520,
  }),

  // ── Ginger ──
  chutney({
    id: 'ginger_chutney',
    label: 'Ginger chutney',
    re: /\b(ginger\s+chutney|allam\s+chutney|allam\s+pachadi|inji\s+chutney|adrak\s+chutney)\b/i,
    kcal100: 95, protein100: 1.5, carbs100: 14, fat100: 3.5, sugar100: 8, salt100: 460,
  }),

  // ── Spicy / kaara (TN, Andhra) ──
  chutney({
    id: 'kaara_chutney',
    label: 'Kaara chutney',
    re: /\b(kaara\s+chutney|kara\s+chutney|karam\s+chutney|kaaram\s+chutney|spicy\s+chutney|mirchi\s+chutney)\b/i,
    kcal100: 105, protein100: 2, carbs100: 14, fat100: 4.5, sugar100: 5, salt100: 550,
  }),
  chutney({
    id: 'red_chutney',
    label: 'Red chutney',
    re: /\b(red\s+chutney|red\s+chilli\s+chutney|chilli\s+chutney|chili\s+chutney)\b/i,
    kcal100: 100, protein100: 2, carbs100: 13, fat100: 4, sugar100: 5, salt100: 540,
  }),
  chutney({
    id: 'green_chilli_chutney',
    label: 'Green chilli chutney',
    re: /\b(green\s+chilli\s+chutney|green\s+chili\s+chutney|pachai\s+milagai\s+chutney|hara\s+mirch\s+chutney)\b/i,
    kcal100: 80, protein100: 2, carbs100: 11, fat100: 3, sugar100: 3, salt100: 500,
  }),

  // ── Sweet / tamarind (North + South) ──
  chutney({
    id: 'tamarind_chutney',
    label: 'Tamarind chutney',
    re: /\b(tamarind\s+chutney|imli\s+chutney|imli\s+ki\s+chutney|puli\s+chutney|chintapandu\s+chutney|hunase\s+chutney)\b/i,
    kcal100: 145, protein100: 1, carbs100: 35, fat100: 0.5, sugar100: 28, salt100: 620,
  }),
  chutney({
    id: 'date_chutney',
    label: 'Date chutney',
    re: /\b(date\s+chutney|khajur\s+chutney|saunth\s+chutney|sonth\s+chutney|imli\s+saunth)\b/i,
    kcal100: 140, protein100: 1.5, carbs100: 32, fat100: 1, sugar100: 26, salt100: 580,
  }),
  chutney({
    id: 'mango_chutney',
    label: 'Mango chutney',
    re: /\b(mango\s+chutney|aam\s+chutney|mamidi\s+chutney|sweet\s+mango\s+chutney)\b/i,
    kcal100: 130, protein100: 0.8, carbs100: 30, fat100: 0.5, sugar100: 24, salt100: 500,
  }),

  // ── Andhra / Telugu specials ──
  chutney({
    id: 'gongura_chutney',
    label: 'Gongura chutney',
    re: /\b(gongura\s+chutney|gongura\s+pachadi|sorrel\s+chutney|pulicha\s+keerai\s+chutney)\b/i,
    kcal100: 78, protein100: 2, carbs100: 12, fat100: 2.5, sugar100: 3, salt100: 480,
  }),
  chutney({
    id: 'dosakaya_chutney',
    label: 'Dosakaya chutney',
    re: /\b(dosakaya\s+chutney|dosakaya\s+pachadi|yellow\s+cucumber\s+chutney|dosa\s+kaya\s+pachadi)\b/i,
    kcal100: 55, protein100: 1, carbs100: 10, fat100: 1.5, sugar100: 4, salt100: 450,
  }),
  chutney({
    id: 'tomato_onion_chutney',
    label: 'Tomato onion chutney',
    re: /\b(tomato\s+onion\s+chutney|ulli\s+thakkali\s+chutney|tomato\s+onion\s+pachadi)\b/i,
    kcal100: 88, protein100: 1.5, carbs100: 15, fat100: 2.5, sugar100: 7, salt100: 500,
  }),
  chutney({
    id: 'peanut_tomato_chutney',
    label: 'Peanut tomato chutney',
    re: /\b(peanut\s+tomato\s+chutney|palli\s+tomato\s+pachadi|groundnut\s+tomato\s+chutney)\b/i,
    kcal100: 130, protein100: 5, carbs100: 14, fat100: 7, sugar100: 6, salt100: 460,
  }),

  // ── Other South ──
  chutney({
    id: 'brinjal_chutney',
    label: 'Brinjal chutney',
    re: /\b(brinjal\s+chutney|eggplant\s+chutney|kathirikai\s+chutney|vankaya\s+pachadi|baingan\s+chutney)\b/i,
    kcal100: 92, protein100: 1.5, carbs100: 12, fat100: 4.5, sugar100: 5, salt100: 470,
  }),
  chutney({
    id: 'sesame_chutney',
    label: 'Sesame chutney',
    re: /\b(sesame\s+chutney|til\s+chutney|nuvvula\s+pachadi|ellu\s+chutney)\b/i,
    kcal100: 200, protein100: 6, carbs100: 10, fat100: 16, sugar100: 2, salt100: 400,
  }),
  chutney({
    id: 'ridge_gourd_chutney',
    label: 'Ridge gourd chutney',
    re: /\b(ridge\s+gourd\s+chutney|peerkangai\s+chutney|beerakaya\s+pachadi|turai\s+chutney|jhinga\s+chutney)\b/i,
    kcal100: 48, protein100: 1, carbs100: 9, fat100: 1.2, sugar100: 3, salt100: 430,
  }),
  chutney({
    id: 'radish_chutney',
    label: 'Radish chutney',
    re: /\b(radish\s+chutney|mullangi\s+chutney|mooli\s+chutney|mullangi\s+pachadi)\b/i,
    kcal100: 52, protein100: 1, carbs100: 10, fat100: 1.5, sugar100: 4, salt100: 440,
  }),
  chutney({
    id: 'carrot_chutney',
    label: 'Carrot chutney',
    re: /\b(carrot\s+chutney|gajar\s+chutney|carrot\s+pachadi)\b/i,
    kcal100: 65, protein100: 1, carbs100: 12, fat100: 1.8, sugar100: 6, salt100: 450,
  }),
  chutney({
    id: 'beetroot_chutney',
    label: 'Beetroot chutney',
    re: /\b(beetroot\s+chutney|beet\s+chutney|beetroot\s+pachadi)\b/i,
    kcal100: 58, protein100: 1.2, carbs100: 11, fat100: 1.5, sugar100: 7, salt100: 440,
  }),
  chutney({
    id: 'capsicum_chutney',
    label: 'Capsicum chutney',
    re: /\b(capsicum\s+chutney|bell\s+pepper\s+chutney|simla\s+mirch\s+chutney)\b/i,
    kcal100: 70, protein100: 1.5, carbs100: 11, fat100: 2.5, sugar100: 5, salt100: 460,
  }),
  chutney({
    id: 'amla_chutney',
    label: 'Amla chutney',
    re: /\b(amla\s+chutney|gooseberry\s+chutney|nellikai\s+chutney|amla\s+pachadi)\b/i,
    kcal100: 72, protein100: 1, carbs100: 14, fat100: 1.5, sugar100: 8, salt100: 470,
  }),

  // ── North street / snack ──
  chutney({
    id: 'chaat_chutney',
    label: 'Chaat chutney',
    re: /\b(chaat\s+chutney|sweet\s+chutney|meethi\s+chutney|khatta\s+meetha\s+chutney)\b/i,
    kcal100: 135, protein100: 1, carbs100: 32, fat100: 0.5, sugar100: 26, salt100: 600,
  }),

  // ── Generic fallback (always last) ──
  chutney({
    id: 'chutney',
    label: 'Chutney',
    re: /\bchutney\b/i,
    kcal100: 120, protein100: 2, carbs100: 18, fat100: 4, sugar100: 12, salt100: 480,
  }),
];

/** Match the most specific chutney name in customer notes (longest phrase wins). */
export function matchChutneyRef(text = '') {
  const t = String(text).trim();
  if (t.length < 3) return null;
  let best = null;
  let bestLen = 0;
  for (const ref of CHUTNEY_CATALOG) {
    const m = ref.re.exec(t);
    if (!m) continue;
    const len = m[0].length;
    if (len > bestLen) {
      best = ref;
      bestLen = len;
    }
  }
  return best;
}

export function isChutneyItemText(text = '') {
  const t = String(text).trim();
  if (t.length < 3) return false;
  if (/\b(chutney|chammanthi|pachadi)\b/i.test(t)) return true;
  return Boolean(matchChutneyRef(t));
}

/** For food-references.js photo/barcode calibration (includes fibre). */
export const CHUTNEY_FOOD_REFERENCES = CHUTNEY_CATALOG.filter((c) => c.id !== 'chutney').map((c) => ({
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
