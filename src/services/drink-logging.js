/** Drink logging — separate from meal time (breakfast/lunch/dinner/snack). */

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
