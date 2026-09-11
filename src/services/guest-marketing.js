/** Guest landing v2 — premium, international, conversion-focused. */

import { APP_NAME } from './brand.js';
import { PLANS, PRO_DAILY_FAIR_USE, PRO_MONTHLY_CAP, formatPlanPrice } from './plans.js';
import { ELIGIBILITY_DISCOUNT_PERCENT } from './discount.js';
import { MEALNOVA_FAQ } from './marketing-seo.js';
import { SUPPORT_EMAIL } from './legal-constants.js';
import {
  renderPlanCompareTableHtml,
  landingPlanPriceDisplay,
  landingScanAllowanceLabel,
} from './plan-comparison.js';
import {
  trackGuestCtaClick,
  trackLandingFaqOpened,
  trackLandingHeroCta,
  trackLandingPlanSelected,
  trackLandingPricingViewed,
  trackStartFreeClick,
} from './analytics.js';

/** UK fish and chips — hero + regression checks. */
const DEMO_MEAL = {
  name: 'Fish, chips & mushy peas',
  img: '/images/hero-meal.jpg',
  alt: 'British fish and chips with golden chips and mushy peas on a white plate',
  portions: '1 medium cod fillet · 200 g chips · 80 g mushy peas',
  servingNote: 'Estimated serving · ~440 g total',
  kcal: '842',
  protein: '32',
  carbs: '78',
  fat: '44',
  fibre: '9',
  range: '760–930',
  confidence: 'Medium',
  components: 4,
};

/** Indian idli plate — regression checks. */
const DEMO_MEAL_INDIAN = {
  name: 'Idli, sambar & coconut chutney',
  img: '/images/meal-india-idli.jpg',
  alt: 'South Indian idli with sambar and white coconut chutney',
  portions: '3 medium idlis · 150 g sambar · 25 g coconut chutney',
  servingNote: 'Estimated serving · ~365 g total',
  kcal: '277',
  protein: '11',
  carbs: '45',
  fat: '6',
  fibre: '5',
  range: '244–310',
  confidence: 'Medium',
  components: 3,
};

const LANDING_ASSETS = {
  '/images/hero-meal.jpg': { webp: '/images/hero-meal.webp' },
  '/images/meal-india-idli.jpg': { webp: '/images/meal-india-idli.webp' },
  '/images/meal-italy-pasta.jpg': { webp: '/images/meal-italy-pasta.webp' },
  '/images/meal-asia-thai-curry.jpg': { webp: '/images/meal-asia-thai-curry.webp' },
  '/images/meal-middle-east-platter.jpg': { webp: '/images/meal-middle-east-platter.webp' },
  '/images/meal-africa-jollof.jpg': { webp: '/images/meal-africa-jollof.webp' },
  '/images/how-step-snap.jpg': { webp: '/images/how-step-snap.webp' },
  '/images/how-step-estimates.jpg': { webp: '/images/how-step-estimates.webp' },
  '/images/how-step-track.jpg': { webp: '/images/how-step-track.webp' },
};

const GLOBAL_MEALS = [
  { region: 'UK', ...DEMO_MEAL },
  { region: 'India', ...DEMO_MEAL_INDIAN },
  {
    region: 'Italy',
    name: 'Pasta with tomato sauce & parmesan',
    img: '/images/meal-italy-pasta.jpg',
    alt: 'Spaghetti with tomato sauce and grated parmesan on a plate',
    portions: '180 g spaghetti · 120 g tomato sauce · 10 g parmesan',
    servingNote: 'Estimated serving · ~310 g total',
    kcal: '520',
    protein: '18',
    carbs: '78',
    fat: '14',
    range: '470–580',
    confidence: 'Medium',
    components: 3,
  },
  {
    region: 'East & Southeast Asia',
    name: 'Thai curry with jasmine rice',
    img: '/images/meal-asia-thai-curry.jpg',
    alt: 'Thai red curry with jasmine rice on a plate',
    portions: '200 g Thai red curry · 150 g jasmine rice',
    servingNote: 'Estimated serving · ~350 g total',
    kcal: '610',
    protein: '24',
    carbs: '72',
    fat: '22',
    range: '540–690',
    confidence: 'Medium',
    components: 4,
  },
  {
    region: 'Middle East',
    name: 'Grilled chicken, rice, hummus & salad',
    img: '/images/meal-middle-east-platter.jpg',
    alt: 'Grilled chicken with rice, hummus and fresh salad',
    portions: '120 g grilled chicken · 150 g rice · 60 g hummus · 40 g salad',
    servingNote: 'Estimated serving · ~370 g total',
    kcal: '685',
    protein: '42',
    carbs: '68',
    fat: '24',
    range: '620–760',
    confidence: 'Medium',
    components: 5,
  },
  {
    region: 'Africa & Caribbean',
    name: 'Jollof rice with grilled chicken',
    img: '/images/meal-africa-jollof.jpg',
    alt: 'Jollof rice with grilled chicken and fried plantain',
    portions: '200 g jollof rice · 120 g grilled chicken · 30 g plantain',
    servingNote: 'Estimated serving · ~350 g total',
    kcal: '540',
    protein: '28',
    carbs: '62',
    fat: '18',
    range: '480–610',
    confidence: 'Medium',
    components: 4,
  },
];

