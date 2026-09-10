/** Push live Stripe env vars to Vercel production (reads secret from .env). */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

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

function setVercelEnv(name, value, environment = 'production') {
  let result = spawnSync(
    'npx',
    ['vercel', 'env', 'update', name, environment, '--yes'],
    { cwd: root, input: `${value}\n`, encoding: 'utf8', shell: true }
  );
  if (result.status !== 0) {
    result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, environment, '--yes'],
      { cwd: root, input: `${value}\n`, encoding: 'utf8', shell: true }
    );
  }
  if (result.status !== 0) {
    const err = (result.stderr || result.stdout || '').trim();
    throw new Error(`Failed ${name}: ${err}`);
  }
  console.log(`✓ ${name}`);
}

async function main() {
  const envPath = path.resolve(process.argv[2] || path.join(root, '.env'));
  const fileEnv = loadEnv(envPath);

  const webhookPath = path.join(root, '.stripe-webhook-secret.local');
  let webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret && fs.existsSync(webhookPath)) {
    webhookSecret = fs.readFileSync(webhookPath, 'utf8').trim();
  }

  const vars = {
    URL: 'https://www.mealnova.co.uk',
    STRIPE_SECRET_KEY: fileEnv.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: webhookSecret,
    STRIPE_ESSENTIAL_MONTHLY_PRICE_ID: 'price_1U1lNBGGG4SmpkxwbCsU5bI9',
    STRIPE_ESSENTIAL_MONTHLY_DISCOUNT_PRICE_ID: 'price_1U1lNBGGG4Smpkxw0oP4V3bs',
    STRIPE_PLUS_MONTHLY_PRICE_ID: 'price_1U1lNBGGG4SmpkxwfEc2gP9Z',
    STRIPE_PLUS_MONTHLY_DISCOUNT_PRICE_ID: 'price_1U1lNAGGG4Smpkxw8YTaexFg',
    STRIPE_PRO_MONTHLY_PRICE_ID: 'price_1U1lNHGGG4SmpkxwSA902kce',
    STRIPE_PRO_MONTHLY_DISCOUNT_PRICE_ID: 'price_1U1lNGGGG4SmpkxwBJRd65Ri',
    STRIPE_PRO_ANNUAL_PRICE_ID: 'price_1U1lNFGGG4SmpkxwUg2hmUmz',
    STRIPE_PRO_ANNUAL_DISCOUNT_PRICE_ID: 'price_1U1lNFGGG4SmpkxwVnODXqVl',
    STRIPE_PACK100_PRICE_ID: 'price_1U1lNBGGG4SmpkxwRTbaza2X',
    STRIPE_PACK100_DISCOUNT_PRICE_ID: 'price_1U1lNAGGG4SmpkxwyBJae8ZY',
  };

  if (!vars.STRIPE_SECRET_KEY?.startsWith('sk_live_')) {
    throw new Error('STRIPE_SECRET_KEY in .env must be a live key (sk_live_...)');
  }
  if (!vars.STRIPE_WEBHOOK_SECRET?.startsWith('whsec_')) {
    throw new Error('Run: node scripts/setup-stripe-webhook.mjs .env first');
  }

  console.log('Updating Vercel production Stripe env vars…');
  for (const [name, value] of Object.entries(vars)) {
    if (!value) throw new Error(`Missing value for ${name}`);
    setVercelEnv(name, value);
  }
  console.log('Done — redeploy production for changes to take effect.');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
