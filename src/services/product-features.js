/** Canonical MealNova feature list — single source for guest landing & Settings. */

import { APP_NAME } from './brand.js';
import { renderPlanCompareTableHtml, AI_SCAN_PLAIN_LANGUAGE } from './plan-comparison.js';
import { DISCLAIMERS } from './disclaimers.js';

/** @typedef {'free' | 'essential' | 'plus' | 'pro'} FeatureTier */

/**
 * @typedef {{ name: string, detail: string, tier?: FeatureTier }} ProductFeature
 * @typedef {{ id: string, title: string, intro?: string, items: ProductFeature[] }} ProductFeatureSection
 */

/** @type {ProductFeatureSection[]} */
export const PRODUCT_FEATURE_SECTIONS = [
  {
    id: 'core',
    title: 'Core — free when signed in',
    intro: 'Everything you need to start tracking meals today.',
    items: [
      {
        name: 'Daily Free Scan',
        detail: '1 AI photo scan per day — resets at midnight (local time)',
        tier: 'free',
      },
      {
        name: 'Barcode & product search',
        detail: 'Unlimited packaged-food logging — no scan credits used',
        tier: 'free',
      },
      {
        name: 'Describe your meal',
        detail: 'Type or dictate — quick rough estimate, no scan credits used',
        tier: 'free',
      },
      {
        name: 'Today dashboard',
        detail: 'Calorie ring plus protein, carbs and fat vs your daily goals',
        tier: 'free',
      },
      {
        name: 'Custom targets',
        detail: 'Set calories and macro goals — adjust anytime in Settings',
        tier: 'free',
      },
      {
        name: 'Cloud sync',
        detail: 'Meals and settings sync securely when you sign in',
        tier: 'free',
      },
      {
        name: 'Data export',
        detail: 'Download your meals and account data as JSON or CSV when signed in',
        tier: 'free',
      },
      {
        name: 'Meal calendar',
        detail: 'Browse any day and log meals for today, past days, or ahead',
        tier: 'free',
      },
    ],
  },
  {
    id: 'tracking',
    title: 'Meal logging',
    intro: 'Photo for plates, barcode for packs, describe anytime — all free ways to log.',
    items: [
      {
        name: 'AI photo estimates',
        detail: 'Snap a plate — AI estimates calories and macros (uses scan allowance)',
        tier: 'free',
      },
      {
        name: 'Smart follow-up questions',
        detail: 'Optional portion, cooking and sauce prompts to refine estimates',
        tier: 'free',
      },
      {
        name: 'Describe your meal',
        detail: 'Type or voice — quick rough estimate without a photo scan',
        tier: 'free',
      },
      {
        name: 'Drink logging',
        detail: 'Log drinks separately from solid meals',
        tier: 'free',
      },
      {
        name: 'Supplement log',
        detail: 'Dedicated tab — log supplements separately from meals (not in calorie ring)',
        tier: 'free',
      },
      {
        name: 'Supplement barcode scan',
        detail: 'Scan packaged supplement barcodes — label nutrients shown when available (free)',
        tier: 'free',
      },
      {
        name: 'Meal review & edit',
        detail: 'Adjust items, portions and notes before saving',
        tier: 'free',
      },
    ],
  },
  {
    id: 'insights',
    title: 'Reports & coaching',
    intro: 'Deeper views unlock on paid plans — see Plans below for prices.',
    items: [
      {
        name: 'Weekly macros report',
        detail: 'Calories and protein/carbs/fat averages over your week',
        tier: 'essential',
      },
      {
        name: '7-day & 30-day trends',
        detail: 'Charts and period comparisons in Reports',
        tier: 'plus',
      },
      {
        name: 'Fibre, sugar & salt',
        detail: 'Extra nutrients in Today, reports and goal tracking',
        tier: 'plus',
      },
      {
        name: 'AI cuisine coach',
        detail: 'Personalised tips from your recent meals — wellness suggestions only',
        tier: 'plus',
      },
      {
        name: 'Goal progress insights',
        detail: 'See how logged estimates compare to targets you set',
        tier: 'plus',
      },
      {
        name: 'Reminders & alerts',
        detail: 'Optional daily check-in and weekly digest when you allow notifications',
        tier: 'free',
      },
    ],
  },
];

/**
 * Settings → Plans only — tier comparison, not billing/admin/setup flows.
 * Top-ups, promo codes, NHS discount, and privacy live in UI below the list.
 */