const STATIC_DEMO_STEPS = [
  {
    img: '/images/how-step-snap.jpg',
    alt: 'Photograph a plate of food to start logging',
    title: 'Photograph or describe your meal',
  },
  {
    img: '/images/how-step-estimates.jpg',
    alt: 'Review calorie and macro estimates for each food',
    title: 'Review every component and portion',
  },
  {
    img: '/images/how-step-track.jpg',
    alt: 'Save the meal and track progress on Today',
    title: 'Adjust portions, then save and track',
  },
];

const ADVANTAGE_ICONS = {
  meals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>',
  transparent: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  global: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15 15 0 0 1 0 20"/><path d="M12 2a15 15 0 0 0 0 20"/></svg>',
  control: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
};

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s) {
  return escapeHtml(s);
}

function landingPhoto(src, alt, { priority = false, className = '', width = 800, height = 600 } = {}) {
  const asset = LANDING_ASSETS[src] || { webp: src.replace(/\.jpg$/i, '.webp') };
  const isPng = src.endsWith('.png');
  return `
    <figure class="landing-photo landing-photo--loading ${className}">
      <picture>
        ${isPng ? '' : `<source type="image/webp" srcset="${asset.webp}"/>`}
        <img class="landing-photo__img" src="${src}" alt="${escapeAttr(alt)}" width="${width}" height="${height}"
          loading="${priority ? 'eager' : 'lazy'}" fetchpriority="${priority ? 'high' : 'auto'}" decoding="async"/>
      </picture>
    </figure>
  `;
}

function landingResultCard(meal) {
  return `
    <div class="landing-result-card landing-meal-review" role="img" aria-label="${escapeAttr(meal.name)}: ${escapeAttr(meal.portions)}. ${escapeAttr(meal.servingNote)}. ${escapeAttr(meal.kcal)} kilocalories, likely ${escapeAttr(meal.range)}, ${escapeAttr(meal.confidence)} confidence">
      <p class="landing-result-card__meal">${escapeHtml(meal.name)}</p>
      <p class="landing-result-card__portions">${escapeHtml(meal.portions)}</p>
      <p class="landing-result-card__serving">${escapeHtml(meal.servingNote)}</p>
      <p class="landing-result-card__kcal">${escapeHtml(meal.kcal)} <span class="review-kcal-label">kcal</span></p>
      <p class="landing-result-card__range"><strong>Likely ${escapeHtml(meal.range)} kcal</strong></p>
      <div class="landing-result-card__macros">
        <span>P ${escapeHtml(meal.protein)}g</span>
        <span>C ${escapeHtml(meal.carbs)}g</span>
        <span>F ${escapeHtml(meal.fat)}g</span>
      </div>
      <div class="landing-result-card__meta">
        <span class="landing-result-card__badge">${escapeHtml(meal.confidence)} confidence</span>
        <span class="landing-result-card__review">Review portions →</span>
      </div>
    </div>
  `;
}

function landingMealStatsHtml(meal) {
  return `
    <p class="landing-global-meals__portions">${escapeHtml(meal.portions)}</p>
    <p class="landing-global-meals__serving">${escapeHtml(meal.servingNote)}</p>
    <p class="landing-global-meals__stats">
      <strong>${escapeHtml(meal.kcal)} kcal</strong> · likely ${escapeHtml(meal.range)} · ${escapeHtml(meal.confidence)} confidence · ${meal.components} components
    </p>
  `;
}

