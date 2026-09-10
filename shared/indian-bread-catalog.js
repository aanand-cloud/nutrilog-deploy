/**
 * Indian flatbreads (parotta, naan, roti/chapati) and typical side dishes.
 * Used for meal notes, photo calibration, and describe-meal matching.
 */

const SIDE_BASE = { fibre100: 2 };

function side(entry) {
  return { ...SIDE_BASE, ...entry };
}

/** Bread variants — specific before generic roti/naan/paratha in food-references. */
export const INDIAN_BREAD_FOOD_REFERENCES = [
  {
    id: 'kerala_parotta',
    re: /\b(kerala\s+parotta|malabar\s+parotta|porotta|parotta|barotta|parotta\s+chop)\b/i,
    kcal100: 310, protein100: 7, carbs100: 42, fat100: 13, fibre100: 2.5, salt100: 480,
  },
  {
    id: 'garlic_naan',
    re: /\bgarlic\s+naan\b/i,
    kcal100: 300, protein100: 9, carbs100: 50, fat100: 7, fibre100: 2.5, salt100: 540,
  },
  {
    id: 'butter_naan',
    re: /\bbutter\s+naan\b/i,
    kcal100: 310, protein100: 9, carbs100: 48, fat100: 9, fibre100: 2.5, salt100: 520,
  },
  {
    id: 'stuffed_naan',
    re: /\b(stuffed\s+naan|keema\s+naan|paneer\s+naan|peshawari\s+naan)\b/i,
    kcal100: 295, protein100: 10, carbs100: 46, fat100: 8, fibre100: 2.5, salt100: 530,
  },
  {
    id: 'tandoori_roti',
    re: /\b(tandoori\s+roti|tandoor\s+roti)\b/i,
    kcal100: 260, protein100: 8, carbs100: 48, fat100: 3, fibre100: 3, salt100: 400,
  },
  {
    id: 'rumali_roti',
    re: /\b(rumali\s+roti|roomali\s+roti)\b/i,
    kcal100: 260, protein100: 8, carbs100: 48, fat100: 3, fibre100: 3, salt100: 400,
  },
  {
    id: 'chapati',
    re: /\b(chapathi|chappati|chappathi)\b/i,
    kcal100: 240, protein100: 8, carbs100: 46, fat100: 2.5, fibre100: 4, salt100: 380,
  },
  {
    id: 'lachha_paratha',
    re: /\b(lachha\s+paratha|laccha\s+paratha|layered\s+paratha)\b/i,
    kcal100: 330, protein100: 8, carbs100: 42, fat100: 15, fibre100: 3, salt100: 520,
  },
  {
    id: 'aloo_paratha',
    re: /\b(aloo\s+paratha|alu\s+paratha|potato\s+paratha)\b/i,
    kcal100: 280, protein100: 7, carbs100: 38, fat100: 12, fibre100: 3.5, salt100: 500,
  },
  {
    id: 'methi_paratha',
    re: /\b(methi\s+paratha|fenugreek\s+paratha)\b/i,
    kcal100: 270, protein100: 8, carbs100: 36, fat100: 11, fibre100: 4, salt100: 490,
  },
  {
    id: 'mooli_paratha',
    re: /\b(mooli\s+paratha|radish\s+paratha|mullangi\s+paratha)\b/i,
    kcal100: 265, protein100: 7, carbs100: 36, fat100: 11, fibre100: 3.5, salt100: 480,
  },
  {
    id: 'bhatura',
    re: /\b(bhatura|bhature|batura)\b/i,
    kcal100: 320, protein100: 7, carbs100: 44, fat100: 13, fibre100: 2.5, salt100: 460,
  },
];

