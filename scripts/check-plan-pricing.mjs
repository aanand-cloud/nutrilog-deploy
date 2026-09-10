#!/usr/bin/env node
/** P7 — plan pricing and comparison consistency checks. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatPlanPrice } from '../src/services/plans.js';
import {
  PLAN_COMPARE_ROWS,
  renderPlanCompareTableHtml,
  landingPlanPriceDisplay,
} from '../src/services/plan-comparison.js';
import { landingPlanCompareHtml } from '../src/services/guest-marketing.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let failed = false;
const fail = (msg) => {
  console.error(`check-plan-pricing: ${msg}`);
  failed = true;
};

const pricingHtml = landingPlanCompareHtml();
renderPlanCompareTableHtml();

const requiredRows = [
  'AI photo scans',
  'Barcode logging',
  'Describe (type/voice)',
  'Food search',
  'Reports',
  'AI coach & insights',
  'Data export',
  'Support',
  'Fair-use cap',
];

for (const label of requiredRows) {
  if (!PLAN_COMPARE_ROWS.some((r) => r.label === label)) {
    fail(`PLAN_COMPARE_ROWS missing ${label}`);
  }
}

if (!/Only AI photo analysis uses scan credits/.test(pricingHtml)) {
  fail('landing must explain scan credits concisely');
}

if (!/landing-pricing__grid--four/.test(pricingHtml)) {
  fail('landing must use 4-tier plan grid');
}

for (const planId of ['free', 'essential', 'plus', 'pro']) {
  if (!new RegExp(`data-plan="${planId}"`).test(pricingHtml)) {
    fail(`landing must include ${planId} plan card`);
  }
}

for (const planId of ['essential', 'plus', 'pro']) {
  const price = formatPlanPrice(planId, false);
  if (!pricingHtml.includes(price)) {
    fail(`landing must show ${planId} price ${price}`);
  }
}

const proAnnual = landingPlanPriceDisplay('pro', { billing: 'annual' });
if (!pricingHtml.includes(proAnnual)) {
  fail(`landing must include Pro annual price ${proAnnual}`);
}

if (/Plus — Recommended/.test(pricingHtml)) {
  fail('Plus recommended label must not duplicate badge in heading');
}

const marketing = readFileSync(join(root, 'src/services/guest-marketing.js'), 'utf8');
if (/function landingPlanFeatureTableHtml/.test(marketing)) {
  fail('guest-marketing must use shared plan-comparison table');
}

const productFeatures = readFileSync(join(root, 'src/services/product-features.js'), 'utf8');
if (!/plan-comparison/.test(productFeatures)) {
  fail('product-features must import plan-comparison');
}

if (failed) process.exit(1);
console.log('check-plan-pricing: ok');
