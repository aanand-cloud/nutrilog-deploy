/**
 * "Remaining today" coach — practical examples for calories & protein left.
 */

import { formatEnergy, getUnitPrefs } from './goals.js';

/** Approximate examples — wellness suggestions, not prescriptions. */
const FOOD_EXAMPLES = [
  { name: 'Greek yogurt & berries', cal: 180, protein: 15 },
  { name: '2 boiled eggs', cal: 140, protein: 12 },
  { name: 'Chicken & rice bowl', cal: 420, protein: 35 },
  { name: 'Banana & peanut butter', cal: 250, protein: 8 },
  { name: 'Lentil soup & bread', cal: 320, protein: 18 },
  { name: 'Protein shake', cal: 150, protein: 25 },
  { name: 'Cheese & crackers', cal: 220, protein: 10 },
  { name: 'Salmon & steamed veg', cal: 400, protein: 36 },
  { name: 'Hummus & pitta', cal: 280, protein: 11 },
  { name: 'Cottage cheese & fruit', cal: 200, protein: 20 },
  { name: 'Tuna salad wrap', cal: 350, protein: 28 },
  { name: 'Overnight oats', cal: 310, protein: 14 },
];

/**
 * @param {{ totals: object, goals: object, mealCount?: number }} opts
 * @returns {object|null}
 */
export function buildRemainingCoach({ totals = {}, goals = {}, mealCount = 0 } = {}) {
  if (mealCount < 1) return null;

  const calGoal = Number(goals.calories_kcal) || 2000;
  const proteinGoal = Number(goals.protein_g) || 50;
  const calRemaining = Math.round(calGoal - (Number(totals.calories_kcal) || 0));
  const proteinRemaining = Math.round(proteinGoal - (Number(totals.protein_g) || 0));

  if (calRemaining <= 0 && proteinRemaining <= 0) return null;

  const prefs = getUnitPrefs();
  const examples = pickExamples(calRemaining, proteinRemaining).slice(0, 3);
  if (!examples.length && calRemaining <= 50) return null;

  const lines = [];
  if (calRemaining > 0) {
    lines.push(`${formatEnergy(calRemaining, prefs)} left`);
  } else if (calRemaining <= 0 && proteinRemaining > 0) {
    lines.push('At your calorie goal');
  }
  if (proteinRemaining > 5) {
    lines.push(`${proteinRemaining}g protein left`);
  } else if (proteinRemaining <= 0 && calRemaining > 0) {
    lines.push('Protein goal met');
  }

  let lead = '';
  if (calRemaining > 150 && proteinRemaining > 15) {
    lead = 'Room for a balanced snack or light meal — here are ideas that could fit:';
  } else if (calRemaining > 0 && calRemaining <= 150) {
    lead = 'Nearly at your calorie goal — a small bite could work if you are hungry:';
  } else if (calRemaining <= 0 && proteinRemaining > 10) {
    lead = 'Calories are on target — these could help nudge protein up:';
  } else {
    lead = 'If you eat again today, these are rough fits for what is left:';
  }

  return {
    headline: lines.join(' · '),
    lead,
    examples,
    calRemaining,
    proteinRemaining,
  };
}

function pickExamples(calLeft, proteinLeft) {
  const calBudget = Math.max(calLeft, 80);
  const proteinNeed = Math.max(proteinLeft, 0);

  const scored = FOOD_EXAMPLES.map((food) => {
    const calOk = food.cal <= calBudget + 80;
    const proteinBonus = proteinNeed > 12 && food.protein >= 12 ? 2 : proteinNeed > 0 && food.protein >= 8 ? 1 : 0;
    const calScore = calOk ? 1 - Math.abs(food.cal - Math.min(calBudget, 400)) / 500 : -2;
    return { food, score: calScore + proteinBonus };
  })
    .filter((x) => x.score > -1)
    .sort((a, b) => b.score - a.score);

  const picked = [];
  const used = new Set();
  for (const { food } of scored) {
    if (picked.length >= 3) break;
    if (used.has(food.name)) continue;
    used.add(food.name);
    picked.push(food);
  }

  if (picked.length < 2) {
    for (const food of FOOD_EXAMPLES) {
      if (picked.length >= 3) break;
      if (used.has(food.name)) continue;
      if (food.cal <= calBudget + 120) {
        used.add(food.name);
        picked.push(food);
      }
    }
  }

  return picked;
}
