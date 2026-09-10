/** Visible build identifier for production verification. */
export const MEALNOVA_BUILD = {
  version: '0.2.1',
  build: '2026-09-10-landing-v2.4',
};

export function buildLabel() {
  return `MealNova v${MEALNOVA_BUILD.version} · Build ${MEALNOVA_BUILD.build}`;
}
