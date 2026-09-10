#!/usr/bin/env node
/**
 * Capture real MealNova UI frames for the landing demo video.
 * Optional auth via MEALNOVA_DEMO_EMAIL / MEALNOVA_DEMO_PASSWORD in .env or .env.local.
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'public', 'images', 'landing-demo');
const baseUrl = process.env.MEALNOVA_CAPTURE_URL || 'https://www.mealnova.co.uk/';

function loadEnvFile(name) {
  const path = join(root, name);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let val = trimmed.slice(idx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile('.env');
loadEnvFile('.env.local');

mkdirSync(outDir, { recursive: true });

async function captureFrame(page, name, shot) {
  const path = join(outDir, name);
  await shot(path);
  console.log(`wrote ${path}`);
}

async function signInIfConfigured(page) {
  const email = process.env.MEALNOVA_DEMO_EMAIL;
  const password = process.env.MEALNOVA_DEMO_PASSWORD;
  if (!email || !password) {
    console.log('No MEALNOVA_DEMO_* credentials — capturing guest-visible UI only.');
    return false;
  }

  await page.click('#siteHeaderSignIn');
  await page.waitForSelector('[role="dialog"]', { timeout: 15000 });
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('[role="dialog"] button.btn-primary, [role="dialog"] button[type="submit"]').first().click();
  await page.waitForTimeout(3500);
  return true;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
  });
  const page = await context.newPage();

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.landing-hero-v2__headline', { timeout: 20000 });

  await captureFrame(page, 'frame-01-hero.png', (p) =>
    page.locator('.landing-hero-v2__visual').screenshot({ path: p }));

  await captureFrame(page, 'frame-02-result-card.png', (p) =>
    page.locator('.landing-result-card').screenshot({ path: p }));

  await page.evaluate(() => {
    document.querySelector('[data-view="log"]')?.click();
  });
  await page.waitForSelector('.log-screen', { timeout: 15000 });
  await page.waitForTimeout(700);
  await captureFrame(page, 'frame-03-log-photo.png', (p) =>
    page.locator('.log-screen').screenshot({ path: p }));

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForSelector('.landing-hero-v2__headline', { timeout: 20000 });
  await page.click('#siteHeaderTryFree');
  await page.waitForSelector('[role="dialog"]', { timeout: 10000 });
  await captureFrame(page, 'frame-04-signup.png', (p) =>
    page.locator('[role="dialog"]').screenshot({ path: p }));
  await page.keyboard.press('Escape').catch(() => {});

  const signedIn = await signInIfConfigured(page);
  if (signedIn) {
    await page.evaluate(() => {
      document.querySelector('[data-view="log"]')?.click();
    });
    await page.waitForSelector('.log-screen', { timeout: 15000 });
    await page.waitForTimeout(700);
    await captureFrame(page, 'frame-05-describe-ready.png', (p) =>
      page.locator('.log-screen').screenshot({ path: p }));
  }

  await page.goto(`${baseUrl}#pricing`, { waitUntil: 'networkidle' });
  await page.waitForSelector('#landingPricingGrid', { timeout: 15000 });
  await page.waitForTimeout(500);
  await captureFrame(page, 'frame-06-pricing.png', (p) =>
    page.locator('#pricing').screenshot({ path: p }));

  await browser.close();
  console.log('capture-landing-demo-frames: ok');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
