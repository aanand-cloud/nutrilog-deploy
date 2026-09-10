/**
 * Extra MNova context — sync local reads only.
 */

import {
  canAccessAiTips,
  canAccessReports,
  canExportData,
  getPlan,
  getScanBudget,
  getTopUpBalance,
} from './subscription.js';
import { getPlanConfig, getReportTier } from './plans.js';
import { partitionMealsByKind } from './supplements.js';
import { getNotifyPrefs, isNotificationSupported } from './notifications.js';

export { buildMnovaWeeklyContext, loadWeekMealsForMnova, weekRangeEnding } from './mnova-weekly-context.js';

export function buildMnovaPlanContext(planId = getPlan()) {
  const plan = getPlanConfig(planId);
  return {
    id: planId,
    name: plan.name,
    tagline: plan.tagline || '',
    reportsAccess: canAccessReports(planId),
    aiTipsAccess: canAccessAiTips(planId),
    exportAccess: canExportData(planId),
    exportNote: 'JSON & CSV download in Settings when signed in — all plans (privacy access right).',
    reportTier: getReportTier(planId),
  };
}

export function buildMnovaScanBudgetContext(planId = getPlan()) {
  const budget = getScanBudget(planId);
  const topUp = getTopUpBalance();
  let summary = '';
  if (budget.paused) {
    summary = 'Scan limits paused (development).';
  } else if (budget.unlimitedMonthly) {
    summary = `${budget.remaining}/${budget.limit} scans left today; ${budget.monthRemaining ?? '—'}/${budget.monthLimit ?? '—'} this month (Pro fair use).`;
  } else if (budget.isDaily === false) {
    summary = `${budget.remaining} subscription scan credits left${topUp ? `; ${topUp} top-up credit${topUp === 1 ? '' : 's'} stored` : ''}. Resets on billing renewal.`;
  } else {
    summary = `${budget.dailyFreeRemaining ?? budget.remaining}/${budget.dailyFreeCap ?? budget.limit} free scan${(budget.dailyFreeCap ?? budget.limit) === 1 ? '' : 's'} left today (resets midnight)${topUp ? `; ${topUp} top-up credit${topUp === 1 ? '' : 's'}` : ''}. Barcode & describe stay free.`;
  }
  return {
    allowed: budget.allowed,
    remaining: budget.remaining,
    limit: budget.limit,
    usedToday: budget.usedToday ?? budget.used,
    topUpStored: topUp,
    resetsOn: budget.resetsOn,
    summary,
  };
}

export function buildMnovaSupplementsContext(meals = []) {
  const { supplements } = partitionMealsByKind(meals);
  return {
    loggedToday: supplements.length,
    recent: supplements.slice(-3).map((m) => m.meal_summary || 'Supplement').filter(Boolean),
    note: 'Supplement logs are a separate diary — they do not add to Today calorie totals.',
  };
}

export function buildMnovaNotifyContext() {
  const prefs = getNotifyPrefs();
  const hh = String(prefs.reminderHour ?? 19).padStart(2, '0');
  const mm = String(prefs.reminderMinute ?? 0).padStart(2, '0');
  return {
    supported: isNotificationSupported(),
    enabled: prefs.enabled === true,
    dailyReminderTime: `${hh}:${mm}`,
    weeklyDigest: prefs.weeklyDigest !== false,
    where: 'Settings → Alerts (daily reminder & weekly digest preview).',
  };
}
