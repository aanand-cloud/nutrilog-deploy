/** Shared SEO metadata, FAQ, and static marketing page registry. */

import { APP_NAME, SITE_URL } from './brand.js';
import { SUPPORT_EMAIL } from './legal-constants.js';
import { FREE_DAILY_SCANS, PRO_DAILY_FAIR_USE, PRO_MONTHLY_CAP } from './plans.js';
import { BARCODE_COPY, DESCRIBE_COPY, FREEMIUM_LINE_1, FREEMIUM_LINE_2 } from './product-copy.js';

export { SITE_URL };

export const OG_IMAGE = `${SITE_URL}/images/hero-meal.webp`;

/** FAQ — single source for landing accordion and FAQPage JSON-LD. */
export const MEALNOVA_FAQ = [
  {
    q: 'How accurate are MealNova estimates?',
    a: 'Weighed staples and exact product labels can produce higher confidence when matched to sources such as UK CoFID, IFCT or verified labels. Mixed meals receive central estimates and likely ranges because recipe and portion size vary. See our accuracy methodology for limits.',
  },
  {
    q: 'Which features are free?',
    a: `Barcode logging, food search and Describe stay free when signed in. Only AI photo analysis uses scan credits. Free accounts include ${FREE_DAILY_SCANS} AI photo scan per day.`,
  },
  {
    q: 'Can MealNova recognise foods from different countries?',
    a: 'MealNova is designed for home cooking, restaurant meals and mixed dishes from many cuisines — including strong support for UK and Indian foods alongside Mediterranean, Asian, Middle Eastern and other everyday plates. Results depend on what is visible and how portions are reviewed.',
  },
  {
    q: 'What happens if a food is not recognised?',
    a: 'Unmatched items stay visible on the review screen so you can rename them, adjust portions, search the database or remove them before saving. Nothing is silently dropped.',
  },
  {
    q: 'Are my meal photos and history private?',
    a: 'Your meal history is not sold. You can export your data or request deletion from Settings or by email. See our privacy page for retention and security details.',
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Paid plans can be cancelled from Settings. You keep access until the end of the current billing period and can continue on the free plan afterwards.',
  },
];

export const MARKETING_PAGE_SLUGS = [
  'photo-calorie-tracker',
  'uk-calorie-tracker',
  'indian-food-calorie-tracker',
  'barcode-nutrition-scanner',
  'meal-planning-reports',
  'accuracy-methodology',
  'privacy-security',
  'help-centre',
];

