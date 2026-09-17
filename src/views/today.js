import { getGoals, formatEnergy, formatEnergyParts, getUnitPrefs, saveGoals, saveUnitPrefs, DEFAULT_GOALS, setGoalsOwnerId } from '../services/goals.js';
import { getMealsForDate, getMealsInRange, sumNutrition, deleteMeal, todayKey, clearAllLocalMeals, saveMeal } from '../services/storage.js';
import { findDuplicateAlertsForDay, findPotentialDuplicates } from '../services/meal-duplicates.js';
import { openDuplicateMealModal } from '../services/duplicate-meal-modal.js';
import { getUsualMeals, buildRepeatMealPayload, getYesterdayMeals, mergeQuickLogMeals } from '../services/usual-meals.js';
import { logAgainSectionHtml } from '../services/log-again-ui.js';
import { buildRemainingCoach } from '../services/remaining-coach.js';
import { remainingCoachHtml } from '../services/remaining-coach-ui.js';
import { openMealEditorModal } from '../services/meal-editor.js';
import { topWeeklyInsight, weekReport, formatDayHeading, formatDayShort, parseDateKey, loggingConsistencyStats } from '../services/reports.js';
import {
  dayDateNavHtml,
  dayDashboardHtml,
  mealTypeBreakdownHtml,
  microsTeaserHtml,
  weeklyInsightTeaserHtml,
  consistencyStripHtml,
  bindDayDateNav,
  planWeekDateKeys,
} from './day-nutrition.js';
import { getUser, getSession, signOut, updatePassword, resetPassword, isSupabaseConfigured } from '../services/auth.js';
import { getProfile, saveDisplayName, saveLocalDisplayName, getLocalDisplayName, clearLocalDisplayName } from '../services/profile.js';
import { fullSync, refreshMealPhotoUrls, resolvePhotoUrlForMeal } from '../services/sync.js';
import { getCuisineTips } from '../services/cuisine-tips.js';
import { buildWeeklyPushMessage, buildDailyPushMessage } from '../services/push-messages.js';
import { buildDayWrapUp, shouldShowDayWrapUp, isDayWrapUpDismissed, dismissDayWrapUp } from '../services/day-wrap-up.js';
import { dayWrapUpCardHtml } from '../services/day-wrap-up-ui.js';
import { buildWeeklyHabitScore } from '../services/habit-score.js';
import { habitScoreHtml } from '../services/habit-score-ui.js';
import { discountEligibilitySettingsHtml, bindDiscountEligibilityForms } from '../services/discount-ui.js';
import { trackDescribeLogStarted } from '../services/analytics.js';
import { requestLogMealType, resumeOfflinePhotoMeal } from './log-routing.js';
import {
  setTodayViewDate,
  clearTodayViewDate,
  getTodayViewDate,
  setLogTargetDate,
  getLogTargetDate,
  clearLogTargetDate,
  setSettingsTab,
  getSettingsTab,
  requestOpenDiscountSection,
  consumeOpenDiscountSection,
  getPendingDiscountPathFocus,
  clearPendingDiscountPathFocus,
  setPasswordResetMode,
  isPasswordResetMode,
} from './app-nav-state.js';
export {
  setTodayViewDate,
  clearTodayViewDate,
  getTodayViewDate,
  setLogTargetDate,
  getLogTargetDate,
  clearLogTargetDate,
  setSettingsTab,
  requestOpenDiscountSection,
  setPasswordResetMode,
} from './app-nav-state.js';
import {
  PLAN_AHEAD_PHASE1_ENABLED,
  futureDayEmptyPlanHtml,
  tomorrowDateKey,
} from '../services/plan-ahead-phase1.js';
import { getReferralCode, getReferralShareUrl, shareReferral } from '../services/referral.js';
import { referralCardHtml } from '../services/referral-ui.js';
import {
  getNotifyPrefs,
  enableNotifications,
  disableNotifications,
  isNotificationSupported,
  saveNotifyPrefs,
} from '../services/notifications.js';
import {
  getScanBudget,
  scansLabel,
  scanPackPriceLabel,
  planPriceLabel,
  startScanPackCheckout,
  startPlanCheckout,
  requestPlanChange,
  openBillingPortal,
  getPlan,
  syncScanStateFromProfile,
  usageMeterRemainingPercent,
  refreshScanAllowanceFromCloud,
  getTopUpBalance,
  getDailyFreeCap,
  getSubScanBalance,
  getSubScansAllowance,
  syncVoucherCreditsFromRedemption,
  planSummaryHtml,
  planBadgeLabel,
  SUBSCRIPTION_PLAN_IDS,
  isSubscriptionPlan,
  hasActivePaidSubscription,
  comparePlanChange,
  canAccessAiTips,
  canAccessReports,
  canAccessMicroNutrients,
} from '../services/subscription.js';
import { PLANS, SCAN_PACKS, PAYG_PACK_ID, FREE_DAILY_SCANS, isCreditSubscriptionPlan, isProPlan, isUnlimitedPlan, topUpCreditUsageNote } from '../services/plans.js';
import { validateAndRedeemVoucher } from '../services/voucher.js';
import { MONETIZATION_PAUSED } from '../monetization.js';
import { activityOptions, estimateDailyCalories } from '../services/calorie-wizard.js';
import { openOnboardingWizard, getWizardProfile } from '../services/onboarding-wizard.js';
import { resolveBodyMetrics } from '../services/wizard-targets.js';
import {
  defaultRateIdForGoal,
  resolveWeightChangeRate,
  weightGoalRateSelectHtml,
} from '../services/weight-goal-rates.js';
import {
  readSettingsWizardBody,
  renderSettingsBodyFieldGroups,
  settingsBodyMetricsHtml,
  syncSettingsUnitButtons,
} from '../services/body-metrics-units.js';
import { exportUserDataJson, exportMealsCsv } from '../services/data-export.js';
import { friendlyAuthError } from '../services/auth-errors.js';
import { nativeAppUsesExternalWebBilling, openWebBilling } from '../services/billing-strategy.js';
import { openLegalModal } from './legal.js';
import { DISCLAIMERS, disclaimerBlock } from '../services/disclaimers.js';
import { LEGAL_VERSION, APP_VERSION, SUPPORT_EMAIL } from '../services/legal-constants.js';
import { deleteMyAccount } from '../services/account-delete.js';
import { resetAppOnDevice } from '../services/app-reset.js';
import { showSentryTestButton, sendSentryTestError } from '../services/sentry.js';
import { ELIGIBILITY_DISCOUNT_PERCENT, getDiscountEligibility } from '../services/discount.js';
import { isTrialActive, trialPlanLabel } from '../services/trial.js';
import {
  computeCreditAlerts,
  getPrimaryCreditAlert,
  usageStripAlertClass,
  creditAlertsPlansHtml,
  bindCreditAlertActions,
  trialBannerExtraHtml,
} from '../services/credit-alerts.js';
import { BARCODE_COPY, DESCRIBE_COPY, FREEMIUM_TAGLINE } from '../services/product-copy.js';
import { isDateInCalendarRange } from '../services/meal-calendar.js';
import {
  landingHeroSectionHtml,
  landingTrustStripHtml,
  landingProductDemoHtml,
  landingGlobalMealsHtml,
  landingAdvantagesHtml,
  landingAccuracyHtml,
  landingPlanCompareHtml,
  landingDiscountStripHtml,
  landingSocialProofHtml,
  landingFaqHtml,
  landingPrivacySupportHtml,
  landingFinalCtaHtml,
  guestLandingFooterHtml,
  bindLandingMarketing,
} from '../services/guest-marketing.js';
import { renderProductFeaturesHtml } from '../services/product-features.js';
import { partitionMealsByKind } from '../services/supplements.js';
import { repairMisdatedMeals } from '../services/meal-date-repair.js';
import { APP_NAME } from '../services/brand.js';
import { openConfirmModal, openTypedConfirmModal } from '../services/confirm-modal.js';
import { getOfflineQueueSummary, processOfflinePhotoQueue } from '../services/photo-offline-queue.js';
import { bindPhase3Settings, phase3RetentionHtml, phase3SettingsModel } from './phase3-settings.js';

const wizardActivities = activityOptions();

function syncWizBodyFields(root, profile = getWizardProfile() || {}) {
  renderSettingsBodyFieldGroups(root, profile);
  syncSettingsUnitButtons(root, profile);
}

function syncWizGoalRateWrap(root) {
  const goal = root.querySelector('#wizGoal')?.value || 'maintain';
  const wrap = root.querySelector('#wizGoalRateWrap');
  if (!wrap) return;
  if (goal === 'maintain') {
    wrap.hidden = true;
    return;
  }
  wrap.hidden = false;
  const prev = root.querySelector('#wizGoalRate')?.value;
  const rateId = prev && prev.startsWith(`${goal}_`) ? prev : defaultRateIdForGoal(goal);
  wrap.innerHTML = weightGoalRateSelectHtml(goal, rateId, {
    id: 'wizGoalRate',
    className: 'settings-select full',
    label: goal === 'lose' ? 'Lose weight at' : 'Gain weight at',
  });
}
let mealDateRepairDone = false;

async function ensureMealDatesRepaired() {
  if (mealDateRepairDone) return;
  mealDateRepairDone = true;
  try {
    const repaired = await repairMisdatedMeals();
    if (repaired.length && isSupabaseConfigured()) {
      const { pushMeal } = await import('../services/sync.js');
      for (const meal of repaired) {
        await pushMeal(meal).catch(() => {});
      }
    }
  } catch (_) {}
}

const ICON_CAMERA = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`;
const ICON_BARCODE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="2" y="4" width="1.6" height="16"/><rect x="5" y="4" width="1" height="16"/><rect x="7.2" y="4" width="2.2" height="16"/><rect x="10.4" y="4" width="1" height="16"/><rect x="12.4" y="4" width="1.6" height="16"/><rect x="15.2" y="4" width="1" height="16"/><rect x="17.4" y="4" width="2.4" height="16"/><rect x="20.6" y="4" width="1.4" height="16"/></svg>`;
const ICON_DESCRIBE = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>`;
const ICON_PLATE = `<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v2"/><path d="M12 19v2"/><path d="M3 12h2"/><path d="M19 12h2"/></svg>`;
const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_DELETE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;
const ICON_CHART = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-6"/></svg>`;