function startFreeBtn(id = '', extraClass = '') {
  return `<button type="button" class="btn btn-primary js-guest-scan js-start-free ${extraClass}"${id ? ` id="${id}"` : ''} data-cta="start_free">Start free</button>`;
}

export function landingHeroSectionHtml() {
  return `
    <section class="landing-hero-v2 landing-section landing-section--open" aria-label="Welcome">
      <div class="landing-section__inner landing-hero-v2__grid">
        <div class="landing-hero-v2__copy">
          <h1 class="landing-hero-v2__headline">Track any meal in seconds.</h1>
          <p class="landing-section__lead">Photograph or describe your meal. Review every food and portion, then track calories and nutrition with transparent sources and confidence ranges.</p>
          <p class="landing-hero-v2__intl">From home cooking and restaurant meals to foods from around the world.</p>
          <div class="landing-hero-v2__actions">
            ${startFreeBtn('guestGetStarted')}
            <a class="btn btn-ghost btn-ghost--secondary" href="#how-it-works" data-site-anchor="how-it-works">Watch how it works</a>
          </div>
          <p class="landing-hero-v2__trust-row">
            <span>✓ Editable portions</span>
            <span>✓ Confidence ranges</span>
            <span>✓ Transparent nutrition sources</span>
          </p>
        </div>
        <div class="landing-hero-v2__visual">
          ${landingPhoto(DEMO_MEAL.img, DEMO_MEAL.alt, { priority: true, className: 'landing-photo--hero' })}
          ${landingResultCard(DEMO_MEAL)}
        </div>
      </div>
    </section>
  `;
}

export function landingTrustStripHtml() {
  return `
    <div class="landing-trust-strip" aria-label="Trust highlights">
      <p class="landing-trust-strip__text landing-section__inner">
        Global meal support · CoFID, IFCT and verified labels where available · Mixed-dish confidence ranges · Always review before saving
      </p>
    </div>
  `;
}

export function landingProductDemoHtml() {
  return `
    <section class="landing-section landing-section--teal" id="how-it-works" aria-labelledby="landingDemoTitle">
      <div class="landing-section__inner">
        <p class="landing-section__eyebrow">How it works</p>
        <h2 id="landingDemoTitle" class="landing-section__title">From meal to nutrition in seconds</h2>
        <p class="landing-section__lead">${APP_NAME} does the searching and splitting. You stay in control of every food and portion.</p>
        <div class="landing-product-demo landing-product-demo--static">
          <ol class="landing-product-demo__steps" aria-describedby="landingDemoAltText">
            ${STATIC_DEMO_STEPS.map((step, i) => `
              <li class="landing-product-demo__step">
                ${landingPhoto(step.img, step.alt, { className: 'landing-photo--demo', width: 800, height: 600 })}
                <p class="landing-product-demo__step-title"><span class="landing-product-demo__step-num">${i + 1}.</span> ${escapeHtml(step.title)}</p>
              </li>
            `).join('')}
          </ol>
          <p class="visually-hidden" id="landingDemoAltText">
            MealNova flow: photograph or describe a meal, review identified foods with portions and confidence ranges, adjust portions, then save to your diary.
          </p>
          <p class="fine-print">Estimates only — always review foods and portions before saving.</p>
        </div>
      </div>
    </section>
  `;
}

