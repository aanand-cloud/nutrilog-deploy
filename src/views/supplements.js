import { getMealsForDate, deleteMeal, todayKey } from '../services/storage.js';
import { refreshMealPhotoUrls } from '../services/sync.js';
import { isSupabaseConfigured } from '../services/auth.js';
import {
  partitionMealsByKind,
  formatSupplementMetaLine,
  supplementMetaFromMeal,
  formatMicronutrientLine,
  aggregateDayMicronutrients,
} from '../services/supplements.js';
import { openSupplementLogModal } from '../services/supplement-log-modal.js';
import { lookupSupplementProduct } from '../services/supplement-barcode.js';
import { openBarcodeScannerModal } from '../services/barcode-scanner.js';
import { formatDayHeading, formatDayShort, parseDateKey } from '../services/reports.js';
import { isDateInCalendarRange } from '../services/meal-calendar.js';
import { dayDateNavHtml, bindDayDateNav } from './day-nutrition.js';
import { DISCLAIMERS, disclaimerBlock } from '../services/disclaimers.js';
import { APP_NAME } from '../services/brand.js';
import { openConfirmModal } from '../services/confirm-modal.js';

let supplementsViewDateKey = null;

export function setSupplementsViewDate(dateKey) {
  supplementsViewDateKey = dateKey || null;
}

export function clearSupplementsViewDate() {
  supplementsViewDateKey = null;
}

function resolveViewDate() {
  const today = todayKey();
  if (!supplementsViewDateKey) return today;
  if (!isDateInCalendarRange(supplementsViewDateKey)) return today;
  return supplementsViewDateKey;
}

