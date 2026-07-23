import { getGoals, formatEnergy, formatEnergyParts, getUnitPrefs, saveGoals, saveUnitPrefs, DEFAULT_GOALS } from '../services/goals.js';
import { getMealsForDate, getMealsInRange, sumNutrition, deleteMeal, todayKey, clearAllLocalMeals } from '../services/storage.js';
import { openMealEditorModal } from '../services/meal-editor.js';
import { topWeeklyInsight, weekReport } from '../services/reports.js';
import { getUser, signIn, signUp, signOut, resetPassword, resendConfirmationEmail, updatePassword, isSupabaseConfigured } from '../services/auth.js';
import { getProfile, saveDisplayName, saveLocalDisplayName, getLocalDisplayName, saveDiscountPrefs, saveVoucherRedemption } from '../services/profile.js';
import { finalizeAuthSession } from '../services/auth-session.js';
import { fullSync } from '../services/sync.js';
import { getCuisineTips } from '../services/cuisine-tips.js';
import { buildWeeklyPushMessage, buildDailyPushMessage } from '../services/push-messages.js';
import {
  getNotifyPrefs,
  enableNotifications,
  disableNotifications,
  isNotificationSupported,
  saveNotifyPrefs,
} from '../services/notifications.js';
import {
  getPlan,
  planLabel,
  scansLabel,
  startPlanCheckout,
  setPlan,
  planPriceLabel,
  isPro,
  startTopUpCheckout,
  openBillingPortal,
  topUpPriceLabel,
  usageMeterRemainingPercent,
  getTopUpBalance,
  getScanBudget,
} from '../services/subscription.js';
import { PLANS, TOPUP_PACK, MAX_TOPUP_CARRY } from '../services/plans.js';
import { getDiscountEligibility, getDiscountSections, validateWorkEmailForDiscount } from '../services/discount.js';
import { validateAndRedeemVoucher } from '../services/voucher.js';
import { isTrialActive, trialPlanLabel, formatTrialUntil } from '../services/trial.js';
import { activityOptions, estimateDailyCalories, suggestMacros } from '../services/calorie-wizard.js';
import { openOnboardingWizard } from '../services/onboarding-wizard.js';
import { exportUserDataJson, exportMealsCsv } from '../services/data-export.js';
import { friendlyAuthError } from '../services/auth-errors.js';
import { openLegalModal } from './legal.js';
import { DISCLAIMERS, disclaimerBlock } from '../services/disclaimers.js';
import { deleteMyAccount } from '../services/account-delete.js';
import {
  signupConsentFieldsHtml,
  bindLegalLinks,
  readSignupConsent,
  signupConsentError,
  recordTermsAcceptance,
} from '../services/privacy-consent.js';

const wizardActivities = activityOptions();
let activeSettingsTab = 'targets';
let openDiscountSection = false;
let passwordResetMode = false;

/** Jump to a specific Goals tab (e.g. plans for NHS discount CTA). */
export function setSettingsTab(tab, { openDiscount = false } = {}) {
  if (['targets', 'account', 'plans', 'alerts'].includes(tab)) {
    activeSettingsTab = tab;
  }
  openDiscountSection = Boolean(openDiscount);
}

/** Show the set-new-password form (after email reset link). */
export function setPasswordResetMode(on = true) {
  passwordResetMode = Boolean(on);
}

