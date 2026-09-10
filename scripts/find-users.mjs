/**
 * Search Supabase auth users by email or display name fragment.
 * Usage: node scripts/find-users.mjs phil
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

const query = String(process.argv[2] || '').trim().toLowerCase();
if (!query) {
  console.error('Usage: node scripts/find-users.mjs phil');
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

function displayName(user) {
  return String(user?.user_metadata?.display_name || user?.raw_user_meta_data?.display_name || '').trim();
}

const matches = [];
let page = 1;
const perPage = 200;

while (page <= 20) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
  if (error) throw error;
  const users = data?.users || [];
  for (const user of users) {
    const email = String(user.email || '').toLowerCase();
    const name = displayName(user).toLowerCase();
    if (email.includes(query) || name.includes(query)) {
      matches.push(user);
    }
  }
  if (users.length < perPage) break;
  page += 1;
}

if (!matches.length) {
  console.log(`No users matched "${query}" in auth.users.`);
  process.exit(0);
}

console.log(`Found ${matches.length} match(es) for "${query}":\n`);
for (const user of matches) {
  console.log(`- ${user.email || '(no email)'}`);
  console.log(`  name: ${displayName(user) || '(none)'}`);
  console.log(`  created: ${user.created_at}`);
  console.log(`  confirmed: ${Boolean(user.email_confirmed_at)}`);
  console.log(`  id: ${user.id}`);
  console.log('');
}
