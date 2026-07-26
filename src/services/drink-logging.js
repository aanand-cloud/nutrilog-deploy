/** Unified photo log — AI detects food vs drinks; no separate scanners. */

export const DRINK_SUBTYPES = [
  {
    id: 'coffee_tea',
    label: 'Coffee & tea',
    icon: '☕',
    aiHint: 'coffee, tea, chai, karak, latte, cappuccino, espresso, matcha, milk tea',
    notesPlaceholder: 'e.g. oat latte, no sugar · or masala chai with milk',
  },
  {
    id: 'juice_smoothie',
    label: 'Juice & smoothies',
    icon: '🥤',
    aiHint: 'fruit juice, smoothie, lassi, milkshake, fresh juice',
    notesPlaceholder: 'e.g. mango lassi · green smoothie · orange juice',
  },
  {
    id: 'soft_drink',
    label: 'Soft drinks',
    icon: '🫧',
    aiHint: 'cola, soda, lemonade, energy drink, fizzy drink — regular or diet',
    notesPlaceholder: 'e.g. diet cola · regular lemonade',
  },
  {
    id: 'alcohol',
    label: 'Alcohol',
    icon: '🍷',
    aiHint: 'wine, beer, cider, whisky, vodka, rum, gin, spirits, cocktail',
    notesPlaceholder: 'e.g. glass of red wine · pint of lager · single whisky',
  },
  {
    id: 'water',
    label: 'Water & other',
    icon: '💧',
    aiHint: 'water, squash, dilutable drink, herbal infusion without milk',
    notesPlaceholder: 'e.g. sparkling water · sugar-free squash',
  },
];

const SUBTYPE_MAP = Object.fromEntries(DRINK_SUBTYPES.map((s) => [s.id, s]));

export function getDrinkSubtype(id) {
  return SUBTYPE_MAP[id] || null;
}

/** Maps drink log subtype → clarification detectDrinkCategory keys. */
export function drinkCategoryForSubtype(subtypeId) {
  switch (subtypeId) {
    case 'coffee_tea':
      return 'coffee_tea';
    case 'juice_smoothie':
      return 'juice_smoothie';
    case 'soft_drink':
      return 'soft_drink';
    case 'alcohol':
      return 'wine'; // spirits/beer resolved from photo + notes
    case 'water':
      return 'water';
    default:
      return 'generic';
  }
}

/** When did you have this? — separate from drink category. */
export function inferMealTypeForDrink(subtypeId, date = new Date()) {
  const h = date.getHours();
  if (subtypeId === 'alcohol') {
    if (h >= 17) return 'dinner';
    return 'snack';
  }
  if (subtypeId === 'coffee_tea' && h < 11) return 'breakfast';
  if (subtypeId === 'juice_smoothie' && h < 11) return 'breakfast';
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h < 21) return 'dinner';
  return 'snack';
}

/** Context sent to Gemini — not shown verbatim to user in saved notes. */
export function buildDrinkAnalysisNotes(subtypeId, userNotes = '') {
  const sub = getDrinkSubtype(subtypeId);
  const lines = [
    'The user is logging a DRINK (beverage), not a solid meal.',
    'Identify the drink in the photo. Estimate volume in millilitres (ml), not grams.',
    'Use drink-specific clarification topics (cup size, milk/sugar for coffee/tea, regular vs diet for soda, wine/spirits measures for alcohol).',
  ];
  if (sub) {
    lines.push(`Selected drink category: ${sub.label}. Typical items: ${sub.aiHint}.`);
  }
  const trimmed = String(userNotes || '').trim();
  if (trimmed) lines.push(`User notes: ${trimmed}`);
  return lines.join('\n');
}

/** Tag saved in meal_notes for reports / export. */
export function formatDrinkMealNotes(subtypeId, userNotes = '') {
  const sub = getDrinkSubtype(subtypeId);
  const tag = sub ? `[Drink — ${sub.label}]` : '[Drink]';
  const trimmed = String(userNotes || '').trim();
  return trimmed ? `${tag} ${trimmed}` : tag;
}

export function drinkSubtypeChipsHtml(selectedId) {
  return DRINK_SUBTYPES.map((sub) => `
    <button
      type="button"
      class="drink-subtype-btn ${selectedId === sub.id ? 'drink-subtype-btn--active' : ''}"
      data-drink-subtype="${sub.id}"
      aria-pressed="${selectedId === sub.id ? 'true' : 'false'}"
    >${sub.icon} ${sub.label}</button>
  `).join('');
}

/** Notes sent with every photo — food and drinks in one flow. */
export function buildPhotoAnalysisNotes(userNotes = '') {
  const lines = [
    'The user photographed food and/or drinks. Identify everything visible in the photo.',
    'Use grams (g) for solid food and millilitres (ml) for beverages.',
    'If the photo is mainly a drink, estimate volume in ml and apply drink-appropriate nutrition.',
  ];
  const trimmed = String(userNotes || '').trim();
  if (trimmed) lines.push(`User notes: ${trimmed}`);
  return lines.join('\n');
}

export function analysisText(analysis) {
  const items = analysis?.items || [];
  return [
    analysis?.meal_summary || '',
    ...items.map((i) => `${i.name || i.item_name || ''} ${i.portion_estimate || ''}`),
  ].join(' ');
}

/** True when the log is primarily a beverage (used after AI, not before). */
export function analysisIsMainlyDrink(analysis) {
  const items = analysis?.items || [];
  if (!items.length) return false;
  const text = analysisText(analysis).toLowerCase();
  const solidFood = /\b(rice|chicken|curry|bread|pasta|salad|sandwich|egg|meat|fish|biryani|pizza|burger|plate|homemade|roast)\b/;
  if (solidFood.test(text) && items.length > 1) return false;
  const drinkHint = /\b(coffee|tea|latte|juice|cola|soda|wine|beer|water|smoothie|milkshake|drink|beverage|whisky|vodka|cocktail|chai|espresso|ml\b)/;
  const drinkUnits = items.filter((i) => /\bml\b|millilitre|milliliter|cup|glass|pint|shot\b/i.test(`${i.portion_estimate || ''} ${i.name || ''}`));
  if (drinkUnits.length >= items.length && drinkHint.test(text)) return true;
  if (items.length === 1 && drinkHint.test(text)) return true;
  return false;
}

export function inferDrinkSubtypeFromAnalysis(analysis) {
  const t = analysisText(analysis).toLowerCase();
  if (/\b(coffee|tea|chai|latte|espresso|cappuccino|matcha|karak)\b/.test(t)) return 'coffee_tea';
  if (/\b(juice|smoothie|lassi|milkshake)\b/.test(t)) return 'juice_smoothie';
  if (/\b(coke|cola|pepsi|soda|lemonade|fizzy|soft drink|energy drink|sprite|fanta)\b/.test(t)) return 'soft_drink';
  if (/\b(wine|beer|whisky|whiskey|vodka|rum|gin|alcohol|cocktail|cider|lager|prosecco)\b/.test(t)) return 'alcohol';
  if (/\b(water|squash|sparkling water)\b/.test(t)) return 'water';
  return null;
}
