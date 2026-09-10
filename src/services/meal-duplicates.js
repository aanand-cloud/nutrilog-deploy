/** Detect likely duplicate meal logs on the same day. */

const RECENT_MINUTES = 180;

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function nameTokens(name) {
  return normalizeName(name)
    .split(' ')
    .filter((w) => w.length > 2);
}

function namesSimilar(a, b) {
  const left = normalizeName(a);
  const right = normalizeName(b);
  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length >= 4 && right.length >= 4) {
    if (left.includes(right) || right.includes(left)) return true;
  }

  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (!tokensA.length || !tokensB.length) return false;
  const setB = new Set(tokensB);
  let overlap = 0;
  for (const token of tokensA) {
    if (setB.has(token)) overlap += 1;
  }
  const minSize = Math.min(tokensA.length, tokensB.length);
  return overlap >= Math.max(2, Math.ceil(minSize * 0.65));
}

function caloriesSimilar(a, b) {
  const calA = Number(a) || 0;
  const calB = Number(b) || 0;
  if (calA <= 0 && calB <= 0) return true;
  const diff = Math.abs(calA - calB);
  return diff <= Math.max(30, calA * 0.15);
}

function minutesApart(isoA, isoB) {
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Infinity;
  return Math.abs(a - b) / 60000;
}

function normalizeBarcode(code) {
  return String(code || '').replace(/\D/g, '');
}

function matchReason(meal, candidate, nowIso = new Date().toISOString()) {
  if (!meal?.id || meal.id === candidate.id) return null;

  const candidateBarcode = normalizeBarcode(candidate.barcode);
  const existingBarcode = normalizeBarcode(meal.barcode);
  if (candidateBarcode && existingBarcode && candidateBarcode === existingBarcode) {
    return {
      reason: 'barcode',
      label: 'Same product already logged today',
    };
  }

  const sameName = normalizeName(meal.meal_summary) === normalizeName(candidate.meal_summary);
  const similar = namesSimilar(meal.meal_summary, candidate.meal_summary);
  const calMatch = caloriesSimilar(meal.total_calories_kcal, candidate.total_calories_kcal);
  const mins = minutesApart(meal.createdAt, nowIso);

  if (sameName && calMatch) {
    return {
      reason: 'same_name',
      label: 'Same meal name already logged today',
    };
  }

  if (similar && calMatch && mins <= RECENT_MINUTES) {
    return {
      reason: 'similar',
      label: 'Very similar meal logged recently',
    };
  }

  return null;
}

/**
 * Before saving — find meals today that look like a duplicate.
 * @returns {{ meal: object, reason: string, label: string }[]}
 */
export function findPotentialDuplicates(candidate, existingMeals = []) {
  const matches = [];
  const seen = new Set();
  const nowIso = new Date().toISOString();

  for (const meal of existingMeals) {
    const hit = matchReason(meal, candidate, nowIso);
    if (hit && !seen.has(meal.id)) {
      seen.add(meal.id);
      matches.push({ meal, ...hit });
    }
  }

  return matches;
}

function duplicatePairReason(a, b) {
  const asCandidate = {
    id: b.id,
    meal_summary: b.meal_summary,
    total_calories_kcal: b.total_calories_kcal,
    barcode: b.barcode,
  };
  return matchReason(a, asCandidate, b.createdAt) || matchReason(b, { ...asCandidate, id: a.id, meal_summary: a.meal_summary, total_calories_kcal: a.total_calories_kcal, barcode: a.barcode }, a.createdAt);
}

/**
 * On Today view — find pairs already saved that look like duplicates.
 * @returns {{ meals: object[], summary: string, detail: string }[]}
 */
export function findDuplicateAlertsForDay(meals = []) {
  const alerts = [];
  const seenPairs = new Set();

  for (let i = 0; i < meals.length; i += 1) {
    for (let j = i + 1; j < meals.length; j += 1) {
      const a = meals[i];
      const b = meals[j];
      const pairKey = [a.id, b.id].sort().join('|');
      if (seenPairs.has(pairKey)) continue;

      if (!duplicatePairReason(a, b)) continue;

      seenPairs.add(pairKey);
      const name = a.meal_summary || b.meal_summary || 'this meal';
      alerts.push({
        meals: [a, b],
        summary: name,
        detail: buildDuplicateAlertText(name, [a, b]),
      });
    }
  }

  return alerts;
}

export function buildDuplicateAlertText(mealName, meals = []) {
  const name = mealName || 'this meal';
  if (meals.length < 2) {
    return `You may have logged ${name} more than once today. Remove any extra entry so your calorie total stays accurate.`;
  }

  const times = meals
    .map((m) => formatMealLogTime(m.createdAt))
    .filter(Boolean)
    .join(' and ');

  if (times) {
    return `You logged ${name} twice today (at ${times}). If one was a mistake, remove it so your calories are not counted twice.`;
  }

  return `You logged ${name} twice today. If one was a mistake, remove it so your calories are not counted twice.`;
}

export function formatMealLogTime(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export function formatMealSummaryLine(meal) {
  const name = meal?.meal_summary || 'Meal';
  const kcal = Math.round(Number(meal?.total_calories_kcal) || 0);
  const time = formatMealLogTime(meal?.createdAt);
  return time ? `${name} · ${kcal} kcal · ${time}` : `${name} · ${kcal} kcal`;
}