export function landingGlobalMealsHtml() {
  return `
    <section class="landing-section landing-section--open landing-regional-demos landing-global-meals" id="global-foods" aria-labelledby="landingGlobalTitle">
      <div class="landing-section__inner">
        <p class="landing-section__eyebrow">Global examples</p>
        <h2 id="landingGlobalTitle" class="landing-section__title">Built for the way the world eats</h2>
        <p class="landing-section__lead">Track everyday staples, mixed dishes, restaurant meals and traditional recipes from cuisines around the world.</p>
        <div class="landing-global-meals__carousel">
          <div class="landing-global-meals__track" id="landingGlobalTrack" tabindex="0" aria-label="Example meals carousel">
            ${GLOBAL_MEALS.map((meal) => `
              <article class="landing-global-meals__card">
                ${landingPhoto(meal.img, meal.alt, { className: 'landing-photo--regional' })}
                <p class="landing-global-meals__region">${escapeHtml(meal.region)}</p>
                <h3 class="landing-global-meals__name">${escapeHtml(meal.name)}</h3>
                ${landingMealStatsHtml(meal)}
              </article>
            `).join('')}
          </div>
          <div class="landing-global-meals__nav">
            <button type="button" class="btn btn-ghost btn-sm" id="landingGlobalPrev" aria-controls="landingGlobalTrack">Previous meals</button>
            <button type="button" class="btn btn-ghost btn-sm" id="landingGlobalNext" aria-controls="landingGlobalTrack">Next meals</button>
          </div>
        </div>
        <p class="fine-print">Examples of meals ${APP_NAME} is designed to recognise. Results depend on the visible foods, recipe and portion information.</p>
      </div>
    </section>
  `;
}

export function landingAdvantagesHtml() {
  const items = [
    { icon: ADVANTAGE_ICONS.meals, title: 'Understands complete meals', body: 'Separates dishes, sides, sauces and accompaniments for review.' },
    { icon: ADVANTAGE_ICONS.transparent, title: 'Transparent estimates', body: 'See confidence, likely ranges and nutrition sources where available.' },
    { icon: ADVANTAGE_ICONS.global, title: 'Global food recognition', body: 'Designed for home cooking, restaurant meals and foods from many cuisines.' },
    { icon: ADVANTAGE_ICONS.control, title: 'You control every portion', body: 'Edit foods, weights, pieces and how much of the plate you ate.' },
  ];
  return `
    <section class="landing-section landing-section--teal" id="features" aria-labelledby="landingAdvantagesTitle">
      <div class="landing-section__inner">
        <h2 id="landingAdvantagesTitle" class="landing-section__title">Why ${APP_NAME}</h2>
        <div class="landing-advantages__grid">
          ${items.map((item) => `
            <article class="landing-advantage">
              <span class="landing-advantage__icon">${item.icon}</span>
              <h3 class="landing-advantage__title">${escapeHtml(item.title)}</h3>
              <p class="landing-advantage__body">${escapeHtml(item.body)}</p>
            </article>
          `).join('')}
        </div>
      </div>
    </section>
  `;
}

export function landingAccuracyHtml() {
  return `
    <section class="landing-section landing-section--open landing-accuracy" id="accuracy" aria-labelledby="landingAccuracyTitle">
      <div class="landing-section__inner">
        <p class="landing-section__eyebrow">Accuracy &amp; limits</p>
        <h2 id="landingAccuracyTitle" class="landing-section__title">Transparent estimates, not lab analysis</h2>
        <ul class="landing-accuracy-v2__list">
          <li><strong>Weighed staples and exact product labels</strong> can produce higher confidence.</li>
          <li><strong>Mixed meals</strong> receive central estimates and likely ranges.</li>
          <li><strong>Unmatched foods</strong> remain visible for correction.</li>
          <li><strong>Missing nutrients</strong> display as unavailable—not zero.</li>
        </ul>
        <p class="fine-print">Sources may include UK CoFID, IFCT, verified product labels and clearly labelled estimated references.</p>
        <p class="fine-print"><a href="/accuracy-methodology/">Read our accuracy methodology</a> · Estimates only — not medical advice.</p>
      </div>
    </section>
  `;
}

