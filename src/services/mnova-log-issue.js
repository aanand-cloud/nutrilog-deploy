/**
 * Recent meal-log failures for MNova context (session only, ~30 min TTL).
 */

const ISSUE_KEY = 'nutrilog_mnova_last_log_issue';
const TTL_MS = 30 * 60 * 1000;

export const MNOVA_LOG_FAILURE_CHIP = "Why didn't that work?";

/** @typedef {{
 *   type: string,
 *   message: string,
 *   query?: string,
 *   screen?: string,
 *   at: number,
 * }} MnovaLogIssue */

const ISSUE_GUIDANCE = {
  barcode_not_found: 'Packaged barcode not in Open Food Facts. Suggest: photo scan, describe/voice, or search by brand name.',
  food_search_empty: 'Name search found no packaged products — often a fresh/homemade dish. Suggest: photo or describe; explain search is for supermarket items only.',
  food_search_error: 'Product search failed (network/service). Suggest: retry, barcode scan, photo, or describe.',
  packaged_lookup_failed: 'Selected product could not be loaded. Suggest: retry search or use photo/describe.',
  photo_analysis_failed: 'AI could not analyse the photo. Suggest: clearer photo, describe instead, or barcode for packaged food.',
  photo_read_failed: 'Image file could not be read. Suggest: JPG/PNG, smaller file, or describe.',
  photo_scan_limit: 'Daily photo scan allowance used. Suggest: describe/voice (free), barcode, or upgrade/wait for reset.',
  photo_sign_in_required: 'Photo logging needs sign-in. Barcode and describe are free once signed in.',
  photo_consent_required: 'AI consent needed for photos. Suggest: enable in privacy settings, or use barcode/describe.',
  photo_unavailable: 'Photo logging temporarily unavailable. Suggest: barcode, product search, or describe.',
  describe_too_short: 'Describe needs a few words. Suggest: dish name + portion, e.g. "2 idlis with sambar".',
  describe_failed: 'Describe could not estimate. Suggest: more detail or photo scan.',
  camera_failed: 'Camera could not open. Suggest: upload from gallery or describe.',
  save_failed: 'Meal could not be saved. Suggest: check connection and retry; local data may still be ok.',
};

/** @param {Partial<MnovaLogIssue> & { type: string, message: string }} issue */
export function recordMnovaLogIssue(issue) {
  if (!issue?.type || !issue?.message) return null;

  const payload = {
    type: String(issue.type).slice(0, 64),
    message: String(issue.message).slice(0, 280),
    query: issue.query ? String(issue.query).slice(0, 120) : undefined,
    screen: issue.screen ? String(issue.screen).slice(0, 32) : 'log',
    at: Date.now(),
  };

  try {
    sessionStorage.setItem(ISSUE_KEY, JSON.stringify(payload));
  } catch (_) {
    /* quota / private mode */
  }

  document.dispatchEvent(new CustomEvent('mnova-log-issue', { detail: payload }));
  return payload;
}

/** @returns {MnovaLogIssue|null} */
export function getMnovaLogIssue() {
  try {
    const raw = sessionStorage.getItem(ISSUE_KEY);
    if (!raw) return null;
    const issue = JSON.parse(raw);
    if (!issue?.type || !issue?.at) return null;
    if (Date.now() - issue.at > TTL_MS) {
      clearMnovaLogIssue();
      return null;
    }
    return issue;
  } catch {
    return null;
  }
}

export function clearMnovaLogIssue() {
  try {
    sessionStorage.removeItem(ISSUE_KEY);
  } catch (_) {
    /* ignore */
  }
  document.dispatchEvent(new CustomEvent('mnova-log-issue-cleared'));
}

/** Context slice for MNova API — null if none or expired. */
export function buildMnovaLogIssueContext() {
  const issue = getMnovaLogIssue();
  if (!issue) return null;

  const minutesAgo = Math.max(0, Math.round((Date.now() - issue.at) / 60000));
  return {
    type: issue.type,
    message: issue.message,
    query: issue.query || undefined,
    screen: issue.screen || 'log',
    minutesAgo,
    guidance: ISSUE_GUIDANCE[issue.type] || 'Explain what likely went wrong and the best free alternative to log this food.',
  };
}

/** Starter chips when a recent log issue exists. */
export function getMnovaLogFailureChips() {
  return getMnovaLogIssue() ? [MNOVA_LOG_FAILURE_CHIP] : [];
}

export function mergeMnovaStarterChips(baseChips = []) {
  const failure = getMnovaLogFailureChips();
  if (!failure.length) return baseChips;
  const rest = baseChips.filter((c) => c !== MNOVA_LOG_FAILURE_CHIP);
  return [...failure, ...rest];
}

export function issueFromErrorMessage(message = '', fallbackType = 'photo_analysis_failed') {
  const msg = String(message || '').trim();
  if (/product not found|barcode/i.test(msg)) return { type: 'barcode_not_found', message: msg };
  if (/sign in/i.test(msg)) return { type: 'photo_sign_in_required', message: msg };
  if (/consent/i.test(msg)) return { type: 'photo_consent_required', message: msg };
  if (/allowance|limit|fair use/i.test(msg)) return { type: 'photo_scan_limit', message: msg };
  if (/temporarily unavailable/i.test(msg)) return { type: 'photo_unavailable', message: msg };
  if (/could not read|empty|jpg|png|too large|timeout|busy|INVALID_ARGUMENT/i.test(msg)) {
    return { type: /read|empty|jpg|png|large/i.test(msg) ? 'photo_read_failed' : 'photo_analysis_failed', message: msg };
  }
  return { type: fallbackType, message: msg || 'Something went wrong while logging' };
}
