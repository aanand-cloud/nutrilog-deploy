/** Per-user API rate limits — backed by Supabase check_rate_limit RPC. */

export const RATE_LIMITS = {
  /** Burst protection — does not raise daily plan allowance (Pro max is 33/day). */
  scanPerMinute: 8,
  scanPerHour: 33,
  /** Clarification refinements after a scan */
  refinePerWindow: 5,
  refineWindowSeconds: 15 * 60,
  /** Weekly cuisine tips */
  cuisineTipsPerHour: 8,
  /** MNova chat — free / paid daily message caps */
  mnovaChatFreePerDay: 20,
  mnovaChatPaidPerDay: 200,
};

export async function enforceRateLimit(
  supabase,
  bucket,
  { limit, windowSeconds = 60 } = {}
) {
  if (!supabase || !bucket || !limit) {
    return { ok: true };
  }

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) {
    console.warn('check_rate_limit failed', bucket, error.message);
    // Fail open if migration missing — avoids total scan outage; plan quotas still enforced in DB.
    const missing =
      /does not exist|could not find|relation.*api_rate_limits/i.test(error.message || '');
    if (missing) {
      console.error('Rate limit RPC unavailable — run supabase/migration-scale-p0.sql');
      return { ok: true, degraded: true };
    }
    return {
      ok: false,
      error: 'Rate limiting unavailable — run supabase/migration-scale-p0.sql, then retry',
      status: 503,
    };
  }

  if (!data?.allowed) {
    const wait = Number(data?.retry_after_seconds) || windowSeconds;
    return {
      ok: false,
      error: `Too many requests — wait ${Math.ceil(wait / 60) || 1} min and try again`,
      retryAfterSeconds: wait,
      status: 429,
    };
  }

  return { ok: true, count: data?.count };
}

/** Guard Gemini meal scans — minute + hour buckets per user. */
export async function enforceScanRateLimits(supabase, userId) {
  const base = `scan:${userId}`;
  const minute = await enforceRateLimit(supabase, `${base}:1m`, {
    limit: RATE_LIMITS.scanPerMinute,
    windowSeconds: 60,
  });
  if (!minute.ok) return minute;

  return enforceRateLimit(supabase, `${base}:1h`, {
    limit: RATE_LIMITS.scanPerHour,
    windowSeconds: 3600,
  });
}

/** Guard free AI refinements (clarify flow). */
export async function enforceRefinementRateLimit(supabase, userId) {
  return enforceRateLimit(supabase, `refine:${userId}`, {
    limit: RATE_LIMITS.refinePerWindow,
    windowSeconds: RATE_LIMITS.refineWindowSeconds,
  });
}

/** Guard cuisine tips endpoint. */
export async function enforceCuisineTipsRateLimit(supabase, userId) {
  return enforceRateLimit(supabase, `cuisine:${userId}`, {
    limit: RATE_LIMITS.cuisineTipsPerHour,
    windowSeconds: 3600,
  });
}

/** Guard MNova chat — separate from meal scan quotas. */
export async function enforceMnovaChatRateLimit(supabase, userId, planId = 'free') {
  const { isUnlimitedPlan, normalizePlanId } = await import('./plans.mjs');
  const id = normalizePlanId(planId);
  const paid = isUnlimitedPlan(id) || id === 'plus';
  const limit = paid ? RATE_LIMITS.mnovaChatPaidPerDay : RATE_LIMITS.mnovaChatFreePerDay;
  return enforceRateLimit(supabase, `mnova:${userId}:day`, {
    limit,
    windowSeconds: 86400,
  });
}