/** @type {Record<string, { path: string, title: string, description: string, h1: string, lead: string, sections: Array<{ h2?: string, html: string }>, includeFaqSchema?: boolean }>} */
export const MARKETING_PAGES = {
  'photo-calorie-tracker': {
    path: '/photo-calorie-tracker',
    title: 'Photo Calorie Tracker — MealNova',
    description: 'Track calories from a meal photo. Review editable portions, confidence ranges and nutrition sources before saving.',
    h1: 'Photo calorie tracker',
    lead: 'Snap your plate, review AI-identified foods and portion weights, then save to your diary — with transparent sources where available.',
    sections: [
      {
        h2: 'How photo logging works',
        html: `<ol class="marketing-static__list">
          <li><strong>Snap</strong> — photograph your meal in natural light.</li>
          <li><strong>Review</strong> — check each food, gram weight and confidence range.</li>
          <li><strong>Save</strong> — totals update your daily calories and macros.</li>
        </ol>
        <p>Photo scans use your AI scan allowance. ${FREEMIUM_LINE_1}. ${FREEMIUM_LINE_2}.</p>`,
      },
      {
        h2: 'Why review matters',
        html: `<p>Mixed plates and restaurant portions vary. ${APP_NAME} opens the review screen on first submission so you can adjust weights, mark unmatched items and scale how much you ate (100%, 75%, 50% and more) before saving.</p>`,
      },
    ],
  },
  'uk-calorie-tracker': {
    path: '/uk-calorie-tracker',
    title: 'UK Calorie Tracker — MealNova',
    description: 'Track British meals — fish and chips, beans on toast, Sunday roast and more — with UK CoFID-backed nutrition where available.',
    h1: 'UK calorie tracker',
    lead: 'Built for everyday British meals, from chip-shop classics to home-cooked plates, with sources such as UK CoFID where we can match them.',
    sections: [
      {
        h2: 'UK meals we handle well',
        html: `<ul class="marketing-static__list">
          <li>Fish and chips with mushy peas — component weights and frying-oil uncertainty shown</li>
          <li>Beans on toast, full English, bangers and mash, Sunday roast</li>
          <li>Weighed staples — rice, baked beans, eggs, semi-skimmed milk</li>
          <li>Packaged foods via barcode — nutrition from available label data</li>
        </ul>`,
      },
      {
        h2: 'Sources and limits',
        html: `<p>Where a food maps to UK CoFID or a verified product label, we show the source on review. Takeaway and pub portions remain estimates — always check the pack or menu when accuracy matters.</p>`,
      },
    ],
  },
  'indian-food-calorie-tracker': {
    path: '/indian-food-calorie-tracker',
    title: 'Indian Food Calorie Tracker — MealNova',
    description: 'Log idli, dosa, biryani, chole bhature, poha and regional Indian meals with IFCT-backed data and editable portions.',
    h1: 'Indian food calorie tracker',
    lead: 'North, South and regional Indian plates — with piece-to-gram conversion for idli, roti and bhature, and IFCT references where matched.',
    sections: [
      {
        h2: 'Regional coverage',
        html: `<ul class="marketing-static__list">
          <li>South Indian — idli with sambar and chutney, dosa plates, uttapam</li>
          <li>North Indian — chole bhature, chicken tikka masala with rice, korma with chapati</li>
          <li>Everyday staples — poha, dal, basmati rice, paneer dishes</li>
          <li>Restaurant biryani — medium confidence with recipe uncertainty explained</li>
        </ul>`,
      },
      {
        h2: 'Describe or photograph',
        html: `<p>Type a meal like <em>3 idlis with 30 g coconut chutney</em> using Describe (always free), or photograph your plate. Component order does not change the result — each food keeps its quantity and weight.</p>`,
      },
    ],
  },
  'barcode-nutrition-scanner': {
    path: '/barcode-nutrition-scanner',
    title: 'Barcode Nutrition Scanner — MealNova',
    description: 'Scan packaged food barcodes for nutrition from available label data. Always free with your MealNova account — no AI scan credits used.',
    h1: 'Barcode nutrition scanner',
    lead: BARCODE_COPY.detail,
    sections: [
      {
        h2: 'When to use barcode',
        html: `<p>Packaged yogurt, snacks, ready meals and drinks with a UK or international barcode are fastest by scan. Nutrition comes from available label data — verify against the physical pack.</p>`,
      },
      {
        h2: 'No scan credits',
        html: `<p>Barcode logging, food search and Describe never deduct from your photo scan allowance. ${FREEMIUM_LINE_2}.</p>`,
      },
    ],
  },
  'meal-planning-reports': {
    path: '/meal-planning-reports',
    title: 'Meal Planning & Nutrition Reports — MealNova',
    description: 'Daily totals, weekly trends and macro reports on Essential, Plus and Pro plans. Plan ahead on the calendar view.',
    h1: 'Meal planning and nutrition reports',
    lead: 'See today’s calories and macros, plan future meals on the calendar, and unlock weekly reports on paid plans.',
    sections: [
      {
        h2: 'Daily tracking',
        html: `<p>Every saved meal adds to your Today view — calories, protein, carbs and fat. Adjust portions at log time so your diary reflects what you actually ate.</p>`,
      },
      {
        h2: 'Reports by plan',
        html: `<ul class="marketing-static__list">
          <li><strong>Free</strong> — daily totals when signed in</li>
          <li><strong>Essential</strong> — weekly calories and macro report</li>
          <li><strong>Plus / Pro</strong> — 7-day and 30-day trends, fibre, sugar and salt; AI coach tips on Plus+</li>
        </ul>`,
      },
    ],
  },
  'accuracy-methodology': {
    path: '/accuracy-methodology',
    title: 'Accuracy & Methodology — MealNova',
    description: 'How MealNova estimates nutrition: parsing, CoFID and IFCT sources, confidence bands, ranges and known limitations.',
    h1: 'Accuracy and methodology',
    lead: 'We do not claim universal percentage accuracy. Here is how estimates are built and where they can vary.',
    sections: [
      {
        h2: 'Calculation pipeline',
        html: `<p>Describe or photo input → parsed components → canonical food match → preparation state → weight → verified per-100g nutrition → component total → meal sum. Missing nutrients stay unavailable — never shown as zero.</p>`,
      },
      {
        h2: 'Confidence bands',
        html: `<ul class="marketing-static__list">
          <li><strong>High</strong> — exact products or simple weighed foods with authoritative data</li>
          <li><strong>Medium</strong> — correctly identified variable dishes with known portions but recipe uncertainty</li>
          <li><strong>Low</strong> — unmatched components, unclear weight or major assumptions</li>
        </ul>`,
      },
      {
        h2: 'Limitations',
        html: `<p>Restaurant oil, batter absorption, hidden ingredients and regional recipes change calories. Ranges show likely bounds; the central estimate always falls inside the displayed range. Unmatched components stay visible — we do not silently drop accompaniments.</p>`,
      },
    ],
  },
  'privacy-security': {
    path: '/privacy-security',
    title: 'Privacy & Security — MealNova',
    description: 'How MealNova handles your account, meal history, exports and deletion. UK-built by Ventra Digital.',
    h1: 'Privacy and security',
    lead: 'Your meal history syncs to your account when signed in. You can export or delete your data from Settings.',
    sections: [
      {
        h2: 'What we store',
        html: `<p>Account email, meal logs, preferences and subscription status. Meal photos are processed for analysis; retention follows our privacy policy in the app.</p>`,
      },
      {
        h2: 'Your controls',
        html: `<ul class="marketing-static__list">
          <li>Export meals and account data (JSON and CSV) from Settings</li>
          <li>Request account deletion from Settings or email ${SUPPORT_EMAIL}</li>
          <li>Analytics, where used, avoids transmitting sensitive health details without appropriate safeguards</li>
        </ul>`,
      },
      {
        h2: 'Security',
        html: `<p>Signed-in sessions use industry-standard authentication. Payment data is handled by Stripe — card details are not stored on MealNova servers.</p>`,
      },
    ],
  },
  'help-centre': {
    path: '/help-centre',
    title: 'Help Centre & FAQ — MealNova',
    description: 'Answers about AI scans, barcode logging, plans, PWA install, accuracy and contacting MealNova support.',
    h1: 'Help centre',
    lead: 'Quick answers about logging meals, plans and getting support.',
    includeFaqSchema: true,
    sections: [],
  },
};

