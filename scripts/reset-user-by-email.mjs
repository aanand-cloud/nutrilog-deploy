/**
 * Delete a Supabase auth user by email so they can sign up again.
 * Usage: node scripts/reset-user-by-email.mjs user@example.com
 *
 * Requires .env with SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function loadEnv() {
  const path = resolve(root, '.env');
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return env;
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

async function findUserByEmail(admin, email) {
  let page = 1;
  const perPage = 200;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const match = users.find((u) => normalizeEmail(u.email) === email);
    if (match) return match;
    if (users.length < perPage) break;
    page += 1;
  }
  return null;
}

const emailArg = process.argv[2];
const email = normalizeEmail(emailArg);

if (!email || !email.includes('@')) {
  console.error('Usage: node scripts/reset-user-by-email.mjs user@example.com');
  process.exit(1);
}

const env = loadEnv();
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log(`Looking up ${email}…`);
const user = await findUserByEmail(admin, email);

if (!user) {
  console.log('No account found for that email — they should be able to sign up fresh.');
  process.exit(0);
}

console.log(`Found user ${user.id} (created ${user.created_at}, confirmed: ${Boolean(user.email_confirmed_at)})`);

const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
if (deleteError) {
  console.error('Delete failed:', deleteError.message);
  process.exit(1);
}

console.log('Deleted. Ask the customer to create a new account at mealnova.co.uk (Sign in → Create free account).');