function landingPlanCard(planId, { featured = false, ctaLabel } = {}) {
  const plan = PLANS[planId];
  const isFree = planId === 'free';
  const monthlyPrice = landingPlanPriceDisplay(planId, { billing: 'monthly' });
  const annualPrice = planId === 'pro' ? landingPlanPriceDisplay('pro', { billing: 'annual' }) : '';
  const title = isFree ? 'Free' : plan.name;
  const features = isFree
    ? ['Barcode, search and describe included', 'Daily totals when signed in']
    : (plan.bullets || []).slice(0, 3);

  return `
    <article class="landing-plan-card${featured ? ' landing-plan-card--featured' : ''}${isFree ? ' landing-plan-card--free' : ''}" data-plan="${planId}">
      ${featured ? '<span class="landing-plan-card__badge">Recommended</span>' : ''}
      <h3 class="landing-plan-card__name">${escapeHtml(title)}</h3>
      <p class="landing-plan-card__price" data-price-monthly>${escapeHtml(monthlyPrice)}</p>
      ${planId === 'pro' ? `<p class="landing-plan-card__price landing-plan-card__price--annual" data-price-annual hidden>${escapeHtml(annualPrice)}</p>` : ''}
      <p class="landing-plan-card__scans">${escapeHtml(landingScanAllowanceLabel(planId))}</p>
      <ul class="landing-plan-card__features">
        ${features.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
      </ul>
      <button type="button" class="btn ${isFree ? 'btn-ghost' : 'btn-primary'} btn-sm landing-plan-card__cta js-guest-scan js-start-free" data-plan="${planId}" data-cta="plan_${planId}">${escapeHtml(ctaLabel)}</button>
    </article>
  `;
}

export function landingPlanCompareHtml() {
  return `
    <section class="landing-section landing-section--teal landing-pricing-v2" id="pricing" aria-labelledby="landingPricingTitle">
      <div class="landing-section__inner">
        <p class="landing-section__eyebrow">Pricing</p>
        <h2 id="landingPricingTitle" class="landing-section__title">Simple plans, clear limits</h2>
        <p class="landing-section__lead">Start free. Upgrade when you want more photo scans and deeper reports.</p>
        <p class="landing-pricing-v2__scan-note landing-scan-credits" role="note">
          Only AI photo analysis uses scan credits. Barcode, Describe and Food Search stay free when signed in.
        </p>
        <div class="landing-pricing__toggle" role="group" aria-label="Billing period">
          <button type="button" class="landing-pricing__toggle-btn landing-pricing__toggle-btn--active" data-landing-billing="monthly" aria-pressed="true">Monthly</button>
          <button type="button" class="landing-pricing__toggle-btn" data-landing-billing="annual" aria-pressed="false">Annual (Pro only)</button>
        </div>
        <div class="landing-pricing__grid landing-pricing__grid--four" id="landingPricingGrid" data-billing="monthly">
          ${landingPlanCard('free', { ctaLabel: 'Start free' })}
          ${landingPlanCard('essential', { ctaLabel: 'Choose Essential' })}
          ${landingPlanCard('plus', { featured: true, ctaLabel: 'Choose Plus' })}
          ${landingPlanCard('pro', { ctaLabel: 'Choose Pro' })}
        </div>
        <details class="landing-pricing__compare-details">
          <summary class="link-btn">Compare all plan features</summary>
          ${renderPlanCompareTableHtml()}
        </details>
        <p class="landing-pricing__fair-use fine-print">
          <strong>Pro fair use:</strong> up to ${PRO_DAILY_FAIR_USE} AI scans per day and about ${PRO_MONTHLY_CAP.toLocaleString()} scans per month.
        </p>
        <p class="landing-pricing__note fine-print">Prices in GBP · cancel anytime · ${ELIGIBILITY_DISCOUNT_PERCENT}% NHS/public-sector and 60+ discount when eligible</p>
      </div>
    </section>
  `;
}

export function landingDiscountStripHtml() {
  return `
    <section class="landing-section landing-section--open" id="landingDiscount" aria-label="Eligible discounts">
      <div class="landing-section__inner">
        <div class="landing-discount-banner">
          <p class="landing-discount-banner__text"><strong>NHS, public-sector and customers aged 60+ receive ${ELIGIBILITY_DISCOUNT_PERCENT}% off.</strong></p>
          <button type="button" class="btn btn-ghost btn-sm" id="landingDiscountCheckBtn">Check eligibility</button>
        </div>
        <p class="fine-print">${APP_NAME} is not affiliated with the NHS.</p>
      </div>
    </section>
  `;
}

export function landingSocialProofHtml() {
  return `
    <section class="landing-section landing-section--open" aria-label="Benchmarking">
      <div class="landing-section__inner landing-social-proof">
        <p class="landing-social-proof__quote">Designed and continuously benchmarked using meals from multiple cuisines.</p>
        <p class="fine-print landing-social-proof__detail">
          Locked test suite of 200 representative meals across UK, Indian, packaged and mixed-dish scenarios.
          <a href="/accuracy-methodology/">See our benchmark methodology</a>.
        </p>
      </div>
    </section>
  `;
}

