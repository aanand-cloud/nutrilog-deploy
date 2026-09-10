/**
 * Rules-only proactive tip when a saved meal looks like an under-counted mixed plate.
 * No AI calls — sessionStorage + toast + MNova context.
 */

import { isSupplementEntry } from './supplements.js';

const TIP_KEY = 'nutrilog_mnova_low_plate_tip';
const TTL_MS = 30 * 60 * 1000;

export const MNOVA_LOW_PLATE_CHIP = 'My plate calories look too low';

const MIXED_PLATE_RE = /\b(with|and|plate|curry|rice|dosa|idli|roti|breakfast|chips|burger|sambar|thali|biryani|english|salad|pasta|noodles|wrap|tacos|sushi)\b/i;

/** @typedef {{ id?: string, mealId?: string, summary: string, kcal: number, itemCount: number, at: number }} MnovaLowPlateTip */

export function isSuspiciousLowPlateMeal(meal) {
  if (!meal || isSupplementEntry(meal)) return false;

  const items = Array.isArray(meal.items) ? meal.items : [];
  const itemCount = items.length;
  const kcal = Math.round(Number(meal.total_calories_kcal) || 0);
  const summary = String(meal.meal_summary || '').trim();

  if (itemCount > 1) return false;
  if (kcal <= 0 || kcal >= 250) return false;
  if (!MIXED_PLATE_RE.test(summary)) return false;

  return true;
}

export function mealLowPlateSnapshot(meal) {
  return {
    id: meal?.id,
    summary: meal?.meal_summary || 'Meal',
    kcal: Math.round(Number(meal?.total_calories_kcal) || 0),
    itemCount: Array.isArray(meal?.items) ? meal.items.length : 0,
  };
}

/** @param {object} meal Saved meal record */
export function recordMnovaLowPlateTip(meal) {
  if (!isSuspiciousLowPlateMeal(meal)) return null;

  const snap = mealLowPlateSnapshot(meal);
  /** @type {MnovaLowPlateTip} */
  const payload = {
    mealId: snap.id,
    summary: snap.summary.slice(0, 120),
    kcal: snap.kcal,
    itemCount: snap.itemCount,
    at: Date.now(),
  };

  try {
    sessionStorage.setItem(TIP_KEY, JSON.stringify(payload));
  } catch (_) {
    /* quota / private mode */
  }

  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('mnova-low-plate-tip', { detail: payload }));
  }
  return payload;
}

/** @returns {MnovaLowPlateTip|null} */
export function getMnovaLowPlateTip() {
  try {
    const raw = sessionStorage.getItem(TIP_KEY);
    if (!raw) return null;
    const tip = JSON.parse(raw);
    if (!tip?.at) return null;
    if (Date.now() - tip.at > TTL_MS) {
      clearMnovaLowPlateTip();
      return null;
    }
    return tip;
  } catch {
    return null;
  }
}

export function clearMnovaLowPlateTip() {
  try {
    sessionStorage.removeItem(TIP_KEY);
  } catch (_) {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.dispatchEvent(new CustomEvent('mnova-low-plate-tip-cleared'));
  }
}

/** Context slice for MNova — null if none or expired. */
export function buildMnovaLowPlateContext() {
  const tip = getMnovaLowPlateTip();
  if (!tip) return null;

  const minutesAgo = Math.max(0, Math.round((Date.now() - tip.at) / 60000));
  return {
    mealId: tip.mealId,
    summary: tip.summary,
    kcal: tip.kcal,
    itemCount: tip.itemCount,
    minutesAgo,
    guidance: 'Mixed plates often miss a side (rice, curry, bread, drink). Suggest: edit the meal on Today, check the item list, or re-log with describe naming every part.',
  };
}

export function buildLowPlateToastMessage(meal) {
  const snap = mealLowPlateSnapshot(meal);
  return `Only ${snap.itemCount} item at ~${snap.kcal} kcal for “${snap.summary}” — a side may be missing. Tap MNova for help.`;
}

/** After a successful food save — records tip + returns toast message, or null. */
export function lowPlateTipAfterSave(meal) {
  if (!recordMnovaLowPlateTip(meal)) return null;
  return buildLowPlateToastMessage(meal);
}

/** After a successful food save — toast + bubble hint, no AI. */
export function maybePromptLowPlateAfterSave(meal, showToast) {
  const msg = lowPlateTipAfterSave(meal);
  if (!msg) return false;
  showToast?.(msg, 5200);
  return true;
}

export function matchesLowPlateChip(text = '') {
  return String(text || '').trim() === MNOVA_LOW_PLATE_CHIP;
}
