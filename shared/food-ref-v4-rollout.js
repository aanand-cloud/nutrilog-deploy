/**
 * Tier 2 V4 rollout — enable by cuisine/region in priority order.
 * Tune based on actual Mealnova user base, not raw catalog size.
 */

/** @typedef {'indian' | 'uk_europe' | 'china_thailand' | 'global_rest'} RolloutPhase */

/** @type {Record<RolloutPhase, { label: string, cuisines: string[], regions: string[] }>} */
export const V4_ROLLOUT_PHASES = {
  indian: {
    label: 'India / South Asian',
    cuisines: ['Indian'],
    regions: ['South & East Asian'],
  },
  uk_europe: {
    label: 'UK & Europe',
    cuisines: ['British', 'European', 'Italian', 'Middle Eastern'],
    regions: ['British & Irish', 'European & Middle Eastern'],
  },
  china_thailand: {
    label: 'China & Thailand',
    cuisines: ['Chinese', 'Thai', 'Japanese', 'Korean', 'Southeast Asian'],
    regions: ['East Asian', 'Southeast Asian'],
  },
  global_rest: {
    label: 'Global remainder',
    cuisines: ['Global', 'Unspecified', 'American & Latin American', 'Filipino', 'Mexican', 'African'],
    regions: [
      'Global & other',
      'Latin American',
      'African & Caribbean',
      'Caribbean',
      'North American',
      'Australian & Oceanian',
      'Sides, carbs & basics',
      'Desserts & sweets',
      'Drinks',
    ],
  },
};

/**
 * Active rollout phases — edit to expand coverage.
 * @type {RolloutPhase[]}
 */
export const V4_ACTIVE_PHASES = ['indian', 'uk_europe', 'china_thailand', 'global_rest'];

/**
 * @param {{ cuisine?: string, region?: string }} item
 * @returns {boolean}
 */
export function isV4ItemRolloutEnabled(item = {}) {
  if (!V4_ACTIVE_PHASES.length) return false;
  const cuisine = String(item.cuisine || '').trim();
  const region = String(item.region || '').trim();

  for (const phase of V4_ACTIVE_PHASES) {
    const cfg = V4_ROLLOUT_PHASES[phase];
    if (!cfg) continue;
    if (cuisine && cfg.cuisines.includes(cuisine)) return true;
    if (region && cfg.regions.includes(region)) return true;
  }
  return false;
}

/** In-memory match log for rollout debugging (ring buffer). */
const MATCH_LOG_MAX = 200;
/** @type {object[]} */
const matchLog = [];

/**
 * @param {object} entry
 */
export function logV4Match(entry = {}) {
  matchLog.unshift({ ...entry, at: new Date().toISOString() });
  if (matchLog.length > MATCH_LOG_MAX) matchLog.length = MATCH_LOG_MAX;
}

export function getV4MatchLog() {
  return [...matchLog];
}

export function clearV4MatchLog() {
  matchLog.length = 0;
}
