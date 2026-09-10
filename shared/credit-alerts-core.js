/**
 * Pure credit alert logic — no browser auth/subscription imports (Node-testable).
 */

import {
  isCreditSubscriptionPlan,
  isUnlimitedPlan,
  normalizePlanId,
} from '../netlify/lib/plans.mjs';

const PLAN_NAMES = {
  free: 'Free',
  essential: 'Essential',
  plus: 'Plus',
  pro: 'Pro',
  pro_annual: 'Pro Annual',
};

function isPaidTrialPlan(plan) {
  const p = plan || 'free';
  return p === 'pro' || p === 'pro_annual' || p === 'plus' || p === 'essential'
    || p === 'daily25' || p === 'daily10';
}

export function isTrialActive(profile) {
  if (!profile?.trial_until) return false;
  if (new Date(profile.trial_until) <= new Date()) return false;
  return isPaidTrialPlan(profile.plan);
}

export function daysUntilIso(iso) {
  if (!iso) return null;
  const end = new Date(iso);
  if (Number.isNaN(end.getTime())) return null;
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

export function formatCreditDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function daysLabel(days) {
  if (days == null) return '';
  if (days <= 0) return 'today';
  if (days === 1) return 'tomorrow';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

/**
 * @param {object} state
 * @returns {Array<object>}
 */
export function computeCreditAlertsCore(state) {
  const {
    profile = {},
    planId,
    budget = { allowed: true },
    subBalance = 0,
    subAllowance = 0,
    topup = 0,
    subExpireAt = null,
    subscriptionExpiresAt = null,
    trialUntil = null,
    stripePaid = false,
    syncFailed = false,
    monetizationPaused = false,
    freeAlt = 'Barcode and describe logging stay free',
  } = state;

  if (monetizationPaused || profile.loggedIn === false) return [];

  const alerts = [];
  const planName = PLAN_NAMES[planId] || planId;

  if (syncFailed) {
    alerts.push({
      id: 'sync-stale',
      tier: 2,
      severity: 'warn',
      kind: 'sync_stale',
      title: 'Allowance may be outdated',
      body: 'We could not refresh your scan balance. Tap refresh — your credits are saved on your account.',
      dismissKey: 'sync-stale',
      cta: { label: 'Refresh', action: 'refresh' },
    });
  }

  if (isTrialActive({ ...profile, trial_until: trialUntil, plan: profile.plan || planId })) {
    const days = daysUntilIso(trialUntil);
    if (days != null && days <= 7) {
      const date = formatCreditDate(trialUntil);
      alerts.push({
        id: `trial-${days}`,
        tier: days <= 1 ? 2 : 1,
        severity: days <= 1 ? 'warn' : 'info',
        kind: 'trial',
        title: days <= 0 ? 'Trial ends today' : `Trial ends ${daysLabel(days)}`,
        body: days <= 0
          ? `Your trial ends today (${date}). Subscribe to keep your plan benefits.`
          : `Trial active until ${date}. Subscribe before it ends to avoid losing paid features.`,
        dismissKey: `trial:${trialUntil?.slice(0, 10)}`,
        cta: { label: 'View plans', action: 'plans' },
      });
    }
  }

  if (isCreditSubscriptionPlan(planId)) {
    if (subAllowance > 0 && subBalance > 0) {
      const pct = subBalance / subAllowance;
      if (subBalance <= 3 || pct <= 0.05) {
        alerts.push({
          id: 'sub-low-critical',
          tier: 2,
          severity: 'warn',
          kind: 'low_balance',
          title: `${subBalance} scan${subBalance === 1 ? '' : 's'} left`,
          body: `Only ${subBalance} of ${subAllowance} ${planName} scans remain this billing period. ${freeAlt}.`,
          dismissKey: `sub-low:${subBalance}`,
          cta: { label: 'Top up', action: 'plans' },
        });
      } else if (subBalance <= 10 || pct <= 0.2) {
        alerts.push({
          id: 'sub-low',
          tier: 1,
          severity: 'info',
          kind: 'low_balance',
          title: `${subBalance} of ${subAllowance} scans left`,
          body: `${subBalance} ${planName} scans left this period. Unused allowance does not carry over.`,
          dismissKey: `sub-low:${subBalance}`,
        });
      }
    }

    if (subExpireAt) {
      const days = daysUntilIso(subExpireAt);
      const date = formatCreditDate(subExpireAt);
      if (days != null && days >= 0 && days <= 7) {
        if (stripePaid) {
          alerts.push({
            id: `renewal-${days}`,
            tier: 1,
            severity: 'info',
            kind: 'renewal',
            title: days <= 0 ? 'Plan renews today' : `Renews ${daysLabel(days)}`,
            body: `${planName} renews on ${date}. Unused scans do not carry over — ${subBalance} left now.`,
            dismissKey: `renewal:${subExpireAt.slice(0, 10)}`,
          });
        } else {
          alerts.push({
            id: `expiry-${days}`,
            tier: days <= 3 ? 2 : 1,
            severity: days <= 3 ? 'warn' : 'info',
            kind: 'expiry',
            title: days <= 0 ? 'Promo access ends today' : `Promo access ends ${daysLabel(days)}`,
            body: `${planName} promo ends ${date}. ${subBalance > 0 ? `${subBalance} scans left — use or subscribe.` : 'Subscribe or top up to keep scanning.'}`,
            dismissKey: `expiry:${subExpireAt.slice(0, 10)}`,
            cta: { label: 'View plans', action: 'plans' },
          });
        }
      }
    }

    if (!budget.allowed) {
      alerts.push({
        id: 'sub-exhausted',
        tier: 3,
        severity: 'critical',
        kind: 'exhausted',
        title: 'No scans left this period',
        body: `Your ${planName} allowance is used up. Top up or wait for renewal. ${freeAlt}.`,
        cta: { label: 'View plans', action: 'plans' },
      });
    }
  }

  if (planId === 'free') {
    if (topup > 0 && topup <= 10) {
      alerts.push({
        id: `topup-low-${topup}`,
        tier: topup <= 2 ? 2 : 1,
        severity: topup <= 2 ? 'warn' : 'info',
        kind: 'topup_low',
        title: `${topup} top-up credit${topup === 1 ? '' : 's'} left`,
        body: `${topup} bonus scan credit${topup === 1 ? '' : 's'} remaining. Top-up credits never expire until used.`,
        dismissKey: `topup:${topup}`,
        cta: { label: 'Top up', action: 'plans' },
      });
    }
    if (topup > 0 && (budget.dailyFreeRemaining ?? 0) === 0 && budget.allowed) {
      alerts.push({
        id: 'daily-used-topup',
        tier: 1,
        severity: 'info',
        kind: 'topup_low',
        title: 'Using top-up credits',
        body: `Today's free scan is used — ${topup} top-up credit${topup === 1 ? '' : 's'} available. Free scan returns at midnight.`,
        dismissKey: `daily-topup:${topup}`,
      });
    }
    if (!budget.allowed) {
      alerts.push({
        id: 'free-exhausted',
        tier: 3,
        severity: 'critical',
        kind: 'exhausted',
        title: 'No scans left today',
        body: `Subscribe, top up, or try again after midnight. ${freeAlt}.`,
        cta: { label: 'View plans', action: 'plans' },
      });
    }
  }

  if (planId === 'pro_annual' && subscriptionExpiresAt) {
    const days = daysUntilIso(subscriptionExpiresAt);
    const date = formatCreditDate(subscriptionExpiresAt);
    if (days != null && days >= 0 && days <= 14) {
      alerts.push({
        id: `pro-annual-${days}`,
        tier: days <= 3 ? 2 : 1,
        severity: days <= 3 ? 'warn' : 'info',
        kind: 'pro_renewal',
        title: days <= 0 ? 'Pro Annual ends today' : `Pro Annual ends ${daysLabel(days)}`,
        body: `Your annual plan ends on ${date}. Renew to keep Pro fair use.`,
        dismissKey: `pro-annual:${subscriptionExpiresAt.slice(0, 10)}`,
        cta: { label: 'Manage billing', action: 'plans' },
      });
    }
  }

  if (isUnlimitedPlan(planId) && !budget.allowed) {
    if (budget.reason === 'monthly_cap') {
      alerts.push({
        id: 'pro-month-cap',
        tier: 2,
        severity: 'warn',
        kind: 'exhausted',
        title: 'Monthly fair use reached',
        body: 'You have hit the ~1,000 scans/month fair use cap. Resets next month.',
        dismissKey: `pro-month:${budget.monthUsed ?? 0}`,
      });
    } else if (budget.reason === 'daily_cap') {
      alerts.push({
        id: 'pro-daily-cap',
        tier: 1,
        severity: 'info',
        kind: 'exhausted',
        title: 'Daily fair use reached',
        body: 'You have used today\'s 33-scan fair use limit. Resets at midnight.',
        dismissKey: `pro-daily:${budget.usedToday ?? 0}`,
      });
    }
  }

  return alerts.sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id));
}

