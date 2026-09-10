/**
 * MealNova logo variants — default is "classic" (camera + nova sparkle).
 * Preview & switch: /logo-preview.html
 * Quick try: ?logo=wellness-leaf
 */
export const LOGO_STORAGE_KEY = 'mealnova_logo_variant';
export const DEFAULT_LOGO_ID = 'classic';

const CLASSIC_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4 8.5h2.4l1.5-1.85h7.2l1.5 1.85H18a1.5 1.5 0 0 1 1.5 1.5v5.5A1.5 1.5 0 0 1 18 17.5H4A1.5 1.5 0 0 1 2.5 16V10A1.5 1.5 0 0 1 4 8.5z" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="11" cy="13.25" r="3.1" stroke="currentColor" stroke-width="1.65"/>
  <circle cx="11" cy="13.25" r="1.15" fill="currentColor" stroke="none"/>
  <path d="M19.5 4.5l.55 1.1 1.1.55-1.1.55-.55 1.1-.55-1.1-1.1-.55 1.1-.55z" fill="currentColor"/>
</svg>`;

const WELLNESS_LEAF_SVG = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 20c-4-2.5-6.5-5.5-6.5-9a4.5 4.5 0 0 1 8-2.7A4.5 4.5 0 0 1 18.5 11c0 3.5-2.5 6.5-6.5 9z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="M12 20V10.5" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" opacity="0.45"/>
  <path d="M19.5 4.5l.55 1.1 1.1.55-1.1.55-.55 1.1-.55-1.1-1.1-.55 1.1-.55z" fill="currentColor"/>
</svg>`;

