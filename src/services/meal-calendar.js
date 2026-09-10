/** Meal calendar helpers — month grid, planning window, day summaries. */

import { sumNutrition, todayKey } from './storage.js';
import { groupMealsByDate, parseDateKey, shiftDateKey } from './reports.js';
import { getGoals } from './goals.js';

export const MAX_FUTURE_DAYS = 21;
export const MAX_HISTORY_DAYS = 365;

export function minCalendarDateKey() {
  return shiftDateKey(todayKey(), -MAX_HISTORY_DAYS);
}

export function maxPlanDateKey() {
  return shiftDateKey(todayKey(), MAX_FUTURE_DAYS);
}

export function isDateInCalendarRange(dateKey) {
  return dateKey >= minCalendarDateKey() && dateKey <= maxPlanDateKey();
}

export function monthRange(year, monthIndex) {
  const start = todayKey(new Date(year, monthIndex, 1));
  const end = todayKey(new Date(year, monthIndex + 1, 0));
  return { start, end };
}

/** Monday-first month grid (6 weeks × 7 days). */
export function buildMonthGrid(year, monthIndex) {
  const today = todayKey();
  const minDate = minCalendarDateKey();
  const maxDate = maxPlanDateKey();
  const first = new Date(year, monthIndex, 1);
  const startPad = (first.getDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setDate(cursor.getDate() - startPad);

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const dateKey = todayKey(cursor);
    cells.push({
      dateKey,
      day: cursor.getDate(),
      inMonth: cursor.getMonth() === monthIndex,
      isToday: dateKey === today,
      isFuture: dateKey > today,
      isPast: dateKey < today,
      isSelectable: dateKey >= minDate && dateKey <= maxDate,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}

export function summarizeMealsByDate(meals) {
  const goals = getGoals();
  const grouped = groupMealsByDate(meals);
  const map = {};
  for (const [dateKey, dayMeals] of Object.entries(grouped)) {
    map[dateKey] = summarizeDayMeals(dayMeals, goals);
  }
  return map;
}

export function summarizeDayMeals(meals, goals = getGoals()) {
  if (!meals?.length) return null;
  const totals = sumNutrition(meals);
  const goalKcal = goals.calories_kcal || 2000;
  const calPct = Math.min(100, Math.round((totals.calories_kcal / goalKcal) * 100));
  return {
    mealCount: meals.length,
    calories_kcal: Math.round(totals.calories_kcal),
    calPct,
  };
}

export function formatMonthHeading(year, monthIndex) {
  return new Date(year, monthIndex, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

export function shiftMonth(year, monthIndex, delta) {
  const d = new Date(year, monthIndex + delta, 1);
  return { year: d.getFullYear(), monthIndex: d.getMonth() };
}

export function canNavigateMonth(year, monthIndex, delta) {
  const { start, end } = monthRange(year, monthIndex);
  const next = shiftMonth(year, monthIndex, delta);
  const { start: nextStart, end: nextEnd } = monthRange(next.year, next.monthIndex);
  if (delta < 0) return nextEnd >= minCalendarDateKey();
  return nextStart <= maxPlanDateKey();
}

export function countLoggedDaysInMonth(mealsByDateSummary, year, monthIndex) {
  const { start, end } = monthRange(year, monthIndex);
  return Object.keys(mealsByDateSummary).filter(
    (k) => k >= start && k <= end && mealsByDateSummary[k]?.mealCount,
  ).length;
}

export function formatPlanDateLabel(dateKey) {
  const today = todayKey();
  if (dateKey === today) return 'today';
  if (dateKey === shiftDateKey(today, 1)) return 'tomorrow';
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** After midnight, dinner/snack logs still belong on the previous diary day until this hour. */
export const LATE_NIGHT_LOG_CUTOFF_HOUR = 4;

/** Before this hour, a dinner log on the current calendar day usually means last night. */
export const MORNING_DINNER_CUTOFF_HOUR = 15;

/**
 * Fix meals saved to the wrong diary day (e.g. logged yesterday evening but date = today).
 * Does not change future planned meals.
 */
export function reconcileMealDate(meal, at = new Date()) {
  if (!meal?.date || !meal?.createdAt) return meal?.date;
  const stored = meal.date;
  const createdDay = todayKey(new Date(meal.createdAt));
  const today = todayKey(at);
  if (stored === today && createdDay < today) return createdDay;
  return stored;
}

/**
 * Resolve which diary day a meal should save to.
 * Explicit navigation (calendar / day arrows) wins, then smart meal-time rules,
 * then the moment the user started logging.
 */
export function resolveMealLogDate({
  targetDateKey = null,
  captureDateKey = null,
  mealType = null,
  at = new Date(),
} = {}) {
  if (targetDateKey) return targetDateKey;

  const nowDay = todayKey(at);
  const hour = at.getHours();
  const baseDay = captureDateKey || nowDay;

  // Logged today before mid-afternoon as dinner → usually last night's meal
  if (mealType === 'dinner' && hour < MORNING_DINNER_CUTOFF_HOUR && baseDay === nowDay) {
    return shiftDateKey(nowDay, -1);
  }

  if (captureDateKey) return captureDateKey;

  if (hour < LATE_NIGHT_LOG_CUTOFF_HOUR && (mealType === 'dinner' || mealType === 'snack')) {
    return shiftDateKey(nowDay, -1);
  }

  return nowDay;
}