export async function renderToday(root, { onLog, onRefresh, onReports, onSettings, profile, onSignIn }) {
  const dateKey = todayKey();
  const meals = await getMealsForDate(dateKey);
  const totals = sumNutrition(meals);
  const goals = getGoals();
  const prefs = getUnitPrefs();
  const calPct = goals.calories_kcal ? Math.min(100, (totals.calories_kcal / goals.calories_kcal) * 100) : 0;
  const calLeftKcal = Math.max(0, (goals.calories_kcal || 0) - totals.calories_kcal);
  const eaten = formatEnergyParts(totals.calories_kcal, prefs);
  const left = formatEnergyParts(calLeftKcal, prefs);
  const discount = getDiscountEligibility(profile || {}, profile?.email || '');
  const showDiscountHero = !isPro() && !discount.eligible;
  const scanBudget = getScanBudget();

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekMeals = await getMealsInRange(weekStart.toISOString().slice(0, 10), dateKey);
  const weeklyTip = topWeeklyInsight(weekMeals);
  const cuisine = weekMeals.length ? await getCuisineTips(weekMeals) : { tips: [] };

  root.innerHTML = `
    ${showDiscountHero ? `
    <section class="discount-hero discount-hero--compact" aria-label="Discount offers">
      <div class="discount-hero__inner">
        <p class="discount-hero__line">
          <strong>30% off</strong> · NHS, 60+, or promo
          <span class="discount-hero__price">£${PLANS.daily10.priceDiscount.toFixed(2)}–£${PLANS.daily25.priceDiscount.toFixed(2)}/mo</span>
        </p>
        <button type="button" class="btn btn-primary btn-sm discount-hero__cta" id="discountHeroBtn">See offers →</button>
      </div>
      <p class="discount-hero__legal">Separate paths for NHS/public sector, 60+, and promo codes. Not affiliated with the NHS.</p>
    </section>
    ` : ''}

    ${!profile?.loggedIn ? `
      <section class="guest-prompt card" aria-label="Create your account">
        <p class="guest-prompt__lead">Free account · cloud backup · AI meal photos</p>
        <div class="guest-prompt__actions">
          <button type="button" class="btn btn-primary" id="guestGetStarted">Get started free</button>
          <button type="button" class="btn btn-ghost" id="guestSignIn">Sign in</button>
        </div>
        <p class="guest-prompt__note">${isSupabaseConfigured() ? 'Packaged food logging (barcode and product search) works without signing in.' : 'If sign-in fails, refresh after the latest app update.'}</p>
      </section>
    ` : ''}

    <section class="home-hero" aria-label="NutriLog">
      <p class="home-hero__steps">Snap · Analyse · Track</p>
      <p class="home-hero__tagline">Eat smarter — it's that easy.</p>
    </section>

    <section class="card hero-card">
      <div class="ring-wrap">
        <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
          <circle class="ring-bg" cx="60" cy="60" r="52"/>
          <circle class="ring-fg" cx="60" cy="60" r="52" style="stroke-dashoffset:${328 - (328 * calPct) / 100}"/>
        </svg>
        <div class="ring-label">
          <span class="ring-value">${eaten.value}</span>
          <span class="ring-unit">${eaten.unit}</span>
          <span class="ring-goal">of ${formatEnergy(goals.calories_kcal, prefs)}</span>
          <span class="ring-left">${left.value} ${left.unit} left</span>
        </div>
      </div>
      <div class="macro-row">
        ${macroChip('Protein', totals.protein_g, goals.protein_g, 'g')}
        ${macroChip('Carbs', totals.carbs_g, goals.carbs_g, 'g')}
        ${macroChip('Fat', totals.fat_g, goals.fat_g, 'g')}
      </div>
      ${disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer health-disclaimer--inline')}
    </section>

    ${weeklyTip ? `
      <section class="insight-card low insight-card--compact" id="weeklyTip">
        <span class="insight-badge">↓ ${weeklyTip.label} ${weeklyTip.periodLabel || 'this week'}</span>
        <p>${escapeHtml(weeklyTip.message)}</p>
        ${weeklyTip.daysUnderTarget ? `<p class="insight-meta">${weeklyTip.daysUnderTarget} day(s) below target</p>` : ''}
        <button type="button" class="btn btn-ghost btn-sm" id="viewReportsBtn">View full report →</button>
        ${disclaimerBlock(DISCLAIMERS.goalInsights, 'fine-print health-disclaimer health-disclaimer--inline')}
      </section>
    ` : ''}

    ${cuisine.tips?.length ? `
      <section class="card tip-card">
        <h2 class="card-title">🍽️ Coach tip for your meals</h2>
        <article class="cuisine-tip">
          <span class="cuisine-tag">${escapeHtml(cuisine.tips[0].cuisine || 'Tip')}</span>
          <h3>${escapeHtml(cuisine.tips[0].title)}</h3>
          <p>${escapeHtml(cuisine.tips[0].body)}</p>
        </article>
        ${cuisine.tips.length > 1 ? `<button type="button" class="btn btn-ghost btn-sm full" id="moreTipsBtn">More tips in Reports →</button>` : ''}
        ${disclaimerBlock(DISCLAIMERS.aiCoach, 'fine-print health-disclaimer health-disclaimer--inline')}
      </section>
    ` : ''}

    <section class="pro-banner ${!scanBudget.allowed ? 'pro-banner--limit' : ''}">
      <div>
        <strong>${scansLabel()}</strong>
        <p>${planLabel()} · resets ${scanBudget.resetsOn}${!scanBudget.allowed ? ' · AI photos paused until reset or upgrade' : ''}</p>
      </div>
      ${getPlan() === 'free' ? `<button type="button" class="btn btn-primary btn-sm" id="todayUpgrade">${scanBudget.allowed ? 'Upgrade' : 'Get more scans'}</button>` : ''}
    </section>

    <section class="section">
      <div class="section-head">
        <h2>Today's meals</h2>
        <span class="badge">${meals.length} logged</span>
      </div>
      ${meals.length === 0 ? `
        <div class="empty-state">
          <p>No meals yet today.</p>
          <button type="button" class="btn btn-primary" id="emptyLogBtn">📷 Log your first meal</button>
        </div>
      ` : `
        <ul class="meal-list" id="mealList">
          ${meals.map((m) => mealCard(m, prefs)).join('')}
        </ul>
      `}
    </section>
  `;

  root.querySelector('#emptyLogBtn')?.addEventListener('click', onLog);
  root.querySelector('#discountHeroBtn')?.addEventListener('click', () => onSettings?.('plans', { openDiscount: true }));
  root.querySelector('#guestGetStarted')?.addEventListener('click', () => onSignIn?.('signup'));
  root.querySelector('#guestSignIn')?.addEventListener('click', () => onSignIn?.('signin'));
  root.querySelector('#todayUpgrade')?.addEventListener('click', () => onSettings?.('plans'));
  root.querySelector('#viewReportsBtn')?.addEventListener('click', () => onReports?.());
  root.querySelector('#moreTipsBtn')?.addEventListener('click', () => onReports?.());
  root.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (confirm('Remove this meal?')) {
        await deleteMeal(btn.dataset.delete);
        onRefresh();
      }
    });
  });
  root.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const meal = meals.find((m) => m.id === btn.dataset.edit);
      if (!meal) return;
      const updated = await openMealEditorModal(meal);
      if (updated) onRefresh();
    });
  });
}

function mealTypeLabel(type) {
  const map = { breakfast: '🌅 Breakfast', lunch: '☀️ Lunch', dinner: '🌙 Dinner', snack: '🍎 Snack' };
  return map[type] || '';
}

function macroChip(label, value, goal, unit) {
  const pct = goal ? Math.round((value / goal) * 100) : 0;
  return `
    <div class="macro-chip">
      <span class="macro-label">${label}</span>
      <span class="macro-value">${Math.round(value)}${unit}</span>
      <span class="macro-pct ${pct < 80 ? 'low' : ''}">${pct}%</span>
    </div>
  `;
}

