/**
 * MNova weekly context — reports + local storage only (no auth/subscription imports).
 */

import {
  loggingConsistencyStats,
  topWeeklyInsight,
  parseDateKey,
} from './reports.js';
import { getMealsInRange, todayKey } from './storage.js';

export function weekRangeEnding(endDateKey = todayKey()) {
  const start = parseDateKey(endDateKey);
  start.setDate(start.getDate() - 6);
  return { start: todayKey(start), end: endDateKey };
}

export function buildMnovaWeeklyContext(weekMeals = [], { endDateKey = todayKey(), reportsAccess = true } = {}) {
  if (!reportsAccess) {
    return {
      locked: true,
      message: 'Weekly insights need Essential plan or above — upgrade in Settings → Plans.',
    };
  }
  if (!weekMeals.length) {
    return { daysLogged: 0, streak: 0, topInsight: null };
  }

  const { daysLoggedThisWeek, currentStreak } = loggingConsistencyStats(weekMeals, endDateKey);
  const insight = topWeeklyInsight(weekMeals);
  return {
    daysLogged: daysLoggedThisWeek,
    streak: currentStreak,
    topInsight: insight
      ? {
          type: insight.type,
          nutrient: insight.nutrient,
          label: insight.label,
          message: insight.message,
          periodLabel: insight.periodLabel || 'this week',
        }
      : null,
  };
}

/** One IndexedDB read — call only when sending a chat message, not when opening MNova. */
export async function loadWeekMealsForMnova(endDateKey = todayKey()) {
  const { start, end } = weekRangeEnding(endDateKey);
  return getMealsInRange(start, end);
}
