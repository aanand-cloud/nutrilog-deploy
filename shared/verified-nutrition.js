/**
 * Verified nutrition overlay — CoFID / IFCT authoritative values on matched refs.
 */

import { VERIFIED_BY_ID, VERIFIED_NUTRITION_STATS, VERIFIED_ALIAS_TO_ID } from './verified-nutrition.generated.js';
import { VERIFICATION_META } from './canonical-food-model.js';
import { normalizeCanonicalFoodText } from './canonical-food-identity.js';
import { getApprovedIndiaNutrition } from './india-nutrition-validation.js';
import { applyLevel23Overlay, resolveLevel23Nutrition } from './india-nutrition-l23.js';

export { VERIFIED_NUTRITION_STATS, VERIFIED_BY_ID, VERIFIED_ALIAS_TO_ID };

/**
 * @param {string} id
 * @returns {boolean}
 */
export function isVerifiedFoodId(id = '') {
  return Boolean(id && getVerifiedRecord(id));
}

/**
 * @param {string} id
 * @returns {object|null}
 */
/** Tier-1 id → verified overlay id when catalog uses a shorter alias. */
const VERIFIED_ID_ALIASES = {
  rice: 'cooked_rice',
  plain_rice: 'cooked_rice',
  chicken: 'chicken_breast',
  cheese: 'cheddar',
  minced_beef: 'minced_beef',
  beef_mince: 'minced_beef',
  ground_beef: 'minced_beef',
  dal_tadka: 'dal',
  dal_fry: 'dal',
  chickpea: 'chickpeas',
  chana: 'chickpeas',
  channa: 'chickpeas',
  channas: 'chickpeas',
  kabuli_chana: 'chickpeas',
  kala_chana: 'chickpeas',
  garbanzo: 'chickpeas',
  garbanzo_beans: 'chickpeas',
  lentil: 'lentils',
  masoor: 'lentils',
  paneer_cubes: 'paneer',
  indian_cottage_cheese: 'paneer',
  bean_curd: 'tofu',
  firm_tofu: 'tofu',
  kidney_beans: 'rajma',
  kidney_bean: 'rajma',
  rajmah: 'rajma',
  lobia: 'cowpeas',
  black_eyed_peas: 'cowpeas',
  black_eyed_pea: 'cowpeas',
  cowpea: 'cowpeas',
  battered_fish: 'white_fish',
  toast: 'toast',
  bread: 'bread',
  semi_skimmed_milk: 'semi_skimmed_milk',
  milk: 'semi_skimmed_milk',
  pizza_margherita: 'pizza',
  pizza_margherita_grilled: 'pizza',
  european_pizza: 'pizza',
  pizza_new_york: 'pizza',
  pizza_diavola: 'pepperoni_pizza',
  pizza_diavola_grilled: 'pepperoni_pizza',
  pizza_funghi_grilled: 'pizza_funghi',
  pizza_napoli_grilled: 'pizza_napoli',
  kebab: 'doner_kebab',
  kebab_doner: 'doner_kebab',
  doner_kebab_grilled: 'doner_kebab',
  turkish_doner: 'doner_kebab',
  turkish_doner_kebab: 'doner_kebab',
  shish_kebab_grilled: 'shish_kebab',
  kofta_kebab_grilled: 'kofta_kebab',
  kofte_doner: 'doner_kebab',
  kofte_doner_grilled: 'doner_kebab',
  hamburger: 'burger',
  hamburger_classic: 'burger',
  us_cheeseburger: 'cheeseburger',
  lasagna_bolognese: 'lasagne',
  lasagna_bolognese_grilled: 'lasagne',
  lasagne_al_forno: 'lasagne',
  lasagna_spinach_grilled: 'lasagna_spinach',
  penne_macaroni: 'macaroni_bechamel',
  macaroni_bechamel_grilled: 'macaroni_bechamel',
  garlic_naan: 'naan',
  chapati: 'roti',
  crispy_chow_mein: 'chow_mein',
  egg_fried_rice: 'fried_rice',
  egg_fried_rice_grilled: 'fried_rice',
  chinese_fried_rice: 'fried_rice',
  fried_rice_chinese: 'fried_rice',
  fried_rice_chinese_grilled: 'fried_rice',
  falafel_chickpea: 'falafel',
  falafel_arabic: 'falafel',
  irish_sausage_roll: 'sausage_roll',
  butter_chicken: 'chicken_tikka_masala',
  pancake: 'pancakes',
  quiche_lorraine: 'quiche',
  donut: 'doughnut',
  donuts: 'doughnut',
  doughnuts: 'doughnut',
  blueberry_muffin: 'muffin',
  american_muffin: 'muffin',
  muffins: 'muffin',
  pork_chops: 'pork_chop',
  lamb_chop: 'lamb_chops',
  fried_eggs: 'fried_egg',
  cream_of_chicken_soup: 'chicken_soup',
  jacket_potato: 'baked_potato',
  jacket_potatoes: 'baked_potato',
  fish_finger: 'fish_fingers',
  fishsticks: 'fish_fingers',
  fish_sticks: 'fish_fingers',
  pitta: 'flatbread',
  pita: 'flatbread',
  pitta_bread: 'flatbread',
  pita_bread: 'flatbread',
  chili_con_carne: 'chilli_con_carne',
  lamb_rogan_josh: 'lamb_curry',
  rogan_josh: 'lamb_curry',
  thai_green_chicken_curry: 'thai_green_curry',
  green_thai_curry: 'thai_green_curry',
  vegetable_curry: 'veg_curry',
  veggie_curry: 'veg_curry',
  samosas: 'samosa',
  vegetable_samosa: 'samosa',
  onion_bhajis: 'onion_bhaji',
  pakoras: 'pakora',
  poppadom: 'poppadoms',
  papadum: 'poppadoms',
  papadums: 'poppadoms',
  spring_rolls: 'spring_roll',
  sweet_sour_chicken: 'sweet_and_sour_chicken',
  yorkshire_puddings: 'yorkshire_pudding',
  brussel_sprouts: 'brussels_sprouts',
  brownies: 'brownie',
  chocolate_brownie: 'brownie',
  salmon_nigiri: 'sushi',
  tuna_sandwich: 'tuna_mayo_sandwich',
  steak: 'beef_steak',
  gravy: 'gravy',
  carrots: 'carrots',
  carrot: 'carrots',
  potatoes: 'potatoes',
  nuts: 'nuts',
  badam: 'almonds',
  almond: 'almonds',
  kaju: 'cashews',
  cashew: 'cashews',
  nariyal: 'coconut',
  fresh_coconut: 'coconut',
  alsi: 'flax_seeds',
  linseed: 'flax_seeds',
  linseeds: 'flax_seeds',
  flaxseed: 'flax_seeds',
  flax_seed: 'flax_seeds',
  hazelnut: 'hazelnuts',
  filbert: 'hazelnuts',
  filberts: 'hazelnuts',
  peanut: 'peanuts',
  groundnut: 'peanuts',
  ground_nut: 'peanuts',
  moongphali: 'peanuts',
  pine_nut: 'pine_nuts',
  pinenuts: 'pine_nuts',
  chilgoza: 'pine_nuts',
  pistachio: 'pistachios',
  pista: 'pistachios',
  poppy_seed: 'poppy_seeds',
  khus_khus: 'poppy_seeds',
  pepitas: 'pumpkin_seeds',
  pumpkin_seed: 'pumpkin_seeds',
  sesame_seed: 'sesame_seeds',
  sunflower_seed: 'sunflower_seeds',
  walnut: 'walnuts',
  akhrot: 'walnuts',
  chia_seed: 'chia_seeds',
  bhindi: 'okra',
  ladies_finger: 'okra',
  lady_finger: 'okra',
  boiled_okra: 'okra',
  okro: 'okra',
  bitter_gourd: 'karela',
  bitter_melon: 'karela',
  moringa: 'drumstick',
  drumsticks: 'drumstick',
  tendli: 'ivy_gourd',
  tindora: 'ivy_gourd',
  kovakkai: 'ivy_gourd',
  kovai: 'ivy_gourd',
  ivy_guard: 'ivy_gourd',
  green_beans: 'french_beans',
  runner_beans: 'french_beans',
  cluster_beans: 'french_beans',
  beans: 'french_beans',
  beet: 'beetroot',
  beets: 'beetroot',
  mixed_veg: 'mixed_vegetables',
  mixed_vegetable: 'mixed_vegetables',
  olive: 'olives',
  boiled_yam: 'yam',
  mangoes: 'mango',
  papita: 'papaya',
  cantaloupe: 'musk_melon',
  muskmelon: 'musk_melon',
  lychee: 'litchi',
  lychees: 'litchi',
  chikoo: 'sapota',
  chiku: 'sapota',
  sitaphal: 'custard_apple',
  anar: 'pomegranate',
  khajur: 'dates',
  raisin: 'raisins',
  blueberry: 'blueberries',
  kiwifruit: 'kiwi',
};

