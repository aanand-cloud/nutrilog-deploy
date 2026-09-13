#!/usr/bin/env node
/** Guard against Log screen ReferenceErrors (e.g. stale isPlanning flag). */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const logPath = join(dirname(fileURLToPath(import.meta.url)), '../src/views/log.js');
const src = readFileSync(logPath, 'utf8');

if (/\bisPlanning\b/.test(src)) {
  console.error('check-log-view: do not use bare isPlanning in src/views/log.js — use isPlanningFor(getSaveDateKey())');
  process.exit(1);
}

if (/Is the complete meal visible/.test(src) || /Do you know the total weight of the complete meal/.test(src)) {
  console.error('check-log-view: photo completeness and meal-weight screens were removed — do not bring them back');
  process.exit(1);
}

console.log('check-log-view: ok');
