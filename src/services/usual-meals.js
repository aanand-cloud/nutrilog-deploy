/**
 * Surface meals the user logs often — for one-tap "Log again" on Today.
 */

import { isSupplementEntry } from './supplements.js';
import { defaultMealType } from './meal-types.js';

import { shiftDateKey } from './reports.js';

function normalizeName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function mealFingerprint(meal) {
  const barcode = String(meal.barcode || '').replace(/\D/g, '');
  if (barcode.length >= 8) return `barcode:${barcode}`;
  const name = normalizeName(meal.meal_summary);
  if (!name) return '';
  const kcal = Math.round(Number(meal.total_calories_kcal) || 0);
  return `food:${name}:${kcal}`;
}

/** Meals logged yesterday — for "same as yesterday" quick log. */
export function getYesterdayMeals(meals = [], todayDateKey, { limit = 4 } = {}) {
  const yesterday = shiftDateKey(todayDateKey, -1);
  const seen = new Set();
  const out = [];

  for (const meal of meals) {
    if (isSupplementEntry(meal)) continue;
    if (meal.date !== yesterday) continue;
    const fp = mealFingerprint(meal);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    out.push({
      fingerprint: fp,
      count: 1,
      template: meal,
      lastCreatedAt: meal.createdAt || '',
      source: 'yesterday',
    });
    if (out.length >= limit) break;
  }

  return out;
}

/**
 * Merge usual meals and yesterday meals without duplicate fingerprints.
 * @param {{ template: object, count: number, source?: string }[]} usual
 * @param {{ template: object, count: number, source?: string }[]} yesterday
 */
export function mergeQuickLogMeals(usual = [], yesterday = [], { limit = 6 } = {}) {
  const seen = new Set();
  const merged = [];

  for (const entry of [...yesterday, ...usual]) {
    const fp = entry.fingerprint || mealFingerprint(entry.template);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    merged.push({ ...entry, fingerprint: fp });
    if (merged.length >= limit) break;
  }

  return merged;
}

/**
 * @param {object[]} meals Food + supplement entries from storage (supplements filtered out)
 * @param {{ limit?: number, minCount?: number }} opts
 */
export function getUsualMeals(meals = [], { limit = 5, minCount = 2 } = {}) {
  const groups = new Map();

  for (const meal of meals) {
    if (isSupplementEntry(meal)) continue;
    const fp = mealFingerprint(meal);
    if (!fp) continue;

    const existing = groups.get(fp);
    if (!existing) {
      groups.set(fp, {
        fingerprint: fp,
        count: 1,
        template: meal,
        lastCreatedAt: meal.createdAt || '',
      });
      continue;
    }

    existing.count += 1;
    if ((meal.createdAt || '') > existing.lastCreatedAt) {
      existing.lastCreatedAt = meal.createdAt || '';
      existing.template = meal;
    }
  }

  return [...groups.values()]
    .filter((g) => g.count >= minCount)
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return (b.lastCreatedAt || '').localeCompare(a.lastCreatedAt || '');
    })
    .slice(0, limit);
}

/** Clone a past meal for logging on a new date (new id assigned on save). */
export function buildRepeatMealPayload(template, dateKey) {
  if (!template) throw new Error('Missing meal');

  const payload = {
    date: dateKey,
    meal_type: template.meal_type || defaultMealType(),
    meal_summary: template.meal_summary,
    total_calories_kcal: template.total_calories_kcal,
    total_nutrition: template.total_nutrition ? { ...template.total_nutrition } : undefined,
    items: Array.isArray(template.items) ? template.items.map((item) => ({ ...item })) : undefined,
    confidence_score: template.confidence_score,
    clarifications: template.clarifications,
    barcode: template.barcode || undefined,
    meal_notes: template.meal_notes || undefined,
    source: 'repeat',
  };

  if (template.photo_path) {
    payload.photo_path = template.photo_path;
  } else if (template.photoDataUrl) {
    payload.photoDataUrl = template.photoDataUrl;
  }

  return payload;
}

export function usualMealLabel(meal) {
  const name = String(meal?.meal_summary || 'Meal').trim();
  return name.length > 42 ? `${name.slice(0, 39)}…` : name;
}