export const LOGO_VARIANTS = [
  {
    id: 'classic',
    name: 'Classic',
    tagline: 'Current logo — camera lens + nova sparkle',
    svg: CLASSIC_SVG,
  },
  {
    id: 'wellness-leaf',
    name: 'Wellness leaf',
    tagline: 'Heart-leaf shape — nourishment and care, not clinical',
    svg: WELLNESS_LEAF_SVG,
  },
  {
    id: 'nourish-bowl',
    name: 'Nourish bowl',
    tagline: 'Warm bowl with steam — everyday eating well',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M6 14c0-3.3 2.7-8 6-8s6 4.7 6 8" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
  <path d="M4 14h16" stroke="currentColor" stroke-width="1.65" stroke-linecap="round"/>
  <path d="M8.5 6.8c.8-1.1 1.6-1.7 2.4-1.7" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" opacity="0.85"/>
  <path d="M12 5.2c.55-.85 1.15-1.3 1.75-1.3" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" opacity="0.65"/>
  <circle cx="17.2" cy="6.2" r="0.95" fill="currentColor" opacity="0.8"/>
</svg>`,
  },
  {
    id: 'balance-ring',
    name: 'Balance ring',
    tagline: 'Circular plate with leaf arc — balanced daily nutrition',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="12" cy="12.5" r="7.2" stroke="currentColor" stroke-width="1.5"/>
  <path d="M12 5.3v14.4" stroke="currentColor" stroke-width="1.1" opacity="0.28"/>
  <path d="M4.8 12.5h14.4" stroke="currentColor" stroke-width="1.1" opacity="0.28"/>
  <path d="M14.6 8.6c2 1.45 2.9 3.1 2.7 5.2-.15 1.65-1.1 3.2-2.7 4.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M19.5 4.5l.55 1.1 1.1.55-1.1.55-.55 1.1-.55-1.1-1.1-.55 1.1-.55z" fill="currentColor" opacity="0.92"/>
</svg>`,
  },
  {
    id: 'sprout-nova',
    name: 'Sprout nova',
    tagline: 'Growing sprout with nova star — fresh start energy',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 18V9.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M9.5 11.5c0-1.35 1.1-2.45 2.5-2.45s2.5 1.1 2.5 2.45" stroke="currentColor" stroke-width="1.45" stroke-linecap="round"/>
  <path d="M8 18h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M19 5.5l.8 1.6 1.7.8-1.7.8-.8 1.6-.8-1.6-1.7-.8 1.7-.8z" fill="currentColor"/>
  <path d="M6.2 7.8c.85.75 1.3 1.45 1.3 2.25" stroke="currentColor" stroke-width="1.15" stroke-linecap="round" opacity="0.65"/>
</svg>`,
  },
  {
    id: 'macro-orbit',
    name: 'Macro orbit',
    tagline: 'Three orbiting nodes — protein, carbs & fats in harmony',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <circle cx="12" cy="13" r="6.3" stroke="currentColor" stroke-width="1.4" opacity="0.32"/>
  <circle cx="12" cy="7.6" r="1.15" fill="currentColor"/>
  <circle cx="16.8" cy="15.1" r="1.15" fill="currentColor" opacity="0.88"/>
  <circle cx="7.2" cy="15.1" r="1.15" fill="currentColor" opacity="0.88"/>
  <path d="M12 8.8v2.6M14.8 14.2l-2.3-1.35M9.2 14.2l2.3-1.35" stroke="currentColor" stroke-width="1.05" stroke-linecap="round" opacity="0.5"/>
</svg>`,
  },
  {
    id: 'vitality-pulse',
    name: 'Vitality pulse',
    tagline: 'Soft heartbeat line through a leaf — energy without medical vibes',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M12 19.5c-3.5-2.5-5.5-4.8-5.5-7.5 0-2.4 1.8-4.2 4-4.2 1.2 0 2.2.55 2.8 1.35.6-.8 1.6-1.35 2.8-1.35 2.2 0 4 1.8 4 4.2 0 2.7-2 5-5.5 7.5z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" opacity="0.55"/>
  <path d="M5.5 12.5h2.2l1.2-2.2 1.4 4.4 1.6-3.1 1.1 2.2h2.5" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`,
  },
  {
    id: 'sun-harvest',
    name: 'Sun harvest',
    tagline: 'Rising sun over horizon — morning meals & positive habit',
    svg: `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <path d="M4 15.5h16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M6.5 15.5c1.5-3.2 3.4-4.8 5.5-4.8s4 1.6 5.5 4.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
  <circle cx="12" cy="8.5" r="2.6" stroke="currentColor" stroke-width="1.45"/>
  <path d="M12 3.8v1.4M12 13.2v1.2M7.1 5.1l1 1M16.9 5.1l-1 1M5.2 8.5h1.4M17.4 8.5h1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" opacity="0.75"/>
</svg>`,
  },
];

export function getLogoVariantId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('logo');
    if (fromQuery && LOGO_VARIANTS.some((v) => v.id === fromQuery)) return fromQuery;
    const stored = localStorage.getItem(LOGO_STORAGE_KEY);
    if (stored && LOGO_VARIANTS.some((v) => v.id === stored)) {
      if (stored === 'wellness-leaf') {
        localStorage.setItem(LOGO_STORAGE_KEY, DEFAULT_LOGO_ID);
        return DEFAULT_LOGO_ID;
      }
      return stored;
    }
  } catch (_) { /* private mode */ }
  return DEFAULT_LOGO_ID;
}

export function getLogoVariant(id = getLogoVariantId()) {
  return LOGO_VARIANTS.find((v) => v.id === id) || LOGO_VARIANTS.find((v) => v.id === DEFAULT_LOGO_ID) || LOGO_VARIANTS[0];
}

export function getBrandMarkSvg(id = getLogoVariantId()) {
  return getLogoVariant(id).svg;
}

export function setLogoVariant(id) {
  const variant = getLogoVariant(id);
  try {
    localStorage.setItem(LOGO_STORAGE_KEY, variant.id);
  } catch (_) { /* ignore */ }
  applyLogoVariant(variant.id);
  window.dispatchEvent(new CustomEvent('mealnova:logo-change', { detail: { id: variant.id } }));
  return variant;
}

export function applyLogoVariant(variantId = getLogoVariantId()) {
  const svg = getBrandMarkSvg(variantId);
  document.querySelectorAll('.brand-mark, [data-brand-mark]').forEach((el) => {
    el.innerHTML = svg;
    el.setAttribute('data-logo', variantId);
  });
  document.documentElement.setAttribute('data-logo-variant', variantId);
  updateFavicon(variantId);
}

function updateFavicon(_variantId) {
  const link = document.querySelector('link[rel="icon"]');
  if (!link || String(link.getAttribute('href') || '').includes('/icons/')) return;
}

/** Inject the active mark into all `.brand-mark` placeholders. */
export function initBrandMarks() {
  applyLogoVariant(getLogoVariantId());
}
