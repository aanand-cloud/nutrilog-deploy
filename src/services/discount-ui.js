/**
 * Settings UI — two independent discount paths:
 * 1) NHS / public sector — confirmed sign-in email domain
 * 2) 60+ — self-declaration only (any account email)
 */

import {
  ELIGIBILITY_DISCOUNT_PERCENT,
  getDiscountEligibility,
  isPublicSectorEmail,
} from './discount.js';
import { saveDiscountPrefs } from './profile.js';
import { APP_NAME } from './brand.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function discountEligibilitySettingsHtml({
  profile = {},
  accountEmail = '',
  discount = null,
} = {}) {
  const d = discount || getDiscountEligibility(profile, accountEmail);
  const accountQualifies = isPublicSectorEmail(accountEmail);
  const publicActive = d.publicSector;
  const seniorActive = d.senior;

  const statusBanner = d.eligible && !d.voucher
    ? `<p class="settings-discount-banner">✓ ${escapeHtml(d.label)} — ${ELIGIBILITY_DISCOUNT_PERCENT}% off applied to prices below</p>`
    : d.voucher && d.eligible
      ? `<p class="settings-discount-banner">✓ ${escapeHtml(d.label)} — ${ELIGIBILITY_DISCOUNT_PERCENT}% off applied to prices below</p>`
      : '';

  const publicAccountHint = accountQualifies
    ? `<p class="discount-claim-hint discount-claim-hint--success">Your confirmed account email <strong>${escapeHtml(accountEmail)}</strong> qualifies — ${ELIGIBILITY_DISCOUNT_PERCENT}% off at checkout.</p>`
    : `<p class="discount-claim-hint">Create your account with your work email (e.g. <span class="copy-keep">you@nhs.net</span>, <span class="copy-keep">you@nhs.uk</span>, <span class="copy-keep">you@gov.uk</span>). Personal addresses like Gmail won't qualify for this path.</p>`;

  return `
    <p class="fine-print">${ELIGIBILITY_DISCOUNT_PERCENT}% off subscriptions and top-ups. ${escapeHtml(APP_NAME)} is not affiliated with the NHS. NHS/public sector uses your confirmed sign-in email; 60+ is honour-based.</p>
    ${statusBanner}

    <div class="discount-sections" id="discountPaths">
      <article class="discount-card${publicActive ? ' discount-card--active' : ''}" id="discountPublicCard" aria-labelledby="discountPublicTitle">
        <div class="discount-card__head">
          <h5 id="discountPublicTitle">1 · NHS &amp; public sector</h5>
          ${publicActive ? '<span class="discount-card__badge">Active</span>' : ''}
        </div>
        <p class="discount-card__blurb">${ELIGIBILITY_DISCOUNT_PERCENT}% off when you sign in with a confirmed NHS, .gov.uk, police, MOD or other public-sector email. No separate work-email field — your account email must match.</p>
        ${publicAccountHint}
      </article>

      <article class="discount-card${seniorActive ? ' discount-card--active' : ''}" id="discountSeniorCard" aria-labelledby="discountSeniorTitle">
        <div class="discount-card__head">
          <h5 id="discountSeniorTitle">2 · 60 and over</h5>
          ${seniorActive ? '<span class="discount-card__badge">Active</span>' : ''}
        </div>
        <p class="discount-card__blurb">Self-declaration only — confirm your age below. No ID upload required. Works with any sign-in email.</p>
        ${seniorActive ? '<p class="discount-claim-hint discount-claim-hint--success">Your 60+ declaration is saved. Uncheck below and save if this no longer applies.</p>' : ''}
        <form id="discountSeniorForm" class="settings-form-compact">
          <label class="settings-row settings-row--toggle">
            <span>I am 60 years of age or over</span>
            <input type="checkbox" name="senior" ${seniorActive ? 'checked' : ''}/>
          </label>
          <label class="settings-row settings-row--toggle">
            <span>I confirm this declaration is accurate</span>
            <input type="checkbox" name="confirm" required/>
          </label>
          <button type="submit" class="btn btn-ghost full">${seniorActive ? 'Update 60+ declaration' : 'Confirm 60+ eligibility'}</button>
        </form>
      </article>
    </div>
  `;
}

export function bindDiscountEligibilityForms(root, { profile, onSave, onSignIn, showToast } = {}) {
  root.querySelector('#discountSeniorForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!profile?.loggedIn) {
      showToast?.('Sign in to save discount eligibility');
      onSignIn?.('signin');
      return;
    }

    const fd = new FormData(e.target);
    const senior = fd.get('senior') === 'on';

    if (!senior && !profile.discount_senior) {
      showToast?.('Tick “I am 60 years of age or over” to claim this discount');
      return;
    }

    try {
      await saveDiscountPrefs({ senior });
      if (senior) {
        showToast?.(`60+ declaration saved — ${ELIGIBILITY_DISCOUNT_PERCENT}% off when you subscribe`);
      } else {
        showToast?.('60+ declaration removed');
      }
      onSave?.();
    } catch (err) {
      showToast?.(err.message || 'Could not save');
    }
  });
}