/** Structured copy for the Today scan-allowance card (keeps scansLabel for a11y). */
function usageStripPresentation(budget, planId) {
  const planName = planBadgeLabel(planId);
  if (!budget) {
    return { count: '—', unit: '', detail: '', planName };
  }
  if (isProPlan(planId)) {
    if (!budget.allowed) {
      return {
        count: '0',
        unit: 'left today',
        detail: budget.reason === 'monthly_cap'
          ? 'Monthly fair use reached · try again next month'
          : 'Daily fair use reached · resets at midnight',
        planName,
      };
    }
    return {
      count: String(budget.remaining),
      unit: `of ${budget.limit} left today`,
      detail: 'Pro fair use · resets at midnight',
      planName,
    };
  }
  if (budget.dailyFreeRemaining > 0 && budget.creditRemaining > 0) {
    return {
      count: String(budget.dailyFreeRemaining),
      unit: budget.dailyFreeRemaining === 1 ? 'free photo today' : 'free photos today',
      detail: `${budget.creditRemaining} credit${budget.creditRemaining === 1 ? '' : 's'} saved · barcode free`,
      planName,
    };
  }
  if (budget.dailyFreeRemaining > 0) {
    return {
      count: String(budget.dailyFreeRemaining),
      unit: budget.dailyFreeRemaining === 1 ? 'free photo today' : 'free photos today',
      detail: 'Resets at midnight · barcode free',
      planName,
    };
  }
  if (budget.creditRemaining > 0) {
    const cap = getDailyFreeCap();
    return {
      count: String(budget.creditRemaining),
      unit: budget.creditRemaining === 1 ? 'credit left' : 'credits left',
      detail: `${cap} free tomorrow · barcode free`,
      planName,
    };
  }
  return {
    count: '0',
    unit: 'scans left today',
    detail: 'Top up for more, or try after midnight · barcode free',
    planName,
  };
}

function todayLogPanelHtml({ isFutureDay, isPastDay, isViewingToday, dateKey }) {
  const photoLabel = isFutureDay ? 'Plan with photo' : isPastDay ? 'Add meal photo' : 'Log meal photo';
  const photoHint = isViewingToday ? 'Uses a scan' : formatDayShort(dateKey);
  return `
    <section class="today-log" aria-label="Log a meal">
      <header class="today-log__head">
        <h2 class="today-log__title">Log a meal</h2>
      </header>
      <div class="today-log__grid">
        <button type="button" class="today-log__btn today-log__btn--photo" id="quickLogMeal" data-log-focus="photo">
          <span class="today-log__icon" aria-hidden="true">${ICON_CAMERA}</span>
          <span class="today-log__copy">
            <span class="today-log__label">${photoLabel}</span>
            <span class="today-log__hint">${photoHint}</span>
          </span>
        </button>
        <button type="button" class="today-log__btn today-log__btn--free" id="homeLogPackagedBtn" data-log-focus="barcode">
          <span class="today-log__badge">${BARCODE_COPY.badge}</span>
          <span class="today-log__icon" aria-hidden="true">${ICON_BARCODE}</span>
          <span class="today-log__copy">
            <span class="today-log__label">Barcode</span>
            <span class="today-log__hint">Packaged food</span>
          </span>
        </button>
        <button type="button" class="today-log__btn today-log__btn--free" id="quickLogDescribe" data-log-focus="describe">
          <span class="today-log__badge">${DESCRIBE_COPY.badge}</span>
          <span class="today-log__icon" aria-hidden="true">${ICON_DESCRIBE}</span>
          <span class="today-log__copy">
            <span class="today-log__label">Describe</span>
            <span class="today-log__hint">Type or voice</span>
          </span>
        </button>
      </div>
    </section>
  `;
}

