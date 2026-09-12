/** Meal calendar — plan ahead and see logged days at a glance. */

import { getMealsInRange, getMealsForDate, sumNutrition, todayKey } from '../services/storage.js';
import {
  buildMonthGrid,
  canNavigateMonth,
  countLoggedDaysInMonth,
  formatMonthHeading,
  formatPlanDateLabel,
  isDateInCalendarRange,
  monthRange,
  shiftMonth,
  summarizeDayMeals,
  summarizeMealsByDate,
} from '../services/meal-calendar.js';
import { formatDayHeading, formatDayShort, foodMealsOnly } from '../services/reports.js';
import { formatEnergy, formatEnergyParts, getGoals, getUnitPrefs } from '../services/goals.js';
import { mealTypeLabel } from '../services/meal-types.js';

const WEEKDAYS = [
  { full: 'Mon', short: 'Mo' },
  { full: 'Tue', short: 'Tu' },
  { full: 'Wed', short: 'We' },
  { full: 'Thu', short: 'Th' },
  { full: 'Fri', short: 'Fr' },
  { full: 'Sat', short: 'Sa' },
  { full: 'Sun', short: 'Su' },
];

let calendarMonth = null;
let calendarSelectedDate = null;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function currentMonthAnchor() {
  const now = new Date();
  return { year: now.getFullYear(), monthIndex: now.getMonth() };
}

function resolveMonth() {
  if (!calendarMonth) return currentMonthAnchor();
  return calendarMonth;
}

function calendarDayCell(cell, summary, selectedDate) {
  if (!cell.inMonth) {
    return `<span class="meal-cal__day meal-cal__day--pad" aria-hidden="true"></span>`;
  }

  const classes = [
    'meal-cal__day',
    cell.isToday ? 'meal-cal__day--today' : '',
    cell.isFuture ? 'meal-cal__day--future' : '',
    summary ? (cell.isFuture ? 'meal-cal__day--planned' : 'meal-cal__day--logged') : '',
    cell.dateKey === selectedDate ? 'meal-cal__day--selected' : '',
    cell.isSelectable ? '' : 'meal-cal__day--disabled',
  ].filter(Boolean).join(' ');

  const aria = summary
    ? `${formatDayShort(cell.dateKey)}, ${summary.mealCount} meal(s), ${summary.calories_kcal} kcal`
    : formatDayShort(cell.dateKey);

  return `
    <button type="button" class="${classes}" data-date="${cell.dateKey}"
      ${cell.isSelectable ? '' : 'disabled tabindex="-1"'}
      aria-label="${escapeHtml(aria)}"
      aria-pressed="${cell.dateKey === selectedDate ? 'true' : 'false'}">
      <span class="meal-cal__day-num">${cell.day}</span>
      ${summary ? `<span class="meal-cal__day-dot" aria-hidden="true"></span>` : ''}
    </button>
  `;
}

