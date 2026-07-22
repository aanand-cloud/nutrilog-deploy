const VOUCHER_KEY = 'nutrilog_voucher_redeemed';

import { getSession } from './auth.js';

export function isVoucherRedeemedLocally() {
  return localStorage.getItem(VOUCHER_KEY) === '1';
}

export function markVoucherRedeemedLocally() {
  localStorage.setItem(VOUCHER_KEY, '1');
}

export async function validateAndRedeemVoucher(code) {
  const session = await getSession();
  const headers = { 'Content-Type': 'application/json' };
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  const res = await fetch('/api/validate-voucher', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      code,
      accessToken: session?.access_token,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || 'Invalid voucher code');
  }
  if (data.type !== 'trial') {
    markVoucherRedeemedLocally();
  }
  return data;
}
