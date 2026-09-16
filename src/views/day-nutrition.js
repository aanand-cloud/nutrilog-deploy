import { formatEnergy, formatEnergyParts } from '../services/goals.js';
import {
  formatDayHeading,
  formatDayShort,
  parseDateKey,
  shiftDateKey,
  weekComparisonLines,
  mealTypeBreakdown,
} from '../services/reports.js';
import { todayKey } from '../services/storage.js';
import { disclaimerBlock, DISCLAIMERS } from '../services/disclaimers.js';

import { formatPlanDateLabel, minCalendarDateKey, maxPlanDateKey } from '../services/meal-calendar.js';

/** Seven visible days around the selected date, clamped to history → 3-week plan window. */
export function planWeekDateKeys(selectedKey) {
  const today = todayKey();
  const minDate = minCalendarDateKey();
  const maxDate = maxPlanDateKey();
  let start;
  if (selectedKey >= today && selectedKey <= shiftDateKey(today, 6)) {
    start = today;
  } else if (selectedKey > today) {
    start = shiftDateKey(selectedKey, -3);
    if (start < today) start = today;
    if (shiftDateKey(start, 6) > maxDate) start = shiftDateKey(maxDate, -6);
  } else {
    start = shiftDateKey(selectedKey, -3);
    if (shiftDateKey(start, 6) > today) start = shiftDateKey(today, -6);
  }
  if (start < minDate) start = minDate;
  const keys = [];
  for (let i = 0; i < 7; i += 1) {
    const key = shiftDateKey(start, i);
    if (key > maxDate) break;
    if (key >= minDate) keys.push(key);
  }
  return keys;
}

export function minViewDateKey() {
  return minCalendarDateKey();
}

function macroChip(label, value, goal, unit, tone = '') {
  const pct = goal ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  const toneClass = tone ? ` macro-chip--${tone}` : '';
  return `
    <div class="macro-chip${toneClass}">
      <span class="macro-label">${label}</span>
      <span class="macro-value">${Math.round(value)}<small>${unit}</small></span>
      <span class="macro-track" aria-hidden="true"><span class="macro-track__fill" style="width:${pct}%"></span></span>
      <span class="macro-pct ${pct < 80 ? 'low' : ''}">${pct}% of goal</span>
    </div>
  `;
}

function microChip(label, value, goal, unit, invertLow = false) {
  const pct = goal ? Math.min(160, Math.round((value / goal) * 100)) : 0;
  const barPct = Math.min(100, pct);
  const lowClass = invertLow ? (pct > 115 ? 'low' : '') : (pct < 80 ? 'low' : '');
  const display = unit === 'mg' ? Math.round(value) : Math.round(value);
  return `
    <div class="macro-chip macro-chip--micro">
      <span class="macro-label">${label}</span>
      <span class="macro-value">${display}<small>${unit}</small></span>
      <span class="macro-track" aria-hidden="true"><span class="macro-track__fill" style="width:${barPct}%"></span></span>
      <span class="macro-pct ${lowClass}">${pct}% of goal</span>
    </div>
  `;
}