/** Expand discount eligibility in Settings → Plans. */
export function revealDiscountSection(root) {
  const extras = root.querySelector('#plansExtrasDetails');
  const discount = root.querySelector('#discountSection');
  if (extras) extras.open = true;
  if (discount) discount.open = true;
  const pathFocus = getPendingDiscountPathFocus();
  const focusId = pathFocus === 'senior'
    ? '#discountSeniorCard'
    : pathFocus === 'public'
      ? '#discountPublicCard'
      : '#discountPaths';
  clearPendingDiscountPathFocus();
  const target = root.querySelector(focusId) || root.querySelector('#discountSection');
  target?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

export async function renderToday(root, { onLog, onRefresh, onReports, onSettings, onCalendar, onSupplements, profile, onSignIn, showToast }) {
  if (profile?.loggedIn && !root.querySelector('.today-log, .today-plan, .view-page--today')) {
    root.innerHTML = `
      <div class="view-page view-page--today">
        <p class="app-boot__title">Loading today…</p>
      </div>
    `;
  }
  if (profile?.loggedIn) await ensureMealDatesRepaired();
  const dateKey = getTodayViewDate();
  const isGuest = !profile?.loggedIn;
  const isViewingToday = dateKey === todayKey();
  const isFutureDay = dateKey > todayKey();
  const isPastDay = dateKey < todayKey();
  const canLogThisDay = !isGuest;
  let meals = await getMealsForDate(dateKey);
  if (profile?.loggedIn && isSupabaseConfigured()) {
    meals = await refreshMealPhotoUrls(meals);
  }
  const { food: foodMeals, supplements: supplementEntries } = partitionMealsByKind(meals);
  const totals = sumNutrition(foodMeals);
  const goals = getGoals();
  const prefs = getUnitPrefs();
  const planId = profile?.loggedIn ? getPlan() : 'free';
  const showMicros = profile?.loggedIn && canAccessMicroNutrients(planId);

  const weekEnd = dateKey;
  const weekStartDate = parseDateKey(weekEnd);
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekMeals = await getMealsInRange(todayKey(weekStartDate), weekEnd);
  const weekStats = weekReport(weekMeals);
  const scanBudget = !MONETIZATION_PAUSED && profile?.loggedIn ? getScanBudget() : null;
  const creditAlerts = scanBudget ? computeCreditAlerts({ profile, budget: scanBudget }) : [];
  const primaryCreditAlert = getPrimaryCreditAlert(creditAlerts);
  const usageStripMod = !scanBudget?.allowed
    ? 'usage-strip--limit'
    : usageStripAlertClass(primaryCreditAlert);
  const hasReports = profile?.loggedIn && canAccessReports(planId);
  const weeklyTip = isViewingToday && hasReports ? topWeeklyInsight(weekMeals) : null;
  const showWeeklyInsightTeaser = isViewingToday && profile?.loggedIn && !hasReports && weekMeals.length >= 2;
  const consistencyStats = !isGuest && isViewingToday ? loggingConsistencyStats(weekMeals, dateKey) : null;
  const consistencyHtml = consistencyStats ? consistencyStripHtml(consistencyStats) : '';
  const scanMeterPct = scanBudget ? usageMeterRemainingPercent(planId) : 0;
  const scanMeterValueText = scanBudget ? `${scansLabel()}, ${scanMeterPct}% of allowance remaining` : '';
  const usageStripAlertRole = primaryCreditAlert?.tier >= 2 ? 'role="alert"' : '';
  const usagePresent = scanBudget ? usageStripPresentation(scanBudget, planId) : null;
  const cuisine = isViewingToday && weekMeals.length && canAccessAiTips(planId) ? await getCuisineTips(weekMeals) : { tips: [] };
  const dayHeading = formatDayHeading(dateKey);
  const mealsHeading = isViewingToday ? "Today's meals" : isFutureDay ? `Planned meals · ${dayHeading}` : `Meals · ${dayHeading}`;
  let showPlanTomorrowCard = false;
  const planMealCounts = {};
  if (!isGuest) {
    try {
      const stripKeys = planWeekDateKeys(dateKey);
      if (stripKeys.length) {
        const stripMeals = await getMealsInRange(stripKeys[0], stripKeys[stripKeys.length - 1]);
        const { food: stripFood } = partitionMealsByKind(stripMeals);
        for (const meal of stripFood) {
          if (!meal?.date) continue;
          planMealCounts[meal.date] = (planMealCounts[meal.date] || 0) + 1;
        }
      }
      if (PLAN_AHEAD_PHASE1_ENABLED && isViewingToday) {
        showPlanTomorrowCard = (planMealCounts[tomorrowDateKey()] || 0) === 0;
      }
    } catch (err) {
      console.error(err);
    }
  }
  const duplicateAlerts = !isGuest && foodMeals.length > 1 ? findDuplicateAlertsForDay(foodMeals) : [];

  let quickLogMeals = [];
  if (!isGuest && canLogThisDay && isViewingToday) {
    const historyStart = new Date();
    historyStart.setDate(historyStart.getDate() - 89);
    const historyMeals = await getMealsInRange(todayKey(historyStart), todayKey());
    const usualMeals = getUsualMeals(historyMeals, { limit: 5, minCount: 2 });
    const yesterdayMeals = getYesterdayMeals(historyMeals, dateKey, { limit: 4 });
    quickLogMeals = mergeQuickLogMeals(usualMeals, yesterdayMeals, { limit: 6 });
  }
  const logAgainHtml = quickLogMeals.length ? logAgainSectionHtml(quickLogMeals, {
    formatEnergy: (kcal) => formatEnergy(kcal, prefs),
  }) : '';

  const remainingCoach = (!isGuest && isViewingToday && foodMeals.length >= 1)
    ? buildRemainingCoach({ totals, goals, mealCount: foodMeals.length })
    : null;
  const remainingCoachCard = remainingCoachHtml(remainingCoach);

  const dayWrapUp = (!isGuest && isViewingToday && foodMeals.length >= 1
    && shouldShowDayWrapUp({ mealCount: foodMeals.length })
    && !isDayWrapUpDismissed(dateKey))
    ? buildDayWrapUp({
      todayMeals: foodMeals,
      goals,
      weekMeals,
      displayName: profile?.displayName || '',
      cuisineTip: cuisine,
      canAccessCoach: canAccessAiTips(planId),
    })
    : null;
  const dayWrapUpHtml = dayWrapUpCardHtml(dayWrapUp);

  const habitScore = (!isGuest && isViewingToday && weekMeals.length)
    ? buildWeeklyHabitScore(weekMeals, goals, dateKey)
    : null;
  const habitScoreCard = habitScoreHtml(habitScore);

  const referralCode = profile?.loggedIn ? getReferralCode(profile.userId, profile.email || '') : '';
  const referralShareUrl = referralCode ? getReferralShareUrl(referralCode) : '';
  const referralHtml = (!isGuest && isViewingToday) ? referralCardHtml({ code: referralCode, shareUrl: referralShareUrl }) : '';

  const offlineQueue = (!isGuest && isViewingToday) ? await getOfflineQueueSummary() : { total: 0, pending: 0, ready: 0, items: [] };
  const offlineQueueBannerHtml = offlineQueueBanner(offlineQueue);

  root.innerHTML = `
    <div class="view-page view-page--today${isGuest ? ' view-page--guest' : ''}">
      ${isGuest ? '' : `<h1 class="visually-hidden">${isViewingToday ? 'Today' : escapeHtml(dayHeading)}</h1>`}
      <div class="view-page__toolbar">
        ${scanBudget && usagePresent ? `
        <section class="usage-strip ${usageStripMod}" aria-label="Scan allowance" ${usageStripAlertRole}>
          <div class="usage-strip__main">
            <div class="usage-strip__copy">
              <div class="usage-strip__meta">
                <span class="usage-strip__eyebrow">Photo scans</span>
                <span class="usage-strip__plan">${escapeHtml(usagePresent.planName)}</span>
              </div>
              <p class="usage-strip__count">
                <strong>${escapeHtml(usagePresent.count)}</strong>
                <span>${escapeHtml(usagePresent.unit)}</span>
              </p>
              <p class="usage-strip__detail">${escapeHtml(usagePresent.detail)}</p>
              ${primaryCreditAlert ? `<p class="usage-strip__alert-line"${primaryCreditAlert.tier >= 2 ? ' role="alert"' : ''}><strong>${escapeHtml(primaryCreditAlert.title)}</strong> — ${escapeHtml(primaryCreditAlert.body)}</p>` : ''}
            </div>
            ${!scanBudget.allowed
              ? `<button type="button" class="btn btn-primary btn-sm usage-strip__cta" id="todayUpgrade">View plans</button>`
              : `<button type="button" class="btn btn-ghost btn-sm usage-strip__cta" id="todayViewPlans">Plans</button>`}
          </div>
          <div class="usage-strip__meter-row">
            <div class="usage-strip__meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${scanMeterPct}" aria-valuetext="${escapeAttr(scanMeterValueText)}" aria-label="Scans remaining">
              <div class="usage-strip__meter-fill ${scanMeterPct <= 20 ? 'usage-strip__meter-fill--low' : ''}" style="width:${scanMeterPct}%"></div>
            </div>
            <span class="usage-strip__meter-pct" aria-hidden="true">${scanMeterPct}%</span>
          </div>
        </section>
        ` : ''}
        ${consistencyHtml}
        ${offlineQueueBannerHtml}
      </div>

      ${isGuest ? `
      <div class="view-page__guest-row view-page__guest-row--photo-first">
      ${landingHeroSectionHtml()}
      ${landingTrustStripHtml()}
      ${landingProductDemoHtml()}
      ${landingGlobalMealsHtml()}
      ${landingAdvantagesHtml()}
      ${landingAccuracyHtml()}
      ${landingPlanCompareHtml()}
      ${landingDiscountStripHtml()}
      ${landingSocialProofHtml()}
      ${landingFaqHtml()}
      ${landingPrivacySupportHtml()}
      ${landingFinalCtaHtml()}
      ${guestLandingFooterHtml()}
      </div>
      ` : `
      <div class="view-page__dashboard">
        ${!isGuest && canLogThisDay ? todayLogPanelHtml({ isFutureDay, isPastDay, isViewingToday, dateKey }) : ''}
        <aside class="view-page__aside">
          ${dayDashboardHtml({
            dateKey,
            totals,
            goals,
            prefs,
            weekReport: weekStats,
            showMicros,
          })}
          ${mealTypeBreakdownHtml(foodMeals, prefs)}
        </aside>

        <div class="view-page__main">
          <section class="section section--meals">
            <div class="section-head">
              <h2>${mealsHeading}</h2>
              <span class="badge">${foodMeals.length} logged</span>
            </div>
            ${duplicateAlerts.length ? duplicateAlerts.map((alert) => `
              <section class="insight-card duplicate-day-alert" role="alert">
                <span class="insight-badge">Possible duplicate</span>
                <p>${escapeHtml(alert.detail)}</p>
              </section>
            `).join('') : ''}
            ${foodMeals.length === 0 ? (
              !isGuest && isFutureDay && PLAN_AHEAD_PHASE1_ENABLED
                ? futureDayEmptyPlanHtml({ dayHeading })
                : `
              <div class="empty-state empty-state--meals">
                <div class="empty-state__icon">${ICON_PLATE}</div>
                <p class="empty-state__title">${isFutureDay ? 'Nothing planned' : 'No meals yet'}</p>
                <p class="empty-state__hint">${isGuest ? 'Create a free account to start.' : 'Use Photo, Barcode or Describe above.'}</p>
              </div>
            `
            ) : `
              <ul class="meal-list" id="mealList">
                ${foodMeals.map((m) => mealCard(m, prefs)).join('')}
              </ul>
            `}
          </section>
        </div>

        ${!isGuest ? (() => {
          try {
            return dayDateNavHtml(dateKey, {
              showCalendarBtn: true,
              mealCounts: planMealCounts,
              emptyTomorrow: showPlanTomorrowCard,
            });
          } catch (err) {
            console.error(err);
            return '';
          }
        })() : ''}

        <div class="view-page__extra">
          ${remainingCoachCard}
          ${dayWrapUpHtml}
          ${habitScoreCard}
          ${logAgainHtml}
          ${referralHtml}
          ${!isGuest && !showMicros ? microsTeaserHtml() : ''}
          ${!isGuest ? `
            <section class="supplements-teaser muted-card" aria-label="Supplement log">
              <p class="supplements-teaser__text">${supplementEntries.length
                ? `<strong>${supplementEntries.length}</strong> supplement${supplementEntries.length === 1 ? '' : 's'}`
                : 'No supplements yet'}</p>
              <button type="button" class="btn btn-ghost btn-sm full" id="todayOpenSupplements">Supplements</button>
            </section>
          ` : ''}
          ${weeklyTip ? `
            <section class="insight-card low insight-card--compact" id="weeklyTip">
              <span class="insight-badge">↓ ${weeklyTip.label} ${weeklyTip.periodLabel || 'this week'}</span>
              <p>${escapeHtml(weeklyTip.message)}</p>
              ${weeklyTip.daysUnderTarget ? `<p class="insight-meta">${weeklyTip.daysUnderTarget} day(s) below target</p>` : ''}
              <button type="button" class="btn btn-ghost btn-sm" id="viewReportsBtn">View full report →</button>
              ${disclaimerBlock(DISCLAIMERS.goalInsights, 'fine-print health-disclaimer health-disclaimer--inline')}
            </section>
          ` : ''}
          ${showWeeklyInsightTeaser ? weeklyInsightTeaserHtml() : ''}
          ${cuisine.tips?.length ? `
            <section class="card tip-card">
              <h2 class="card-title">Coach tip for your meals</h2>
              <article class="cuisine-tip">
                <span class="cuisine-tag">${escapeHtml(cuisine.tips[0].cuisine || 'Tip')}</span>
                <h3>${escapeHtml(cuisine.tips[0].title)}</h3>
                <p>${escapeHtml(cuisine.tips[0].body)}</p>
              </article>
              ${cuisine.tips.length > 1 ? `<button type="button" class="btn btn-ghost btn-sm full" id="moreTipsBtn">More tips in Reports →</button>` : ''}
              ${disclaimerBlock(DISCLAIMERS.aiCoach, 'fine-print health-disclaimer health-disclaimer--inline')}
            </section>
          ` : ''}
        </div>
      </div>
      `}
    </div>
  `;

  const openLogForViewDate = (mealType = null, focus = null) => {
    setLogTargetDate(dateKey);
    if (mealType) requestLogMealType(mealType);
    onLog?.(focus);
  };

  const startLog = (focus) => {
    if (isGuest && isSupabaseConfigured()) {
      onSignIn?.(focus ? 'signin' : 'signup');
      return;
    }
    if (focus === 'describe') trackDescribeLogStarted('today');
    openLogForViewDate(null, focus || null);
  };
  root.querySelectorAll('[data-log-focus]').forEach((btn) => {
    btn.addEventListener('click', () => startLog(btn.dataset.logFocus));
  });
  root.querySelectorAll('[data-plan-meal-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openLogForViewDate(btn.dataset.planMealType);
    });
  });
  root.querySelector('#todayOpenSupplements')?.addEventListener('click', () => onSupplements?.());
  root.querySelectorAll('.js-guest-scan').forEach((btn) => {
    btn.addEventListener('click', () => onSignIn?.('signup'));
  });
  root.querySelector('#guestSignIn')?.addEventListener('click', () => onSignIn?.('signin'));
  root.querySelector('#guestFooterSignIn')?.addEventListener('click', () => onSignIn?.('signin'));
  if (isGuest) {
    bindLandingMarketing(root, { onSignIn });
    root.querySelectorAll('[data-legal]').forEach((btn) => {
      btn.addEventListener('click', () => openLegalModal(btn.dataset.legal));
    });
  }
  root.querySelector('#viewReportsBtn')?.addEventListener('click', () => onReports?.());
  root.querySelector('#moreTipsBtn')?.addEventListener('click', () => onReports?.());
  root.querySelector('#microsTeaserPlans')?.addEventListener('click', () => onSettings?.('plans'));
  root.querySelector('#weeklyInsightTeaserPlans')?.addEventListener('click', () => onSettings?.('plans'));
  root.querySelector('#todayUpgrade')?.addEventListener('click', () => onSettings?.('plans'));
  root.querySelector('#todayViewPlans')?.addEventListener('click', () => onSettings?.('plans'));
  root.querySelector('[data-offline-resume]')?.addEventListener('click', (e) => {
    resumeOfflinePhotoMeal(e.currentTarget.dataset.offlineResume);
    onLog?.();
  });
  root.querySelector('#offlineQueueRetry')?.addEventListener('click', async () => {
    showToast?.('Checking connection…');
    const result = await processOfflinePhotoQueue();
    if (result.ready > 0) {
      showToast?.('Meal ready — tap Review meal', 5000);
      onRefresh?.();
      return;
    }
    if (result.failed > 0) {
      showToast?.('Still offline — your photo stays saved', 5000);
      return;
    }
    showToast?.('Nothing to analyse right now');
  });
  root.querySelector('#dayNavCalendar')?.addEventListener('click', () => onCalendar?.());
  root.querySelector('#dayWrapUpDismiss')?.addEventListener('click', () => {
    dismissDayWrapUp(dateKey);
    document.getElementById('dayWrapUpCard')?.remove();
  });
  root.querySelector('#referFriendShareBtn')?.addEventListener('click', () => {
    shareReferral({ code: referralCode, showToast });
  });
  root.querySelector('#referFriendCopyBtn')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(referralShareUrl);
      showToast?.('Invite link copied');
    } catch {
      showToast?.('Could not copy — select the link and copy manually');
    }
  });
  if (!isGuest) {
    bindDayDateNav(root, {
      dateKey,
      onDateChange: (nextKey) => {
        setTodayViewDate(nextKey);
        onRefresh?.();
      },
    });
  }
  root.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await openConfirmModal({
        title: 'Remove this meal?',
        message: 'This cannot be undone.',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (ok) {
        await deleteMeal(btn.dataset.delete);
        onRefresh();
      }
    });
  });
  root.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const meal = foodMeals.find((m) => m.id === btn.dataset.edit);
      if (!meal) return;
      const updated = await openMealEditorModal(meal);
      if (updated) onRefresh();
    });
  });
  root.querySelectorAll('.meal-thumb[data-photo-path]').forEach((img) => {
    img.addEventListener('error', async () => {
      const path = img.dataset.photoPath;
      if (!path || img.dataset.retried === '1') return;
      img.dataset.retried = '1';
      const signed = await resolvePhotoUrlForMeal(img.dataset.mealId, path);
      if (signed) img.src = signed;
    });
  });

  root.querySelectorAll('[data-log-again]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const index = Number(btn.dataset.logAgain);
      const entry = quickLogMeals[index];
      if (!entry?.template) return;

      btn.disabled = true;
      try {
        const payload = buildRepeatMealPayload(entry.template, dateKey);
        const candidate = {
          meal_summary: payload.meal_summary,
          total_calories_kcal: payload.total_calories_kcal,
          barcode: payload.barcode || null,
        };
        const duplicates = findPotentialDuplicates(candidate, foodMeals);
        if (duplicates.length) {
          const choice = await openDuplicateMealModal({
            candidate: payload,
            duplicates: duplicates.map((d) => d.meal),
          });
          if (choice !== 'save') return;
        }

        const saved = await saveMeal(payload);
        if (saved?.cloudSynced === false && profile?.loggedIn) {
          showToast?.('Logged on this device — sync will catch up shortly', 4000);
        } else {
          showToast?.('Logged again ✓');
        }
        onRefresh?.();
      } catch (err) {
        showToast?.(err?.message || 'Could not log meal', 4500);
      } finally {
        btn.disabled = false;
      }
    });
  });
}