/** Side dishes commonly served with parotta, naan, roti, or chapati. */
export const INDIAN_BREAD_SIDE_CATALOG = [
  side({
    id: 'salna',
    label: 'Salna',
    re: /\b(salna|parotta\s+salna|porotta\s+salna|chicken\s+salna|mutton\s+salna|egg\s+salna|veg\s+salna|vegetable\s+salna)\b/i,
    kcal100: 95, protein100: 4, carbs100: 8, fat100: 5, sugar100: 2, salt100: 480,
    defaultGrams: 120,
  }),
  side({
    id: 'chicken_kurma',
    label: 'Chicken kurma',
    re: /\b(chicken\s+kurma|chicken\s+korma|kori\s+kurma)\b/i,
    kcal100: 130, protein100: 10, carbs100: 6, fat100: 8, sugar100: 2, salt100: 500,
    defaultGrams: 150,
  }),
  side({
    id: 'veg_kurma',
    label: 'Vegetable kurma',
    re: /\b(veg(?:etable)?\s+kurma|mixed\s+veg\s+kurma|veg\s+korma)\b/i,
    kcal100: 95, protein100: 2.5, carbs100: 8, fat100: 6, sugar100: 3, salt100: 480,
    defaultGrams: 120,
  }),
  side({
    id: 'side_chicken_curry',
    label: 'Chicken curry',
    re: /\b(side\s+of\s+chicken\s+curry|chicken\s+curry\s+side|with\s+chicken\s+curry|chicken\s+curry\s+with\s+(?:roti|naan|parotta|chapati))\b/i,
    kcal100: 120, protein100: 9, carbs100: 5, fat100: 7, sugar100: 2, salt100: 520,
    defaultGrams: 150,
  }),
  side({
    id: 'side_egg_curry',
    label: 'Egg curry',
    re: /\b(side\s+of\s+egg\s+curry|egg\s+curry\s+side|with\s+egg\s+curry|egg\s+curry\s+with\s+(?:roti|naan|parotta|chapati)|anda\s+curry\s+with\s+roti)\b/i,
    kcal100: 145, protein100: 10, carbs100: 5, fat100: 10, sugar100: 2, salt100: 520,
    defaultGrams: 140,
  }),
  side({
    id: 'side_mutton_curry',
    label: 'Mutton curry',
    re: /\b(side\s+of\s+mutton\s+curry|mutton\s+curry\s+side|with\s+mutton\s+curry|lamb\s+curry\s+with\s+(?:roti|naan|parotta))\b/i,
    kcal100: 135, protein100: 11, carbs100: 4, fat100: 9, sugar100: 2, salt100: 540,
    defaultGrams: 150,
  }),
  side({
    id: 'side_fish_curry',
    label: 'Fish curry',
    re: /\b(fish\s+curry\s+with\s+(?:parotta|roti|appam)|side\s+of\s+fish\s+curry|with\s+fish\s+curry)\b/i,
    kcal100: 115, protein100: 12, carbs100: 4, fat100: 6, sugar100: 1, salt100: 500,
    defaultGrams: 150,
  }),
  side({
    id: 'side_dal',
    label: 'Dal',
    re: /\b(side\s+of\s+dal|dal\s+side|with\s+dal|with\s+dal\s+tadka|with\s+dal\s+fry|dal\s+tadka|dal\s+fry|dal\s+with\s+(?:roti|chapati|naan)|roti\s+with\s+dal|chapati\s+with\s+dal)\b/i,
    kcal100: 95, protein100: 6, carbs100: 12, fat100: 2.5, sugar100: 2, salt100: 420,
    defaultGrams: 150,
  }),
  side({
    id: 'side_sabzi',
    label: 'Sabzi',
    re: /\b(side\s+of\s+sabzi|sabzi\s+side|with\s+sabzi|sabji\s+with\s+(?:roti|chapati)|mixed\s+veg\s+with\s+roti)\b/i,
    kcal100: 85, protein100: 3, carbs100: 9, fat100: 4.5, sugar100: 3, salt100: 450,
    defaultGrams: 120,
  }),
  side({
    id: 'side_poriyal',
    label: 'Poriyal',
    re: /\b(poriyal|thoran)\b(?!\s+with\s+rice)/i,
    kcal100: 75, protein100: 2.5, carbs100: 8, fat100: 3.5, sugar100: 2, salt100: 420,
    defaultGrams: 100,
  }),
  side({
    id: 'side_butter_chicken',
    label: 'Butter chicken',
    re: /\b(butter\s+chicken\s+with\s+(?:naan|roti|kulcha)|naan\s+with\s+butter\s+chicken|side\s+of\s+butter\s+chicken)\b/i,
    kcal100: 180, protein100: 12, carbs100: 6, fat100: 12, sugar100: 3, salt100: 580,
    defaultGrams: 180,
  }),
  side({
    id: 'side_paneer',
    label: 'Paneer curry',
    re: /\b(paneer\s+(?:curry|masala|tikka)\s+with\s+(?:naan|roti|kulcha)|palak\s+paneer\s+with\s+(?:roti|naan)|side\s+of\s+paneer)\b/i,
    kcal100: 165, protein100: 9, carbs100: 8, fat100: 12, sugar100: 3, salt100: 520,
    defaultGrams: 160,
  }),
  side({
    id: 'side_dal_makhani',
    label: 'Dal makhani',
    re: /\b(dal\s+makhani\s+with\s+(?:naan|roti|kulcha)|naan\s+with\s+dal\s+makhani|side\s+of\s+dal\s+makhani)\b/i,
    kcal100: 140, protein100: 7, carbs100: 12, fat100: 7, sugar100: 2, salt100: 480,
    defaultGrams: 150,
  }),
  side({
    id: 'side_chole',
    label: 'Chole',
    re: /\b(chole\s+with\s+(?:roti|naan|kulcha|bhature)|chana\s+masala\s+with\s+roti|side\s+of\s+chole)\b/i,
    kcal100: 110, protein100: 5, carbs100: 14, fat100: 3.5, sugar100: 3, salt100: 480,
    defaultGrams: 150,
  }),
  side({
    id: 'side_raita',
    label: 'Raita',
    re: /\b(raita\s+with\s+(?:roti|naan|parotta|chapati)|side\s+of\s+raita|with\s+raita\s+and\s+(?:roti|naan|parotta))\b/i,
    kcal100: 65, protein100: 3, carbs100: 5, fat100: 3.5, sugar100: 3, salt100: 290,
    defaultGrams: 80,
  }),
  side({
    id: 'side_papad',
    label: 'Papad',
    re: /\b(papad\s+with\s+(?:roti|naan|dal|meal)|side\s+papad|roasted\s+papad|fried\s+papad)\b/i,
    kcal100: 370, protein100: 20, carbs100: 50, fat100: 3, sugar100: 0, salt100: 1200,
    defaultGrams: 15,
  }),
  side({
    id: 'side_pickles',
    label: 'Pickle',
    re: /\b(pickle\s+with\s+(?:roti|naan|parotta|chapati)|side\s+of\s+pickle|with\s+achaar|with\s+achar)\b/i,
    kcal100: 45, protein100: 0.5, carbs100: 8, fat100: 1, sugar100: 4, salt100: 1200,
    defaultGrams: 20,
  }),
];

export function matchIndianBreadSideRef(text = '') {
  const t = String(text).trim();
  if (t.length < 3) return null;
  for (const ref of INDIAN_BREAD_SIDE_CATALOG) {
    if (ref.re.test(t)) return ref;
  }
  return null;
}

export const INDIAN_BREAD_SIDE_FOOD_REFERENCES = INDIAN_BREAD_SIDE_CATALOG.map((c) => ({
  id: c.id,
  re: c.re,
  kcal100: c.kcal100,
  protein100: c.protein100,
  carbs100: c.carbs100,
  fat100: c.fat100,
  fibre100: c.fibre100 ?? 2,
  sugar100: c.sugar100,
  salt100: c.salt100,
}));
