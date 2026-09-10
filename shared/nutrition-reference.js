/** UK reference values for common whole foods (USDA / CoFID approximations). */

export const UK_MEDIUM_EGG_G = 58;

export const UK_MEDIUM_EGG = {
  kcal: 77,
  protein_g: 6.3,
  carbs_g: 0.4,
  fat_g: 5.3,
  fibre_g: 0,
  sugar_g: 0.2,
  salt_mg: 62,
};

const COUNT_WORDS = {
  one: 1,
  a: 1,
  an: 1,
  single: 1,
  whole: 1,
  two: 2,
  couple: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
};

function parseCountToken(token = '') {
  const t = String(token).trim().toLowerCase();
  if (t === 'couple of') return 2;
  if (COUNT_WORDS[t] != null) return COUNT_WORDS[t];
  const n = parseInt(t, 10);
  return Number.isFinite(n) && n > 0 && n <= 12 ? n : 0;
}

/** Named dishes that contain "egg" but are not standalone boiled/fried eggs. */
const EGG_DISH_RES = [
  /\beggplant\b|\baubergine\b|\bbaingan\b/,
  /\beggs?\s+benedict\b/,
  /\begg\s+noodles?\b/,
  /\b(?:mutta\s+)?eggs?\s+dosa\b|\bmuttai\s+dosa\b|\bmutta\s+dosa\b/,
  /\beggs?\s+curry\b|\banda\s+curry\b|\banda\s+masala\b|\bboiled\s+egg\s+curry\b/,
  /\beggs?\s+roll\b/,
  /\beggs?\s+puff\b/,
  /\beggs?\s+paratha\b|\banda\s+paratha\b/,
  /\beggs?\s+drop\s+soup\b|\begg\s+flower\s+soup\b|\bdan\s+hua\s+tang\b/,
  /\beggs?\s+tart\b|\bdan\s+tat\b|\bportuguese\s+egg\s+tart\b/,
  /\begg\s+fried\s+rice\b|\beggs?\s+fried\s+rice\b/,
  /\beggs?\s+on\s+toast\b|\begg\s+toast\b/,
  /\begg\s+bhurji\b|\beggs?\s+bhurji\b|\banda\s+bhurji\b/,
  /\begg\s+masala\b|\beggs?\s+masala\b/,
  /\begg\s+biryani\b|\beggs?\s+biryani\b/,
  /\bscotch\s+eggs?\b/,
  /\bpickled\s+eggs?\b/,
  /\begg\s+and\s+soldiers\b|\bsoldiers\s+and\s+egg\b|\bdippy\s+egg\b/,
];

export function isEggDishName(text = '') {
  const t = String(text).trim().toLowerCase();
  if (!/\begg/.test(t)) return false;
  return EGG_DISH_RES.some((re) => re.test(t));
}

/** Parse how many chicken eggs are described (0 if none / ambiguous). */
export function parseEggCount(text = '') {
  const t = String(text).trim().toLowerCase();
  if (!/\begg/.test(t)) return 0;
  if (isEggDishName(t)) return 0;

  const patterns = [
    /\b(\d+|one|two|three|four|five|six|a|an|single|whole|couple\s+of)\s+(?:large|medium|small|xl)?\s*(?:boiled|poached|fried|scrambled|hard[\s-]?boiled|soft[\s-]?boiled)\s+eggs?\b/,
    /\b(\d+|one|two|three|four|five|six|a|an|single|whole|couple\s+of)\s+(?:boiled|poached|fried|scrambled|hard[\s-]?boiled|soft[\s-]?boiled)\s+eggs?\b/,
    /\b(\d+|one|two|three|four|five|six|a|an|single|whole|couple\s+of)\s+(?:boiled|poached|fried|scrambled|hard[\s-]?boiled|soft[\s-]?boiled\s+)?eggs?\b/,
    /\b(\d+|one|two|three|four|five|six|a|an|single|whole)\s+eggs?\b/,
    /\b(?:boiled|poached|whole|hard[\s-]?boiled|soft[\s-]?boiled)\s+eggs?\b/,
    /\beggs?\s+(?:boiled|poached|fried|scrambled)\b/,
  ];

  for (const re of patterns) {
    const m = t.match(re);
    if (!m) continue;
    const count = m[1] ? parseCountToken(m[1]) : 1;
    if (count > 0) return count;
  }

  if (/\begg\b/.test(t) && !/\beggs?\s+and\b/.test(t)) return 1;
  return 0;
}

export function nutritionForEggs(count = 1) {
  const n = Math.max(1, Math.min(12, Math.round(count)));
  return {
    kcal: Math.round(UK_MEDIUM_EGG.kcal * n),
    protein_g: round1(UK_MEDIUM_EGG.protein_g * n),
    carbs_g: round1(UK_MEDIUM_EGG.carbs_g * n),
    fat_g: round1(UK_MEDIUM_EGG.fat_g * n),
    fibre_g: 0,
    sugar_g: round1(UK_MEDIUM_EGG.sugar_g * n),
    salt_mg: Math.round(UK_MEDIUM_EGG.salt_mg * n),
  };
}

export function eggSummary(count = 1) {
  const n = Math.max(1, Math.round(count));
  const style = n === 1 ? '1 boiled egg' : `${n} boiled eggs`;
  return style;
}

export function isEggItemName(text = '') {
  const t = String(text).toLowerCase();
  if (!/\begg/.test(t)) return false;
  return !isEggDishName(t);
}

export function parseEggCountFromItem(item = {}) {
  const text = `${item.name || ''} ${item.portion_estimate || ''}`;
  const fromText = parseEggCount(text);
  if (fromText > 0) return fromText;

  const gm = text.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (gm) {
    return Math.max(1, Math.min(12, Math.round(parseFloat(gm[1]) / UK_MEDIUM_EGG_G)));
  }
  return isEggItemName(text) ? 1 : 0;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