function mealCard(meal, prefs = getUnitPrefs()) {
  const n = meal.total_nutrition || {};
  const type = mealTypeLabel(meal.meal_type);
  return `
    <li class="meal-card">
      ${meal.photoDataUrl ? `<img src="${meal.photoDataUrl}" alt="" class="meal-thumb"/>` : '<div class="meal-thumb meal-thumb--placeholder">🍽️</div>'}
      <div class="meal-body">
        <h3>${type ? `<span class="meal-type">${type}</span> ` : ''}${escapeHtml(meal.meal_summary || 'Meal')}</h3>
        <p class="meal-meta">${formatEnergy(meal.total_calories_kcal || 0, prefs)} · P ${Math.round(n.protein_g || 0)}g · C ${Math.round(n.carbs_g || 0)}g · F ${Math.round(n.fat_g || 0)}g</p>
        ${meal.meal_notes ? `<p class="meal-notes">${escapeHtml(meal.meal_notes)}</p>` : ''}
        ${meal.items?.length ? `<p class="meal-items">${meal.items.map((i) => escapeHtml(i.name)).join(', ')}</p>` : ''}
      </div>
      <div class="meal-actions">
        <button type="button" class="icon-btn icon-btn--edit" data-edit="${meal.id}" aria-label="Edit meal">✎</button>
        <button type="button" class="icon-btn" data-delete="${meal.id}" aria-label="Delete meal">✕</button>
      </div>
    </li>
  `;
}