/**
 * Resolve verified id from alias text or id.
 * @param {string} textOrId
 * @returns {string|null}
 */
const VERIFIED_EXTRA_ALIASES = {
  strawberries: 'strawberry',
  'minced beef': 'minced_beef',
  'beef mince': 'minced_beef',
  'ground beef': 'minced_beef',
};

export function resolveVerifiedIdFromText(textOrId = '') {
  const raw = String(textOrId || '').trim().toLowerCase();
  if (!raw) return null;
  if (VERIFIED_BY_ID[raw]) return raw;
  if (VERIFIED_ID_ALIASES[raw]) return VERIFIED_ID_ALIASES[raw];
  if (VERIFIED_EXTRA_ALIASES[raw]) return VERIFIED_EXTRA_ALIASES[raw];
  if (VERIFIED_ALIAS_TO_ID[raw]) return VERIFIED_ALIAS_TO_ID[raw];
  const normalized = normalizeCanonicalFoodText(raw);
  if (VERIFIED_EXTRA_ALIASES[normalized]) return VERIFIED_EXTRA_ALIASES[normalized];
  if (VERIFIED_ALIAS_TO_ID[normalized]) return VERIFIED_ALIAS_TO_ID[normalized];
  for (const [alias, id] of Object.entries(VERIFIED_EXTRA_ALIASES)) {
    if (!alias.includes(' ')) continue;
    if (normalized === alias || normalized.endsWith(` ${alias}`) || normalized.startsWith(`${alias} `) || normalized.includes(` ${alias} `)) {
      return id;
    }
  }
  const tokens = normalized.split(/\s+/);
  const skipBarePlum = tokens.some((tok) => /^(hog|june|java)$/.test(tok));
  const skipBareApple = tokens.includes('golden') && !tokens.includes('delicious');
  for (const tok of tokens) {
    if (skipBarePlum && /^plums?$/.test(tok)) continue;
    if (skipBareApple && /^apples?$/.test(tok)) continue;
    if (VERIFIED_EXTRA_ALIASES[tok]) return VERIFIED_EXTRA_ALIASES[tok];
    if (VERIFIED_ALIAS_TO_ID[tok]) return VERIFIED_ALIAS_TO_ID[tok];
  }
  return null;
}