function mealTypeLabel(type) {
  const map = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  return map[type] || '';
}

function mealCard(meal, prefs = getUnitPrefs()) {
  const n = meal.total_nutrition || {};
  const type = mealTypeLabel(meal.meal_type);
  return `
    <li class="meal-card">
      ${meal.photoDataUrl || meal.photo_path
    ? `<img src="${meal.photoDataUrl || ''}" alt="" class="meal-thumb" data-meal-id="${meal.id}" data-photo-path="${escapeHtml(meal.photo_path || '')}"/>`
    : `<div class="meal-thumb meal-thumb--placeholder">${ICON_PLATE}</div>`}
      <div class="meal-body">
        <h3>${type ? `<span class="meal-type">${type}</span> ` : ''}${escapeHtml(meal.meal_summary || 'Meal')}${meal._manuallyAdjusted ? ' <span class="meal-adjusted">Manually adjusted</span>' : ''}</h3>
        <p class="meal-meta">${formatEnergy(meal.total_calories_kcal || 0, prefs)} · P ${n.protein_g == null ? 'unavailable' : `${Math.round(n.protein_g)}g`} · C ${n.carbs_g == null ? 'unavailable' : `${Math.round(n.carbs_g)}g`} · F ${n.fat_g == null ? 'unavailable' : `${Math.round(n.fat_g)}g`}</p>
        ${meal.meal_notes ? `<p class="meal-notes">${escapeHtml(meal.meal_notes)}</p>` : ''}
        ${meal.items?.length ? `<p class="meal-items">${meal.items.map((i) => escapeHtml(i.name)).join(', ')}</p>` : ''}
      </div>
      <div class="meal-actions">
        <button type="button" class="icon-btn icon-btn--edit" data-edit="${meal.id}" aria-label="Edit meal">${ICON_EDIT}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-delete="${meal.id}" aria-label="Delete meal">${ICON_DELETE}</button>
      </div>
    </li>
  `;
}

