/**
 * List live Stripe products/prices for Vercel env var setup.
 * Usage: node scripts/list-stripe-prices.mjs [.env-file]
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

function gbp(amount) {
  if (amount == null) return '—';
  return `£${(amount / 100).toFixed(2)}`;
}

async function main() {
  const envPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '.env'));
  const env = { ...loadEnv(envPath), ...process.env };
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret?.startsWith('sk_')) {
    throw new Error('Add STRIPE_SECRET_KEY=sk_live_... to .env (Live mode key from Stripe Dashboard)');
  }

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });
  const mode = secret.includes('_test_') ? 'TEST' : 'LIVE';
  if (mode === 'TEST') {
    console.warn('Warning: you are using a TEST key — switch to sk_live_... for real payments.\n');
  }

  const prices = await stripe.prices.list({ active: true, limit: 100, expand: ['data.product'] });
  const recurring = prices.data.filter((p) => p.recurring);
  const oneTime = prices.data.filter((p) => !p.recurring);

  console.log(`Stripe ${mode} — subscription prices (for Vercel STRIPE_*_PRICE_ID):\n`);
  for (const p of recurring.sort((a, b) => (a.unit_amount || 0) - (b.unit_amount || 0))) {
    const product = typeof p.product === 'object' ? p.product : null;
    const name = product?.name || p.id;
    const interval = p.recurring?.interval === 'year' ? '/year' : '/month';
    console.log(`${name} — ${gbp(p.unit_amount)}${interval}`);
    console.log(`  ${p.id}\n`);
  }

  if (oneTime.length) {
    console.log('One-off prices (top-up packs):\n');
    for (const p of oneTime) {
      const product = typeof p.product === 'object' ? p.product : null;
      const name = product?.name || p.id;
      console.log(`${name} — ${gbp(p.unit_amount)} one-time`);
      console.log(`  ${p.id}\n`);
    }
  }

  console.log('Copy each price_... ID into matching Vercel env vars, then redeploy.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