export const PLANS_PAGE_FEATURE_SECTIONS = [
  {
    id: 'core',
    title: 'Included free',
    intro: 'Every signed-in account — barcode, search, and describe never use scan credits.',
    items: [
      {
        name: 'Daily Free Scan',
        detail: '1 AI photo scan per day — resets at midnight (local time)',
        tier: 'free',
      },
      {
        name: 'Barcode & product search',
        detail: 'Unlimited packaged-food logging — no scan credits used',
        tier: 'free',
      },
      {
        name: 'Describe your meal',
        detail: 'Type or dictate — quick rough estimate, no scan credits used',
        tier: 'free',
      },
      {
        name: 'Today dashboard',
        detail: 'Calorie ring plus protein, carbs and fat vs your daily goals',
        tier: 'free',
      },
      {
        name: 'Custom targets',
        detail: 'Set calories and macro goals — adjust anytime in Settings',
        tier: 'free',
      },
      {
        name: 'Meal calendar',
        detail: 'Browse any day and log meals for today, past days, or ahead',
        tier: 'free',
      },
      {
        name: 'Data export',
        detail: 'Download meals and account data as JSON or CSV when signed in',
        tier: 'free',
      },
    ],
  },
  {
    id: 'tracking',
    title: 'Meal logging',
    intro: 'Photo AI uses your scan allowance; barcode, search, and describe do not.',
    items: [
      {
        name: 'AI photo estimates',
        detail: 'Snap a plate — AI estimates calories and macros',
        tier: 'free',
      },
      {
        name: 'Smart follow-up questions',
        detail: 'Optional portion, cooking and sauce prompts to refine estimates',
        tier: 'free',
      },
      {
        name: 'Describe your meal',
        detail: 'Type or voice — quick rough estimate without a photo scan',
        tier: 'free',
      },
      {
        name: 'Drink logging',
        detail: 'Log drinks separately from solid meals',
        tier: 'free',
      },
      {
        name: 'Supplement log',
        detail: 'Dedicated tab — supplements separate from meals',
        tier: 'free',
      },
      {
        name: 'Supplement barcode scan',
        detail: 'Scan packaged supplement barcodes when label data is available',
        tier: 'free',
      },
      {
        name: 'Meal review & edit',
        detail: 'Adjust items, portions and notes before saving',
        tier: 'free',
      },
    ],
  },
  {
    id: 'paid',
    title: 'Paid plan extras',
    intro: 'More AI scans plus deeper reports — compare prices below.',
    items: [
      {
        name: 'Weekly macros report',
        detail: 'Calories and protein/carbs/fat averages over your week',
        tier: 'essential',
      },
      {
        name: '7-day & 30-day trends',
        detail: 'Charts and period comparisons in Reports',
        tier: 'plus',
      },
      {
        name: 'Fibre, sugar & salt',
        detail: 'Extra nutrients in Today, reports and goal tracking',
        tier: 'plus',
      },
      {
        name: 'AI cuisine coach',
        detail: 'Personalised tips from your recent meals — wellness suggestions only',
        tier: 'plus',
      },
      {
        name: 'Goal progress insights',
        detail: 'See how logged estimates compare to targets you set',
        tier: 'plus',
      },
    ],
  },
];

/** Curated highlights for guest landing — full catalog expands on demand. */
export const LANDING_HEADLINE_FEATURES = [
  {
    name: 'Daily free AI photo scan',
    detail: '1 scan per day when signed in — resets at midnight',
    tier: 'free',
  },
  {
    name: 'Unlimited barcode & product search',
    detail: 'Packaged food logging — no scan credits used',
    tier: 'free',
  },
  {
    name: 'Today dashboard',
    detail: 'Calorie ring plus protein, carbs and fat vs your goals',
    tier: 'free',
  },
  {
    name: 'Supplement log',
    detail: 'Supplements tracked separately from meals — own tab',
    tier: 'free',
  },
  {
    name: 'Meal calendar',
    detail: 'Log today, catch up on past days, or plan up to 3 weeks ahead',
    tier: 'free',
  },
  {
    name: 'Reports & coaching',
    detail: 'Weekly macros on Essential+ · trends, micros & AI coach on Plus',
    tier: 'essential',
  },
];

const TIER_LABELS = {
  free: 'Free',
  essential: 'Essential+',
  plus: 'Plus+',
  pro: 'Pro',
};

