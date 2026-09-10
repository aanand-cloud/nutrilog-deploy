#!/usr/bin/env node
/** Plan-ahead Phase 1 module sanity checks. */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const phase1Path = join(root, 'src/services/plan-ahead-phase1.js');
const src = readFileSync(phase1Path, 'utf8');

const required = [
  'PLAN_AHEAD_PHASE1_ENABLED',
  'planTomorrowCardHtml',
  'futureDayEmptyPlanHtml',
  'calendarPlanAheadHintHtml',
  'logPlanningCaptureLeadHtml',
];

for (const token of required) {
  if (!src.includes(token)) {
    console.error(`check-plan-ahead-phase1: missing ${token} in plan-ahead-phase1.js`);
    process.exit(1);
  }
}

if (!/export const PLAN_AHEAD_PHASE1_ENABLED = (true|false)/.test(src)) {
  console.error('check-plan-ahead-phase1: PLAN_AHEAD_PHASE1_ENABLED must be a boolean export');
  process.exit(1);
}

console.log('check-plan-ahead-phase1: ok');
