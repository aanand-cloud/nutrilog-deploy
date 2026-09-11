export const MEAL_TYPES = [
  { id: 'breakfast', label: 'Breakfast', icon: '🌅' },
  { id: 'lunch', label: 'Lunch', icon: '☀️' },
  { id: 'dinner', label: 'Dinner', icon: '🌙' },
  { id: 'snack', label: 'Snack', icon: '🍎' },
];

/** Local-timezone meal type from the user's clock — never the server timezone. */
export function defaultMealType(now = new Date()) {
  const h = now.getHours();
  const m = now.getMinutes();
  const minutes = h * 60 + m;
  if (minutes >= 4 * 60 && minutes < 11 * 60) return 'breakfast';
  if (minutes >= 11 * 60 && minutes < 16 * 60) return 'lunch';
  if (minutes >= 16 * 60 && minutes < 22 * 60) return 'dinner';
  return 'snack';
}

export function mealTypeLabel(type) {
  const map = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner', snack: '🍎 Snack' };
  return map[type] || '';
}

export { inferMealTypeForDrink } from './drink-logging.js';
