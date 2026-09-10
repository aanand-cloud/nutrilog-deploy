#!/usr/bin/env node
/** Regression checks for the public guest landing page. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { formatPlanPrice } from '../src/services/plans.js';
import { landingPlanCompareHtml, landingDiscountStripHtml } from '../src/services/guest-marketing.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const marketingPath = join(root, 'src/services/guest-marketing.js');
const guestCssPath = join(root, 'src/styles/guest-site.css');
const landingV2CssPath = join(root, 'src/styles/landing-v2.css');
const productCopyPath = join(root, 'src/services/product-copy.js');

const marketing = readFileSync(marketingPath, 'utf8');
const guestCss = readFileSync(guestCssPath, 'utf8');
const landingV2Css = readFileSync(landingV2CssPath, 'utf8');
const productCopy = readFileSync(productCopyPath, 'utf8');
const pricingHtml = landingPlanCompareHtml();
const discountHtml = landingDiscountStripHtml();

let failed = false;
const fail = (msg) => {
  console.error(`check-landing-page: ${msg}`);
  failed = true;
};

function parseDemoMeal(name) {
  const match = marketing.match(new RegExp(`const ${name} = \\{([\\s\\S]*?)\\};`));
  if (!match) {
    fail(`missing ${name} demo block`);
    return null;
  }
  const block = match[1];
  const pick = (key) => {
    const m = block.match(new RegExp(`${key}:\\s*'([^']+)'`));
    return m ? m[1] : null;
  };
  return {
    kcal: Number(pick('kcal')),
    protein: Number(pick('protein')),
    carbs: Number(pick('carbs')),
    fat: Number(pick('fat')),
  };
}

function macroKcal({ protein, carbs, fat }) {
  return protein * 4 + carbs * 4 + fat * 9;
}

for (const demoName of ['DEMO_MEAL', 'DEMO_MEAL_INDIAN']) {
  const demo = parseDemoMeal(demoName);
  if (!demo) continue;
  const approx = macroKcal(demo);
  const delta = Math.abs(demo.kcal - approx);
  if (delta > 15) {
    fail(`${demoName} kcal ${demo.kcal} vs macro sum ${approx} (delta ${delta})`);
  }
}

const heroBlock = marketing.match(/export function landingHeroSectionHtml\([\s\S]*?\n\}/);
if (!heroBlock || (heroBlock[0].match(/<h1\b/g) || []).length !== 1) {
  fail('landing hero must contain exactly one H1');
}

if (!/Track any meal in seconds/.test(marketing)) {
  fail('landing hero must use the v2 headline');
}

if (/data-landing-discount-scroll/.test(pricingHtml)) {
  fail('pricing section must not duplicate discount scroll link');
}

if (/Sodium from labels is converted/.test(marketing)) {
  fail('trust copy must use customer-facing salt language');
}

const cssBundle = `${guestCss}\n${landingV2Css}`;
if (!/guest-landing-footer-v2[\s\S]*#0f172a/.test(cssBundle) && !/guest-landing-footer[\s\S]*color:\s*#0f172a/.test(cssBundle)) {
  fail('guest landing footer must set explicit dark foreground colour');
}

if (!/width:\s*min\(1160px,\s*calc\(100%\s*-\s*32px\)\)/.test(cssBundle)) {
  fail('landing container must centre content at 1160px max width');
}

if (!/FREEMIUM_LINE_1/.test(productCopy) || !/FREEMIUM_LINE_2/.test(productCopy)) {
  fail('product copy must define two-line freemium messaging');
}

for (const planId of ['essential', 'plus', 'pro']) {
  const price = formatPlanPrice(planId, false);
  if (!pricingHtml.includes(price)) {
    fail(`landing pricing HTML must include authoritative price ${price}`);
  }
}

if (!pricingHtml.includes(formatPlanPrice('pro_annual', false))) {
  fail('landing pricing HTML must include Pro annual price from plans.js');
}

if ((discountHtml.match(/id="landingDiscount"/g) || []).length !== 1) {
  fail('discount strip id landingDiscount must appear once in rendered strip');
}

if (!/landing-meal-review/.test(marketing)) {
  fail('landing must include a MealNova review UI demonstration');
}

if (!/landing-regional-demos|landing-global-meals/.test(marketing)) {
  fail('landing must include global meal demonstrations');
}

if (!/landing-scan-credits/.test(marketing)) {
  fail('landing must explain scan credit usage');
}

if (!/landing-faq/.test(marketing)) {
  fail('landing must include FAQ section');
}

if (!/landing-accuracy/.test(marketing)) {
  fail('landing must include accuracy and limitations section');
}

if (!/landing-privacy-pwa/.test(marketing)) {
  fail('landing must include privacy and PWA install explanation');
}

if (!/landing-support/.test(marketing)) {
  fail('landing must include customer support contact');
}

if (!/Start free/.test(marketing)) {
  fail('landing must use consistent Start free CTA label');
}

if (failed) process.exit(1);
console.log('check-landing-page: ok');