/** Render a plan compare cell — green tick for included features. */
export function formatPlanCompareCell(value) {
  if (value === '✓') {
    return '<span class="plan-compare-tick" aria-hidden="true">✓</span>';
  }
  return escapeHtml(String(value));
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function tierBadge(tier) {
  if (!tier || tier === 'free') {
    return `<span class="product-features__tier product-features__tier--free">Free</span>`;
  }
  return `<span class="product-features__tier product-features__tier--${tier}">${TIER_LABELS[tier] || tier}</span>`;
}

function featureItemHtml(item) {
  return `
    <li class="product-features__item">
      <div class="product-features__item-head">
        <span class="product-features__item-name">${escapeHtml(item.name)}</span>
        ${tierBadge(item.tier)}
      </div>
      <p class="product-features__item-detail">${escapeHtml(item.detail)}</p>
    </li>
  `;
}

function sectionHtml(section) {
  return `
    <div class="product-features__section" id="productFeatures-${escapeHtml(section.id)}">
      <h3 class="product-features__section-title">${escapeHtml(section.title)}</h3>
      ${section.intro ? `<p class="product-features__section-intro">${escapeHtml(section.intro)}</p>` : ''}
      <ul class="product-features__list">
        ${section.items.map(featureItemHtml).join('')}
      </ul>
    </div>
  `;
}

/**
 * Compact plan comparison for Settings → Plans (collapsed by default).
 */
export function renderPlansCompareDetailsHtml() {
  return `
    <details class="plans-compare-details">
      <summary>What's included by plan</summary>
      <div class="plans-compare-details__body">
        <p class="plans-compare-details__lead">${AI_SCAN_PLAIN_LANGUAGE}</p>
        <div class="plans-compare-scroll" tabindex="0" role="region" aria-label="Plan feature comparison">
          ${renderPlanCompareTableHtml({
            tableClass: 'plans-compare-table',
            wrapClass: 'plans-compare-table-wrap',
          })}
        </div>
      </div>
    </details>
  `;
}

/**
 * @param {{ variant?: 'landing' | 'settings', showDisclaimer?: boolean }} [opts]
 */
export function renderProductFeaturesHtml(opts = {}) {
  const { variant = 'landing', showDisclaimer = true } = opts;

  if (variant === 'settings') {
    return renderPlansCompareDetailsHtml();
  }

  const sections = PRODUCT_FEATURE_SECTIONS;

  return `
    <section
      class="product-features card"
      id="productFeatures"
      aria-labelledby="productFeaturesTitle"
    >
      <div class="product-features__head">
        <p class="product-features__eyebrow">${APP_NAME} features</p>
        <h2 id="productFeaturesTitle" class="product-features__title">Built for everyday tracking</h2>
        <p class="product-features__lead">
          Photo when it's a plate. Barcode or search when it's packaged. Supplements in their own diary — with clear plan tiers when you need more scans.
        </p>
      </div>
      <ul class="product-features__list product-features__list--headline" aria-label="Key features">
        ${LANDING_HEADLINE_FEATURES.map(featureItemHtml).join('')}
      </ul>
      <button
        type="button"
        class="btn btn-ghost full product-features__expand"
        id="productFeaturesExpand"
        aria-expanded="false"
        aria-controls="productFeaturesFull"
      >See all features</button>
      <div id="productFeaturesFull" class="product-features__full" hidden>
        <div class="product-features__sections">
          ${sections.map(sectionHtml).join('')}
        </div>
      </div>
      ${showDisclaimer ? `<p class="product-features__disclaimer fine-print health-disclaimer">${escapeHtml(DISCLAIMERS.appFooter)}</p>` : ''}
      <div class="product-features__footer">
        <p class="fine-print">Full plan comparison in Settings → Plans after you sign in.</p>
      </div>
    </section>
  `;
}

/** Expand/collapse full feature catalog on guest landing. */
export function bindLandingProductFeatures(root = document) {
  const btn = root.querySelector('#productFeaturesExpand');
  const panel = root.querySelector('#productFeaturesFull');
  if (!btn || !panel) return;

  btn.addEventListener('click', () => {
    const opening = panel.hidden;
    panel.hidden = !opening;
    btn.setAttribute('aria-expanded', String(opening));
    btn.textContent = opening ? 'Show less' : 'See all features';
    if (opening) {
      panel.querySelector('.product-features__section')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  });
}
