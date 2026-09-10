/** Ensure live Stripe webhook points at MealNova production. Prints whsec for Vercel. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Stripe from 'stripe';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEBHOOK_URL = 'https://www.mealnova.co.uk/api/stripe-webhook';
const LEGACY_WEBHOOK_URLS = ['https://nutrilog.uk/api/stripe-webhook', 'https://www.nutrilog.uk/api/stripe-webhook'];
const EVENTS = [
  'checkout.session.completed',
  'invoice.paid',
  'customer.subscription.deleted',
  'customer.subscription.updated',
];

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

async function main() {
  const envPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '.env'));
  const env = { ...loadEnv(envPath), ...process.env };
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY missing in .env');

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });
  const existing = await stripe.webhookEndpoints.list({ limit: 100 });

  for (const legacy of LEGACY_WEBHOOK_URLS) {
    const old = existing.data.find((w) => w.url === legacy && w.status !== 'disabled');
    if (old) {
      await stripe.webhookEndpoints.update(old.id, { disabled: true });
      console.log(`Disabled legacy webhook ${old.id} (${legacy})`);
    }
  }

  const match = existing.data.find((w) => w.url === WEBHOOK_URL && w.status !== 'disabled');

  let endpoint;
  if (match) {
    endpoint = await stripe.webhookEndpoints.update(match.id, {
      enabled_events: EVENTS,
      disabled: false,
      description: 'MealNova production',
    });
    console.log(`Updated webhook ${endpoint.id}`);
  } else {
    endpoint = await stripe.webhookEndpoints.create({
      url: WEBHOOK_URL,
      enabled_events: EVENTS,
      description: 'MealNova production',
    });
    console.log(`Created webhook ${endpoint.id}`);
  }

  console.log(`URL: ${endpoint.url}`);
  console.log('\nAdd to Vercel production:');
  console.log('  URL=https://www.mealnova.co.uk');
  const secretPath = path.join(__dirname, '..', '.stripe-webhook-secret.local');
  if (endpoint.secret) {
    fs.writeFileSync(secretPath, endpoint.secret, 'utf8');
    console.log('Webhook signing secret saved locally for Vercel push.');
  } else if (fs.existsSync(secretPath)) {
    console.log('Webhook updated — using existing signing secret file.');
  } else {
    console.warn('Webhook secret only appears when first created. Check Stripe Dashboard → Webhooks → signing secret.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