export function landingFaqHtml() {
  return `
    <section class="landing-section landing-section--teal landing-faq" id="faq" aria-labelledby="landingFaqTitle">
      <div class="landing-section__inner">
        <p class="landing-section__eyebrow">FAQ</p>
        <h2 id="landingFaqTitle" class="landing-section__title">Common questions</h2>
        <div class="landing-faq__list">
          ${MEALNOVA_FAQ.map((item, i) => `
            <details class="landing-faq__item" id="faq-${i + 1}" data-faq-index="${i}">
              <summary>${escapeHtml(item.q)}</summary>
              <p>${escapeHtml(item.a)}</p>
            </details>
          `).join('')}
        </div>
        <p class="landing-faq__more fine-print"><a href="/help-centre/">Full help centre</a></p>
      </div>
    </section>
  `;
}

export function landingPrivacySupportHtml() {
  return `
    <section class="landing-section landing-section--open landing-privacy-pwa landing-support" aria-labelledby="landingPrivacySupportTitle">
      <div class="landing-section__inner">
        <h2 id="landingPrivacySupportTitle" class="visually-hidden">Privacy, install and support</h2>
        <div class="landing-privacy-support__grid">
          <article class="landing-privacy-support__col">
            <h3>Private by design</h3>
            <p>Your meal history is not sold. Export your data or request deletion from Settings or by email.</p>
            <p class="fine-print"><a href="/privacy-security/">Privacy &amp; security</a></p>
          </article>
          <article class="landing-privacy-support__col">
            <h3>Install anywhere</h3>
            <p>Add ${APP_NAME} to iPhone or Android as a progressive web app — no app store required.</p>
          </article>
          <article class="landing-privacy-support__col">
            <h3>Real support</h3>
            <p>Email <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a> — we aim to reply within two working days.</p>
          </article>
        </div>
      </div>
    </section>
  `;
}

export function landingFinalCtaHtml() {
  return `
    <section class="landing-final-cta" aria-label="Get started">
      <div class="landing-section__inner">
        <h2 class="landing-section__title">Ready to make meal tracking easier?</h2>
        <p class="landing-section__lead">Start free—no card required. Barcode, Food Search and Describe are included.</p>
        <div class="landing-final-cta__actions">
          ${startFreeBtn('guestFooterGetStarted')}
          <button type="button" class="btn btn-ghost" id="guestFooterSignIn">Sign in</button>
        </div>
      </div>
    </section>
  `;
}

export function guestLandingFooterHtml() {
  return `
    <footer class="guest-landing-footer-v2" aria-label="Site footer">
      <div class="landing-section__inner guest-landing-footer-v2__grid">
        <div>
          <p class="guest-landing-footer-v2__brand">${APP_NAME}</p>
          <p class="fine-print">UK-built · Estimates only · Not medical advice</p>
        </div>
        <nav class="guest-landing-footer-v2__links" aria-label="Product">
          <a href="/photo-calorie-tracker/">Product</a>
          <a href="/accuracy-methodology/">Accuracy</a>
          <a href="/uk-calorie-tracker/">UK foods</a>
          <a href="/indian-food-calorie-tracker/">Indian foods</a>
          <a href="/help-centre/">Help Centre</a>
        </nav>
        <nav class="guest-landing-footer-v2__links" aria-label="Legal">
          <button type="button" class="link-btn" data-legal="privacy">Privacy</button>
          <button type="button" class="link-btn" data-legal="terms">Terms</button>
          <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">Contact</a>
        </nav>
      </div>
      <p class="guest-landing-footer-v2__meta landing-section__inner">© ${new Date().getFullYear()} ${APP_NAME}</p>
    </footer>
  `;
}

/** @deprecated v1 sections — kept for tests importing names */
export const howItWorksHtml = landingProductDemoHtml;
export const landingRegionalDemosHtml = landingGlobalMealsHtml;
export const landingAiResultHtml = () => '';
export const landingProblemHtml = () => '';
export const landingWhyHtml = landingAdvantagesHtml;
export const landingScanCreditsHtml = () => '<div class="landing-scan-credits visually-hidden" aria-hidden="true"></div>';
export const landingTrustHtml = () => '';
export const landingPrivacyPwaHtml = landingPrivacySupportHtml;
export const landingSupportHtml = () => '';

