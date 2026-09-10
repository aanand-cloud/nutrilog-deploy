/**
 * Plan-ahead Phase 1 — discoverability UX (no new nav tab).
 *
 * Roll back instantly: set PLAN_AHEAD_PHASE1_ENABLED to false and rebuild.
 * Or revert the git commit / branch that introduced Phase 1.
 */
import { formatPlanDateLabel, maxPlanDateKey } from './meal-calendar.js';
import { shiftDateKey } from './reports.js';
import { todayKey } from './storage.js';
import { MEAL_TYPES } from './meal-types.js';

/** Flip to false to restore the pre-Phase-1 Today / Calendar / Log UI. */
export const PLAN_AHEAD_PHASE1_ENABLED = true;

export function tomorrowDateKey() {
  return shiftDateKey(todayKey(), 1);
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

/** Action card on Today when tomorrow has no planned meals yet. */
export function planTomorrowCardHtml() {
  const tomorrow = tomorrowDateKey();
  const label = formatPlanDateLabel(tomorrow);
  return `
    <section class="plan-tomorrow-card muted-card" aria-label="Plan meals for tomorrow">
      <div class="plan-tomorrow-card__copy">
        <p class="plan-tomorrow-card__title">Plan ${escapeHtml(label)}</p>
        <p class="plan-tomorrow-card__body">Nothing planned yet — add breakfast, lunch, or dinner before the day starts.</p>
      </div>
      <div class="plan-tomorrow-card__actions">
        <button type="button" class="btn btn-primary btn-sm" id="planTomorrowBtn">Plan ${escapeHtml(label)}</button>
        <button type="button" class="btn btn-ghost btn-sm" id="planTomorrowCalendarBtn">Open calendar</button>
      </div>
    </section>
  `;
}

/** Date nav sub-label when Phase 1 is on. */
export function dayDateNavPickHintPhase1({ showCalendarBtn = false } = {}) {
  if (!showCalendarBtn) return 'Tap to pick date · plan ahead';
  return 'Pick date · plan up to 3 weeks';
}

/** Calendar screen hint — stronger CTA than the passive legacy tip. */
export function calendarPlanAheadHintHtml() {
  const maxLabel = formatPlanDateLabel(maxPlanDateKey());
  return `
    <aside class="plan-ahead-hint plan-ahead-hint--phase1" aria-label="Plan meals ahead">
      <span class="plan-ahead-hint__icon" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/>
        </svg>
      </span>
      <p class="plan-ahead-hint__text">Tap a future date, then <strong>Plan meal</strong>. You can plan through ${escapeHtml(maxLabel)}.</p>
    </aside>
  `;
}

/** Future-day empty meals list — quick plan by meal type. */
export function futureDayEmptyPlanHtml({ dayHeading = '' } = {}) {
  const typeButtons = MEAL_TYPES.map((t) => `
    <button type="button" class="plan-meal-quick__type-btn" data-plan-meal-type="${t.id}">
      <span class="plan-meal-quick__type-icon" aria-hidden="true">${t.icon}</span>
      <span class="plan-meal-quick__type-label">${escapeHtml(t.label)}</span>
    </button>
  `).join('');

  return `
    <div class="empty-state empty-state--meals empty-state--plan">
      <div class="empty-state__icon" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
        </svg>
      </div>
      <p class="empty-state__title">Nothing planned yet</p>
      <p class="empty-state__hint">${dayHeading
    ? `Planning for <strong>${escapeHtml(dayHeading)}</strong> — pick a meal slot or scan as usual.`
    : 'Pick a meal slot or scan as usual — saved to this day, not today.'}</p>
      <div class="plan-meal-quick" role="group" aria-label="Plan by meal type">
        <div class="plan-meal-quick__types">${typeButtons}</div>
        <button type="button" class="btn btn-primary" id="emptyLogBtn">Plan any meal</button>
      </div>
    </div>
  `;
}

/** Extra copy on Log capture when planning a future day. */
export function logPlanningCaptureLeadHtml() {
  return 'You\'re planning ahead — photo, barcode, or describe what you expect to eat.';
}

export function logPlanningBannerSubtextHtml() {
  return '<p class="log-date-banner__sub">Saved to this day — won\'t count toward today\'s totals.</p>';
}
