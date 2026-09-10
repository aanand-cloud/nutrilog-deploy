/**
 * Weekly MealNova habit score (0–100) — logging consistency, not a health score.
 */

import { groupMealsByDate, parseDateKey, shiftDateKey } from './reports.js';
import { todayKey, sumNutrition } from './storage.js';
import { partitionMealsByKind } from './supplements.js';

/**
 * @param {object[]} weekMeals
 * @param {object} goals
 * @param {string} [endDateKey]
 */
export function buildWeeklyHabitScore(weekMeals = [], goals = {}, endDateKey = todayKey()) {
  const { food: meals } = partitionMealsByKind(weekMeals);
  const byDate = groupMealsByDate(meals);
  const daysLogged = Object.keys(byDate).filter((k) => byDate[k]?.length > 0).length;

  let streak = 0;
  let cursor = endDateKey;
  if (!byDate[cursor]?.length) cursor = shiftDateKey(endDateKey, -1);
  const minKey = shiftDateKey(endDateKey, -400);
  while (byDate[cursor]?.length) {
    streak += 1;
    cursor = shiftDateKey(cursor, -1);
    if (cursor < minKey) break;
  }

  const loggingScore = Math.min(40, Math.round((daysLogged / 7) * 40));
  const streakScore = Math.min(30, streak >= 7 ? 30 : streak >= 5 ? 24 : streak >= 3 ? 18 : streak >= 2 ? 12 : streak >= 1 ? 6 : 0);

  let proteinHits = 0;
  let proteinDays = 0;
  const proteinGoal = Number(goals.protein_g) || 0;
  for (let i = 0; i < 7; i += 1) {
    const key = shiftDateKey(endDateKey, -i);
    const dayMeals = byDate[key];
    if (!dayMeals?.length) continue;
    proteinDays += 1;
    const total = sumNutrition(dayMeals);
    if (proteinGoal && total.protein_g >= proteinGoal * 0.75) proteinHits += 1;
  }
  const proteinScore = proteinGoal && proteinDays
    ? Math.min(20, Math.round((proteinHits / Math.max(proteinDays, 1)) * 20))
    : 10;

  const uniqueSummaries = new Set(
    meals.map((m) => String(m.meal_summary || '').trim().toLowerCase()).filter(Boolean),
  );
  const varietyScore = Math.min(10, uniqueSummaries.size >= 8 ? 10 : uniqueSummaries.size >= 5 ? 8 : uniqueSummaries.size >= 3 ? 5 : uniqueSummaries.size >= 1 ? 3 : 0);

  const score = Math.min(100, Math.max(0, loggingScore + streakScore + proteinScore + varietyScore));

  let label = 'Getting started';
  if (score >= 85) label = 'On a roll';
  else if (score >= 70) label = 'Strong week';
  else if (score >= 50) label = 'Building momentum';
  else if (score >= 30) label = 'Finding your rhythm';

  return {
    score,
    label,
    daysLogged,
    streak,
    proteinHits,
    proteinDays,
    uniqueMeals: uniqueSummaries.size,
  };
}
