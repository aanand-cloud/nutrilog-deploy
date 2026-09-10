/** Shared auth gate for logged-out log flows. */

import { FREEMIUM_TAGLINE } from './product-copy.js';

/**
 * @param {{ title?: string, lead?: string, signupId?: string, signinId?: string }} opts
 */
export function guestLoginBannerHtml({
  title = 'Try MealNova free',
  lead = 'Create a free account to log meals with a photo, barcode, search, or describe.',
  signupId = 'logSignUpBtn',
  signinId = 'logSignInBtn',
} = {}) {
  return `
    <section class="login-banner login-banner--guest card" aria-label="Account required">
      <h2 class="login-banner__title">${title}</h2>
      <p class="login-banner__text">${lead}</p>
      <ul class="login-banner__benefits">
        <li>No card required</li>
        <li>1 AI photo scan per day</li>
        <li>Unlimited barcode, search &amp; describe logging</li>
      </ul>
      <p class="login-banner__fine fine-print">${FREEMIUM_TAGLINE}</p>
      <div class="login-banner__actions">
        <button type="button" class="btn btn-primary" id="${signupId}">Create free account</button>
        <button type="button" class="btn btn-ghost" id="${signinId}">Sign in</button>
      </div>
    </section>
  `;
}

/**
 * @param {ParentNode} root
 * @param {{ onSignIn?: Function, signupId?: string, signinId?: string }} opts
 */
export function bindGuestLoginBanner(root, { onSignIn, signupId = 'logSignUpBtn', signinId = 'logSignInBtn' } = {}) {
  root.querySelector(`#${signupId}`)?.addEventListener('click', () => onSignIn?.('signup'));
  root.querySelector(`#${signinId}`)?.addEventListener('click', () => onSignIn?.('signin'));
}