export async function renderSettings(root, { onSave, onGoToday, showToast, profile: profileIn, onSignIn }) {
  let activeSettingsTab = getSettingsTab();
  const goals = getGoals();
  const prefs = getUnitPrefs();
  const notifyPrefs = getNotifyPrefs();
  const profile = profileIn || await getProfile();
  const session = await getSession();
  const user = session?.user ?? (profile.loggedIn ? await getUser() : null);
  const cloudReady = isSupabaseConfigured();
  const notifySupported = isNotificationSupported();
  const displayName = profile.displayName || '';

  const end = todayKey();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekMeals = await getMealsInRange(todayKey(weekStart), end);
  const todayMeals = await getMealsForDate(end);
  const tdeeStart = new Date();
  tdeeStart.setDate(tdeeStart.getDate() - 13);
  const tdeeMeals = await getMealsInRange(todayKey(tdeeStart), end);
  let cuisine = null;
  if (weekMeals.length && canAccessAiTips()) {
    cuisine = await getCuisineTips(weekMeals);
  }

  let weeklyPreview;
  let dailyPreview;
  let previewNote = 'your logged meals';

  if (weekMeals.length) {
    weeklyPreview = buildWeeklyPushMessage(weekReport(weekMeals), cuisine, displayName);
    dailyPreview = buildDailyPushMessage(sumNutrition(todayMeals), goals, todayMeals.length, displayName);
  } else {
    previewNote = 'sample data (log meals for yours)';
    weeklyPreview = buildWeeklyPushMessage(null, null, displayName || 'Alex');
    dailyPreview = buildDailyPushMessage({ calories_kcal: 840, protein_g: 28, carbs_g: 90, fat_g: 30 }, goals, 2, displayName || 'Alex');
  }

  const initials = (displayName || user?.email || '?').charAt(0).toUpperCase();
  const showPasswordReset =
    isPasswordResetMode() || new URLSearchParams(window.location.search).get('reset') === '1';
  const recoveryReady = showPasswordReset && Boolean(user);
  const recoveryPending = showPasswordReset && !user;
  if (profile?.loggedIn) syncScanStateFromProfile(profile);
  const paygPack = SCAN_PACKS[PAYG_PACK_ID];
  const currentPlan = profile?.loggedIn ? getPlan() : 'free';
  const settingsCreditAlerts = profile?.loggedIn && !MONETIZATION_PAUSED
    ? computeCreditAlerts({ profile, budget: getScanBudget(currentPlan) })
    : [];
  const accountEmail = profile.email || user?.email || '';
  const discount = getDiscountEligibility(profile, accountEmail);
  const wizardProfile = getWizardProfile() || {};
  const wizGoal = wizardProfile.weightGoal || 'maintain';
  const wizRateId = wizardProfile.weightChangeRateId || defaultRateIdForGoal(wizGoal);
  let wizardTdee = null;
  try {
    const metrics = resolveBodyMetrics(wizardProfile, { strict: true });
    wizardTdee = estimateDailyCalories({
      sex: wizardProfile.sex,
      age: metrics.age,
      weightKg: metrics.weightKg,
      heightCm: metrics.heightCm,
      activity: wizardProfile.activity || 'light',
      weightGoal: 'maintain',
    }).tdee;
  } catch (_) { /* wizard body fields may be incomplete */ }
  const phase3 = phase3SettingsModel({ meals: tdeeMeals, dateKey: end, wizardTdee });

  root.innerHTML = `
    <div class="settings-screen">
      <header class="settings-header">
        <h1 class="settings-title">Goals &amp; settings</h1>
        <p class="settings-subtitle">Targets, account, plans, and alerts</p>
      </header>

      <nav class="settings-tabs tab-bar" role="tablist" aria-label="Settings sections">
        ${settingsTab('targets', 'Targets', activeSettingsTab)}
        ${settingsTab('account', 'Account', activeSettingsTab)}
        ${settingsTab('plans', 'Plans', activeSettingsTab)}
        ${settingsTab('alerts', 'Alerts', activeSettingsTab)}
      </nav>

      <div class="settings-panels">
        <section class="settings-panel card" role="tabpanel" id="settingsPanel-targets" aria-labelledby="settingsTab-targets" data-panel="targets" ${panelHidden('targets', activeSettingsTab)}>
          ${profile?.loggedIn ? `
          <form id="goalsForm">
            <p class="card-desc fine-print">${DISCLAIMERS.wellnessTargets}</p>

            <details class="settings-details calorie-wizard" id="calorieWizard">
              <summary>Personalise calorie target (estimate)</summary>
              <div class="settings-details-body">
                <p class="fine-print">Prefer a guided flow? <button type="button" class="link-btn" id="runOnboardingWizard">Run 3-step setup wizard</button></p>
                <p class="fine-print">Wellness estimate only — not medical advice.</p>
                <div class="wizard-grid">
                  <label class="field">
                    <span>Sex</span>
                    <select id="wizSex" class="settings-select">
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                    </select>
                  </label>
                  <label class="field">
                    <span>Age</span>
                    <input type="number" id="wizAge" min="16" max="100" inputmode="numeric" placeholder="e.g. 35" value="${escapeHtml(wizardProfile.age || '')}" required/>
                  </label>
                  ${settingsBodyMetricsHtml(wizardProfile)}
                  <label class="field full">
                    <span>Activity</span>
                    <select id="wizActivity" class="settings-select full">
                      ${wizardActivities.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field full">
                    <span>Weight goal</span>
                    <select id="wizGoal" class="settings-select full">
                      <option value="lose" ${wizGoal === 'lose' ? 'selected' : ''}>Lose weight</option>
                      <option value="maintain" ${wizGoal === 'maintain' ? 'selected' : ''}>Maintain weight</option>
                      <option value="gain" ${wizGoal === 'gain' ? 'selected' : ''}>Gain weight</option>
                    </select>
                  </label>
                  <div id="wizGoalRateWrap" ${wizGoal === 'maintain' ? 'hidden' : ''}>
                    ${weightGoalRateSelectHtml(wizGoal, wizRateId, {
                      id: 'wizGoalRate',
                      className: 'settings-select full',
                      label: wizGoal === 'lose' ? 'Lose weight at' : 'Gain weight at',
                    })}
                  </div>
                </div>
                <button type="button" class="btn btn-ghost full" id="applyCalorieEstimate">Calculate &amp; apply to targets</button>
                <p class="fine-print" id="calorieEstimateResult" hidden></p>
              </div>
            </details>

            ${phase3RetentionHtml(phase3)}

            <div class="goal-hero">
              <label class="goal-hero-field">
                <span class="goal-hero-label">Daily calorie target</span>
                <div class="goal-hero-input-wrap">
                  <input type="number" name="calories_kcal" value="${goals.calories_kcal}" min="0" step="50" inputmode="numeric" aria-label="Daily calories"/>
                  <span class="goal-hero-unit">kcal</span>
                </div>
              </label>
            </div>

            <p class="settings-group-label">Macronutrients</p>
            <div class="goal-macro-grid">
              ${goalMacroField('protein_g', 'Protein', goals.protein_g, 'g', '#0f766e')}
              ${goalMacroField('carbs_g', 'Carbs', goals.carbs_g, 'g', '#d97706')}
              ${goalMacroField('fat_g', 'Fat', goals.fat_g, 'g', '#e11d48')}
            </div>

            <p class="settings-group-label">Daily limits</p>
            <p class="fine-print health-disclaimer">${DISCLAIMERS.nutrientTargetsShort}</p>
            <div class="goal-limits-grid">
              ${goalField('fibre_g', 'Fibre min (g)', goals.fibre_g)}
              ${goalField('sugar_g', 'Total sugars max (g)', goals.sugar_g)}
              ${goalField('salt_mg', 'Salt max (mg · ~6 g/day)', goals.salt_mg)}
            </div>
            <p class="fine-print">Barcode sodium is converted to salt (×2.5). Sugar totals include natural and added sugars — NHS free-sugar guidance is about 30g/day for adults.</p>

            <div class="settings-row">
              <span>Display energy as</span>
              <select name="energy" class="settings-select" aria-label="Energy unit">
                <option value="kcal" ${prefs.energy === 'kcal' ? 'selected' : ''}>kcal</option>
                <option value="kJ" ${prefs.energy === 'kJ' ? 'selected' : ''}>kJ</option>
              </select>
            </div>
            ${prefs.energy === 'kJ' ? '<p class="fine-print">Enter your daily target in kcal above — Today and Reports show kJ.</p>' : ''}

            <div class="settings-sticky-actions">
              <button type="button" class="btn btn-ghost" id="resetGoals">Reset defaults</button>
              <button type="submit" class="btn btn-primary">Save goals</button>
            </div>
          </form>
          ` : `
          <div class="guest-prompt">
            <p class="guest-prompt__lead">Sign in to set and save your daily nutrition targets.</p>
            <div class="guest-prompt__actions settings-auth-cta">
              <button type="button" class="btn btn-primary full" id="targetsGetStarted">Create free account</button>
              <button type="button" class="btn btn-ghost full" id="targetsSignIn">Sign in</button>
            </div>
            <p class="guest-prompt__note">${BARCODE_COPY.authFine}</p>
          </div>
          `}
        </section>

        <section class="settings-panel card" role="tabpanel" id="settingsPanel-account" aria-labelledby="settingsTab-account" data-panel="account" ${panelHidden('account', activeSettingsTab)}>
          <div class="account-card">
            <div class="account-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
            <div class="account-card-body">
              <strong>${escapeHtml(displayName || (user ? 'Your account' : 'Guest'))}</strong>
              <span>${user ? escapeHtml(user.email) : 'Sign in to back up meals &amp; use AI photo logging'}</span>
            </div>
          </div>

          ${!cloudReady ? `
            <p class="card-desc">Cloud login is not configured on this site build. Contact support if this persists after an update.</p>
          ` : recoveryReady ? `
            <section class="password-reset-panel card muted-card" aria-labelledby="passwordResetTitle">
              <h3 class="settings-panel-title" id="passwordResetTitle">Set a new password</h3>
              <p class="card-desc">You opened a secure link from your email. Choose a new password for ${escapeHtml(user.email || 'your account')}.</p>
              <form id="newPasswordForm" class="auth-form settings-form-compact">
                <label class="field full">
                  <span>New password</span>
                  <input type="password" name="password" id="newPasswordInput" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters"/>
                </label>
                <button type="submit" class="btn btn-primary full">Save new password</button>
              </form>
            </section>
          ` : recoveryPending ? `
            <section class="password-reset-panel card muted-card" aria-labelledby="passwordResetExpiredTitle">
              <h3 class="settings-panel-title" id="passwordResetExpiredTitle">Reset link expired</h3>
              <p class="card-desc">This password reset link is invalid or has already been used. Request a fresh link and open it on this device.</p>
              <form id="requestResetForm" class="auth-form settings-form-compact">
                <label class="field full">
                  <span>Email</span>
                  <input type="email" name="email" id="requestResetEmail" required autocomplete="email" inputmode="email" placeholder="you@email.com"/>
                </label>
                <button type="submit" class="btn btn-primary full">Email me a new reset link</button>
              </form>
              <p class="fine-print">Already know your password? <button type="button" class="link-btn" id="settingsSignIn">Sign in</button></p>
            </section>
          ` : user ? `
            <p class="settings-group-label">First name</p>
            <p class="fine-print">Used in your greeting and reports.</p>
            <form id="nameForm" class="auth-form settings-form-compact">
              <label class="field full">
                <span>First name</span>
                <input type="text" name="display_name" value="${escapeHtml(displayName)}" required maxlength="40" autocomplete="given-name" placeholder="e.g. Sarah"/>
              </label>
              <button type="submit" class="btn btn-primary full">Save name</button>
            </form>
            <div class="settings-action-row">
              <button type="button" class="btn btn-ghost" id="syncBtn">Sync now</button>
              <button type="button" class="btn btn-ghost settings-btn-danger" id="signOutBtn">Sign out</button>
            </div>
            <div class="settings-danger-zone">
              <p class="settings-group-label">Delete account</p>
              <p class="fine-print">Permanently removes your account, cloud meals, photos, and cancels any active subscription. This cannot be undone.</p>
              <button type="button" class="btn btn-ghost settings-btn-danger full" id="deleteAccountBtn">Delete my account</button>
            </div>
          ` : `
            <p class="settings-group-label">Create account or sign in</p>
            <div class="guest-prompt">
              <p class="guest-prompt__lead">Free to start. Your meals sync securely to the cloud when signed in.</p>
              <div class="guest-prompt__actions settings-auth-cta">
                <button type="button" class="btn btn-primary full" id="settingsGetStarted">Create free account</button>
                <button type="button" class="btn btn-ghost full" id="settingsSignIn">Sign in</button>
              </div>
              <p class="guest-prompt__note">${BARCODE_COPY.authFine}</p>
            </div>
          `}

          <p class="settings-group-label">Privacy &amp; data</p>
          <div class="settings-list settings-list--stack">
            ${profile?.loggedIn ? `
            <button type="button" class="btn btn-ghost full" id="exportJsonBtn">Download my data (JSON)</button>
            <button type="button" class="btn btn-ghost full" id="exportCsvBtn">Download meals (CSV)</button>
            <p class="fine-print">Exports meals saved on this device. Sync first if you need the latest from the cloud.</p>
            ` : `
            <p class="fine-print">Sign in to download your data (JSON or CSV).</p>
            `}
            <button type="button" class="btn btn-ghost full" id="privacyBtn">Privacy policy</button>
            <button type="button" class="btn btn-ghost full" id="termsBtn">Terms of use</button>
            <button type="button" class="btn btn-ghost full settings-btn-danger" id="resetAppBtn">Reset app on this device</button>
            <p class="fine-print">Clears local meals, goals, onboarding, and cached sign-in on this phone or browser. Does not delete your cloud account. Try this if signup or the app feels stuck.</p>
            ${showSentryTestButton() ? `
              <button type="button" class="btn btn-ghost full" id="sentryTestBtn">Test Sentry</button>
              <p class="fine-print">Sends a test error to your Sentry dashboard — safe to ignore there.</p>
            ` : ''}
          </div>
        </section>

        <section class="settings-panel card plans-page" role="tabpanel" id="settingsPanel-plans" aria-labelledby="settingsTab-plans" data-panel="plans" ${panelHidden('plans', activeSettingsTab)}>
          <div class="settings-panel-head">
            <h3 class="settings-panel-title">Plans</h3>
            <span class="settings-badge">${planBadgeLabel(currentPlan)}</span>
          </div>
          <p class="settings-panel-lead plans-page__lead">Free, Plus or Pro for photo scans — Essential if you need fewer scans. Barcode, search and Describe stay free.</p>

          ${profile.loggedIn && isTrialActive(profile) ? `
          <div class="plans-status-banner plans-status-banner--trial" role="status">
            <strong>Trial active</strong> — ${escapeHtml(trialPlanLabel(profile))}${escapeHtml(trialBannerExtraHtml(profile))}
          </div>
          ` : ''}

          ${creditAlertsPlansHtml(settingsCreditAlerts)}

          ${profile.loggedIn && currentPlan === 'free' && getTopUpBalance() > 0 ? `
          <div class="plans-status-banner plans-status-banner--topup" role="status">
            <strong>Bonus scans</strong> — ${getTopUpBalance()} top-up credit${getTopUpBalance() === 1 ? '' : 's'} on your account
          </div>
          ` : ''}

          ${profile.loggedIn ? plansStatusCardHtml(currentPlan) : `
          <p class="plans-guest-lead">${PLANS.free.name} — ${FREE_DAILY_SCANS} AI photo scan per day. ${BARCODE_COPY.short}.</p>
          `}

          <div class="plans-discount-pill ${discount.eligible ? 'plans-discount-pill--active' : ''}" role="note">
            <span class="plans-discount-pill__badge">${ELIGIBILITY_DISCOUNT_PERCENT}% off</span>
            <span class="plans-discount-pill__text">NHS work email or 60+ — ${ELIGIBILITY_DISCOUNT_PERCENT}% off</span>
            ${discount.eligible
              ? `<span class="plans-discount-pill__status">Applied to prices below</span>`
              : profile.loggedIn
                ? `<button type="button" class="link-btn" id="openDiscountSection">See if you qualify →</button>`
                : `<span class="plans-discount-pill__hint">Sign in to apply</span>`}
          </div>

          ${nativeAppUsesExternalWebBilling() && profile.loggedIn ? `
          <div class="native-billing-banner muted-card">
            <p><strong>Subscriptions &amp; top-ups</strong> are completed on our website (Stripe). Sign in with the same email. When you return to the app, your plan syncs automatically.</p>
            <button type="button" class="btn btn-primary full" id="openWebPlansBtn">Open plans on web</button>
          </div>
          ` : ''}

          <div class="plans-page__pricing" id="plansPricing">
            <div class="plans-free-chip" role="note">
              <span class="plans-free-chip__label">Always free</span>
              <span class="plans-free-chip__text">${FREEMIUM_TAGLINE}</span>
            </div>

            <div class="plan-subscription-block plan-subscription-block--primary">
              <p class="settings-group-label">Subscription plans</p>
              <p class="plan-carousel-hint" aria-hidden="true">Swipe to compare →</p>
              <div class="plan-carousel-wrap">
                <div class="plan-pricing-grid plan-pricing-grid--subs">
                  ${SUBSCRIPTION_PLAN_IDS.map((planId) => subscriptionPlanCard(planId, currentPlan, profile, user)).join('')}
                </div>
              </div>
            </div>

            <div class="plan-subscription-block plan-subscription-block--topup">
              <p class="settings-group-label">Top up anytime</p>
              <div class="plan-topup-wrap">
                ${topUpPlanCard(currentPlan, profile, user, paygPack)}
              </div>
            </div>
          </div>

          ${renderProductFeaturesHtml({ variant: 'settings', showDisclaimer: false })}

          ${profile.loggedIn ? `
          <details class="settings-details plans-extras-details" id="plansExtrasDetails">
            <summary>Promo code &amp; billing</summary>
            <div class="settings-details-body plans-extras-details__body">
              <form class="voucher-form" id="promoCodeForm">
                <label class="field full">
                  <span>Promo code</span>
                  <div class="settings-action-row">
                    <input type="text" id="promoCodeInput" class="full" placeholder="e.g. VIP100" autocomplete="off" maxlength="40"/>
                    <button type="submit" class="btn btn-ghost" id="promoCodeApplyBtn">Apply</button>
                  </div>
                </label>
                <p class="fine-print">Sign in with a confirmed email before applying. <strong>VIP100</strong> adds 100 bonus AI meal scans to your account.</p>
              </form>

              <details class="settings-details settings-details--nested" id="discountSection">
                <summary>Discount eligibility — NHS / public sector or 60+</summary>
                <div class="settings-details-body">
                  ${discountEligibilitySettingsHtml({ profile, accountEmail, discount })}
                </div>
              </details>

              <p class="fine-print plan-billing-note">Subscription scans reset each billing period — unused allowance does not carry over. Top-up credits never expire until used.</p>

              ${isSubscriptionPlan(currentPlan) ? `
                <button type="button" class="btn btn-ghost full" id="manageSubscriptionBtn">${nativeAppUsesExternalWebBilling() ? 'Manage subscription on web' : 'Manage or cancel subscription'}</button>
                <p class="fine-print">${nativeAppUsesExternalWebBilling() ? 'Cancel or update payment on our website — access continues until the end of your billing period.' : 'Cancel anytime — you keep access until the end of your billing period.'}</p>
              ` : ''}
            </div>
          </details>
          ` : `
          <p class="plans-guest-signin fine-print">
            Already have an account?
            <button type="button" class="link-btn" id="plansSignInLink">Sign in</button>
          </p>
          `}

          <p class="plans-trust-row" aria-label="Payment security">
            <svg class="plans-trust-row__icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            Secure checkout by Stripe · Cancel anytime · Prices in GBP
          </p>
        </section>

        <section class="settings-panel card" role="tabpanel" id="settingsPanel-alerts" aria-labelledby="settingsTab-alerts" data-panel="alerts" ${panelHidden('alerts', activeSettingsTab)}>
          <h3 class="settings-panel-title">Notifications</h3>
          ${!notifySupported ? `
            <p class="card-desc">Notifications are not supported in this browser.</p>
          ` : `
            <p class="card-desc">Reminders when you open ${APP_NAME}, plus push alerts when your browser allows them.</p>
            <div class="settings-list">
              <label class="settings-row settings-row--toggle">
                <span>Enable notifications</span>
                <input type="checkbox" id="notifyToggle" ${notifyPrefs.enabled ? 'checked' : ''}/>
              </label>
              <label class="settings-row">
                <span>Daily reminder</span>
                <input type="time" id="reminderTime" class="settings-time" value="${String(notifyPrefs.reminderHour).padStart(2, '0')}:${String(notifyPrefs.reminderMinute).padStart(2, '0')}"/>
              </label>
            </div>
            <p class="fine-print settings-panel-title">Scan allowance alerts</p>
            <p class="fine-print">Shown when you open ${APP_NAME}. Background push needs notification permission above.</p>
            <div class="settings-list">
              <label class="settings-row settings-row--toggle">
                <span>Credits expiring soon</span>
                <input type="checkbox" id="creditExpiryToggle" ${notifyPrefs.creditExpiryEnabled !== false ? 'checked' : ''}/>
              </label>
              <label class="settings-row settings-row--toggle">
                <span>Trial ending soon</span>
                <input type="checkbox" id="creditTrialToggle" ${notifyPrefs.creditTrialEnabled !== false ? 'checked' : ''}/>
              </label>
              <label class="settings-row settings-row--toggle">
                <span>Low scan balance (≤5 left)</span>
                <input type="checkbox" id="creditLowToggle" ${notifyPrefs.creditLowEnabled ? 'checked' : ''}/>
              </label>
            </div>
            <p class="fine-print">Daily reminders run when the app is open. Background push needs permission and a supported browser.</p>

            <details class="settings-details">
              <summary>Preview what notifications look like</summary>
              <div class="settings-details-body">
                <p class="fine-print">Based on ${previewNote}.</p>
                ${notifyPreviewCard('Weekly digest (Monday)', weeklyPreview)}
                ${notifyPreviewCard('Daily reminder', dailyPreview)}
                ${notifyPreviewCard('Scan allowance alert', { title: '3 scans left', body: 'This will use 1 of your 3 remaining scans. Barcode and describe logging stay free.' })}
              </div>
            </details>
          `}
        </section>
      </div>

      <footer class="settings-footer" aria-label="Support and legal">
        <p class="settings-footer__support">
          Questions or data requests?
          <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a>
        </p>
        <p class="settings-footer__meta fine-print">
          <button type="button" class="link-btn" data-settings-legal="privacy">Privacy</button>
          ·
          <button type="button" class="link-btn" data-settings-legal="terms">Terms</button>
          · ${APP_NAME} v${APP_VERSION} · Policy ${LEGAL_VERSION}
        </p>
      </footer>
    </div>
  `;

  root.querySelectorAll('.settings-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSettingsTab = btn.dataset.tab;
      setSettingsTab(activeSettingsTab);
      root.querySelectorAll('.settings-tab').forEach((b) => {
        const selected = b.dataset.tab === activeSettingsTab;
        b.classList.toggle('active', selected);
        b.setAttribute('aria-selected', selected ? 'true' : 'false');
      });
      root.querySelectorAll('.settings-panel').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== activeSettingsTab;
      });
      btn.focus();
    });
  });

  root.querySelector('#nameForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await saveDisplayName(fd.get('display_name'));
      showToast?.('Name saved');
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Could not save name');
    }
  });

  root.querySelector('#goalsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const btn = e.target.querySelector('button[type="submit"]');
    const next = {};
    for (const k of Object.keys(DEFAULT_GOALS)) {
      next[k] = Number(fd.get(k)) || DEFAULT_GOALS[k];
    }
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving…';
    }
    try {
      saveGoals(next);
      const user = await getUser();
      if (user?.id) setGoalsOwnerId(user.id);
      saveUnitPrefs({ energy: fd.get('energy') || getUnitPrefs().energy });
      try {
        const { syncGoalsToCloud } = await import('../services/sync.js');
        await syncGoalsToCloud();
        showToast?.('Goals saved');
      } catch (syncErr) {
        showToast?.('Saved on this device — cloud sync failed, try Sync now in Settings');
      }
      onSave();
      onGoToday?.();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save goals';
      }
    }
  });

  root.querySelector('#resetGoals')?.addEventListener('click', async () => {
    saveGoals(DEFAULT_GOALS);
    try {
      const { syncGoalsToCloud } = await import('../services/sync.js');
      await syncGoalsToCloud();
      showToast?.('Goals reset to defaults');
    } catch (_) {
      showToast?.('Reset locally — cloud sync failed, try Sync now in Settings');
    }
    onSave();
  });

  root.querySelector('#runOnboardingWizard')?.addEventListener('click', async () => {
    await openOnboardingWizard({ showToast, force: true });
    onSave();
  });

  root.querySelector('#wizGoal')?.addEventListener('change', () => syncWizGoalRateWrap(root));

  root.addEventListener('click', (event) => {
    const heightBtn = event.target.closest('[data-wiz-height-unit]');
    if (heightBtn) {
      const body = readSettingsWizardBody(root, getWizardProfile() || {});
      body.heightUnit = heightBtn.dataset.wizHeightUnit;
      syncWizBodyFields(root, body);
      return;
    }
    const weightBtn = event.target.closest('[data-wiz-weight-unit]');
    if (weightBtn) {
      const body = readSettingsWizardBody(root, getWizardProfile() || {});
      body.weightUnit = weightBtn.dataset.wizWeightUnit;
      syncWizBodyFields(root, body);
    }
  });

  bindPhase3Settings(root, { showToast, onRefresh: onSave });

  root.querySelector('#applyCalorieEstimate')?.addEventListener('click', () => {
    const form = root.querySelector('#goalsForm');
    const resultEl = root.querySelector('#calorieEstimateResult');
    try {
      const bodyState = readSettingsWizardBody(root, getWizardProfile() || {});
      bodyState.sex = root.querySelector('#wizSex')?.value;
      bodyState.age = root.querySelector('#wizAge')?.value;
      const metrics = resolveBodyMetrics(bodyState, { strict: true });
      const weightGoal = root.querySelector('#wizGoal')?.value;
      const rate = resolveWeightChangeRate(weightGoal, root.querySelector('#wizGoalRate')?.value);
      const estimate = estimateDailyCalories({
        sex: bodyState.sex,
        age: metrics.age,
        weightKg: metrics.weightKg,
        heightCm: metrics.heightCm,
        activity: root.querySelector('#wizActivity')?.value,
        weightGoal,
        gramsPerWeek: rate.gramsPerWeek,
      });
      form.querySelector('[name="calories_kcal"]').value = estimate.target;
      if (resultEl) {
        resultEl.hidden = false;
        const paceNote = rate.label ? ` Pace: ${rate.label}.` : '';
        resultEl.textContent = `Estimated maintenance ~${estimate.tdee} kcal/day → target ${estimate.target} kcal.${paceNote} Protein, carbs and fat unchanged — edit in Targets if needed.`;
      }
      showToast?.('Calorie estimate applied — review and save');
    } catch (err) {
      showToast?.(err.message || 'Could not estimate');
    }
  });

  root.querySelector('#exportJsonBtn')?.addEventListener('click', async () => {
    if (!profile?.loggedIn) {
      showToast?.('Sign in to export your data');
      return;
    }
    try {
      await exportUserDataJson(profile);
      showToast?.('Data export downloaded');
    } catch (err) {
      showToast?.(err.message || 'Export failed');
    }
  });

  root.querySelector('#exportCsvBtn')?.addEventListener('click', async () => {
    if (!profile?.loggedIn) {
      showToast?.('Sign in to export your data');
      return;
    }
    try {
      const count = await exportMealsCsv(profile);
      showToast?.(count ? `Exported ${count} meals` : 'No meals to export yet');
    } catch (err) {
      showToast?.(err.message || 'Export failed');
    }
  });

  root.querySelector('#privacyBtn')?.addEventListener('click', () => openLegalModal('privacy'));
  root.querySelector('#termsBtn')?.addEventListener('click', () => openLegalModal('terms'));

  root.querySelector('#resetAppBtn')?.addEventListener('click', async () => {
    const ok = await openConfirmModal({
      title: 'Reset app on this device?',
      message: 'This clears local meals, goals, onboarding progress, and any cached sign-in on this device. Your cloud account and cloud meals are not deleted.',
      confirmLabel: 'Reset app',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await resetAppOnDevice();
    } catch (err) {
      showToast?.(err.message || 'Could not reset app', 5000);
    }
  });
  root.querySelectorAll('[data-settings-legal]').forEach((btn) => {
    btn.addEventListener('click', () => openLegalModal(btn.dataset.settingsLegal));
  });

  root.querySelector('#sentryTestBtn')?.addEventListener('click', async () => {
    try {
      await sendSentryTestError();
      showToast?.('Test error sent — check Sentry Issues in ~1 min');
    } catch (err) {
      showToast?.(err.message || 'Sentry test failed', 5000);
    }
  });

  root.querySelector('#targetsGetStarted')?.addEventListener('click', () => onSignIn?.('signup'));
  root.querySelector('#targetsSignIn')?.addEventListener('click', () => onSignIn?.('signin'));
  root.querySelector('#settingsGetStarted')?.addEventListener('click', () => onSignIn?.('signup'));
  root.querySelector('#settingsSignIn')?.addEventListener('click', () => onSignIn?.('signin'));

  root.querySelector('#requestResetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector('#requestResetEmail');
    const email = input?.value?.trim() || '';
    if (!email) {
      showToast?.('Enter your email address', 4000);
      input?.focus();
      return;
    }
    const btn = root.querySelector('#requestResetForm button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Sending…';
    }
    try {
      await resetPassword(email);
      showToast?.('Check your email for a new reset link (check spam too)', 6000);
    } catch (err) {
      showToast?.(friendlyAuthError(err.message) || 'Could not send reset email', 5000);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Email me a new reset link';
      }
    }
  });

  root.querySelector('#newPasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector('#newPasswordInput');
    const password = input?.value || '';
    if (password.length < 6) {
      showToast?.('Password must be at least 6 characters', 4000);
      input?.focus();
      return;
    }
    const btn = root.querySelector('#newPasswordForm button[type="submit"]');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Saving…';
    }
    try {
      await updatePassword(password);
      setPasswordResetMode(false);
      const url = new URL(window.location.href);
      url.searchParams.delete('reset');
      window.history.replaceState({}, '', url.pathname + url.search);
      showToast?.('Password updated — you\'re all set');
      onSave();
    } catch (err) {
      showToast?.(friendlyAuthError(err.message) || 'Could not update password', 5000);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save new password';
      }
    }
  });

  root.querySelector('#signOutBtn')?.addEventListener('click', async () => {
    const ok = await openConfirmModal({
      title: 'Sign out?',
      message: 'You can sign back in anytime to sync your meals.',
      confirmLabel: 'Sign out',
    });
    if (!ok) return;
    const clearLocal = await openConfirmModal({
      title: 'Clear local meals?',
      message: 'Remove meals stored on this device too? Choose Keep to preserve them for your next sign-in.',
      confirmLabel: 'Clear local meals',
      cancelLabel: 'Keep meals',
      tone: 'danger',
    });
    await signOut();
    clearLocalDisplayName();
    if (clearLocal) {
      await clearAllLocalMeals();
      showToast?.('Signed out — local meals cleared');
    } else {
      showToast?.('Signed out');
    }
    onSave();
  });

  root.querySelector('#deleteAccountBtn')?.addEventListener('click', async () => {
    const ok = await openConfirmModal({
      title: `Delete your ${APP_NAME} account?`,
      message: 'This removes your profile, cloud meals, photos, and cancels any active subscription.',
      confirmLabel: 'Continue',
      tone: 'danger',
    });
    if (!ok) return;
    const confirmed = await openTypedConfirmModal({
      title: 'Delete account permanently',
      message: 'This action cannot be undone. All your data will be removed.',
      expected: 'DELETE',
      confirmLabel: 'Delete permanently',
    });
    if (!confirmed) {
      showToast?.('Account deletion cancelled');
      return;
    }
    try {
      await deleteMyAccount();
      await clearAllLocalMeals();
      showToast?.('Your account has been deleted');
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Could not delete account', 6000);
    }
  });

  root.querySelector('#plansSignInLink')?.addEventListener('click', () => onSignIn?.('signin'));
  root.querySelector('#openDiscountSection')?.addEventListener('click', () => {
    revealDiscountSection(root);
  });

  if (consumeOpenDiscountSection()) {
    revealDiscountSection(root);
  }
  bindCreditAlertActions(root, {
    onPlans: () => {
      root.querySelector('.settings-tab[data-tab="plans"]')?.click();
    },
    onRefresh: async () => {
      showToast?.('Refreshing allowance…');
      await refreshScanAllowanceFromCloud().catch(() => {});
      showToast?.('Allowance updated');
      onSave();
    },
  });

  root.querySelectorAll('.plans-signin-sub').forEach((btn) => {
    btn.addEventListener('click', () => onSignIn?.('signup'));
  });

  root.querySelector('#openWebPlansBtn')?.addEventListener('click', async () => {
    try {
      await openWebBilling({ tab: 'plans' });
      showToast?.('Opening plans in your browser…');
    } catch (err) {
      showToast?.(err.message || 'Could not open website');
    }
  });

  root.querySelectorAll('[data-pack]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!profile?.loggedIn) {
        showToast?.('Sign in to buy credits');
        onSignIn?.('signin');
        return;
      }
      const packId = btn.dataset.pack;
      const pack = SCAN_PACKS[packId];
      if (!pack) return;
      try {
        const result = await startScanPackCheckout(packId);
        if (result?.external) {
          showToast?.('Complete checkout in your browser — credits sync when you return');
          return;
        }
        if (result.mock) {
          showToast?.(import.meta.env.DEV
            ? `+${pack.scans} credits added (demo — add Stripe for real payments)`
            : `+${pack.scans} credits added`);
          onSave();
        }
      } catch (err) {
        showToast?.(err.message || 'Could not start checkout');
      }
    });
  });

  root.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!profile?.loggedIn) {
        showToast?.('Sign in to subscribe');
        onSignIn?.('signin');
        return;
      }
      const planId = btn.dataset.plan;
      const annual = btn.dataset.annual === 'yes';
      try {
        const result = await startPlanCheckout(planId, { annual });
        if (result?.external) {
          showToast?.('Complete checkout in your browser — your plan syncs when you return');
          return;
        }
        if (result.mock) {
          showToast?.(`${PLANS[planId]?.name || planId} enabled (demo — add Stripe price IDs for real billing)`);
          onSave();
        }
      } catch (err) {
        showToast?.(err.message || 'Could not start checkout');
      }
    });
  });

  root.querySelectorAll('[data-change-plan]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!profile?.loggedIn) {
        showToast?.('Sign in to change plan');
        onSignIn?.('signin');
        return;
      }
      const planId = btn.dataset.changePlan;
      const annual = btn.dataset.annual === 'yes';
      try {
        const result = await requestPlanChange(planId, { annual });
        if (result?.cancelled) return;
        if (result?.external) {
          showToast?.('Complete this on our website — your plan syncs when you return');
          return;
        }
        if (result?.url) {
          showToast?.('Complete checkout in your browser — your plan syncs when you return');
          return;
        }
        if (result?.mock) {
          showToast?.(`${PLANS[planId]?.name || planId} enabled (demo — add Stripe price IDs for real billing)`);
          onSave();
        }
      } catch (err) {
        if (err.message?.includes('billing')) {
          showToast?.(err.message);
        } else {
          showToast?.(err.message || 'Could not change plan');
        }
      }
    });
  });

  root.querySelector('#manageSubscriptionBtn')?.addEventListener('click', async () => {
    try {
      const result = await openBillingPortal();
      if (result?.external) {
        showToast?.('Opening subscription management in your browser…');
      }
    } catch (err) {
      showToast?.(err.message || 'Could not open billing portal');
    }
  });

  root.querySelector('#promoCodeForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = root.querySelector('#promoCodeInput');
    const applyBtn = root.querySelector('#promoCodeApplyBtn');
    const code = input?.value?.trim();
    if (!code) {
      showToast?.('Enter a promo code');
      return;
    }
    if (!profile?.loggedIn) {
      showToast?.('Sign in to redeem a promo code');
      onSignIn?.('signin');
      return;
    }
    const prevLabel = applyBtn?.textContent || 'Apply';
    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.textContent = 'Applying…';
    }
    try {
      const result = await validateAndRedeemVoucher(code);
      if (result.type === 'trial') {
        showToast?.('Promo applied — trial activated');
      } else if (result.type === 'topup') {
        const added = result.scansAdded || result.topupScans || 100;
        const total = result.displayBalance ?? (getSubScanBalance() || getTopUpBalance());
        showToast?.(`Success! +${added} scans added — ${total} scans now available`);
      } else {
        showToast?.(`Promo applied — ${ELIGIBILITY_DISCOUNT_PERCENT}% off prices`);
      }
      if (input) input.value = '';
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Invalid promo code');
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.textContent = prevLabel;
      }
    }
  });

  bindDiscountEligibilityForms(root, { profile, onSave, onSignIn, showToast });

  root.querySelector('#syncBtn')?.addEventListener('click', async () => {
    try {
      const result = await fullSync();
      showToast?.(syncResultMessage(result));
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Sync failed');
    }
  });

  root.querySelector('#notifyToggle')?.addEventListener('change', async (e) => {
    try {
      if (e.target.checked) {
        await enableNotifications();
        const end = todayKey();
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 6);
        const weekMeals = await getMealsInRange(todayKey(weekStart), end);
        const todayMeals = await getMealsForDate(end);
        const cuisine = weekMeals.length && canAccessAiTips() ? await getCuisineTips(weekMeals) : null;
        const { runPersonalisedNotificationCheck } = await import('../services/notifications.js');
        await runPersonalisedNotificationCheck(weekMeals, todayMeals, cuisine);
        showToast?.('Notifications enabled with your current stats');
      } else {
        await disableNotifications();
        showToast?.('Notifications off');
      }
      onSave();
    } catch (err) {
      e.target.checked = false;
      showToast?.(err.message || 'Could not enable notifications');
    }
  });

  root.querySelector('#reminderTime')?.addEventListener('change', (e) => {
    const [h, m] = e.target.value.split(':').map(Number);
    saveNotifyPrefs({ reminderHour: h, reminderMinute: m });
    showToast?.('Reminder time saved');
  });

  root.querySelector('#creditExpiryToggle')?.addEventListener('change', (e) => {
    saveNotifyPrefs({ creditExpiryEnabled: e.target.checked });
    showToast?.('Credit expiry alerts updated');
  });
  root.querySelector('#creditTrialToggle')?.addEventListener('change', (e) => {
    saveNotifyPrefs({ creditTrialEnabled: e.target.checked });
    showToast?.('Trial alerts updated');
  });
  root.querySelector('#creditLowToggle')?.addEventListener('change', (e) => {
    saveNotifyPrefs({ creditLowEnabled: e.target.checked });
    showToast?.('Low balance alerts updated');
  });
}