/**
 * Pre-scan confirm when allowance is tight or access is ending soon.
 * @returns {null | { title: string, message: string, confirmLabel: string, cancelLabel: string, sessionKey: string | null }}
 */
export function getPreScanConfirmCore(state) {
  const {
    profile = {},
    planId,
    budget = { allowed: true },
    subBalance = 0,
    subAllowance = 0,
    topup = 0,
    subExpireAt = null,
    trialUntil = null,
    stripePaid = false,
    monetizationPaused = false,
    freeAlt = 'Barcode and describe logging stay free',
  } = state;

  if (monetizationPaused || profile.loggedIn === false) return null;
  if (!budget.allowed) return null;

  const remaining = Number(budget.remaining ?? 0);
  if (remaining <= 0) return null;

  const parts = [];
  let sessionKey = null;
  let alwaysConfirm = false;
  const planName = PLAN_NAMES[planId] || planId;

  if (remaining <= 5) {
    alwaysConfirm = true;
    parts.push(`This will use 1 of your ${remaining} remaining scan${remaining === 1 ? '' : 's'}.`);
  }

  if (isCreditSubscriptionPlan(planId) && subExpireAt && !stripePaid) {
    const days = daysUntilIso(subExpireAt);
    if (days != null && days >= 0 && days <= 3) {
      parts.push(`Promo access ends ${days <= 0 ? 'today' : daysLabel(days)} (${formatCreditDate(subExpireAt)}).`);
      sessionKey = sessionKey || `expiry:${subExpireAt.slice(0, 10)}`;
    }
  }

  if (isTrialActive({ ...profile, trial_until: trialUntil, plan: profile.plan || planId })) {
    const days = daysUntilIso(trialUntil);
    if (days != null && days >= 0 && days <= 3) {
      parts.push(`Trial ends ${days <= 0 ? 'today' : daysLabel(days)} (${formatCreditDate(trialUntil)}).`);
      sessionKey = sessionKey || `trial:${trialUntil?.slice(0, 10)}`;
    }
  }

  if (isCreditSubscriptionPlan(planId) && subAllowance > 0 && subBalance > 0) {
    const pct = subBalance / subAllowance;
    if ((subBalance <= 3 || pct <= 0.05) && remaining > 5) {
      parts.push(`Only ${subBalance} of ${subAllowance} ${planName} scans left this period.`);
      sessionKey = sessionKey || `sub-low:${subBalance}`;
    }
  }

  if (planId === 'free' && topup > 0 && topup <= 2 && remaining <= 5 && !alwaysConfirm) {
    parts.push(`${topup} top-up credit${topup === 1 ? '' : 's'} left.`);
  }

  if (!parts.length) return null;

  return {
    title: remaining <= 5
      ? `Use 1 of ${remaining} scan${remaining === 1 ? '' : 's'}?`
      : 'Continue with photo scan?',
    message: `${parts.join(' ')} ${freeAlt}.`,
    confirmLabel: 'Use 1 scan',
    cancelLabel: 'Cancel',
    sessionKey: alwaysConfirm ? null : sessionKey,
  };
}

