/**
 * Credit allowance alerts — low balance, expiry, trial ending, sync stale.
 */

import {
  computeCreditAlertsCore,
  daysUntilIso,
  formatCreditDate,
  getCreditPushAlertsCore,
  getPreScanConfirmCore,
  getPrimaryCreditAlertCore,
  isTrialActive,
  trialBannerExtraHtml,
  usageStripAlertClass,
} from '../../shared/credit-alerts-core.js';
import { openConfirmModal } from './confirm-modal.js';
import {
  getScanBudget,
  getTopUpBalance,
  getSubScanBalance,
  getSubScansAllowance,
  getSubCreditsExpireAt,
  getPlan,
  isStripePaidProfile,
} from './subscription.js';
import { normalizePlanId } from './plans.js';
import { MONETIZATION_PAUSED } from '../monetization.js';
import { BARCODE_COPY } from './product-copy.js';

export {
  daysUntilIso,
  formatCreditDate,
  getCreditPushAlertsCore,
  getPreScanConfirmCore,
  isTrialActive,
  trialBannerExtraHtml,
  usageStripAlertClass,
} from '../../shared/credit-alerts-core.js';

const DISMISS_PREFIX = 'nutrilog_credit_alert_dismiss:';
const PRE_SCAN_SESSION_PREFIX = 'nutrilog_pre_scan_confirm:';
const DISMISS_TTL_MS = 24 * 60 * 60 * 1000;

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function resolveAlertState(opts = {}) {
  const profile = opts.profile || {};
  const planId = normalizePlanId(opts.plan ?? profile.plan ?? getPlan());
  return {
    profile,
    planId,
    budget: opts.budget ?? getScanBudget(planId),
    subBalance: opts.subScanBalance ?? getSubScanBalance(),
    subAllowance: opts.subScansAllowance ?? getSubScansAllowance(),
    topup: opts.topupBalance ?? getTopUpBalance(),
    subExpireAt: opts.subCreditsExpireAt ?? profile.sub_credits_expire_at ?? getSubCreditsExpireAt(),
    subscriptionExpiresAt: opts.subscriptionExpiresAt ?? profile.subscription_expires_at ?? null,
    trialUntil: opts.trialUntil ?? profile.trial_until ?? null,
    stripePaid: opts.stripePaid ?? isStripePaidProfile(profile),
    syncFailed: Boolean(opts.syncFailed),
    monetizationPaused: MONETIZATION_PAUSED,
    freeAlt: BARCODE_COPY.paywallNote,
  };
}

export function computeCreditAlerts(opts = {}) {
  return computeCreditAlertsCore(resolveAlertState(opts));
}

export function isCreditAlertDismissed(dismissKey) {
  if (!dismissKey) return false;
  try {
    const raw = localStorage.getItem(`${DISMISS_PREFIX}${dismissKey}`);
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

export function dismissCreditAlert(dismissKey) {
  if (!dismissKey) return;
  try {
    localStorage.setItem(`${DISMISS_PREFIX}${dismissKey}`, String(Date.now()));
  } catch {
    /* ignore */
  }
}

export function filterDismissedCreditAlerts(alerts = []) {
  return alerts.filter((a) => !a.dismissKey || !isCreditAlertDismissed(a.dismissKey));
}

export function getPrimaryCreditAlert(alerts = []) {
  return getPrimaryCreditAlertCore(alerts, isCreditAlertDismissed);
}

export function creditAlertsPlansHtml(alerts = []) {
  const visible = filterDismissedCreditAlerts(alerts).filter((a) => a.tier >= 1);
  if (!visible.length) return '';
  return visible.map((alert) => {
    const mod = alert.tier >= 3
      ? 'plans-status-banner--critical'
      : alert.tier >= 2 || alert.severity === 'warn'
        ? 'plans-status-banner--warn'
        : 'plans-status-banner--info';
    const dismissBtn = alert.dismissKey
      ? `<button type="button" class="link-btn credit-alert-dismiss" data-dismiss-key="${escapeHtml(alert.dismissKey)}">Dismiss</button>`
      : '';
    const ctaBtn = alert.cta?.action === 'plans'
      ? `<button type="button" class="link-btn credit-alert-plans" data-credit-action="plans">${escapeHtml(alert.cta.label)}</button>`
      : alert.cta?.action === 'refresh'
        ? `<button type="button" class="link-btn credit-alert-refresh" data-credit-action="refresh">${escapeHtml(alert.cta.label)}</button>`
        : '';
    return `
      <div class="plans-status-banner ${mod} credit-alert-banner" role="status" data-alert-id="${escapeHtml(alert.id)}">
        <strong>${escapeHtml(alert.title)}</strong>
        <span>${escapeHtml(alert.body)}</span>
        ${ctaBtn ? `<span class="credit-alert-banner__actions">${ctaBtn}${dismissBtn ? ` · ${dismissBtn}` : ''}</span>` : dismissBtn ? `<span class="credit-alert-banner__actions">${dismissBtn}</span>` : ''}
      </div>
    `;
  }).join('');
}

export function bindCreditAlertActions(root, { onPlans, onRefresh, onDismissed } = {}) {
  root.querySelectorAll('[data-credit-action="plans"]').forEach((btn) => {
    btn.addEventListener('click', () => onPlans?.());
  });
  root.querySelectorAll('[data-credit-action="refresh"]').forEach((btn) => {
    btn.addEventListener('click', () => onRefresh?.());
  });
  root.querySelectorAll('.credit-alert-dismiss').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.getAttribute('data-dismiss-key');
      if (key) dismissCreditAlert(key);
      btn.closest('.credit-alert-banner')?.remove();
      onDismissed?.();
    });
  });
}

function wasPreScanConfirmShown(sessionKey) {
  if (!sessionKey) return false;
  try {
    return sessionStorage.getItem(`${PRE_SCAN_SESSION_PREFIX}${sessionKey}`) === '1';
  } catch {
    return false;
  }
}

function markPreScanConfirmShown(sessionKey) {
  if (!sessionKey) return;
  try {
    sessionStorage.setItem(`${PRE_SCAN_SESSION_PREFIX}${sessionKey}`, '1');
  } catch {
    /* ignore */
  }
}

export function getPreScanConfirm(opts = {}) {
  const confirm = getPreScanConfirmCore(resolveAlertState(opts));
  if (!confirm) return null;
  if (confirm.sessionKey && wasPreScanConfirmShown(confirm.sessionKey)) return null;
  return confirm;
}

/** @returns {Promise<boolean>} true when scan may proceed */
export async function confirmBeforePhotoScan(opts = {}) {
  const confirm = getPreScanConfirm(opts);
  if (!confirm) return true;
  const ok = await openConfirmModal({
    title: confirm.title,
    message: confirm.message,
    confirmLabel: confirm.confirmLabel,
    cancelLabel: confirm.cancelLabel,
  });
  if (ok && confirm.sessionKey) markPreScanConfirmShown(confirm.sessionKey);
  return ok;
}

export function getCreditPushAlerts(opts = {}, notifyPrefs = {}) {
  return getCreditPushAlertsCore(resolveAlertState(opts), notifyPrefs);
}