export function faqPageJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: MEALNOVA_FAQ.map(({ q, a }) => ({
      '@type': 'Question',
      name: q,
      acceptedAnswer: { '@type': 'Answer', text: a },
    })),
  };
}

export function pageJsonLd(page) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: page.title,
    description: page.description,
    url: `${SITE_URL}${page.path}`,
    isPartOf: { '@type': 'WebSite', name: APP_NAME, url: `${SITE_URL}/` },
  };
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function faqSectionHtml() {
  return `
    <div class="landing-faq__list marketing-static__faq">
      ${MEALNOVA_FAQ.map((item, i) => `
        <details class="landing-faq__item" id="faq-${i + 1}">
          <summary>${escapeHtml(item.q)}</summary>
          <p>${escapeHtml(item.a)}</p>
        </details>
      `).join('')}
    </div>
  `;
}

export function buildStaticMarketingPageHtml(slug) {
  const page = MARKETING_PAGES[slug];
  if (!page) throw new Error(`Unknown marketing page: ${slug}`);

  const canonical = `${SITE_URL}${page.path}`;
  const jsonLd = [
    pageJsonLd(page),
    ...(page.includeFaqSchema ? [faqPageJsonLd()] : []),
  ];

  const bodySections = slug === 'help-centre'
    ? faqSectionHtml()
    : page.sections.map((section) => `
        <section class="marketing-static__section">
          ${section.h2 ? `<h2>${escapeHtml(section.h2)}</h2>` : ''}
          ${section.html}
        </section>
      `).join('');

  const footerLinks = MARKETING_PAGE_SLUGS.map((s) => {
    const p = MARKETING_PAGES[s];
    return `<a href="${p.path}/">${escapeHtml(p.h1)}</a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
  <meta name="theme-color" content="#0d6b64"/>
  <meta name="description" content="${escapeHtml(page.description)}"/>
  <meta property="og:title" content="${escapeHtml(page.title)}"/>
  <meta property="og:description" content="${escapeHtml(page.description)}"/>
  <meta property="og:image" content="${OG_IMAGE}"/>
  <meta property="og:url" content="${canonical}/"/>
  <meta property="og:type" content="website"/>
  <meta name="twitter:card" content="summary_large_image"/>
  <meta name="twitter:title" content="${escapeHtml(page.title)}"/>
  <meta name="twitter:description" content="${escapeHtml(page.description)}"/>
  <meta name="twitter:image" content="${OG_IMAGE}"/>
  <script type="application/ld+json">${JSON.stringify(jsonLd.length === 1 ? jsonLd[0] : jsonLd)}</script>
  <title>${escapeHtml(page.title)}</title>
  <link rel="canonical" href="${canonical}/"/>
  <link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png"/>
  <link rel="apple-touch-icon" href="/icons/icon-192.png"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap" rel="stylesheet"/>
  <link rel="stylesheet" href="/src/styles/type-tokens.css"/>
  <link rel="stylesheet" href="/src/styles/app.css"/>
  <link rel="stylesheet" href="/src/styles/guest-site.css"/>
  <link rel="stylesheet" href="/src/styles/marketing-pages.css"/>
</head>
<body class="marketing-static-page">
  <header class="marketing-static-header">
    <div class="marketing-static-header__inner">
      <a href="/" class="site-header__brand" aria-label="${escapeHtml(APP_NAME)} home">
        <img src="/icons/icon-192.png" alt="" width="32" height="32" class="marketing-static-header__icon"/>
        <span class="site-header__name">${escapeHtml(APP_NAME)}</span>
      </a>
      <nav class="marketing-static-header__nav" aria-label="Marketing pages">
        <a href="/">Home</a>
        <a href="/help-centre/">Help</a>
        <a href="/#pricing">Pricing</a>
      </nav>
      <a class="btn btn-primary btn-sm marketing-static-header__cta" href="/">Start free</a>
    </div>
  </header>
  <main class="marketing-static-main">
    <article class="marketing-static-article card">
      <p class="marketing-static__eyebrow">${escapeHtml(APP_NAME)}</p>
      <h1>${escapeHtml(page.h1)}</h1>
      <p class="marketing-static__lead">${escapeHtml(page.lead)}</p>
      ${bodySections}
      <p class="marketing-static__cta-row">
        <a class="btn btn-primary" href="/">Open ${escapeHtml(APP_NAME)}</a>
        <a class="btn btn-ghost" href="/accuracy-methodology/">Read about accuracy</a>
      </p>
    </article>
  </main>
  <footer class="marketing-static-footer">
    <nav class="marketing-static-footer__nav" aria-label="Site links">${footerLinks}</nav>
    <p class="marketing-static-footer__meta fine-print">Estimates only · Not medical advice · UK-built by Ventra Digital · <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}">${escapeHtml(SUPPORT_EMAIL)}</a></p>
  </footer>
</body>
</html>`;
}

export function buildSitemapXml() {
  const urls = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'weekly' },
    ...MARKETING_PAGE_SLUGS.map((slug) => ({
      loc: `${SITE_URL}${MARKETING_PAGES[slug].path}/`,
      priority: slug === 'help-centre' ? '0.8' : '0.7',
      changefreq: 'monthly',
    })),
  ];

  const body = urls.map(({ loc, priority, changefreq }) => `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}
