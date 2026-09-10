import { reconcileMealDate } from './meal-calendar.js';
import { getAllMeals, putMealLocal } from './storage.js';

/** Move mis-dated meals onto the day they were actually logged. */
export async function repairMisdatedMeals() {
  const meals = await getAllMeals();
  const repaired = [];
  for (const meal of meals) {
    const nextDate = reconcileMealDate(meal);
    if (!nextDate || nextDate === meal.date) continue;
    const updated = { ...meal, date: nextDate };
    await putMealLocal(updated);
    repaired.push(updated);
  }
  return repaired;
}
