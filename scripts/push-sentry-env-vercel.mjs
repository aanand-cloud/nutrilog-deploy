/** Push Sentry DSN env vars to Vercel production (reads from .env). */
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
    { cwd: root, input: `${value}\n`, encoding: 'utf8', shell: true },
  );
  if (result.status !== 0) {
    result = spawnSync(
      'npx',
      ['vercel', 'env', 'add', name, environment, '--yes'],
      { cwd: root, input: `${value}\n`, encoding: 'utf8', shell: true },
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

  const clientDsn = fileEnv.VITE_SENTRY_DSN || fileEnv.SENTRY_DSN;
  const serverDsn = fileEnv.SENTRY_DSN || fileEnv.VITE_SENTRY_DSN;

  if (!clientDsn?.startsWith('https://')) {
    throw new Error(
      'Add VITE_SENTRY_DSN=https://… to .env first.\nCreate a free project at https://sentry.io → Settings → Client Keys (DSN).',
    );
  }

  console.log('Updating Vercel production Sentry env vars…');
  setVercelEnv('VITE_SENTRY_DSN', clientDsn);
  setVercelEnv('SENTRY_DSN', serverDsn);
  if (fileEnv.SENTRY_ENVIRONMENT) setVercelEnv('SENTRY_ENVIRONMENT', fileEnv.SENTRY_ENVIRONMENT);
  console.log('Done — redeploy production, then Settings → Test Sentry (if VITE_SENTRY_TEST_UI=true).');
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
