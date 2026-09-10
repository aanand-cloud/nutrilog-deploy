#!/usr/bin/env node
/** P10 monitoring guardrails — health route, Sentry wiring, runbooks. */
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

const checks = [
  {
    file: 'vercel.json',
    test: (src) => /\/api\/health/.test(src) && /keep-alive\?health=1/.test(src),
    msg: 'vercel.json must rewrite /api/health to keep-alive health probe',
  },
  {
    file: 'netlify/functions/keep-alive.mjs',
    test: (src) => /MEALNOVA_BUILD/.test(src) && /isHealthProbe/.test(src) && /checks\.supabase/.test(src),
    msg: 'keep-alive.mjs must expose public health probe with build id',
  },
  {
    file: 'netlify/lib/sentry.mjs',
    test: (src) => /reportServerError/.test(src) && /Sentry\.flush/.test(src),
    msg: 'sentry.mjs must capture and flush server errors',
  },
  {
    file: 'src/services/sentry.js',
    test: (src) => /VITE_SENTRY_DSN/.test(src),
    msg: 'frontend sentry.js must read VITE_SENTRY_DSN',
  },
  {
    file: 'api/_adapter.mjs',
    test: (src) => /reportServerError/.test(src),
    msg: 'API adapter must report uncaught errors to Sentry',
  },
  {
    file: 'docs/runbooks.md',
    test: (src) => /\/api\/health/.test(src) && /Sentry/.test(src),
    msg: 'docs/runbooks.md must document health check and Sentry',
  },
  {
    file: 'src/services/credit-alerts.js',
    test: (src) => /confirmBeforePhotoScan/.test(src),
    msg: 'credit-alerts.js must expose confirmBeforePhotoScan for Phase 2',
  },
];

let failed = 0;
for (const { file, test, msg } of checks) {
  if (!existsSync(join(root, file))) {
    console.error(`check-monitoring: missing ${file}`);
    failed += 1;
    continue;
  }
  const src = read(file);
  if (!test(src)) {
    console.error(`check-monitoring: ${msg} (${file})`);
    failed += 1;
  }
}

if (failed) process.exit(1);
console.log('check-monitoring: ok');