export function getVerifiedRecord(id = '') {
  if (!id) return null;
  const key = VERIFIED_ID_ALIASES[id] || id;
  return VERIFIED_BY_ID[key] || null;
}

/**
 * Resolve the canonical verified record id for a matched ref.
 * @param {string} refId
 */
export function canonicalVerifiedId(refId = '') {
  const verified = getVerifiedRecord(refId);
  return verified?.id || refId;
}

/**
 * Overlay verified CoFID/IFCT nutrition onto a Tier-1 or V4 ref row.
 * @param {object|null} ref
 * @returns {object|null}
 */
export function enrichReferenceWithVerified(ref, context = {}) {
  if (!ref?.id) return ref;

  const level23 = resolveLevel23Nutrition(ref.id, { exactName: context.exactName || '' });
  if (level23?.nutrition_source === 'exact_brand') {
    return applyLevel23Overlay(ref, level23);
  }

  const verified = getVerifiedRecord(ref.id);
  if (!verified) {
    if (level23?.nutrition_source === 'level2_3_generic') {
      return applyLevel23Overlay(ref, level23);
    }
    const approved = getApprovedIndiaNutrition(ref.id);
    if (!approved) {
      return ref.nutrition_source ? ref : { ...ref, nutrition_source: 'v4_fallback' };
    }
    return {
      ...ref,
      kcal100: approved.kcal100,
      protein100: approved.protein100,
      carbs100: approved.carbs100,
      fat100: approved.fat100,
      fibre100: approved.fibre100,
      dataSource: approved.dataSource,
      verificationStatus: approved.verificationStatus,
      nutrition_basis: approved.nutrition_basis,
      lastReviewedAt: approved.lastReviewedAt,
      dataQualityScore: VERIFICATION_META[approved.verificationStatus]?.score ?? 70,
      nutrition_source: 'v4_fallback',
      _indiaValidated: true,
    };
  }

  return {
    ...ref,
    kcal100: verified.kcal100,
    protein100: verified.protein100,
    carbs100: verified.carbs100,
    fat100: verified.fat100,
    fibre100: verified.fibre100,
    sugar100: verified.sugar100,
    salt100: verified.salt100,
    dataSource: verified.dataSource,
    sourceRecordId: verified.sourceRecordId,
    verificationStatus: verified.verificationStatus,
    nutrition_basis: verified.nutrition_basis,
    preparationState: verified.preparationState,
    lastReviewedAt: verified.lastReviewedAt,
    dataQualityScore: verified.dataQualityScore
      ?? VERIFICATION_META[verified.verificationStatus]?.score
      ?? 95,
    _verified: true,
  };
}

/**
 * Provenance summary for UI / confidence.
 * @param {object} ref
 */
export function verifiedProvenanceLabel(ref = {}) {
  if (!ref?.dataSource || ref.dataSource === 'internal_estimated') return '';
  const src = String(ref.dataSource).toUpperCase();
  const id = ref.sourceRecordId ? ` #${ref.sourceRecordId}` : '';
  return `${src}${id}`;
}