/** Date picker + 3-week plan strip for Today / day views */
export function dayDateNavHtml(dateKey, {
  showCalendarBtn = false,
  mealCounts = {},
  emptyTomorrow = false,
} = {}) {
  const today = todayKey();
  const minDate = minViewDateKey();
  const maxDate = maxPlanDateKey();
  const canPrev = dateKey > minDate;
  const canNext = dateKey < maxDate;
  const heading = formatDayHeading(dateKey);
  const isToday = dateKey === today;
  const isFuture = dateKey > today;
  const mode = isToday ? 'today' : isFuture ? 'plan' : 'past';
  const eyebrow = isToday ? 'Today' : isFuture ? 'Planning' : 'Past day';
  const lead = isToday
    ? 'Plan up to 3 weeks ahead.'
    : isFuture
      ? 'Saves to this day, not today.'
      : 'You can still add a meal.';
  const maxLabel = formatPlanDateLabel(maxDate);
  const weekKeys = planWeekDateKeys(dateKey);
  const chips = weekKeys.map((key) => {
    const d = parseDateKey(key);
    const weekday = d.toLocaleDateString(undefined, { weekday: 'short' });
    const dayNum = String(d.getDate());
    const selected = key === dateKey;
    const isChipToday = key === today;
    const count = mealCounts[key] || 0;
    const chipMode = isChipToday ? 'today' : key > today ? 'plan' : 'past';
    return `
      <button type="button" class="today-plan__chip today-plan__chip--${chipMode}${selected ? ' is-selected' : ''}"
        data-plan-date="${key}" role="option" aria-selected="${selected ? 'true' : 'false'}"
        aria-label="${escapeHtml(formatDayHeading(key))}${count ? `, ${count} meal${count === 1 ? '' : 's'}` : ''}">
        <span class="today-plan__chip-day">${escapeHtml(weekday)}</span>
        <span class="today-plan__chip-num">${dayNum}</span>
        <span class="today-plan__chip-meta">${isChipToday ? 'Today' : count ? `${count}` : key > today ? 'Plan' : '·'}</span>
      </button>
    `;
  }).join('');

  return `
    <section class="today-plan today-plan--${mode}" aria-label="Choose day">
      <header class="today-plan__head">
        <div class="today-plan__copy">
          <p class="today-plan__eyebrow">${eyebrow}</p>
          <h2 class="today-plan__title">${escapeHtml(heading)}</h2>
          <p class="today-plan__lead">${lead}</p>
        </div>
        <div class="today-plan__tools">
          ${!isToday ? `<button type="button" class="btn btn-ghost btn-sm" id="dayNavToday">Back to today</button>` : ''}
          ${showCalendarBtn ? `
            <button type="button" class="today-plan__cal-btn" id="dayNavCalendar" aria-label="Open meal calendar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
              </svg>
              <span>Calendar</span>
            </button>
          ` : ''}
        </div>
      </header>
      <nav class="today-plan__nav" aria-label="Week">
        <button type="button" class="today-plan__step" id="dayNavPrev" ${canPrev ? '' : 'disabled'} aria-label="Previous day">←</button>
        <div class="today-plan__strip" role="listbox" aria-label="Plan week">${chips}</div>
        <button type="button" class="today-plan__step" id="dayNavNext" ${canNext ? '' : 'disabled'} aria-label="Next day">→</button>
      </nav>
      <footer class="today-plan__foot">
        <button type="button" class="today-plan__pick" id="dayNavPickBtn" aria-label="Pick any date, ${escapeHtml(heading)}">
          Any date
        </button>
        <p class="today-plan__window">Through ${escapeHtml(maxLabel)}</p>
        <input type="date" id="dayNavPick" class="day-date-nav__input" value="${dateKey}"
          min="${minDate}" max="${maxDate}" tabindex="-1" aria-hidden="true"/>
      </footer>
      ${emptyTomorrow && isToday ? `
        <p class="today-plan__nudge">Nothing planned for tomorrow.</p>
      ` : ''}
    </section>
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
  const calPctRaw = goals.calories_kcal ? (totals.calories_kcal / goals.calories_kcal) * 100 : 0;
  const calPct = Math.min(100, calPctRaw);
  const calDeltaKcal = (goals.calories_kcal || 0) - totals.calories_kcal;
  const overGoal = calDeltaKcal < 0;
  const left = formatEnergyParts(Math.abs(calDeltaKcal), prefs);
  const eaten = formatEnergyParts(totals.calories_kcal, prefs);
  const comparisons = weekReport ? weekComparisonLines(totals, weekReport) : [];
  const dayWord = dateKey === todayKey() ? 'today' : 'this day';

  const inner = `
      <header class="dash-head">
        <div class="dash-head__copy">
          <p class="dash-head__label">${escapeHtml(calLabel)}</p>
          <p class="dash-head__goal">Goal ${formatEnergy(goals.calories_kcal, prefs)}</p>
        </div>
        <p class="dash-head__left${overGoal ? ' dash-head__left--over' : ''}">${overGoal ? `${left.value} ${left.unit} over` : `${left.value} ${left.unit} left`}</p>
      </header>
      <div class="dash-ring">
        <div class="ring-wrap">
          <svg class="progress-ring" viewBox="0 0 120 120" aria-hidden="true">
            <circle class="ring-bg" cx="60" cy="60" r="52"/>
            <circle class="ring-fg${overGoal ? ' ring-fg--over' : ''}" cx="60" cy="60" r="52" style="stroke-dashoffset:${328 - (328 * calPct) / 100}"/>
          </svg>
          <div class="ring-label">
            <span class="ring-value">${eaten.value}</span>
            <span class="ring-unit">${eaten.unit}</span>
            <span class="ring-goal">${Math.round(calPctRaw)}% of goal</span>
          </div>
        </div>
      </div>
      <div class="macro-row" aria-label="Macros">
        ${macroChip('Protein', totals.protein_g, goals.protein_g, 'g', 'protein')}
        ${macroChip('Carbs', totals.carbs_g, goals.carbs_g, 'g', 'carbs')}
        ${macroChip('Fat', totals.fat_g, goals.fat_g, 'g', 'fat')}
      </div>
      ${showMicros ? `
        <div class="macro-row macro-row--micros" aria-label="Micronutrients">
          ${microChip('Fibre', totals.fibre_g, goals.fibre_g, 'g')}
          ${microChip('Sugar', totals.sugar_g, goals.sugar_g, 'g', true)}
          ${microChip('Salt', totals.salt_mg, goals.salt_mg, 'mg', true)}
        </div>
      ` : ''}
      ${comparisons.length ? `
        <section class="dash-compare" aria-label="Comparison to 7-day average">
          <div class="dash-compare__head">
            <p class="dash-compare__title">vs 7-day average</p>
            <p class="dash-compare__hint">${escapeHtml(dayWord)}</p>
          </div>
          <div class="dash-compare__grid">
            ${comparisons.map((c) => `
              <div class="dash-compare__item">
                <span class="dash-compare__label">${escapeHtml(c.label)}</span>
                <span class="dash-compare__today">${escapeHtml(c.today)}</span>
                <span class="dash-compare__avg">avg ${escapeHtml(c.avg)}</span>
              </div>
            `).join('')}
          </div>
        </section>
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
  root.querySelectorAll('[data-plan-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.planDate;
      if (next && next !== dateKey) onDateChange?.(next);
    });
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
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
