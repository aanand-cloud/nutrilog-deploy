/**
 * Side dishes commonly served with biryani (Hyderabad, Tamil Nadu, North, etc.).
 * Used for meal notes, photo calibration, and describe-meal matching.
 * Nutrition ≈ typical restaurant/home side portion per 100 g.
 */

const SIDE_BASE = {
  fibre100: 1,
};

function side(entry) {
  return { ...SIDE_BASE, ...entry };
}

/** @type {Array<{ id: string, label: string, re: RegExp, kcal100: number, protein100: number, carbs100: number, fat100: number, sugar100: number, salt100: number, fibre100?: number, defaultGrams: number }>} */
export const BIRYANI_SIDE_CATALOG = [
  // ── Raita / curd sides ──
  side({
    id: 'onion_raita',
    label: 'Onion raita',
    re: /\b(onion\s+raita|pyaz\s+raita|pyaaz\s+raita|ulli\s+raita|vengayam\s+raita)\b/i,
    kcal100: 72, protein100: 2.5, carbs100: 7, fat100: 4, sugar100: 4, salt100: 320,
    defaultGrams: 80,
  }),
  side({
    id: 'cucumber_raita',
    label: 'Cucumber raita',
    re: /\b(cucumber\s+raita|kheera\s+raita|vellarikkai\s+raita|dosakaya\s+raita)\b/i,
    kcal100: 58, protein100: 2.5, carbs100: 5, fat100: 3, sugar100: 3, salt100: 300,
    defaultGrams: 80,
  }),
  side({
    id: 'boondi_raita',
    label: 'Boondi raita',
    re: /\b(boondi\s+raita|bundhi\s+raita)\b/i,
    kcal100: 95, protein100: 3, carbs100: 10, fat100: 4.5, sugar100: 4, salt100: 340,
    defaultGrams: 80,
  }),
  side({
    id: 'mint_raita',
    label: 'Mint raita',
    re: /\b(mint\s+raita|pudina\s+raita)\b/i,
    kcal100: 68, protein100: 2.5, carbs100: 6, fat100: 3.5, sugar100: 4, salt100: 310,
    defaultGrams: 80,
  }),
  side({
    id: 'raita',
    label: 'Raita',
    re: /\braita\b/i,
    kcal100: 65, protein100: 3, carbs100: 5, fat100: 3.5, sugar100: 3, salt100: 290,
    defaultGrams: 80,
  }),

  // ── Brinjal / eggplant sides (TN + Hyderabad) ──
  side({
    id: 'brinjal_gosthu',
    label: 'Brinjal gosthu',
    re: /\b(brinjal\s+gosthu|brinjal\s+gotsu|baingan\s+gosthu|kathirikai\s+gosthu|kathirikkai\s+gosthu|eggplant\s+gosthu)\b/i,
    kcal100: 88, protein100: 1.5, carbs100: 10, fat100: 4.5, sugar100: 4, salt100: 480,
    defaultGrams: 100,
  }),
  side({
    id: 'bagara_baingan',
    label: 'Bagara baingan',
    re: /\b(bagara\s+baingan|baghara\s+baingan|bagara\s+brinjal|bagara\s+eggplant)\b/i,
    kcal100: 105, protein100: 2, carbs100: 9, fat100: 7, sugar100: 4, salt100: 520,
    defaultGrams: 100,
  }),
  side({
    id: 'ennai_kathirikai',
    label: 'Ennai kathirikai',
    re: /\b(ennai\s+kathirikai|ennai\s+kathirikkai|oil\s+brinjal\s+curry)\b/i,
    kcal100: 115, protein100: 1.5, carbs100: 8, fat100: 9, sugar100: 3, salt100: 490,
    defaultGrams: 90,
  }),

  // ── Hyderabad salan & dalcha ──
  side({
    id: 'mirchi_salan',
    label: 'Mirchi ka salan',
    re: /\b(mirchi\s+ka\s+salan|mirchi\s+salan|chilli\s+salan|chili\s+salan|hyderabadi\s+salan)\b/i,
    kcal100: 95, protein100: 2, carbs100: 8, fat100: 6, sugar100: 3, salt100: 540,
    defaultGrams: 80,
  }),
  side({
    id: 'dalcha',
    label: 'Dalcha',
    re: /\b(dalcha|daalcha|dal\s+cha|mutton\s+dalcha|chana\s+dalcha|hyderabadi\s+dalcha)\b/i,
    kcal100: 78, protein100: 4, carbs100: 10, fat100: 2.5, sugar100: 2, salt100: 460,
    defaultGrams: 100,
  }),

  // ── Salads & papad ──
  side({
    id: 'kachumber',
    label: 'Kachumber',
    re: /\b(kachumber|kachumber\s+salad|onion\s+salad|pyaz\s+salad)\b/i,
    kcal100: 35, protein100: 1, carbs100: 6, fat100: 0.5, sugar100: 4, salt100: 280,
    defaultGrams: 50,
  }),
  side({
    id: 'kosambari',
    label: 'Kosambari',
    re: /\b(kosambari|kosumalli|kosumbari)\b/i,
    kcal100: 42, protein100: 1.5, carbs100: 7, fat100: 0.8, sugar100: 3, salt100: 260,
    defaultGrams: 60,
  }),
  side({
    id: 'papad_side',
    label: 'Papad',
    re: /\b(papad\s+side|side\s+papad|papad\s+with\s+biryani|roasted\s+papad|fried\s+papad)\b/i,
    kcal100: 370, protein100: 20, carbs100: 50, fat100: 3, sugar100: 0, salt100: 1200,
    defaultGrams: 15,
  }),

  // ── Soup / shorba ──
  side({
    id: 'biryani_shorba',
    label: 'Shorba',
    re: /\b(shorba|biryani\s+shorba|mutton\s+shorba|chicken\s+shorba|yakhni\s+shorba)\b/i,
    kcal100: 45, protein100: 3, carbs100: 3, fat100: 2, sugar100: 1, salt100: 420,
    defaultGrams: 150,
  }),

  // ── Sweet sides (Hyderabad / Mughlai) ──
  side({
    id: 'bread_halwa',
    label: 'Bread halwa',
    re: /\b(bread\s+halwa|double\s+ka\s+meetha|shahi\s+tukda|shahi\s+tukra|double\s+meetha)\b/i,
    kcal100: 310, protein100: 5, carbs100: 42, fat100: 14, sugar100: 28, salt100: 120,
    defaultGrams: 120,
  }),
  side({
    id: 'firni_side',
    label: 'Firni',
    re: /\b(firni|phirni|kheer\s+side)\b/i,
    kcal100: 120, protein100: 3, carbs100: 18, fat100: 4, sugar100: 14, salt100: 80,
    defaultGrams: 100,
  }),
  side({
    id: 'gulab_jamun_side',
    label: 'Gulab jamun',
    re: /\b(gulab\s+jamun\s+side|side\s+gulab\s+jamun|gulabjamun\s+with\s+biryani)\b/i,
    kcal100: 320, protein100: 4, carbs100: 52, fat100: 10, sugar100: 38, salt100: 80,
    defaultGrams: 80,
  }),
];

/** Match the most specific biryani side in customer notes or item text. */
export function matchBiryaniSideRef(text = '') {
  const t = String(text).trim();
  if (t.length < 3) return null;
  for (const ref of BIRYANI_SIDE_CATALOG) {
    if (ref.re.test(t)) return ref;
  }
  return null;
}

/** For food-references.js photo/barcode calibration. */
export const BIRYANI_SIDE_FOOD_REFERENCES = BIRYANI_SIDE_CATALOG.map((c) => ({
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
