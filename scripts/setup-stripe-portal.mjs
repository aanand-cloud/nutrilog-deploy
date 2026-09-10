/**
 * Configure Stripe Customer Portal for MealNova plan changes.
 * Usage: node scripts/setup-stripe-portal.mjs [.env-file]
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }
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

const SUBSCRIPTION_PRICE_KEYS = [
  'STRIPE_ESSENTIAL_MONTHLY_PRICE_ID',
  'STRIPE_ESSENTIAL_MONTHLY_DISCOUNT_PRICE_ID',
  'STRIPE_PLUS_MONTHLY_PRICE_ID',
  'STRIPE_PLUS_MONTHLY_DISCOUNT_PRICE_ID',
  'STRIPE_PRO_MONTHLY_PRICE_ID',
  'STRIPE_PRO_MONTHLY_DISCOUNT_PRICE_ID',
  'STRIPE_PRO_ANNUAL_PRICE_ID',
  'STRIPE_PRO_ANNUAL_DISCOUNT_PRICE_ID',
  'STRIPE_PRO_PRICE_ID',
  'STRIPE_DAILY25_PRICE_ID',
  'STRIPE_DAILY25_DISCOUNT_PRICE_ID',
];

const RETURN_URL = 'https://www.mealnova.co.uk/?view=settings';

async function main() {
  const envPath = process.argv[2];
  const fileEnv = envPath ? loadEnv(path.resolve(envPath)) : {};
  const env = { ...fileEnv, ...process.env };

  const secret = env.STRIPE_SECRET_KEY;
  if (!secret?.startsWith('sk_')) {
    throw new Error(
      'STRIPE_SECRET_KEY not found in .env — add a line: STRIPE_SECRET_KEY=sk_live_... then save the file'
    );
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });
  const mode = secret.includes('_test_') ? 'test' : 'live';

  let priceIds = [...new Set(
    SUBSCRIPTION_PRICE_KEYS.map((k) => env[k]).filter((id) => id && id.startsWith('price_'))
  )];

  if (!priceIds.length) {
    console.log('Note: no price IDs in .env — fetching subscription prices from Stripe automatically…');
    const listed = await stripe.prices.list({ active: true, limit: 100, type: 'recurring' });
    priceIds = listed.data.map((p) => p.id);
    console.log(`Found ${priceIds.length} recurring price(s) in Stripe (${mode} mode).`);
  }

  if (!priceIds.length) {
    throw new Error('No active subscription prices found in Stripe');
  }

  const byProduct = new Map();
  const standardPriceIds = new Set(
    SUBSCRIPTION_PRICE_KEYS.filter((k) => !k.includes('DISCOUNT'))
      .map((k) => env[k])
      .filter(Boolean)
  );

  for (const priceId of priceIds) {
    const price = await stripe.prices.retrieve(priceId);
    if (!price.active || !price.recurring) {
      console.warn(`Skipping inactive/non-recurring price: ${priceId}`);
      continue;
    }
    const productId = String(price.product);
    const interval = price.recurring.interval || 'month';
    if (!byProduct.has(productId)) byProduct.set(productId, new Map());
    const intervals = byProduct.get(productId);
    const existingId = intervals.get(interval);
    if (!existingId) {
      intervals.set(interval, priceId);
      continue;
    }
    const existing = await stripe.prices.retrieve(existingId);
    const preferNew =
      (standardPriceIds.has(priceId) && !standardPriceIds.has(existingId))
      || ((price.unit_amount || 0) > (existing.unit_amount || 0)
        && !standardPriceIds.has(existingId));
    if (preferNew) intervals.set(interval, priceId);
  }

  const products = [...byProduct.entries()].slice(0, 10).map(([product, intervals]) => ({
    product,
    prices: [...intervals.values()],
  }));

  if (!products.length) {
    throw new Error('Could not resolve any active Stripe products from price IDs');
  }

  const features = {
    customer_update: {
      enabled: true,
      allowed_updates: ['email'],
    },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: {
      enabled: true,
      mode: 'at_period_end',
      cancellation_reason: {
        enabled: true,
        options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other'],
      },
      proration_behavior: 'none',
    },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ['price'],
      proration_behavior: 'create_prorations',
      products,
    },
  };

  const payload = {
    business_profile: {
      headline: 'Manage your MealNova subscription',
      privacy_policy_url: 'https://www.mealnova.co.uk/?view=settings',
    },
    default_return_url: RETURN_URL,
    features,
  };

  const existing = await stripe.billingPortal.configurations.list({ limit: 10 });
  const current = existing.data.find((c) => c.is_default) || existing.data[0];

  let config;
  if (current) {
    config = await stripe.billingPortal.configurations.update(current.id, payload);
    console.log(`Updated portal configuration ${config.id}`);
  } else {
    config = await stripe.billingPortal.configurations.create(payload);
    console.log(`Created portal configuration ${config.id}`);
    console.log('Tip: In Stripe Dashboard → Settings → Billing → Customer portal, set this as the active configuration if prompted.');
  }

  console.log(`Stripe mode: ${mode}`);
  console.log(`Return URL: ${RETURN_URL}`);
  console.log(`Products in portal: ${products.length}`);
  for (const p of products) {
    const prod = await stripe.products.retrieve(p.product);
    console.log(`  - ${prod.name || p.product}: ${p.prices.length} price(s)`);
  }
  console.log('Enabled: plan changes, cancel at period end, payment method update, invoices');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
