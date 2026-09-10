#!/usr/bin/env node
/** Static accessibility guardrails for P9 — key patterns in shell, views, and modals. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
  return readFileSync(join(root, relPath), 'utf8');
}

const checks = [
  {
    file: 'index.html',
    test: (src) => /class="skip-link" href="#main"/.test(src),
    msg: 'index.html must include a skip link to #main',
  },
  {
    file: 'src/services/modal-a11y.js',
    test: (src) => /\.inert\s*=\s*true/.test(src) && /\.inert\s*=\s*false/.test(src),
    msg: 'modal-a11y.js must toggle inert on background while dialogs are open',
  },
  {
    file: 'src/services/meal-review-modal.js',
    test: (src) => !/\bwindow\.confirm\b/.test(src) && /openConfirmModal/.test(src),
    msg: 'meal-review-modal.js must use openConfirmModal instead of window.confirm',
  },
  {
    file: 'src/services/meal-review-modal.js',
    test: (src) => /captureFocusToken/.test(src) && /restoreFocusToken/.test(src),
    msg: 'meal-review-modal.js must preserve focus across re-renders',
  },
  {
    file: 'src/app.js',
    test: (src) => /function focusMainHeading/.test(src),
    msg: 'app.js must move focus to the main heading on view changes',
  },
  {
    file: 'src/views/today.js',
    test: (src) => /role="tablist"/.test(src) && /role="tab"/.test(src) && /aria-valuetext=/.test(src),
    msg: 'today.js must expose settings tabs and usage meter aria-valuetext',
  },
  {
    file: 'src/views/log.js',
    test: (src) => /aria-live="polite"/.test(src) && /aria-current="step"/.test(src),
    msg: 'log.js must announce status and mark the active log step',
  },
  {
    file: 'src/styles/app.css',
    test: (src) => /\.skip-link:focus/.test(src) && /\.icon-btn[\s\S]*width:\s*44px/.test(src),
    msg: 'app.css must style skip-link focus and 44px icon buttons',
  },
];

let failed = 0;
for (const { file, test, msg } of checks) {
  const src = read(file);
  if (!test(src)) {
    console.error(`check-a11y: ${msg} (${file})`);
    failed += 1;
  }
}

if (failed) process.exit(1);
console.log('check-a11y: ok');