function selectedDayMealsHtml(meals, prefs) {
  if (!meals.length) return '';
  return `
    <ul class="meal-cal-detail__list">
      ${meals.map((m) => {
        const n = m.total_nutrition || {};
        const type = mealTypeLabel(m.meal_type);
        return `
          <li class="meal-cal-detail__meal">
            ${type ? `<span class="meal-cal-detail__meal-type">${escapeHtml(type)}</span>` : ''}
            <strong>${escapeHtml(m.meal_summary || 'Meal')}</strong>
            <span class="meal-cal-detail__meal-meta">${formatEnergy(m.total_calories_kcal || 0, prefs)} · P ${Math.round(n.protein_g || 0)}g</span>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function syncSelectedDateForMonth(year, monthIndex) {
  const today = todayKey();
  const inMonth = (dateKey) => {
    const [y, m] = dateKey.split('-').map(Number);
    return y === year && m === monthIndex + 1;
  };
  if (calendarSelectedDate && inMonth(calendarSelectedDate) && isDateInCalendarRange(calendarSelectedDate)) {
    return;
  }
  if (inMonth(today) && isDateInCalendarRange(today)) {
    calendarSelectedDate = today;
    return;
  }
  const day = String(Math.min(new Date().getDate(), new Date(year, monthIndex + 1, 0).getDate())).padStart(2, '0');
  calendarSelectedDate = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${day}`;
}

export async function renderCalendar(root, { profile, onViewDay, onLogForDate, onBack, onSignIn }) {
  const isGuest = !profile?.loggedIn;

  if (isGuest) {
    root.innerHTML = `
      <section class="view-page view-page--calendar">
        <div class="meal-cal-guest card muted-card">
          <p class="meal-cal-guest__eyebrow">Meal calendar</p>
          <h2 class="meal-cal-guest__title">Plan your week ahead</h2>
          <p class="meal-cal-guest__lead">Plan ahead, see logged days, and jump to any date.</p>
          <ul class="meal-cal-guest__list">
            <li>Plan up to 3 weeks of meals in advance</li>
            <li>See calories and meal count on each day</li>
            <li>Tap a date to view or add meals</li>
          </ul>
          <button type="button" class="btn btn-primary full" id="calGuestSignUp">Create free account</button>
          <button type="button" class="btn btn-ghost full" id="calGuestSignIn">Sign in</button>
        </div>
      </section>
    `;
    root.querySelector('#calGuestSignUp')?.addEventListener('click', () => onSignIn?.('signup'));
    root.querySelector('#calGuestSignIn')?.addEventListener('click', () => onSignIn?.('signin'));
    return;
  }

  const { year, monthIndex } = resolveMonth();
  const { start, end } = monthRange(year, monthIndex);
  const monthMeals = foodMealsOnly(await getMealsInRange(start, end));
  const summaryByDate = summarizeMealsByDate(monthMeals);
  const grid = buildMonthGrid(year, monthIndex);
  const loggedDays = countLoggedDaysInMonth(summaryByDate, year, monthIndex);
  const heading = formatMonthHeading(year, monthIndex);
  const canPrev = canNavigateMonth(year, monthIndex, -1);
  const canNext = canNavigateMonth(year, monthIndex, 1);
  const today = todayKey();
  const selectedDate = calendarSelectedDate && isDateInCalendarRange(calendarSelectedDate)
    ? calendarSelectedDate
    : (() => {
      syncSelectedDateForMonth(year, monthIndex);
      return calendarSelectedDate;
    })();

  const allSelectedMeals = await getMealsForDate(selectedDate);
  const selectedMeals = foodMealsOnly(allSelectedMeals);
  const supplementCount = allSelectedMeals.length - selectedMeals.length;
  const selectedSummary = summarizeDayMeals(selectedMeals);
  const prefs = getUnitPrefs();
  const goals = getGoals();
  const isSelectedFuture = selectedDate > today;
  const isSelectedToday = selectedDate === today;
  const energy = selectedSummary
    ? formatEnergyParts(selectedSummary.calories_kcal, prefs)
    : null;

  root.innerHTML = `
    <div class="view-page view-page--calendar">
      <header class="meal-cal__header card">
        <button type="button" class="back-link" id="calBack">← Today</button>
        <div class="meal-cal__head-row">
          <div class="meal-cal__head-copy">
            <p class="meal-cal__eyebrow">Meal calendar</p>
            <h2 class="meal-cal__title">${escapeHtml(heading)}</h2>
            <p class="meal-cal__sub">${loggedDays} day${loggedDays === 1 ? '' : 's'} logged · 3 weeks ahead</p>
          </div>
          <div class="meal-cal__nav" aria-label="Change month">
            <button type="button" class="meal-cal__nav-btn" id="calPrev" ${canPrev ? '' : 'disabled'} aria-label="Previous month">←</button>
            <button type="button" class="meal-cal__nav-btn" id="calNext" ${canNext ? '' : 'disabled'} aria-label="Next month">→</button>
          </div>
        </div>
      </header>

      <section class="meal-cal card" aria-label="Calendar for ${escapeHtml(heading)}">
        <div class="meal-cal__weekdays" aria-hidden="true">
          ${WEEKDAYS.map((d) => `
            <span class="meal-cal__weekday">
              <span class="meal-cal__weekday-full">${d.full}</span>
              <span class="meal-cal__weekday-short">${d.short}</span>
            </span>
          `).join('')}
        </div>
        <div class="meal-cal__grid" role="grid">
          ${grid.map((cell) => calendarDayCell(cell, summaryByDate[cell.dateKey], selectedDate)).join('')}
        </div>
        <div class="meal-cal__legend" aria-hidden="true">
          <span class="meal-cal__legend-item"><span class="meal-cal__legend-swatch meal-cal__legend-swatch--logged"></span> Logged</span>
          <span class="meal-cal__legend-item"><span class="meal-cal__legend-swatch meal-cal__legend-swatch--planned"></span> Planned</span>
          <span class="meal-cal__legend-item"><span class="meal-cal__legend-swatch meal-cal__legend-swatch--today"></span> Today</span>
        </div>
      </section>

      <section class="meal-cal-detail card" aria-label="Selected day">
        <div class="meal-cal-detail__head">
          <div>
            <p class="meal-cal-detail__label">${isSelectedFuture ? 'Planning for' : isSelectedToday ? 'Today' : 'Selected day'}</p>
            <h3 class="meal-cal-detail__title">${escapeHtml(formatDayHeading(selectedDate))}</h3>
          </div>
          ${selectedSummary ? `<span class="badge">${selectedSummary.mealCount} meal${selectedSummary.mealCount === 1 ? '' : 's'}</span>` : ''}
        </div>

        ${selectedSummary ? `
          <p class="meal-cal-detail__kcal">
            <strong>${energy.value}</strong> ${energy.unit} logged
            ${goals.calories_kcal ? `<span class="meal-cal-detail__goal"> · ${selectedSummary.calPct}% of goal</span>` : ''}
          </p>
        ` : `
          <p class="meal-cal-detail__empty">${isSelectedFuture ? 'Nothing planned.' : supplementCount ? 'No food meals.' : 'No meals yet.'}</p>
        `}

        ${supplementCount ? `<p class="meal-cal-detail__supp-note fine-print">${supplementCount} supplement${supplementCount === 1 ? '' : 's'} logged — see Supplements tab (not included in food calories).</p>` : ''}

        ${selectedDayMealsHtml(selectedMeals, prefs)}

        <div class="meal-cal-detail__actions">
          <button type="button" class="btn btn-primary" id="calLogBtn">
            ${isSelectedFuture ? 'Plan meal' : 'Log meal'} for ${escapeHtml(formatPlanDateLabel(selectedDate))}
          </button>
          <button type="button" class="btn btn-ghost" id="calViewBtn">View day →</button>
        </div>
      </section>
    </div>
  `;

  root.querySelector('#calBack')?.addEventListener('click', () => onBack?.());
  root.querySelector('#calPrev')?.addEventListener('click', () => {
    if (!canPrev) return;
    calendarMonth = shiftMonth(year, monthIndex, -1);
    syncSelectedDateForMonth(calendarMonth.year, calendarMonth.monthIndex);
    renderCalendar(root, { profile, onViewDay, onLogForDate, onBack, onSignIn });
  });
  root.querySelector('#calNext')?.addEventListener('click', () => {
    if (!canNext) return;
    calendarMonth = shiftMonth(year, monthIndex, 1);
    syncSelectedDateForMonth(calendarMonth.year, calendarMonth.monthIndex);
    renderCalendar(root, { profile, onViewDay, onLogForDate, onBack, onSignIn });
  });
  root.querySelectorAll('.meal-cal__day[data-date]').forEach((btn) => {
    btn.addEventListener('click', () => {
      calendarSelectedDate = btn.dataset.date;
      renderCalendar(root, { profile, onViewDay, onLogForDate, onBack, onSignIn });
    });
  });
  root.querySelector('#calLogBtn')?.addEventListener('click', () => onLogForDate?.(selectedDate));
  root.querySelector('#calViewBtn')?.addEventListener('click', () => onViewDay?.(selectedDate));
}

export function resetCalendarState() {
  calendarMonth = null;
  calendarSelectedDate = null;
}

export function openCalendarOnDate(dateKey) {
  if (!dateKey) return;
  const d = dateKey.split('-').map(Number);
  calendarMonth = { year: d[0], monthIndex: d[1] - 1 };
  calendarSelectedDate = dateKey;
}