export function bindLandingPhotos(root = document) {
  root.querySelectorAll('.landing-photo__img').forEach((img) => {
    const figure = img.closest('.landing-photo');
    if (!figure) return;
    const markLoaded = () => {
      figure.classList.remove('landing-photo--loading');
      figure.classList.add('landing-photo--loaded');
    };
    const markFallback = () => {
      figure.classList.remove('landing-photo--loading');
      figure.classList.add('landing-photo--fallback');
    };
    if (img.complete && img.naturalWidth > 0) {
      markLoaded();
      return;
    }
    img.addEventListener('load', markLoaded, { once: true });
    img.addEventListener('error', markFallback, { once: true });
  });
}

export function bindLandingPricing(root) {
  const grid = root.querySelector('#landingPricingGrid');
  if (!grid) return;

  const setBilling = (mode) => {
    grid.dataset.billing = mode;
    root.querySelectorAll('[data-landing-billing]').forEach((btn) => {
      const active = btn.dataset.landingBilling === mode;
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
      btn.classList.toggle('landing-pricing__toggle-btn--active', active);
    });
    const proCard = grid.querySelector('[data-plan="pro"]');
    if (proCard) {
      const monthly = proCard.querySelector('[data-price-monthly]');
      const annual = proCard.querySelector('[data-price-annual]');
      if (monthly) monthly.hidden = mode === 'annual';
      if (annual) annual.hidden = mode !== 'annual';
    }
  };

  root.querySelectorAll('[data-landing-billing]').forEach((btn) => {
    btn.addEventListener('click', () => setBilling(btn.dataset.landingBilling));
  });
  setBilling('monthly');

  const pricingSection = root.querySelector('#pricing');
  if (pricingSection && 'IntersectionObserver' in window) {
    const obs = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        trackLandingPricingViewed();
        obs.disconnect();
      }
    }, { threshold: 0.35 });
    obs.observe(pricingSection);
  }
}

export function bindLandingDiscount(root, { onSignIn } = {}) {
  root.querySelector('#landingDiscountCheckBtn')?.addEventListener('click', () => {
    trackGuestCtaClick('discount_check');
    onSignIn?.('signup', { discountPath: 'public' });
  });
  root.querySelector('#landingDiscountPublicBtn')?.addEventListener('click', () => onSignIn?.('signup', { discountPath: 'public' }));
  root.querySelector('#landingDiscountSeniorBtn')?.addEventListener('click', () => onSignIn?.('signup', { discountPath: 'senior' }));
}

function bindLandingCarousel(root) {
  const track = root.querySelector('#landingGlobalTrack');
  if (!track) return;
  const cardWidth = () => track.querySelector('.landing-global-meals__card')?.offsetWidth || 320;
  root.querySelector('#landingGlobalPrev')?.addEventListener('click', () => {
    track.scrollBy({ left: -(cardWidth() + 14), behavior: 'smooth' });
  });
  root.querySelector('#landingGlobalNext')?.addEventListener('click', () => {
    track.scrollBy({ left: cardWidth() + 14, behavior: 'smooth' });
  });
}

function bindLandingFaq(root) {
  root.querySelectorAll('.landing-faq__item').forEach((item) => {
    item.addEventListener('toggle', () => {
      if (item.open) trackLandingFaqOpened(item.dataset.faqIndex || '0');
    });
  });
}

export function bindLandingMarketing(root, { onSignIn } = {}) {
  bindLandingPhotos(root);
  bindLandingPricing(root);
  bindLandingDiscount(root, { onSignIn });
  bindLandingCarousel(root);
  bindLandingFaq(root);

  root.querySelectorAll('.js-guest-scan, .js-start-free').forEach((btn) => {
    btn.addEventListener('click', () => {
      const location = btn.id || btn.dataset.cta || 'landing';
      trackGuestCtaClick(location);
      trackStartFreeClick(location);
      if (btn.closest('.landing-hero-v2')) trackLandingHeroCta(location);
      if (btn.dataset.plan) trackLandingPlanSelected(btn.dataset.plan);
    });
  });
}
