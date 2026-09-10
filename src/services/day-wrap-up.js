/**
 * Gentle "How was today?" wrap-up — one insight + one suggestion, no guilt.
 */

import { formatEnergy, getUnitPrefs } from './goals.js';
import { sumNutrition } from './storage.js';

const DISMISS_PREFIX = 'nutrilog_wrapup_dismiss_';

export function shouldShowDayWrapUp({ hour = new Date().getHours(), mealCount = 0 } = {}) {
  return mealCount >= 1 && hour >= 17 && hour < 22;
}

export function isDayWrapUpDismissed(dateKey) {
  try {
    return sessionStorage.getItem(`${DISMISS_PREFIX}${dateKey}`) === '1';
  } catch {
    return false;
  }
}

export function dismissDayWrapUp(dateKey) {
  try {
    sessionStorage.setItem(`${DISMISS_PREFIX}${dateKey}`, '1');
  } catch (_) {}
}

function isDrinkMeal(meal) {
  return /^\[Drink/i.test(String(meal?.meal_notes || ''));
}

function countWeekDrinks(weekMeals = []) {
  return weekMeals.filter(isDrinkMeal).length;
}

function mealTypeLabel(type) {
  const map = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  return map[type] || '';
}

/**
 * @param {object} opts
 * @param {object[]} opts.todayMeals
 * @param {object} opts.goals
 * @param {object[]} [opts.weekMeals]
 * @param {string} [opts.displayName]
 * @param {object|null} [opts.cuisineTip]
 * @param {boolean} [opts.canAccessCoach]
 */
export function buildDayWrapUp({
  todayMeals = [],
  goals = {},
  weekMeals = [],
  displayName = '',
  cuisineTip = null,
  canAccessCoach = false,
} = {}) {
  const prefs = getUnitPrefs();
  const totals = sumNutrition(todayMeals);
  const calGoal = Number(goals.calories_kcal) || 2000;
  const proteinGoal = Number(goals.protein_g) || 50;
  const calDelta = Math.round(totals.calories_kcal - calGoal);
  const proteinPct = proteinGoal ? Math.round((totals.protein_g / proteinGoal) * 100) : 0;

  const biggest = todayMeals.reduce((best, meal) => {
    const kcal = Number(meal.total_calories_kcal) || 0;
    if (!best || kcal > (Number(best.total_calories_kcal) || 0)) return meal;
    return best;
  }, null);

  let insight = '';
  if (Math.abs(calDelta) <= 75) {
    insight = `You're right around your calorie goal today — a steady, balanced day.`;
  } else if (calDelta <= -150) {
    insight = `You're about ${Math.abs(calDelta)} kcal under your goal — a lighter day.`;
  } else if (calDelta >= 150) {
    insight = `You're about ${calDelta} kcal above your goal today.`;
  } else if (calDelta < 0) {
    insight = `You're slightly under your calorie goal (${Math.abs(calDelta)} kcal).`;
  } else {
    insight = `You're slightly over your calorie goal (+${calDelta} kcal).`;
  }

  const details = [];
  if (todayMeals.length >= 2 && biggest) {
    const name = biggest.meal_summary || 'One meal';
    const kcal = Math.round(Number(biggest.total_calories_kcal) || 0);
    const typeLabel = mealTypeLabel(biggest.meal_type);
    details.push(
      typeLabel
        ? `${typeLabel} (${name}) was your biggest log at ${kcal} kcal — that's normal for many people.`
        : `${name} was your biggest log at ${kcal} kcal — that's normal for many people.`,
    );
  } else if (todayMeals.length === 1) {
    details.push('One meal logged so far — add another whenever you eat next.');
  }

  const weekDrinks = countWeekDrinks(weekMeals);
  if (weekDrinks >= 2) {
    details.push(`You've logged ${weekDrinks} drinks separately this week — nice to keep them visible.`);
  }

  let suggestion = '';
  if (proteinPct > 0 && proteinPct < 70) {
    suggestion = "Protein is a bit low today — yogurt, eggs, or beans work well if you're hungry later.";
  } else if (calDelta <= -200) {
    suggestion = 'A lighter day is fine — eat when hunger hits, not by the clock.';
  } else if (calDelta >= 200) {
    suggestion = "One fuller day doesn't undo your progress — tomorrow is a fresh start.";
  } else if (Math.abs(calDelta) <= 75) {
    suggestion = 'Nice steady logging today. Same again tomorrow if it suits you.';
  } else {
    suggestion = "You're building a clear picture of your week — that's what matters.";
  }

  let coachLine = null;
  if (canAccessCoach && cuisineTip?.tips?.[0]?.body) {
    coachLine = truncate(cuisineTip.tips[0].body, 140);
  } else if (proteinPct > 0 && proteinPct < 65) {
    coachLine = 'A protein-forward snack tomorrow morning can help if today felt light on protein.';
  } else if (Math.abs(calDelta) <= 75 && todayMeals.length >= 2) {
    coachLine = 'Steady days like this build a clearer picture of your habits — keep logging when you can.';
  }

  const pushBody = [insight, suggestion].filter(Boolean).join(' ');

  return {
    title: displayName ? `${displayName}, how was today?` : 'How was today?',
    insight,
    details,
    suggestion,
    coachLine,
    pushTitle: `Today: ${formatEnergy(totals.calories_kcal, prefs)}`,
    pushBody,
    stats: {
      calDelta,
      proteinPct,
      mealsLogged: todayMeals.length,
      caloriesLogged: Math.round(totals.calories_kcal),
      proteinLogged: Math.round(totals.protein_g),
      calGoal,
      proteinGoal,
    },
  };
}

function truncate(text, max) {
  const t = String(text || '').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}