function syncResultMessage({ pushed = 0, pulled = 0, failed = 0 } = {}) {
  if (pushed === 0 && pulled === 0 && failed === 0) {
    return 'Sync complete — everything up to date';
  }
  const parts = [];
  if (pushed > 0) parts.push(`${pushed} meal${pushed === 1 ? '' : 's'} backed up`);
  if (pulled > 0) parts.push(`${pulled} downloaded`);
  if (failed > 0) parts.push(`${failed} failed to upload`);
  return parts.join(' · ');
}

function notifyPreviewCard(label, msg) {
  return `
    <div class="notify-preview-wrap">
      <span class="notify-preview-label">${escapeHtml(label)}</span>
      <div class="notify-preview-phone">
        <div class="notify-preview-toast">
          <div class="notify-preview-app">
            <span class="notify-preview-icon">🥗</span>
            <span>${APP_NAME}</span>
            <span class="notify-preview-time">now</span>
          </div>
          <p class="notify-preview-title">${escapeHtml(msg.title)}</p>
          <p class="notify-preview-body">${escapeHtml(msg.body)}</p>
        </div>
      </div>
    </div>
  `;
}

function goalField(name, label, value) {
  return `
    <label class="field goal-limit-field">
      <span>${label}</span>
      <input type="number" name="${name}" value="${value}" min="0" step="1" inputmode="numeric"/>
    </label>
  `;
}

