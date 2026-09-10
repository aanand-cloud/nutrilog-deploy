#!/usr/bin/env node
/** Credit alert engine — low balance, expiry, trial warnings. */

import {
  computeCreditAlertsCore,
  daysUntilIso,
  formatCreditDate,
  getCreditPushAlertsCore,
  getPreScanConfirmCore,
  getPrimaryCreditAlertCore,
  usageStripAlertClass,
} from '../shared/credit-alerts-core.js';

let failed = false;
const fail = (msg) => {
  console.error(`test-credit-alerts: ${msg}`);
  failed = true;
};

const loggedIn = { loggedIn: true };

function assertAlerts(label, state, expect) {
  const alerts = computeCreditAlertsCore({
    profile: loggedIn,
    monetizationPaused: false,
    freeAlt: 'Barcode and describe logging stay free',
    ...state,
  });
  for (const [key, val] of Object.entries(expect)) {
    if (key === 'count') {
      if (alerts.length !== val) fail(`${label}: expected ${val} alerts, got ${alerts.length}`);
      continue;
    }
    if (key === 'kinds') {
      const kinds = alerts.map((a) => a.kind);
      for (const k of val) {
        if (!kinds.includes(k)) fail(`${label}: missing kind ${k} in ${kinds.join(', ')}`);
      }
      continue;
    }
    if (key === 'primaryKind') {
      const primary = getPrimaryCreditAlertCore(alerts);
      if (primary?.kind !== val) fail(`${label}: primary kind ${primary?.kind} !== ${val}`);
    }
  }
}

assertAlerts('low subscription balance', {
  planId: 'plus',
  subBalance: 8,
  subAllowance: 300,
  stripePaid: true,
  budget: { allowed: true },
}, { count: 1, kinds: ['low_balance'] });

assertAlerts('critical subscription low', {
  planId: 'essential',
  subBalance: 2,
  subAllowance: 200,
  stripePaid: true,
  budget: { allowed: true },
}, { primaryKind: 'low_balance' });

assertAlerts('promo expiry soon', {
  planId: 'plus',
  subBalance: 40,
  subAllowance: 300,
  subExpireAt: new Date(Date.now() + 2 * 86400000).toISOString(),
  stripePaid: false,
  budget: { allowed: true },
}, { kinds: ['expiry'] });

assertAlerts('stripe renewal info', {
  planId: 'plus',
  subBalance: 120,
  subAllowance: 300,
  subExpireAt: new Date(Date.now() + 5 * 86400000).toISOString(),
  stripePaid: true,
  budget: { allowed: true },
}, { kinds: ['renewal'] });

assertAlerts('topup low free user', {
  planId: 'free',
  topup: 5,
  budget: { allowed: true, dailyFreeRemaining: 1, creditRemaining: 5 },
}, { kinds: ['topup_low'] });

assertAlerts('exhausted subscription', {
  planId: 'plus',
  subBalance: 0,
  subAllowance: 300,
  topup: 0,
  budget: { allowed: false },
}, { primaryKind: 'exhausted' });

assertAlerts('trial ending', {
  planId: 'pro',
  trialUntil: new Date(Date.now() + 3 * 86400000).toISOString(),
  profile: {
    ...loggedIn,
    plan: 'pro',
    trial_until: new Date(Date.now() + 3 * 86400000).toISOString(),
  },
  budget: { allowed: true },
}, { kinds: ['trial'] });

assertAlerts('sync stale', {
  syncFailed: true,
  planId: 'free',
  budget: { allowed: true },
}, { kinds: ['sync_stale'] });

if (daysUntilIso(new Date(Date.now() + 86400000).toISOString()) !== 1) {
  fail('daysUntilIso should return 1 for tomorrow');
}

const formatted = formatCreditDate('2026-09-15T00:00:00.000Z');
if (!formatted.includes('2026') && !formatted.includes('15')) {
  fail(`formatCreditDate unexpected: ${formatted}`);
}

const warnClass = usageStripAlertClass({ tier: 2, severity: 'warn' });
if (warnClass !== 'usage-strip--warn') fail(`usageStripAlertClass warn expected usage-strip--warn, got ${warnClass}`);

const preScan = getPreScanConfirmCore({
  profile: loggedIn,
  planId: 'plus',
  budget: { allowed: true, remaining: 3 },
  subBalance: 3,
  subAllowance: 300,
  stripePaid: true,
});
if (!preScan || !preScan.title.includes('3')) fail('getPreScanConfirmCore should prompt when ≤5 scans remain');

const preScanSkip = getPreScanConfirmCore({
  profile: loggedIn,
  planId: 'plus',
  budget: { allowed: true, remaining: 50 },
  subBalance: 120,
  subAllowance: 300,
  stripePaid: true,
});
if (preScanSkip) fail('getPreScanConfirmCore should be null with comfortable balance');

const pushAlerts = getCreditPushAlertsCore({
  profile: loggedIn,
  planId: 'plus',
  subBalance: 2,
  subAllowance: 300,
  stripePaid: true,
  budget: { allowed: true, remaining: 2 },
}, { creditLowEnabled: true });
if (!pushAlerts.some((a) => a.kind === 'low_balance')) {
  fail('getCreditPushAlertsCore should include low_balance when enabled');
}

if (failed) process.exit(1);
console.log('test-credit-alerts: ok');
