import { formatEnergy, formatEnergyParts } from '../services/goals.js';
import {
  formatDayHeading,
  formatDayShort,
  shiftDateKey,
  weekComparisonLines,
  mealTypeBreakdown,
} from '../services/reports.js';
import { todayKey } from '../services/storage.js';
import { disclaimerBlock, DISCLAIMERS } from '../services/disclaimers.js';

import { minCalendarDateKey, maxPlanDateKey } from '../services/meal-calendar.js';
import { PLAN_AHEAD_PHASE1_ENABLED, dayDateNavPickHintPhase1 } from '../services/plan-ahead-phase1.js';

export function minViewDateKey() {
  return minCalendarDateKey();
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

function microChip(label, value, goal, unit, invertLow = false) {
  const pct = goal ? Math.round((value / goal) * 100) : 0;
  const lowClass = invertLow ? (pct > 115 ? 'low' : '') : (pct < 80 ? 'low' : '');
  const display = unit === 'mg' ? Math.round(value) : Math.round(value);
  return `
    <div class="macro-chip macro-chip--micro">
      <span class="macro-label">${label}</span>
      <span class="macro-value">${display}${unit}</span>
      <span class="macro-pct ${lowClass}">${pct}%</span>
    </div>
  `;
}

/** Date picker row for Today / day views */
export function dayDateNavHtml(dateKey, { showCalendarBtn = false } = {}) {
  const today = todayKey();
  const minDate = minViewDateKey();
  const maxDate = maxPlanDateKey();
  const canPrev = dateKey > minDate;
  const canNext = dateKey < maxDate;
  const heading = formatDayHeading(dateKey);
  return `
    <nav class="day-date-nav" aria-label="Choose day">
      <button type="button" class="day-date-nav__btn" id="dayNavPrev" ${canPrev ? '' : 'disabled'} aria-label="Previous day">←</button>
      <div class="day-date-nav__center">
        <button type="button" class="day-date-nav__label-btn" id="dayNavPickBtn" aria-label="Pick a date, ${escapeHtml(heading)}">
          <span class="day-date-nav__label">${escapeHtml(heading)}</span>
          <span class="day-date-nav__pick-hint">${PLAN_AHEAD_PHASE1_ENABLED
    ? dayDateNavPickHintPhase1({ showCalendarBtn })
    : (showCalendarBtn ? 'Pick any date' : 'Tap to pick date')}</span>
        </button>
        <input type="date" id="dayNavPick" class="day-date-nav__input" value="${dateKey}"
          min="${minDate}" max="${maxDate}" tabindex="-1" aria-hidden="true"/>
        ${dateKey !== today ? `<button type="button" class="link-btn day-date-nav__today" id="dayNavToday">Back to today</button>` : ''}
      </div>
      ${showCalendarBtn ? `
        <button type="button" class="day-date-nav__calendar-btn" id="dayNavCalendar" aria-label="${PLAN_AHEAD_PHASE1_ENABLED ? 'Open meal calendar — plan your week' : 'Open meal calendar'}" title="${PLAN_AHEAD_PHASE1_ENABLED ? 'Plan week — meal calendar' : 'Meal calendar'}">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
          </svg>
        </button>
      ` : ''}
      <button type="button" class="day-date-nav__btn" id="dayNavNext" ${canNext ? '' : 'disabled'} aria-label="Next day">→</button>
    </nav>
  `;
}

/** Subtle tip — log or plan meals for future dates */
export function planAheadHintHtml({ variant = 'today' } = {}) {
  const copy = variant === 'calendar'
    ? 'Tap any date, then <strong>Plan meal</strong>.'
    : 'Log meals for <strong>future dates</strong> — pick a day, then log as usual.';
  return `
    <aside class="plan-ahead-hint" aria-label="Plan meals ahead">
      <span class="plan-ahead-hint__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
        </svg>
      </span>
      <p class="plan-ahead-hint__text">${copy}</p>
    </aside>
  `;
}

/** Calorie ring + macros (+ micros on Plus+) */
export function dayDashboardHtml({
  dateKey,
  totals,
  goals,
  prefs,
  weekReport,
  showMicros = false,
  compactDisclaimer = true,
  wrapCard = true,
}) {
  const heading = formatDayHeading(dateKey);
  const calLabel = dateKey === todayKey() ? "Today's calories" : `${heading} calories`;
  const calPct = goals.calories_kcal ? Math.min(100, (totals.calories_kcal / goals.calories_kcal) * 100) : 0;
  const calLeftKcal = Math.max(0, (goals.calories_kcal || 0) - totals.calories_kcal);
  const eaten = formatEnergyParts(totals.calories_kcal, prefs);
  const left = formatEnergyParts(calLeftKcal, prefs);
  const comparisons = weekReport ? weekComparisonLines(totals, weekReport) : [];
  const dayWord = dateKey === todayKey() ? 'today' : 'this day';

  const inner = `
      <p class="hero-card__label">${escapeHtml(calLabel)}</p>
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
      ${showMicros ? `
        <div class="macro-row macro-row--micros">
          ${microChip('Fibre', totals.fibre_g, goals.fibre_g, 'g')}
          ${microChip('Sugar', totals.sugar_g, goals.sugar_g, 'g', true)}
          ${microChip('Salt', totals.salt_mg, goals.salt_mg, 'mg', true)}
        </div>
      ` : ''}
      ${comparisons.length ? `
        <div class="day-week-compare" aria-label="Comparison to 7-day average">
          ${comparisons.map((c) => `
            <p><strong>${escapeHtml(c.label)}:</strong> ${escapeHtml(c.today)} ${dayWord} · 7-day avg ${escapeHtml(c.avg)}</p>
          `).join('')}
        </div>
      ` : ''}
      ${compactDisclaimer ? disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer health-disclaimer--inline') : ''}
  `;

  if (!wrapCard) return inner;
  return `<section class="card hero-card hero-card--dashboard">${inner}</section>`;
}

export function mealTypeBreakdownHtml(meals, prefs) {
  const rows = mealTypeBreakdown(meals);
  if (!rows.length) return '';
  return `
    <div class="meal-type-row" aria-label="Calories by meal">
      ${rows.map((r) => `
        <span class="meal-type-pill">
          <span class="meal-type-pill__label">${escapeHtml(r.label)}</span>
          <span class="meal-type-pill__value">${formatEnergy(r.calories_kcal, prefs)}</span>
        </span>
      `).join('')}
    </div>
  `;
}

/** Inline day breakdown for Reports chart drill-down */
export function dayDetailPanelHtml({
  dateKey,
  meals,
  totals,
  goals,
  prefs,
  weekReport,
  showMicros,
  showOpenInToday = true,
}) {
  const heading = formatDayShort(dateKey);
  const dashboard = dayDashboardHtml({
    dateKey,
    totals,
    goals,
    prefs,
    weekReport,
    showMicros,
    compactDisclaimer: false,
    wrapCard: false,
  });
  const breakdown = mealTypeBreakdownHtml(meals, prefs);

  return `
    <section class="day-detail-panel card" aria-label="Day breakdown for ${escapeHtml(heading)}">
      <div class="day-detail-panel__head">
        <h2 class="card-title">${escapeHtml(heading)}</h2>
        <button type="button" class="icon-btn day-detail-panel__close" id="dayDetailClose" aria-label="Close day detail">×</button>
      </div>
      <div class="hero-card hero-card--dashboard day-detail-panel__dash">${dashboard}</div>
      ${breakdown}
      ${meals.length ? `
        <ul class="meal-list meal-list--compact">
          ${meals.map((m) => dayMealRow(m, prefs)).join('')}
        </ul>
      ` : `
        <p class="fine-print day-detail-panel__empty">No meals logged this day.</p>
      `}
      ${showOpenInToday ? `<button type="button" class="btn btn-ghost full" id="dayDetailOpenToday">Open in Today →</button>` : ''}
      ${disclaimerBlock(DISCLAIMERS.nutritionEstimate, 'fine-print health-disclaimer health-disclaimer--inline')}
    </section>
  `;
}

function dayMealRow(meal, prefs) {
  const n = meal.total_nutrition || {};
  const typeMap = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };
  const type = typeMap[meal.meal_type] || '';
  return `
    <li class="day-meal-row">
      <div>
        ${type ? `<span class="meal-type">${type}</span> ` : ''}
        <strong>${escapeHtml(meal.meal_summary || 'Meal')}</strong>
        <span class="day-meal-row__meta">${formatEnergy(meal.total_calories_kcal || 0, prefs)} · P ${Math.round(n.protein_g || 0)}g</span>
      </div>
    </li>
  `;
}