function goalMacroField(name, label, value, unit, accent) {
  return `
    <label class="goal-macro-card" style="--macro-accent:${accent}">
      <span class="goal-macro-label">${label}</span>
      <div class="goal-macro-input">
        <input type="number" name="${name}" value="${value}" min="0" step="1" inputmode="numeric" aria-label="${label}"/>
        <span>${unit}</span>
      </div>
    </label>
  `;
}

function planUsageMeterDetail(planId) {
  const b = getScanBudget(planId);
  if (isCreditSubscriptionPlan(planId)) {
    const balance = getSubScanBalance();
    const allowance = getSubScansAllowance();
    const topup = getTopUpBalance();
    if (balance > 0) {
      return {
        label: 'This billing period',
        value: `${balance}/${allowance} scans`,
        note: 'Cancel anytime',
      };
    }
    if (topup > 0) {
      return {
        label: 'Top-up credits',
        value: `${topup} remaining`,
        note: 'Subscription scans used · top-up credits never expire until used',
      };
    }
    return {
      label: 'This billing period',
      value: `0/${allowance} scans`,
      note: 'Cancel anytime',
    };
  }
  if (isUnlimitedPlan(planId)) {
    return {
      label: 'Today (fair use)',
      value: `${b.remaining}/${b.limit} scans`,
      note: 'Up to 33 scans per day · ~1,000/month fair use · cancel anytime',
    };
  }
  return {
    label: 'Today',
    value: `${b.dailyFreeRemaining ?? 0}/${getDailyFreeCap()} free · ${getTopUpBalance()} top-up credits`,
    note: 'Daily Free Scan resets at midnight (12:00 AM) · top-up credits never expire until used',
  };
}

