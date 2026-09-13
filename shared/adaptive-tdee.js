/**
 * 14-day adaptive TDEE from logged intake and scale weight.
 * Wellness estimate only — not medical advice.
 */

export const KCAL_PER_KG = 7700;
export const TDEE_WINDOW_DAYS = 14;
export const TDEE_MIN_SPAN_DAYS = 7;
export const TDEE_MIN_INTAKE_DAYS = 7;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function dayOffset(dateKey, days) {
  const [y, m, d] = String(dateKey).split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function daysBetween(a, b) {
  const pa = String(a).split('-').map(Number);
  const pb = String(b).split('-').map(Number);
  const da = Date.UTC(pa[0], pa[1] - 1, pa[2]);
  const db = Date.UTC(pb[0], pb[1] - 1, pb[2]);
  return Math.round((db - da) / 86400000);
}

function isFoodMeal(meal) {
  return meal?.meal_type !== 'supplement' && meal?.source !== 'supplement';
}

export function dailyIntakeFromMeals(meals = []) {
  const byDate = new Map();
  for (const meal of meals) {
    if (!isFoodMeal(meal)) continue;
    const date = meal?.date;
    if (!date) continue;
    const kcal = num(meal.total_calories_kcal);
    byDate.set(date, (byDate.get(date) || 0) + kcal);
  }
  return [...byDate.entries()]
    .map(([date, kcal]) => ({ date, kcal }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function computeAdaptiveTdee({
  meals = [],
  weighIns = [],
  windowDays = TDEE_WINDOW_DAYS,
  asOf = '',
} = {}) {
  const end = asOf || (weighIns.at(-1)?.date) || dailyIntakeFromMeals(meals).at(-1)?.date;
  if (!end) {
    return { ok: false, reason: 'need_data', tdee: null };
  }
  const start = dayOffset(end, -(windowDays - 1));
  const intake = dailyIntakeFromMeals(meals).filter((row) => row.date >= start && row.date <= end);
  const weights = (weighIns || [])
    .filter((row) => row.date >= start && row.date <= end && num(row.kg) >= 30 && num(row.kg) <= 300)
    .sort((a, b) => a.date.localeCompare(b.date));

  const intakeDays = intake.filter((row) => row.kcal > 0);
  if (intakeDays.length < TDEE_MIN_INTAKE_DAYS) {
    return {
      ok: false,
      reason: 'need_intake_days',
      tdee: null,
      intakeDays: intakeDays.length,
      weighIns: weights.length,
    };
  }
  if (weights.length < 2) {
    return {
      ok: false,
      reason: 'need_weigh_ins',
      tdee: null,
      intakeDays: intakeDays.length,
      weighIns: weights.length,
    };
  }

  const first = weights[0];
  const last = weights[weights.length - 1];
  const spanDays = Math.max(1, daysBetween(first.date, last.date));
  if (spanDays < TDEE_MIN_SPAN_DAYS) {
    return {
      ok: false,
      reason: 'need_weight_span',
      tdee: null,
      intakeDays: intakeDays.length,
      weighIns: weights.length,
      spanDays,
    };
  }

  const avgIntake = Math.round(intakeDays.reduce((sum, row) => sum + row.kcal, 0) / intakeDays.length);
  const deltaKg = num(last.kg) - num(first.kg);
  const observed = Math.round(avgIntake - ((deltaKg * KCAL_PER_KG) / spanDays));
  const tdee = Math.max(1200, Math.min(5000, observed));

  let confidence = 'low';
  if (intakeDays.length >= 12 && weights.length >= 3) confidence = 'high';
  else if (intakeDays.length >= 7 && weights.length >= 2) confidence = 'medium';

  return {
    ok: true,
    reason: null,
    tdee,
    avgIntake,
    deltaKg: Math.round(deltaKg * 100) / 100,
    spanDays,
    intakeDays: intakeDays.length,
    weighIns: weights.length,
    firstWeight: { date: first.date, kg: num(first.kg) },
    lastWeight: { date: last.date, kg: num(last.kg) },
    confidence,
    window: { start, end },
  };
}