export function bindDayDateNav(root, { dateKey, onDateChange }) {
  root.querySelector('#dayNavPrev')?.addEventListener('click', () => {
    if (dateKey <= minViewDateKey()) return;
    onDateChange?.(shiftDateKey(dateKey, -1));
  });
  root.querySelector('#dayNavNext')?.addEventListener('click', () => {
    if (dateKey >= maxPlanDateKey()) return;
    onDateChange?.(shiftDateKey(dateKey, 1));
  });
  root.querySelector('#dayNavToday')?.addEventListener('click', () => {
    onDateChange?.(todayKey());
  });
  const pickInput = root.querySelector('#dayNavPick');
  const pickBtn = root.querySelector('#dayNavPickBtn');
  pickBtn?.addEventListener('click', () => {
    if (!pickInput) return;
    if (typeof pickInput.showPicker === 'function') {
      pickInput.showPicker();
    } else {
      pickInput.click();
    }
  });
  pickInput?.addEventListener('change', () => {
    const val = pickInput.value;
    if (!val || val === dateKey) return;
    const maxDate = maxPlanDateKey();
    const clamped = val > maxDate ? maxDate : val < minViewDateKey() ? minViewDateKey() : val;
    onDateChange?.(clamped);
  });
}

/** Teaser for fibre / sugar / salt on Free & Essential */
export function microsTeaserHtml() {
  return `
    <section class="micros-teaser muted-card" aria-label="Plus micro nutrients">
      <div class="micros-teaser__copy">
        <p class="micros-teaser__title">Fibre, sugar &amp; salt</p>
        <p class="micros-teaser__body">Track fibre, sugar and salt on Today and in reports — Plus plan.</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm micros-teaser__btn" id="microsTeaserPlans">View Plus</button>
    </section>
  `;
}

