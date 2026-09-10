/** Shared product messaging — keep barcode / describe / scan positioning consistent app-wide. */

export const BARCODE_COPY = {
  /** Badge / hint (short) */
  badge: 'Always free',
  /** One-line promise */
  short: 'Always free with your account',
  /** Full line for cards and modals */
  detail: 'Barcode & product search — always free with your account. No scan credits used.',
  /** Log → packaged food section */
  logSection: 'Free with your account · no scan credits',
  /** Guest-facing card */
  guest: 'Nutrition from the product’s available label data — please verify against the package.',
  /** Settings → Plans intro suffix */
  plansNote: 'Barcode logging is always included at no extra cost.',
  /** When photo scans are limited */
  paywallNote: 'Barcode and describe logging stay free',
  /** Quick-action sublabel */
  quickHint: 'Packaged food · always free',
  /** Auth modal footer */
  authFine: 'Barcode, search, and describe logging are always free with your account.',
};

export const DESCRIBE_COPY = {
  badge: 'Always free',
  short: 'Always free with your account',
  detail: 'Type or dictate — quick rough estimate, no scan credits used.',
  logSection: 'Free with your account · no scan credits',
  quickHint: 'Type or voice · always free',
  paywallNote: 'Describe or barcode instead — still free',
  paywallBtn: 'Describe your meal instead — free',
};

/** Primary freemium line — landing hero and footer. */
export const FREEMIUM_LINE_1 = 'No card required · One free AI photo scan daily';
/** Secondary freemium line — barcode, search and describe. */
export const FREEMIUM_LINE_2 = 'Unlimited barcode, food search and description logging';
/** @deprecated Use FREEMIUM_LINE_1 + FREEMIUM_LINE_2 for display. */
export const FREEMIUM_TAGLINE = FREEMIUM_LINE_1;

/** Two-line freemium hint for landing sections. */
export function freemiumHintHtml({ className = 'freemium-hint' } = {}) {
  return `
    <span class="${className}">
      <span class="${className}__line">${FREEMIUM_LINE_1}</span>
      <span class="${className}__line ${className}__line--second">${FREEMIUM_LINE_2}</span>
    </span>
  `;
}

/** Short suffix when scan allowance is exhausted. */
export const FREE_LOG_SCAN_NOTE = 'barcode & describe still free';
