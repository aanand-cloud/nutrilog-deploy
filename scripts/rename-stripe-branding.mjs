/**
 * Rename Stripe products from NutriLog → MealNova (customer-facing checkout names).
 * Usage: node scripts/rename-stripe-branding.mjs [.env-file]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function toMealNovaName(name) {
  return String(name || '')
    .replace(/\bNutriLog\b/gi, 'MealNova')
    .replace(/\bNUTRILOG\b/g, 'MealNova')
    .trim();
}

async function main() {
  const envPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '.env'));
  const env = { ...loadEnv(envPath), ...process.env };
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret?.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY missing in .env');
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });
  const mode = secret.includes('_test_') ? 'test' : 'live';
  console.log(`Updating Stripe ${mode} product names to MealNova…\n`);

  const products = await stripe.products.list({ active: true, limit: 100 });
  let updated = 0;

  for (const product of products.data) {
    const nextName = toMealNovaName(product.name);
    if (!nextName || nextName === product.name) continue;

    await stripe.products.update(product.id, { name: nextName });
    console.log(`✓ ${product.name} → ${nextName}`);
    updated += 1;
  }

  if (!updated) {
    console.log('All active products already use MealNova names (or no NutriLog names found).');
  } else {
    console.log(`\nUpdated ${updated} product(s). Checkout will show MealNova on next purchase.`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
