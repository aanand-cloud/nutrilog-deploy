import { APP_NAME } from './brand.js';

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function referralCardHtml({ code, shareUrl } = {}) {
  if (!code) return '';

  return `
    <section class="referral-card" aria-label="Refer a friend">
      <p class="referral-card__eyebrow">Invite</p>
      <h3 class="referral-card__title">Refer a friend</h3>
      <p class="referral-card__text">Share ${escapeHtml(APP_NAME)} — friends get a free account, you get bonus scan credits.</p>
      <div class="referral-card__link-wrap">
        <input class="referral-card__link" type="text" readonly value="${escapeHtml(shareUrl)}" aria-label="Your referral link"/>
      </div>
      <div class="referral-card__actions">
        <button type="button" class="btn btn-primary btn-sm" id="referFriendShareBtn">Share invite</button>
        <button type="button" class="btn btn-ghost btn-sm" id="referFriendCopyBtn">Copy link</button>
      </div>
    </section>
  `;
}