/** Teaser for weekly goal insights on Free plan */
export function weeklyInsightTeaserHtml() {
  return `
    <section class="micros-teaser muted-card" aria-label="Weekly insights preview">
      <div class="micros-teaser__copy">
        <p class="micros-teaser__title">Weekly goal insights</p>
        <p class="micros-teaser__body">See what's above or below your targets each week — Plus and Pro.</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm micros-teaser__btn" id="weeklyInsightTeaserPlans">View Plus</button>
    </section>
  `;
}

/** Teaser for goal insights on Essential (Reports) */
export function goalInsightsTeaserHtml() {
  return `
    <section class="micros-teaser muted-card" aria-label="Goal insights preview">
      <div class="micros-teaser__copy">
        <p class="micros-teaser__title">Goal insights &amp; suggestions</p>
        <p class="micros-teaser__body">Personalised tips when protein, fibre, sugar or calories drift from your targets — Plus and Pro.</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm micros-teaser__btn" id="reportsInsightsTeaserUpgrade">View Plus</button>
    </section>
  `;
}

/** Teaser for AI coach tips on Essential plan (Reports) */
export function aiCoachTeaserHtml() {
  return `
    <section class="micros-teaser muted-card" aria-label="AI coach preview">
      <div class="micros-teaser__copy">
        <p class="micros-teaser__title">AI cuisine coach</p>
        <p class="micros-teaser__body">Tips based on your meals and cuisine — Plus and Pro.</p>
      </div>
      <button type="button" class="btn btn-ghost btn-sm micros-teaser__btn" id="reportsAiTeaserUpgrade">View Plus</button>
    </section>
  `;
}

/** Compact logging consistency strip for Today */
export function consistencyStripHtml({ daysLoggedThisWeek = 0, currentStreak = 0 } = {}) {
  const parts = [];
  if (daysLoggedThisWeek > 0) {
    parts.push(`${daysLoggedThisWeek} day${daysLoggedThisWeek === 1 ? '' : 's'} logged this week`);
  }
  if (currentStreak >= 2) {
    parts.push(`${currentStreak}-day streak`);
  }
  if (!parts.length) return '';

  return `
    <section class="consistency-strip muted-card" aria-label="Logging consistency">
      <span class="consistency-strip__icon" aria-hidden="true">${currentStreak >= 2 ? '🔥' : '📅'}</span>
      <p class="consistency-strip__text">${escapeHtml(parts.join(' · '))}</p>
    </section>
  `;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}
