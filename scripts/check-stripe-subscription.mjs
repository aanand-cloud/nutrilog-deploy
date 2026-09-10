/** Check recent Stripe subscription status and webhook events. */
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

function fmt(ts) {
  return new Date(ts * 1000).toLocaleString('en-GB', { timeZone: 'Europe/London' });
}

async function main() {
  const envPath = path.resolve(process.argv[2] || path.join(__dirname, '..', '.env'));
  const env = { ...loadEnv(envPath), ...process.env };
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret?.startsWith('sk_')) throw new Error('STRIPE_SECRET_KEY missing in .env');

  const stripe = new Stripe(secret, { apiVersion: '2024-06-20' });
  const mode = secret.includes('_test_') ? 'test' : 'live';
  console.log(`Stripe mode: ${mode}\n`);

  console.log('=== Recent subscription events ===');
  const events = await stripe.events.list({
    limit: 15,
    types: ['customer.subscription.deleted', 'customer.subscription.updated', 'checkout.session.completed'],
  });
  for (const e of events.data) {
    const obj = e.data.object;
    console.log(`${e.type} | ${fmt(e.created)} | sub status=${obj.status || obj.payment_status || 'n/a'}`);
    if (obj.metadata?.plan) console.log(`  plan: ${obj.metadata.plan}`);
    if (e.type === 'customer.subscription.updated') {
      console.log(`  cancel_at_period_end: ${obj.cancel_at_period_end}`);
      if (obj.current_period_end) console.log(`  period ends: ${fmt(obj.current_period_end)}`);
    }
    if (e.type === 'customer.subscription.deleted') {
      console.log(`  subscription canceled/ended`);
    }
  }

  console.log('\n=== Your subscriptions (latest 5) ===');
  const subs = await stripe.subscriptions.list({
    limit: 5,
    status: 'all',
    expand: ['data.customer'],
  });
  for (const s of subs.data) {
    const email = typeof s.customer === 'object' ? s.customer?.email : s.customer;
    console.log(
      `${s.status} | cancel_at_period_end=${s.cancel_at_period_end} | ends ${fmt(s.current_period_end)} | ${email || 'no email'} | plan=${s.metadata?.plan || '?'}`,
    );
  }

  console.log('\n=== Webhook endpoint ===');
  const hooks = await stripe.webhookEndpoints.list({ limit: 20 });
  const ep = hooks.data.find((w) => w.url.includes('mealnova.co.uk'));
  if (ep) {
    console.log(`${ep.url} — ${ep.status}`);
  } else {
    console.log('No mealnova.co.uk webhook found');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
