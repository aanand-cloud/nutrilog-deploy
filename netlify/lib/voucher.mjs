/** Promo / trial voucher codes — server-side only (env vars on Vercel). */

function parseExpiry(expires) {
  const expiry = new Date(`${expires}T23:59:59`);
  if (Number.isNaN(expiry.getTime())) return null;
  return expiry;
}

function parseVoucherEntry(entry, fallbackExpiry) {
  const parts = entry.split(':').map((s) => s.trim()).filter(Boolean);
  const code = (parts[0] || '').toUpperCase();
  const expires = parts[1] || fallbackExpiry;
  let type = 'discount';
  let trialPlan = 'daily10';
  let trialDays = 7;

  if (parts[2]?.toLowerCase() === 'trial') {
    type = 'trial';
    trialPlan = parts[3] === 'daily25' ? 'daily25' : 'daily10';
    trialDays = Math.min(90, Math.max(1, Number(parts[4]) || 7));
  }

  return { code, expires, type, trialPlan, trialDays };
}

/** All active codes from env. Supports discount and free-trial codes. */
export function getVoucherCodes(env = process.env) {
  const multi = (env.VOUCHER_CODES || '').trim();
  const fallbackExpiry = (env.VOUCHER_EXPIRES || '2027-07-16').trim();

  if (multi) {
    return multi
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => parseVoucherEntry(entry, fallbackExpiry))
      .filter((v) => v.code);
  }

  const code = (env.VOUCHER_CODE || 'NUTRIPROMO').trim().toUpperCase();
  return [
    { code, expires: fallbackExpiry, type: 'discount', trialPlan: 'daily10', trialDays: 7 },
    { code: 'TRIAL7', expires: '2026-12-31', type: 'trial', trialPlan: 'daily10', trialDays: 7 },
    { code: 'TRYPLUS', expires: '2026-12-31', type: 'trial', trialPlan: 'daily25', trialDays: 14 },
  ];
}

export function getVoucherConfig(env = process.env) {
  const [primary] = getVoucherCodes(env);
  return {
    code: primary?.code || 'NUTRIPROMO',
    expires: primary?.expires || '2027-07-16',
  };
}

export function validateVoucherCode(code, env = process.env) {
  const entered = (code || '').trim().toUpperCase();

  if (!entered) {
    return { ok: false, error: 'Enter your promo code' };
  }

  const matches = getVoucherCodes(env).filter((v) => v.code === entered);
  if (!matches.length) {
    return { ok: false, error: 'That code is not valid' };
  }

  const now = new Date();
  const valid = matches.find((v) => {
    const expiry = parseExpiry(v.expires);
    return expiry && now <= expiry;
  });

  if (!valid) {
    return { ok: false, error: 'This promo code has expired' };
  }

  if (valid.type === 'trial') {
    const planLabel = valid.trialPlan === 'daily25' ? 'Plus' : 'Standard';
    return {
      ok: true,
      type: 'trial',
      code: valid.code,
      validUntil: valid.expires,
      trialPlan: valid.trialPlan,
      trialDays: valid.trialDays,
      label: `${valid.trialDays}-day ${planLabel} trial`,
    };
  }

  return {
    ok: true,
    type: 'discount',
    code: valid.code,
    validUntil: valid.expires,
    label: '30% off promo code',
  };
}
