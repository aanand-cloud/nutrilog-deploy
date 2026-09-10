import { getSession, isSupabaseConfigured } from './auth.js';
import { getGoals } from './goals.js';
import {
  buildMnovaWelcomeMessage,
  buildPersonalizationSignal,
  firstNameFromDisplayName,
  resolveMnovaFirstName,
} from './mnova-personalization.js';
import { requireAiProcessingConsent } from './privacy-consent.js';
import { apiFetch } from './api-base.js';
import { getMealsForDate, sumNutrition, todayKey } from './storage.js';
import { getPlan, isPro, canAccessReports } from './subscription.js';
import { partitionMealsByKind } from './supplements.js';
import {
  buildMnovaLogIssueContext,
  clearMnovaLogIssue,
} from './mnova-log-issue.js';
import { buildMnovaLowPlateContext, clearMnovaLowPlateTip } from './mnova-low-plate.js';
import {
  buildMnovaNotifyContext,
  buildMnovaPlanContext,
  buildMnovaScanBudgetContext,
  buildMnovaSupplementsContext,
  buildMnovaWeeklyContext,
  loadWeekMealsForMnova,
} from './mnova-context-extra.js';

const HISTORY_KEY = 'nutrilog_mnova_history';
const MAX_HISTORY = 20;

export {
  buildMnovaWelcomeMessage,
  firstNameFromDisplayName,
  resolveMnovaFirstName,
} from './mnova-personalization.js';

export {
  getMnovaStarterChips,
  buildContextualMnovaStarterChips,
  MNOVA_STARTER_CHIPS,
} from './mnova-starter-chips.js';

export { clearMnovaLogIssue, getMnovaLogIssue, MNOVA_LOG_FAILURE_CHIP, recordMnovaLogIssue } from './mnova-log-issue.js';
export {
  clearMnovaLowPlateTip,
  getMnovaLowPlateTip,
  MNOVA_LOW_PLATE_CHIP,
  lowPlateTipAfterSave,
  matchesLowPlateChip,
} from './mnova-low-plate.js';

/** @typedef {{ role: 'user' | 'assistant', content: string }} MnovaTurn */

export function getMnovaHistory() {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((t) => t?.role && t?.content) : [];
  } catch {
    return [];
  }
}

export function saveMnovaHistory(turns = []) {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(turns.slice(-MAX_HISTORY)));
}

export function clearMnovaHistory() {
  sessionStorage.removeItem(HISTORY_KEY);
}

export async function buildMnovaContext({ currentView = 'today', history = [], includeWeekly = false } = {}) {
  const firstName = await resolveMnovaFirstName();
  const goals = getGoals();
  const planId = getPlan();
  let today = null;
  let supplements = buildMnovaSupplementsContext([]);
  try {
    const dateKey = todayKey();
    const meals = await getMealsForDate(dateKey);
    const { food: foodMeals } = partitionMealsByKind(meals);
    supplements = buildMnovaSupplementsContext(meals);
    const totals = sumNutrition(foodMeals);
    const progress = totals
      ? {
          calories: {
            eaten: Math.round(totals.calories_kcal || 0),
            goal: Math.round(goals.calories_kcal || 0),
            remaining: Math.round((goals.calories_kcal || 0) - (totals.calories_kcal || 0)),
          },
          protein_g: {
            eaten: Math.round(totals.protein_g || 0),
            goal: Math.round(goals.protein_g || 0),
            remaining: Math.round((goals.protein_g || 0) - (totals.protein_g || 0)),
          },
        }
      : null;

    today = {
      date: dateKey,
      mealsLogged: foodMeals.length,
      totals,
      progress,
      summaries: foodMeals.slice(-6).map((m) => m.meal_summary).filter(Boolean),
      recentMeals: foodMeals.slice(-4).map((m) => ({
        summary: m.meal_summary || 'Meal',
        kcal: Math.round(Number(m.total_calories_kcal) || 0),
        itemCount: Array.isArray(m.items) ? m.items.length : 0,
        id: m.id,
      })),
      lastMealId: foodMeals.length ? foodMeals[foodMeals.length - 1].id : null,
    };
  } catch (_) {
    today = { date: todayKey(), mealsLogged: 0, totals: null, progress: null, summaries: [], recentMeals: [] };
  }

  let weekly = null;
  if (includeWeekly) {
    try {
      const weekMeals = await loadWeekMealsForMnova(today?.date || todayKey());
      weekly = buildMnovaWeeklyContext(weekMeals, {
        endDateKey: today?.date || todayKey(),
        reportsAccess: canAccessReports(planId),
      });
    } catch (_) {
      weekly = null;
    }
  }

  return {
    screen: currentView,
    plan: buildMnovaPlanContext(planId),
    scanBudget: buildMnovaScanBudgetContext(planId),
    today,
    supplements,
    weekly,
    notifications: buildMnovaNotifyContext(),
    lastLogIssue: buildMnovaLogIssueContext(),
    lowPlateTip: buildMnovaLowPlateContext(),
    personalization: buildPersonalizationSignal({ firstName, history }),
  };
}

/**
 * @param {string} message
 * @param {{ history?: MnovaTurn[], context?: object }} [opts]
 */
export async function sendMnovaMessage(message, { history = [], context = {} } = {}) {
  const text = String(message || '').trim();
  if (!text) {
    return { ok: false, error: 'Enter a message' };
  }

  if (isSupabaseConfigured()) {
    const session = await getSession();
    if (!session?.access_token) {
      return { ok: false, error: 'Sign in to chat with MNova', requiresAuth: true };
    }

    const aiOk = await requireAiProcessingConsent();
    if (!aiOk) {
      return { ok: false, error: 'AI consent required to use MNova', needsConsent: true };
    }
  }

  try {
    const payload = {
      intent: 'mnova',
      message: text,
      history: history.slice(-8),
      context,
      goals: getGoals(),
    };
    if (isSupabaseConfigured()) {
      const session = await getSession();
      if (session?.access_token) payload.accessToken = session.access_token;
    }

    const res = await apiFetch('/api/cuisine-tips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401 || data.requiresAuth) {
      return { ok: false, error: 'Sign in to chat with MNova', requiresAuth: true };
    }
    if (res.status === 429) {
      return {
        ok: false,
        error: data.error || 'Daily MNova limit reached — try again tomorrow',
        retryAfterSeconds: data.retryAfterSeconds,
      };
    }
    if (!res.ok) {
      return { ok: false, error: data.error || 'Could not reach MNova — try again' };
    }

    return {
      ok: true,
      reply: String(data.reply || '').trim(),
      suggestions: Array.isArray(data.suggestions) ? data.suggestions.filter(Boolean).slice(0, 3) : [],
    };
  } catch (_) {
    return { ok: false, error: 'Network error — check your connection' };
  }
}

/** Clear stored log failure after MNova has been asked about it. */
export function acknowledgeMnovaLogIssue() {
  clearMnovaLogIssue();
}

export function mnovaDailyLimitHint() {
  return isPro() ? 'Pro: generous daily chat limit' : 'Free: up to 20 MNova messages per day';
}