/** Push-worthy credit alerts filtered by notification prefs. */
export function getCreditPushAlertsCore(state, prefs = {}) {
  const alerts = computeCreditAlertsCore(state);
  const remaining = Number(state.budget?.remaining ?? 0);
  return alerts.filter((alert) => {
    if (alert.kind === 'expiry' || alert.kind === 'renewal') {
      return prefs.creditExpiryEnabled !== false;
    }
    if (alert.kind === 'trial') {
      return prefs.creditTrialEnabled !== false && alert.tier >= 2;
    }
    if (alert.kind === 'low_balance' || alert.kind === 'topup_low') {
      if (prefs.creditLowEnabled !== true) return false;
      return alert.tier >= 2 || remaining <= 5;
    }
    if (alert.kind === 'exhausted' && alert.tier >= 3) {
      return prefs.creditExpiryEnabled !== false;
    }
    return false;
  });
}

export function getPrimaryCreditAlertCore(alerts = [], isDismissed = () => false) {
  const visible = alerts.filter((a) => !a.dismissKey || !isDismissed(a.dismissKey));
  return visible[0] || null;
}

export function usageStripAlertClass(alert) {
  if (!alert) return '';
  if (alert.tier >= 3 || alert.severity === 'critical') return 'usage-strip--limit';
  if (alert.tier >= 2 || alert.severity === 'warn') return 'usage-strip--warn';
  return 'usage-strip--info';
}

export function trialBannerExtraHtml(profile) {
  if (!isTrialActive(profile)) return '';
  const days = daysUntilIso(profile.trial_until);
  if (days == null || days > 7) return '';
  if (days <= 0) return ' · ends today';
  if (days === 1) return ' · 1 day left';
  return ` · ${days} days left`;
}
