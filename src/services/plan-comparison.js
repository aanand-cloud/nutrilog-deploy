/**
 * Single source for plan comparison tables and Essential vs Plus positioning (P7).
 */

import {
  FREE_DAILY_SCANS,
  PRO_DAILY_FAIR_USE,
  PRO_MONTHLY_CAP,
  formatPlanPrice,
} from './plans.js';

/** Primary tiers shown as large cards on the landing page. */
export const LANDING_PRIMARY_PLAN_IDS = ['free', 'plus', 'pro'];

/** Secondary budget tier — difference from Plus must stay obvious. */
export const LANDING_BUDGET_PLAN_ID = 'essential';

export const AI_SCAN_PLAIN_LANGUAGE = 'An AI meal scan is when you photograph your plate and MealNova identifies foods and estimates nutrition. Only photo scans use your allowance — barcode, food search and Describe stay free.';

export const ESSENTIAL_VS_PLUS_SUMMARY = {
  headline: 'Essential vs Plus — what changes?',
  essential: '200 photo scans per month · weekly macro report · no AI coach',
  plus: '300 photo scans per month · 7- & 30-day reports · AI coach tips',
  footnote: 'Barcode, search and Describe are free on both plans.',
};

/** @typedef {{ label: string, free: string, essential: string, plus: string, pro: string }} PlanCompareRow */

/** @type {PlanCompareRow[]} */
export const PLAN_COMPARE_ROWS = [
  {
    label: 'AI photo scans',
    free: `${FREE_DAILY_SCANS}/day`,
    essential: '200/month',
    plus: '300/month',
    pro: `Up to ${PRO_DAILY_FAIR_USE}/day`,
  },
  {
    label: 'Barcode logging',
    free: 'Free',
    essential: 'Free',
    plus: 'Free',
    pro: 'Free',
  },
  {
    label: 'Describe (type/voice)',
    free: 'Free',
    essential: 'Free',
    plus: 'Free',
    pro: 'Free',
  },
  {
    label: 'Food search',
    free: 'Free',
    essential: 'Free',
    plus: 'Free',
    pro: 'Free',
  },
  {
    label: 'Reports',
    free: 'Daily totals',
    essential: 'Weekly macros',
    plus: '7- & 30-day + fibre/sugar/salt',
    pro: 'Full reports',
  },
  {
    label: 'AI coach & insights',
    free: '—',
    essential: '—',
    plus: 'Included',
    pro: 'Included',
  },
  {
    label: 'Data export',
    free: 'When signed in',
    essential: 'When signed in',
    plus: 'When signed in',
    pro: 'When signed in',
  },
  {
    label: 'Support',
    free: 'Email',
    essential: 'Email',
    plus: 'Email',
    pro: 'Priority email',
  },
  {
    label: 'Fair-use cap',
    free: '—',
    essential: '—',
    plus: '—',
    pro: `~${PRO_MONTHLY_CAP.toLocaleString()}/month`,
  },
];

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatCell(value) {
  if (value === '✓' || value === 'Included') {
    return '<span class="plan-compare-tick" aria-hidden="true">✓</span>';
  }
  if (value === '—') {
    return '<span class="plan-compare-dash" aria-hidden="true">—</span>';
  }
  if (value === 'Free') {
    return '<span class="plan-compare-free">Free</span>';
  }
  return escapeHtml(value);
}

/**
 * @param {{ tableClass?: string, wrapClass?: string, caption?: string, id?: string }} [opts]
 */
export function renderPlanCompareTableHtml(opts = {}) {
  const {
    tableClass = 'landing-pricing__compare',
    wrapClass = 'landing-pricing__compare-wrap',
    caption = 'Plan feature comparison',
    id = '',
  } = opts;

  return `
    <div class="${wrapClass}">
      <table class="${tableClass}"${id ? ` id="${id}"` : ''}>
        <caption class="visually-hidden">${escapeHtml(caption)}</caption>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Free</th>
            <th scope="col">Essential</th>
            <th scope="col">Plus</th>
            <th scope="col">Pro</th>
          </tr>
        </thead>
        <tbody>
          ${PLAN_COMPARE_ROWS.map((row) => `
            <tr>
              <th scope="row">${escapeHtml(row.label)}</th>
              <td>${formatCell(row.free)}</td>
              <td>${formatCell(row.essential)}</td>
              <td>${formatCell(row.plus)}</td>
              <td>${formatCell(row.pro)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderEssentialVsPlusCalloutHtml() {
  const s = ESSENTIAL_VS_PLUS_SUMMARY;
  const essentialPrice = formatPlanPrice('essential', false);
  const plusPrice = formatPlanPrice('plus', false);
  return `
    <aside class="landing-pricing__essential card" aria-labelledby="essentialVsPlusTitle">
      <div class="landing-pricing__essential-head">
        <p class="landing-pricing__essential-eyebrow">Budget option</p>
        <h3 id="essentialVsPlusTitle" class="landing-pricing__essential-title">${escapeHtml(s.headline)}</h3>
      </div>
      <div class="landing-pricing__essential-grid">
        <div class="landing-pricing__essential-col">
          <strong>Essential · ${escapeHtml(essentialPrice)}</strong>
          <p>${escapeHtml(s.essential)}</p>
        </div>
        <div class="landing-pricing__essential-col landing-pricing__essential-col--plus">
          <strong>Plus · ${escapeHtml(plusPrice)} · Recommended</strong>
          <p>${escapeHtml(s.plus)}</p>
        </div>
      </div>
      <p class="landing-pricing__essential-foot fine-print">${escapeHtml(s.footnote)}</p>
      <button type="button" class="btn btn-ghost btn-sm landing-pricing__essential-cta js-guest-scan" data-plan-hint="essential">Choose Essential</button>
    </aside>
  `;
}

export function renderAiScanExplainerHtml() {
  return `
    <div class="landing-pricing__ai-scan" role="note">
      <strong>What counts as an AI scan?</strong>
      <p>${escapeHtml(AI_SCAN_PLAIN_LANGUAGE)}</p>
    </div>
  `;
}

/** Landing card price strings — monthly list prices from plans.js. */
export function landingPlanPriceDisplay(planId, { billing = 'monthly' } = {}) {
  if (planId === 'free') return '£0';
  if (billing === 'annual' && planId === 'pro') {
    return formatPlanPrice('pro_annual', false);
  }
  return formatPlanPrice(planId, false);
}

export function landingScanAllowanceLabel(planId) {
  if (planId === 'free') return `${FREE_DAILY_SCANS} AI photo scan per day`;
  if (planId === 'essential') return '200 AI photo scans per month';
  if (planId === 'plus') return '300 AI photo scans per month';
  return `Fair-use AI scans · up to ${PRO_DAILY_FAIR_USE}/day`;
}