const ICON_EDIT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
const ICON_DELETE = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`;

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function supplementCard(entry) {
  const meta = supplementMetaFromMeal(entry);
  const metaLine = formatSupplementMetaLine(meta);
  const nutrientLine = formatMicronutrientLine(meta.micronutrients);
  return `
    <li class="supplement-card">
      <div class="supplement-card__icon" aria-hidden="true">💊</div>
      <div class="supplement-card__body">
        <h3>${escapeHtml(meta.name || 'Supplement')}</h3>
        <p class="supplement-card__meta">${escapeHtml(metaLine)}</p>
        ${nutrientLine ? `<p class="supplement-card__nutrients">${escapeHtml(nutrientLine)}</p>` : ''}
        ${meta.notes ? `<p class="supplement-card__notes">${escapeHtml(meta.notes)}</p>` : ''}
      </div>
      <div class="meal-actions">
        <button type="button" class="icon-btn icon-btn--edit" data-edit="${entry.id}" aria-label="Edit supplement">${ICON_EDIT}</button>
        <button type="button" class="icon-btn icon-btn--danger" data-delete="${entry.id}" aria-label="Delete supplement">${ICON_DELETE}</button>
      </div>
    </li>
  `;
}

function dayNutrientPanelHtml(totals) {
  const line = formatMicronutrientLine(totals);
  if (!line) return '';
  return `
    <section class="supplements-nutrient-panel card muted-card" aria-label="Label nutrients today">
      <h3 class="supplements-nutrient-panel__title">From product labels today</h3>
      <p class="supplements-nutrient-panel__values">${escapeHtml(line)}</p>
      ${disclaimerBlock(DISCLAIMERS.supplementNutrients, 'fine-print health-disclaimer health-disclaimer--inline')}
    </section>
  `;
}

export async function renderSupplements(root, { profile, showToast, onRefresh, onSignIn }) {
  const isGuest = !profile?.loggedIn;

  if (isGuest) {
    root.innerHTML = `
      <section class="upgrade-gate view-page view-page--gate supplements-guest" aria-label="Supplements">
        <h1 class="visually-hidden">Supplements</h1>
        <div class="view-page__gate-copy">
          <div class="upgrade-gate__head">
            <p class="upgrade-gate__eyebrow">${APP_NAME} supplement log</p>
            <h2 class="upgrade-gate__title">Supplement log</h2>
            <p class="upgrade-gate__lead">Separate from meals — barcode or manual entry. Not in your calorie ring.</p>
          </div>
          <ul class="upgrade-gate__features">
            <li>Manual log with dose and time of day</li>
            <li>Barcode scan for labelled products (free)</li>
            <li>Vitamin &amp; mineral info from product labels when available</li>
          </ul>
          <div class="upgrade-gate__actions">
            <button type="button" class="btn btn-primary full" id="supplementsSignUp">Create free account</button>
            <button type="button" class="btn btn-ghost full" id="supplementsSignIn">Sign in</button>
          </div>
          ${disclaimerBlock(DISCLAIMERS.supplementLogShort, 'fine-print health-disclaimer')}
        </div>
      </section>
    `;
    root.querySelector('#supplementsSignUp')?.addEventListener('click', () => onSignIn?.('signup'));
    root.querySelector('#supplementsSignIn')?.addEventListener('click', () => onSignIn?.('signin'));
    return;
  }

  const dateKey = resolveViewDate();
  const isViewingToday = dateKey === todayKey();
  let meals = await getMealsForDate(dateKey);
  if (isSupabaseConfigured()) {
    meals = await refreshMealPhotoUrls(meals);
  }
  const { supplements } = partitionMealsByKind(meals);
  const dayMicroTotals = aggregateDayMicronutrients(supplements);
  const dayHeading = formatDayHeading(dateKey);

  root.innerHTML = `
    <div class="view-page view-page--supplements">
      <h1 class="visually-hidden">Supplements</h1>
      ${dayDateNavHtml(dateKey, { showCalendarBtn: false })}
      <header class="supplements-hero card">
        <p class="supplements-hero__eyebrow">Supplement log</p>
        <p class="supplements-hero__title">${isViewingToday ? 'Log what you take today' : `Supplements · ${escapeHtml(dayHeading)}`}</p>
        <p class="supplements-hero__lead">Separate from meals — scan or enter manually.</p>
        <div class="supplements-hero__actions">
          <button type="button" class="btn btn-primary" id="supplementsLogBtn">Log supplement</button>
          <button type="button" class="btn btn-ghost" id="supplementsScanBtn">Scan barcode</button>
        </div>
      </header>

      ${dayNutrientPanelHtml(dayMicroTotals)}

      <section class="section section--supplements-list">
        <div class="section-head">
          <h2>${isViewingToday ? "Today's log" : `Log · ${formatDayShort(dateKey)}`}</h2>
          <span class="badge">${supplements.length} logged</span>
        </div>
        ${supplements.length === 0 ? `
          <div class="empty-state empty-state--supplements">
            <p class="empty-state__title">Nothing logged yet</p>
            <p class="empty-state__hint">Tap Log supplement or scan a barcode.</p>
          </div>
        ` : `
          <ul class="supplement-list">
            ${supplements.map((entry) => supplementCard(entry)).join('')}
          </ul>
        `}
      </section>
    </div>
  `;

  const openLog = async (prefill) => {
    const saved = await openSupplementLogModal({ dateKey, showToast, prefill });
    if (saved) onRefresh?.();
  };

  const scanAndLog = async () => {
    const code = await openBarcodeScannerModal();
    if (!code) return;
    try {
      showToast?.('Looking up product…');
      const product = await lookupSupplementProduct(code);
      await openLog({
        name: product.name,
        brand: product.brand,
        dose: product.dose,
        barcode: product.barcode,
        micronutrients: product.micronutrients,
      });
    } catch (err) {
      showToast?.(err.message || 'Product not found — try manual entry', 5000);
    }
  };

  root.querySelector('#supplementsLogBtn')?.addEventListener('click', () => openLog());
  root.querySelector('#supplementsScanBtn')?.addEventListener('click', scanAndLog);

  bindDayDateNav(root, {
    dateKey,
    onDateChange: (nextKey) => {
      supplementsViewDateKey = nextKey;
      onRefresh?.();
    },
  });

  root.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const ok = await openConfirmModal({
        title: 'Remove supplement?',
        message: 'Remove this entry from your diary?',
        confirmLabel: 'Remove',
        tone: 'danger',
      });
      if (ok) {
        await deleteMeal(btn.dataset.delete);
        onRefresh?.();
      }
    });
  });

  root.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const entry = supplements.find((m) => m.id === btn.dataset.edit);
      if (!entry) return;
      const saved = await openSupplementLogModal({ meal: entry, dateKey, showToast });
      if (saved) onRefresh?.();
    });
  });
}