export async function renderSettings(root, { onSave, onGoToday, showToast, profile: profileIn }) {
  const goals = getGoals();
  const prefs = getUnitPrefs();
  const notifyPrefs = getNotifyPrefs();
  const profile = profileIn || await getProfile();
  const user = profile.loggedIn ? await getUser() : null;
  const cloudReady = isSupabaseConfigured();
  const notifySupported = isNotificationSupported();
  const displayName = profile.displayName || '';

  const end = todayKey();
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const weekMeals = await getMealsInRange(weekStart.toISOString().slice(0, 10), end);
  const todayMeals = await getMealsForDate(end);
  const cuisine = weekMeals.length ? await getCuisineTips(weekMeals) : null;

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

  const discount = getDiscountEligibility(profile, profile.email || user?.email || '');
  const discountSections = getDiscountSections(profile, profile.email || user?.email || '');
  const trialActive = isTrialActive(profile);
  const currentPlan = getPlan();
  const initials = (displayName || user?.email || '?').charAt(0).toUpperCase();
  const showPasswordReset =
    passwordResetMode || new URLSearchParams(window.location.search).get('reset') === '1';

  root.innerHTML = `
    <div class="settings-screen">
      <header class="settings-header">
        <h2 class="settings-title">Goals &amp; settings</h2>
        <p class="settings-subtitle">Targets, account, plans, and alerts</p>
      </header>

      <nav class="settings-tabs tab-bar" aria-label="Settings sections">
        ${settingsTab('targets', '🎯 Targets', activeSettingsTab)}
        ${settingsTab('account', '👤 Account', activeSettingsTab)}
        ${settingsTab('plans', '⭐ Plans', activeSettingsTab)}
        ${settingsTab('alerts', '🔔 Alerts', activeSettingsTab)}
      </nav>

      <div class="settings-panels">
        <section class="settings-panel card" data-panel="targets" ${panelHidden('targets', activeSettingsTab)}>
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
                    <input type="number" id="wizAge" min="16" max="100" inputmode="numeric" placeholder="e.g. 35"/>
                  </label>
                  <label class="field">
                    <span>Weight (kg)</span>
                    <input type="number" id="wizWeight" min="30" max="300" step="0.1" inputmode="decimal" placeholder="e.g. 72"/>
                  </label>
                  <label class="field">
                    <span>Height (cm)</span>
                    <input type="number" id="wizHeight" min="120" max="230" inputmode="numeric" placeholder="e.g. 168"/>
                  </label>
                  <label class="field full">
                    <span>Activity</span>
                    <select id="wizActivity" class="settings-select full">
                      ${wizardActivities.map((a) => `<option value="${a.id}">${a.label}</option>`).join('')}
                    </select>
                  </label>
                  <label class="field full">
                    <span>Weight goal</span>
                    <select id="wizGoal" class="settings-select full">
                      <option value="lose">Lose weight (~500 kcal below maintenance)</option>
                      <option value="maintain" selected>Maintain weight</option>
                      <option value="gain">Gain weight (~275 kcal above maintenance)</option>
                    </select>
                  </label>
                </div>
                <button type="button" class="btn btn-ghost full" id="applyCalorieEstimate">Calculate &amp; apply to targets</button>
                <p class="fine-print" id="calorieEstimateResult" hidden></p>
              </div>
            </details>

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
            <div class="goal-limits-grid">
              ${goalField('fibre_g', 'Fibre min (g)', goals.fibre_g)}
              ${goalField('sugar_g', 'Sugar max (g)', goals.sugar_g)}
              ${goalField('salt_mg', 'Salt max (mg)', goals.salt_mg)}
            </div>

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
        </section>

        <section class="settings-panel card" data-panel="account" ${panelHidden('account', activeSettingsTab)}>
          <div class="account-card">
            <div class="account-avatar" aria-hidden="true">${escapeHtml(initials)}</div>
            <div class="account-card-body">
              <strong>${escapeHtml(displayName || (user ? 'Your account' : 'Guest'))}</strong>
              <span>${user ? escapeHtml(user.email) : 'Sign in to back up meals &amp; use AI photo logging'}</span>
              ${user ? `<span class="plan-pill plan-pill--inline">${planLabel()} · ${scansLabel()}</span>` : ''}
            </div>
          </div>

          ${!cloudReady ? `
            <p class="card-desc">Cloud login is not configured on this site build. Contact support if this persists after an update.</p>
          ` : user ? `
            ${showPasswordReset ? `
              <p class="settings-group-label">Set new password</p>
              <p class="fine-print">Choose a new password for your account.</p>
              <form id="newPasswordForm" class="auth-form settings-form-compact">
                <label class="field full">
                  <span>New password</span>
                  <input type="password" name="password" id="newPasswordInput" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters"/>
                </label>
                <button type="submit" class="btn btn-primary full">Save new password</button>
              </form>
            ` : ''}
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
            <p class="fine-print">Free to start. Your meals sync securely to the cloud when signed in.</p>
            <form id="authForm" class="auth-form settings-form-compact" novalidate>
              <label class="field full">
                <span>First name</span>
                <input type="text" name="display_name" id="authFirstName" maxlength="40" autocomplete="given-name" placeholder="e.g. Sarah" value="${escapeHtml(displayName)}"/>
              </label>
              <label class="field full">
                <span>Email</span>
                <input type="email" name="email" id="authEmail" required autocomplete="email" inputmode="email" placeholder="you@email.com"/>
              </label>
              <label class="field full">
                <span>Password</span>
                <input type="password" name="password" id="authPassword" required minlength="6" autocomplete="current-password" placeholder="At least 6 characters"/>
              </label>
              ${signupConsentFieldsHtml({ idPrefix: 'settingsAuth' })}
              <p class="auth-status" id="authStatus" hidden role="status"></p>
              <div class="settings-auth-actions">
                <button type="button" class="btn btn-primary" id="signUpBtn">Create account</button>
                <button type="button" class="btn btn-ghost" id="signInBtn">Sign in</button>
              </div>
              <button type="button" class="btn btn-ghost btn-sm full" id="forgotPasswordBtn">Forgot password?</button>
              <button type="button" class="btn btn-ghost btn-sm full" id="resendConfirmBtn" hidden>Resend confirmation email</button>
            </form>
          `}

          <p class="settings-group-label">Privacy &amp; data</p>
          <div class="settings-list settings-list--stack">
            <button type="button" class="btn btn-ghost full" id="exportJsonBtn">Download my data (JSON)</button>
            <button type="button" class="btn btn-ghost full" id="exportCsvBtn">Download meals (CSV)</button>
            <button type="button" class="btn btn-ghost full" id="privacyBtn">Privacy policy</button>
            <button type="button" class="btn btn-ghost full" id="termsBtn">Terms of use</button>
          </div>
        </section>

        <section class="settings-panel card ${currentPlan !== 'free' ? 'muted-card' : 'pro-card'}" data-panel="plans" ${panelHidden('plans', activeSettingsTab)}>
          <div class="settings-panel-head">
            <h3 class="settings-panel-title">Meal log plans</h3>
            <span class="settings-badge">${trialActive ? `${planLabel()} trial` : currentPlan === 'free' ? 'Free · 1/day' : planLabel()}</span>
          </div>
          ${currentPlan === 'free' ? `
            <p class="card-desc">Free includes <strong>1 AI meal log per day</strong>, resetting at midnight (12am) on your phone. Paid plans use a flexible monthly allowance.</p>
          ` : `
            <p class="card-desc">Monthly allowance — use flexibly across the month. Subscription allowance resets on the 1st; purchased top-ups carry over (up to ${MAX_TOPUP_CARRY}). Manage or cancel anytime in Billing &amp; subscription below.</p>
          `}

          <div class="usage-meter-wrap">
            <div class="usage-meter-head">
              <span>${currentPlan === 'free' ? 'Today' : 'This month'}</span>
              <span>${getScanBudget().remaining}/${getScanBudget().limit} available</span>
            </div>
            <div class="usage-meter-track" aria-hidden="true">
              <div class="usage-meter-fill" style="width:${usageMeterRemainingPercent()}%"></div>
            </div>
            ${getTopUpBalance() > 0 && currentPlan !== 'free' ? `<p class="fine-print">+${getTopUpBalance()} bonus logs carried from top-ups</p>` : ''}
            ${currentPlan === 'free' ? `<p class="fine-print">Resets every day at midnight (12am)</p>` : ''}
          </div>

          ${openDiscountSection ? `
            <p class="discount-claim-hint" id="discountClaimHint">
              ${discount.eligible
                ? '✓ Your discount is active — choose a plan below, or update details in Ways to save.'
                : '👇 Pick NHS/public sector, 60+, or a promo code below to unlock 30% off'}
            </p>
          ` : ''}
          ${discount.label ? `<p class="settings-discount-banner">✓ ${escapeHtml(discount.label)} — 30% off paid plans</p>` : ''}

          <div class="plan-grid plan-grid--settings">
            <article class="plan-card ${currentPlan === 'daily10' ? 'plan-card--active' : ''}">
              <h3>${PLANS.daily10.name}</h3>
              <p class="plan-tagline">${PLANS.daily10.tagline}</p>
              <p class="plan-price">${planPriceLabel('daily10', profile, profile.email)}</p>
              <ul class="plan-features-list">
                <li>300 meal logs per month</li>
                <li>Cloud backup</li>
              </ul>
              ${currentPlan !== 'daily10' ? `<button type="button" class="btn btn-primary full" data-plan="daily10">Choose Standard</button>` : '<p class="plan-current-tag">Current plan</p>'}
            </article>
            <article class="plan-card plan-card--featured ${currentPlan === 'daily25' ? 'plan-card--active' : ''}">
              <span class="plan-featured-tag">Most popular</span>
              <h3>${PLANS.daily25.name}</h3>
              <p class="plan-tagline">${PLANS.daily25.tagline}</p>
              <p class="plan-price">${planPriceLabel('daily25', profile, profile.email)}</p>
              <ul class="plan-features-list">
                <li>750 meal logs per month</li>
                <li>Cloud backup</li>
              </ul>
              ${currentPlan !== 'daily25' ? `<button type="button" class="btn btn-primary full" data-plan="daily25">Choose Plus</button>` : '<p class="plan-current-tag">Current plan</p>'}
            </article>
          </div>

          <div class="topup-card">
            <div class="topup-card-head">
              <h4>Need more this month?</h4>
              <p>Add <strong>${TOPUP_PACK.scans} meal logs</strong> — ${topUpPriceLabel(profile, profile.email || user?.email || '')} one-time</p>
            </div>
            <p class="fine-print">${currentPlan === 'free' ? 'Top-ups apply to paid plans. Upgrade first, then add extra logs if needed.' : `Top-up logs roll over month to month (max ${MAX_TOPUP_CARRY} stored). Used after your monthly allowance.`}</p>
            <button type="button" class="btn btn-ghost full" id="topUpBtn" ${currentPlan === 'free' ? 'disabled' : ''}>Buy +${TOPUP_PACK.scans} meal logs</button>
          </div>

          ${profile.loggedIn ? `
            <div class="manage-sub-card manage-sub-card--billing ${trialActive ? 'manage-sub-card--active' : currentPlan === 'free' ? 'manage-sub-card--free' : 'manage-sub-card--active'}">
              <div class="manage-sub-card-head">
                <div class="billing-status-row">
                  <h4>Billing &amp; subscription</h4>
                  <span class="billing-status-pill ${trialActive ? 'billing-status-pill--active' : currentPlan === 'free' ? 'billing-status-pill--free' : 'billing-status-pill--active'}">${trialActive ? 'Free trial' : currentPlan === 'free' ? 'Free plan' : planLabel()}</span>
                </div>
                ${trialActive ? `
                  <p class="billing-status-summary">Free trial active</p>
                  <p>You're on a complimentary ${planLabel()} trial until ${formatTrialUntil(profile.trial_until)} — no card required. Subscribe above before it ends to keep your monthly allowance.</p>
                  <p class="fine-print">When the trial ends, you'll return to the free plan (1 meal log per day) unless you subscribe.</p>
                ` : currentPlan === 'free' ? `
                  <p class="billing-status-summary">No active subscription</p>
                  <p>You're on the free tier — 1 AI meal log per day. Subscribe to Standard or Plus above and this section becomes your billing hub: update payment, switch plan, or cancel anytime through Stripe's secure portal.</p>
                  <p class="fine-print">If you cancel a paid plan, you keep access until the end of your billing period, then return to the free plan automatically.</p>
                  <button type="button" class="btn btn-primary full" id="billingViewPlansBtn">Compare paid plans</button>
                ` : `
                  <p class="billing-status-summary">Active subscription</p>
                  <p>Cancel or change your plan anytime — no emails or phone calls needed.</p>
                  <p class="fine-print">Opens Stripe's secure billing page. Your plan stays active until the end of the current billing period if you cancel.</p>
                  <button type="button" class="btn btn-ghost full" id="manageSubBtn">Cancel or change plan</button>
                `}
              </div>
            </div>
          ` : `
            <div class="manage-sub-card manage-sub-card--billing manage-sub-card--guest">
              <div class="manage-sub-card-head">
                <div class="billing-status-row">
                  <h4>Billing &amp; subscription</h4>
                  <span class="billing-status-pill billing-status-pill--guest">Sign in required</span>
                </div>
                <p>Sign in to view your plan status, receipts, and subscription settings.</p>
                <p class="fine-print">Paid subscribers can cancel or change plan here — self-serve, no support ticket needed.</p>
                <button type="button" class="btn btn-ghost full" id="billingSignInBtn">Go to Account</button>
              </div>
            </div>
          `}

          <div class="discount-sections" id="discountSection">
            <h4 class="discount-sections__title">Ways to save</h4>
            <p class="fine-print discount-sections__lead">NHS/public sector, 60+, and promo codes are separate paths — run offers without mixing them up.</p>

            <article class="discount-card ${discountSections.publicSector.active ? 'discount-card--active' : ''}" id="publicSectorSection">
              <div class="discount-card__head">
                <h5>${discountSections.publicSector.title}</h5>
                ${discountSections.publicSector.active ? '<span class="discount-card__badge">Active</span>' : ''}
              </div>
              <p class="fine-print">${discountSections.publicSector.blurb}</p>
              ${discountSections.publicSector.active ? `
                <p class="settings-discount-banner">✓ Verified — 30% off Standard &amp; Plus</p>
              ` : `
                <form id="publicSectorForm" class="auth-form settings-form-compact">
                  <label class="field full">
                    <span>Work email</span>
                    <input type="email" name="work_email" value="${escapeHtml(profile.discount_work_email || '')}" placeholder="you@nhs.net" inputmode="email" required/>
                  </label>
                  <label class="toggle-row settings-toggle">
                    <span>I confirm this is my current public-sector work email</span>
                    <input type="checkbox" name="consent" required/>
                  </label>
                  <button type="submit" class="btn btn-ghost full">Verify &amp; save</button>
                </form>
              `}
            </article>

            <article class="discount-card ${discountSections.senior.active ? 'discount-card--active' : ''}" id="seniorSection">
              <div class="discount-card__head">
                <h5>${discountSections.senior.title}</h5>
                ${discountSections.senior.active ? '<span class="discount-card__badge">Active</span>' : ''}
              </div>
              <p class="fine-print">${discountSections.senior.blurb}</p>
              ${discountSections.senior.active ? `
                <p class="settings-discount-banner">✓ Age discount active — 30% off Standard &amp; Plus</p>
              ` : `
                <form id="seniorForm" class="auth-form settings-form-compact">
                  <label class="toggle-row settings-toggle">
                    <span>I am 60 years of age or over</span>
                    <input type="checkbox" name="senior" required/>
                  </label>
                  <label class="toggle-row settings-toggle">
                    <span>I confirm this declaration is accurate</span>
                    <input type="checkbox" name="consent" required/>
                  </label>
                  <button type="submit" class="btn btn-ghost full">Confirm &amp; save</button>
                </form>
              `}
            </article>

            <article class="discount-card ${discountSections.voucher.active ? 'discount-card--active' : ''}" id="voucherSection">
              <div class="discount-card__head">
                <h5>${discountSections.voucher.title}</h5>
                ${discountSections.voucher.active ? '<span class="discount-card__badge">Applied</span>' : ''}
              </div>
              <p class="fine-print">${discountSections.voucher.blurb}</p>
              ${discountSections.voucher.trialActive ? `
                <p class="settings-discount-banner">✓ ${escapeHtml(trialPlanLabel(profile))} — no card required</p>
              ` : discountSections.voucher.active ? `
                <p class="settings-discount-banner">✓ Promo code applied — 30% off (valid 1 year)</p>
              ` : `
                <form id="voucherForm" class="auth-form voucher-form settings-form-compact">
                  <label class="field full">
                    <span>Promo code</span>
                    <input type="text" name="code" placeholder="NUTRIPROMO or TRIAL7" autocapitalize="characters" autocomplete="off" required/>
                  </label>
                  <button type="submit" class="btn btn-primary full">Apply promo code</button>
                </form>
              `}
            </article>
          </div>
        </section>

        <section class="settings-panel card" data-panel="alerts" ${panelHidden('alerts', activeSettingsTab)}>
          <h3 class="settings-panel-title">Notifications</h3>
          ${!notifySupported ? `
            <p class="card-desc">Notifications are not supported in this browser.</p>
          ` : `
            <p class="card-desc">Reminders when you open NutriLog, plus push alerts when your browser allows them.</p>
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
            <p class="fine-print">Daily reminders run when the app is open. Background push needs permission and a supported browser.</p>

            <details class="settings-details">
              <summary>Preview what notifications look like</summary>
              <div class="settings-details-body">
                <p class="fine-print">Based on ${previewNote}.</p>
                ${notifyPreviewCard('Weekly digest (Monday)', weeklyPreview)}
                ${notifyPreviewCard('Daily reminder', dailyPreview)}
              </div>
            </details>
          `}
        </section>
      </div>
    </div>
  `;

  root.querySelectorAll('.settings-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeSettingsTab = btn.dataset.tab;
      openDiscountSection = false;
      root.querySelectorAll('.settings-tab').forEach((b) => {
        b.classList.toggle('active', b.dataset.tab === activeSettingsTab);
      });
      root.querySelectorAll('.settings-panel').forEach((panel) => {
        panel.hidden = panel.dataset.panel !== activeSettingsTab;
      });
    });
  });

  const focusDiscount = openDiscountSection;
  openDiscountSection = false;

  if (focusDiscount) {
    requestAnimationFrame(() => {
      root.querySelector('#discountSection')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const input = root.querySelector('#discountSection input[name="code"], #discountSection input[name="work_email"]');
      if (input && !discount.eligible) {
        setTimeout(() => input.focus({ preventScroll: true }), 400);
      }
    });
  }

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
      saveUnitPrefs({ energy: fd.get('energy') });
      try {
        const { syncGoalsToCloud } = await import('../services/sync.js');
        await syncGoalsToCloud();
      } catch (_) {}
      showToast?.('Goals saved');
      onSave();
      onGoToday?.();
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'Save goals';
      }
    }
  });

  root.querySelector('#resetGoals')?.addEventListener('click', () => {
    saveGoals(DEFAULT_GOALS);
    showToast?.('Goals reset to defaults');
    onSave();
  });

  root.querySelector('#runOnboardingWizard')?.addEventListener('click', async () => {
    await openOnboardingWizard({ onComplete: () => onSave() });
  });

  root.querySelector('#applyCalorieEstimate')?.addEventListener('click', () => {
    const form = root.querySelector('#goalsForm');
    const resultEl = root.querySelector('#calorieEstimateResult');
    try {
      const estimate = estimateDailyCalories({
        sex: root.querySelector('#wizSex')?.value,
        age: root.querySelector('#wizAge')?.value,
        weightKg: root.querySelector('#wizWeight')?.value,
        heightCm: root.querySelector('#wizHeight')?.value,
        activity: root.querySelector('#wizActivity')?.value,
        weightGoal: root.querySelector('#wizGoal')?.value,
      });
      const macros = suggestMacros(estimate.target, root.querySelector('#wizWeight')?.value);
      form.querySelector('[name="calories_kcal"]').value = estimate.target;
      form.querySelector('[name="protein_g"]').value = macros.protein_g;
      form.querySelector('[name="carbs_g"]').value = macros.carbs_g;
      form.querySelector('[name="fat_g"]').value = macros.fat_g;
      if (resultEl) {
        resultEl.hidden = false;
        resultEl.textContent = `Estimated maintenance ~${estimate.tdee} kcal/day → target ${estimate.target} kcal. Review and tap Save goals.`;
      }
      showToast?.('Estimate applied — review and save');
    } catch (err) {
      showToast?.(err.message || 'Could not estimate');
    }
  });

  root.querySelector('#exportJsonBtn')?.addEventListener('click', async () => {
    try {
      await exportUserDataJson(profile);
      showToast?.('Data export downloaded');
    } catch (err) {
      showToast?.(err.message || 'Export failed');
    }
  });

  root.querySelector('#exportCsvBtn')?.addEventListener('click', async () => {
    try {
      const count = await exportMealsCsv(profile);
      showToast?.(count ? `Exported ${count} meals` : 'No meals to export yet');
    } catch (err) {
      showToast?.(err.message || 'Export failed');
    }
  });

  root.querySelector('#privacyBtn')?.addEventListener('click', () => openLegalModal('privacy'));
  root.querySelector('#termsBtn')?.addEventListener('click', () => openLegalModal('terms'));
  bindLegalLinks(root.querySelector('#authForm'));

  function readAuthForm() {
    const form = root.querySelector('#authForm');
    if (!form) return null;
    const fd = new FormData(form);
    return {
      firstName: String(fd.get('display_name') || '').trim(),
      email: String(fd.get('email') || '').trim(),
      password: String(fd.get('password') || ''),
    };
  }

  function setAuthStatus(message, { showResend = false, tone = 'info' } = {}) {
    const el = root.querySelector('#authStatus');
    const resendBtn = root.querySelector('#resendConfirmBtn');
    if (!el) return;
    el.classList.remove('auth-status--error', 'auth-status--success');
    if (tone === 'error') el.classList.add('auth-status--error');
    if (tone === 'success') el.classList.add('auth-status--success');
    if (message) {
      el.textContent = message;
      el.hidden = false;
    } else {
      el.textContent = '';
      el.hidden = true;
    }
    if (resendBtn) resendBtn.hidden = !showResend;
  }

  function setAuthBusy(busy) {
    ['#signUpBtn', '#signInBtn', '#forgotPasswordBtn', '#resendConfirmBtn'].forEach((sel) => {
      const btn = root.querySelector(sel);
      if (btn) btn.disabled = busy;
    });
  }

  async function finishSignedIn(firstName) {
    const result = await finalizeAuthSession(firstName);
    if (!result.ok) {
      throw new Error('Sign in did not complete — please try again');
    }
    const name = firstName || profile.displayName || getLocalDisplayName();
    if (result.syncFailed) {
      setAuthStatus('Signed in — your data will sync shortly.', { tone: 'success' });
      showToast?.('Signed in — your data will sync shortly');
    } else {
      showToast?.(name ? `Welcome, ${name}!` : 'Signed in');
    }
    onSave();
  }

  root.querySelector('#authForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    root.querySelector('#signInBtn')?.click();
  });

  root.querySelector('#signInBtn')?.addEventListener('click', async () => {
    const { firstName, email, password } = readAuthForm() || {};
    if (!email || !password) {
      setAuthStatus('Enter your email and password.', { tone: 'error' });
      return;
    }
    setAuthBusy(true);
    setAuthStatus('Signing in…');
    try {
      await signIn(email, password);
      await finishSignedIn(firstName);
      setAuthStatus('');
    } catch (err) {
      const msg = friendlyAuthError(err.message) || 'Sign in failed';
      setAuthStatus(msg, { tone: 'error', showResend: /confirm your email/i.test(msg) });
      showToast?.(msg, 5000);
    } finally {
      setAuthBusy(false);
    }
  });

  root.querySelector('#signUpBtn')?.addEventListener('click', async () => {
    const form = root.querySelector('#authForm');
    const { firstName, email, password } = readAuthForm() || {};
    const consent = readSignupConsent(form);
    if (!firstName) {
      setAuthStatus('Please enter your first name.', { tone: 'error' });
      root.querySelector('#authFirstName')?.focus();
      return;
    }
    if (!email || !password) {
      setAuthStatus('Enter email and password (6+ characters).', { tone: 'error' });
      return;
    }
    if (password.length < 6) {
      setAuthStatus('Password must be at least 6 characters.', { tone: 'error' });
      return;
    }
    if (!consent.ok) {
      setAuthStatus(signupConsentError(consent), { tone: 'error' });
      return;
    }
    setAuthBusy(true);
    setAuthStatus('Creating your account…');
    try {
      saveLocalDisplayName(firstName);
      const data = await signUp(email, password, firstName);
      await recordTermsAcceptance();
      if (data.session) {
        setAuthStatus('Account created!', { tone: 'success' });
        await finishSignedIn(firstName);
        return;
      }
      if (data.user) {
        const msg = 'Account created! Check your email to confirm, then tap Sign in. Check spam too.';
        setAuthStatus(msg, { tone: 'success', showResend: true });
        showToast?.(msg, 6000);
        return;
      }
      setAuthStatus('Account created — tap Sign in.', { tone: 'success' });
    } catch (err) {
      const msg = friendlyAuthError(err.message) || 'Could not create account';
      setAuthStatus(msg, { tone: 'error' });
      showToast?.(msg, 5000);
    } finally {
      setAuthBusy(false);
    }
  });

  root.querySelector('#resendConfirmBtn')?.addEventListener('click', async () => {
    const email = root.querySelector('#authEmail')?.value?.trim();
    if (!email) {
      setAuthStatus('Enter your email first.', { tone: 'error' });
      return;
    }
    setAuthBusy(true);
    setAuthStatus('Sending confirmation email…');
    try {
      await resendConfirmationEmail(email);
      const msg = 'Confirmation email sent — check inbox and spam.';
      setAuthStatus(msg, { tone: 'success', showResend: true });
      showToast?.(msg, 5000);
    } catch (err) {
      const msg = friendlyAuthError(err.message) || 'Could not resend email';
      setAuthStatus(msg, { tone: 'error' });
      showToast?.(msg, 5000);
    } finally {
      setAuthBusy(false);
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
      showToast?.('Password updated — you can sign in with your new password');
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
    if (!window.confirm('Sign out of your account?')) return;
    const clearLocal = window.confirm(
      'Remove meals stored on this device too?\n\nOK = clear local meals\nCancel = keep them for next sign-in'
    );
    await signOut();
    if (clearLocal) {
      await clearAllLocalMeals();
      showToast?.('Signed out — local meals cleared');
    } else {
      showToast?.('Signed out');
    }
    onSave();
  });

  root.querySelector('#deleteAccountBtn')?.addEventListener('click', async () => {
    if (!window.confirm(
      'Delete your NutriLog account permanently?\n\nThis removes your profile, cloud meals, photos, and cancels any active subscription.'
    )) return;
    const typed = window.prompt('Type DELETE to confirm account deletion');
    if (typed !== 'DELETE') {
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

  root.querySelector('#forgotPasswordBtn')?.addEventListener('click', async () => {
    const email = root.querySelector('#authEmail')?.value?.trim();
    if (!email) {
      setAuthStatus('Enter your email above, then tap Forgot password.', { tone: 'error' });
      root.querySelector('#authEmail')?.focus();
      return;
    }
    setAuthBusy(true);
    setAuthStatus('Sending reset email…');
    try {
      await resetPassword(email);
      const msg = 'Reset email sent — check inbox and spam.';
      setAuthStatus(msg, { tone: 'success' });
      showToast?.(msg, 5000);
    } catch (err) {
      const msg = friendlyAuthError(err.message) || 'Could not send reset email';
      setAuthStatus(msg, { tone: 'error' });
      showToast?.(msg, 5000);
    } finally {
      setAuthBusy(false);
    }
  });

  root.querySelector('#syncBtn')?.addEventListener('click', async () => {
    try {
      const result = await fullSync();
      if (result.plan) setPlan(result.plan);
      showToast?.(syncResultMessage(result));
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Sync failed');
    }
  });

  root.querySelectorAll('[data-plan]').forEach((btn) => {
    btn.addEventListener('click', () =>
      handleUpgrade(root, user?.email, showToast, btn.dataset.plan, discount.eligible, profile, onSave)
    );
  });

  root.querySelector('#topUpBtn')?.addEventListener('click', async () => {
    if (!profile?.loggedIn) {
      showToast?.('Sign in first — then you can buy top-ups');
      setSettingsTab('account');
      onSave();
      return;
    }
    try {
      const result = await startTopUpCheckout({ email: user?.email || profile.email || '', discount: discount.eligible });
      if (result.mock) {
        showToast?.(import.meta.env.DEV
          ? `+${TOPUP_PACK.scans} meal logs added (demo — add Stripe for real payments)`
          : `+${TOPUP_PACK.scans} meal logs added`);
        onSave();
      }
    } catch (err) {
      showToast?.(err.message || 'Could not start checkout');
    }
  });

  root.querySelector('#manageSubBtn')?.addEventListener('click', async () => {
    try {
      await openBillingPortal();
    } catch (err) {
      showToast?.(err.message || 'Could not open billing portal');
    }
  });

  root.querySelector('#billingViewPlansBtn')?.addEventListener('click', () => {
    root.querySelector('.plan-grid--settings')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  root.querySelector('#billingSignInBtn')?.addEventListener('click', () => {
    setSettingsTab('account');
    onSave();
  });

  root.querySelector('#voucherForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = new FormData(e.target).get('code');
    try {
      const result = await validateAndRedeemVoucher(code);
      if (result.type === 'trial') {
        if (result.trialPlan) setPlan(result.trialPlan);
        showToast?.(result.label ? `${result.label} started` : 'Free trial started');
      } else {
        await saveVoucherRedemption();
        showToast?.('Promo code applied — 30% off');
      }
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Invalid promo code');
    }
  });

  root.querySelector('#publicSectorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const check = validateWorkEmailForDiscount(fd.get('work_email'));
    if (!check.ok) {
      showToast?.(check.error);
      return;
    }
    try {
      await saveDiscountPrefs({ workEmail: check.email });
      showToast?.('NHS/public sector discount verified — 30% off');
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Could not save');
    }
  });

  root.querySelector('#seniorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    if (fd.get('senior') !== 'on') {
      showToast?.('Confirm you are 60 or over to continue');
      return;
    }
    try {
      await saveDiscountPrefs({ senior: true });
      showToast?.('60+ discount saved — 30% off');
      onSave();
    } catch (err) {
      showToast?.(err.message || 'Could not save');
    }
  });

  root.querySelector('#todayUpgrade')?.addEventListener('click', () => onSettings?.('plans'));

  root.querySelector('#notifyToggle')?.addEventListener('change', async (e) => {
    try {
      if (e.target.checked) {
        await enableNotifications();
        const end = todayKey();
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - 6);
        const weekMeals = await getMealsInRange(weekStart.toISOString().slice(0, 10), end);
        const todayMeals = await getMealsForDate(end);
        const cuisine = weekMeals.length ? await getCuisineTips(weekMeals) : null;
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
            <span>NutriLog</span>
            <span class="notify-preview-time">now</span>
          </div>
          <p class="notify-preview-title">${escapeHtml(msg.title)}</p>
          <p class="notify-preview-body">${escapeHtml(msg.body)}</p>
        </div>
      </div>
    </div>
  `;
}

async function handleUpgrade(root, email, showToast, planId = 'daily10', discount = false, profile = null, onSave) {
  if (!profile?.loggedIn) {
    showToast?.('Sign in first — then choose a plan below');
    setSettingsTab('account');
    onSave?.();
    return;
  }
  try {
    const data = await startPlanCheckout(planId, { email: email || profile.email || '', discount });
    if (data.mock) {
      setPlan(planId);
      showToast?.(import.meta.env.DEV
        ? `${PLANS[planId]?.name || planId} plan enabled (demo — add Stripe price IDs for real billing)`
        : `${PLANS[planId]?.name || planId} plan enabled`);
      root.dispatchEvent(new CustomEvent('refresh'));
    }
  } catch (err) {
    showToast?.(err.message || 'Could not start checkout');
  }
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

function settingsTab(id, label, active) {
  return `<button type="button" class="tab settings-tab ${active === id ? 'active' : ''}" data-tab="${id}">${label}</button>`;
}

function panelHidden(id, active) {
  return active !== id ? 'hidden' : '';
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
