/** Pure helpers for offline photo queue (no browser / auth deps). */

/** True when a failed analysis should be saved for later instead of discarded. */
export function isQueueableAnalysisError(err = {}) {
  if (err?.requiresAuth || err?.limitReached || err?.rateLimited) return false;
  const msg = String(err?.message || err || '');
  if (/sign in|scan limit|daily scan|plan limit|upgrade|too many requests/i.test(msg)) return false;
  if (/GEMINI|OPENAI|not configured|temporarily unavailable|Photo logging is temporarily/i.test(msg)) {
    return false;
  }
  if (err instanceof TypeError) return true;
  if (err?.name === 'AbortError') return true;
  if (/could not reach|network|offline|failed to fetch|timeout|took too long|502|503|504/i.test(msg)) {
    return true;
  }
  return false;
}
