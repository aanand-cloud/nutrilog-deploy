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

console.log('check-log-view: ok');