function plansStatusCardHtml(currentPlan) {
  const meter = planUsageMeterDetail(currentPlan);
  const pct = usageMeterRemainingPercent(currentPlan);
  return `
    <div class="plans-status-card ${isSubscriptionPlan(currentPlan) && currentPlan !== 'free' ? 'plans-status-card--pro' : ''}">
      <div class="plans-status-card__head">
        <div>
          <p class="plans-status-card__label">Your allowance</p>
          <p class="plans-status-card__summary">${planSummaryHtml(currentPlan)}</p>
        </div>
        <div class="plans-status-card__stat">
          <span class="plans-status-card__stat-label">${escapeHtml(meter.label)}</span>
          <strong class="plans-status-card__stat-value">${escapeHtml(meter.value)}</strong>
        </div>
      </div>
      <div class="usage-meter-track" aria-hidden="true">
        <div class="usage-meter-fill" style="width:${pct}%"></div>
      </div>
      <p class="fine-print plans-status-card__note">${escapeHtml(meter.note)}</p>
    </div>
  `;
}

function subscriptionPlanCard(planId, currentPlan, profile, user) {
  const plan = PLANS[planId];
  if (!plan) return '';
  const isCurrent = currentPlan === planId;
  const hasSub = hasActivePaidSubscription(currentPlan);
  const changeDir = hasSub && !isCurrent ? comparePlanChange(currentPlan, planId) : null;
  const featured = planId === 'plus';
  const onNative = nativeAppUsesExternalWebBilling();
  const price = planPriceLabel(planId, profile, profile.email || user?.email || '', {
    annual: plan.billing === 'annual',
  });
  const bullets = plan.bullets || [];
  let btnLabel = 'Subscribe';
  let btnClass = 'btn-primary';
  let btnAttrs = '';

  if (isCurrent) {
    btnLabel = 'Current plan';
    btnClass = 'btn-ghost';
    btnAttrs = 'disabled';
  } else if (changeDir === 'downgrade') {
    btnLabel = onNative ? 'Change on web' : 'Change plan';
    btnClass = 'btn-ghost';
    btnAttrs = `data-change-plan="${planId}"${plan.billing === 'annual' ? ' data-annual="yes"' : ''}`;
  } else if (changeDir === 'upgrade') {
    btnLabel = onNative ? 'Upgrade on web' : 'Upgrade';
    btnClass = 'btn-primary';
    btnAttrs = `data-change-plan="${planId}"${plan.billing === 'annual' ? ' data-annual="yes"' : ''}`;
  } else if (changeDir === 'lateral') {
    btnLabel = onNative ? 'Switch on web' : 'Switch plan';
    btnClass = 'btn-ghost';
    btnAttrs = `data-change-plan="${planId}"${plan.billing === 'annual' ? ' data-annual="yes"' : ''}`;
  } else if (plan.billing === 'annual') {
    btnLabel = onNative ? 'Subscribe yearly on web' : 'Subscribe yearly';
    btnAttrs = `data-plan="${planId}" data-annual="yes"`;
  } else if (onNative) {
    btnLabel = 'Subscribe on web';
    btnAttrs = `data-plan="${planId}"`;
  } else {
    btnAttrs = `data-plan="${planId}"`;
  }

  return `
    <article class="plan-card ${featured && !isCurrent ? 'plan-card--featured' : ''} ${isCurrent ? 'plan-card--active' : ''}">
      ${featured && !isCurrent ? '<span class="plan-featured-tag">Most popular</span>' : ''}
      ${isCurrent ? '<span class="plan-featured-tag plan-featured-tag--current">Your plan</span>' : ''}
      <h3>${escapeHtml(plan.name)}</h3>
      <p class="plan-tagline">${escapeHtml(plan.tagline)}</p>
      <p class="plan-price">${price}</p>
      <ul class="plan-features-list plan-features-list--compact">
        ${bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
      </ul>
      <div class="plan-card__footer">
      ${profile.loggedIn ? `
        <button type="button" class="btn ${btnClass} plan-card__btn"
          ${btnAttrs}
          ${isCurrent ? 'disabled' : ''}>${btnLabel}</button>
      ` : `
        <button type="button" class="btn btn-ghost plan-card__btn plans-signin-sub">Create account</button>
      `}
      </div>
    </article>
  `;
}

function topUpPlanCard(currentPlan, profile, user, paygPack) {
  return `
    <article class="plan-card plan-card--topup plan-card--solo">
      <h3>${paygPack.name}</h3>
      <p class="plan-tagline">${paygPack.tagline}</p>
      <p class="plan-price">${scanPackPriceLabel(PAYG_PACK_ID, profile, profile.email || user?.email || '')}</p>
      <ul class="plan-features-list plan-features-list--compact">
        ${paygPack.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
        <li>${escapeHtml(topUpCreditUsageNote(currentPlan))}</li>
      </ul>
      <div class="plan-card__footer">
      ${profile.loggedIn ? `
        <button type="button" class="btn btn-primary plan-card__btn" data-pack="${PAYG_PACK_ID}">${nativeAppUsesExternalWebBilling() ? 'Top up on web' : 'Top up 100 credits'}</button>
      ` : `
        <button type="button" class="btn btn-ghost plan-card__btn plans-signin-sub">Create account</button>
      `}
      </div>
    </article>
  `;
}

function settingsTab(id, label, active) {
  const selected = active === id;
  return `<button type="button" role="tab" class="tab settings-tab ${selected ? 'active' : ''}" data-tab="${id}" id="settingsTab-${id}" aria-selected="${selected ? 'true' : 'false'}" aria-controls="settingsPanel-${id}">${label}</button>`;
}

function panelHidden(id, active) {
  return active !== id ? 'hidden' : '';
}

function offlineQueueBanner(summary = {}) {
  if (!summary.total) return '';
  const readyItem = (summary.items || []).find((item) => item.status === 'ready');
  if (summary.ready > 0 && readyItem) {
    const label = summary.ready === 1
      ? '1 meal photo analysed — finish logging when ready'
      : `${summary.ready} meal photos analysed — finish logging when ready`;
    return `
      <section class="offline-queue-banner offline-queue-banner--ready muted-card" aria-live="polite">
        <p>${escapeHtml(label)}</p>
        <button type="button" class="btn btn-primary btn-sm" data-offline-resume="${escapeAttr(readyItem.id)}">Review meal</button>
      </section>
    `;
  }
  const pendingLabel = summary.pending === 1
    ? '1 photo saved — will analyse when you\'re back online'
    : `${summary.pending} photos saved — will analyse when you're back online`;
  return `
    <section class="offline-queue-banner muted-card" aria-live="polite">
      <p>${escapeHtml(pendingLabel)}</p>
      <button type="button" class="btn btn-ghost btn-sm" id="offlineQueueRetry">Try now</button>
    </section>
  `;
}

function escapeAttr(s) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
