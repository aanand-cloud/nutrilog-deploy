import { getVoucherCodes, validateVoucherCode } from '../netlify/lib/voucher.mjs';

function assert(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
}

const codes = getVoucherCodes({});
const vip = codes.find((entry) => entry.code === 'VIP100');
assert('VIP100 is configured', Boolean(vip));
assert('VIP100 is a topup code', vip?.type === 'topup');
assert('VIP100 grants 100 scans', vip?.topupScans === 100);

const valid = validateVoucherCode('vip100');
assert('vip100 validates case-insensitively', valid.ok && valid.type === 'topup');

const merged = getVoucherCodes({ VOUCHER_CODES: 'CUSTOM:2027-12-31:discount' });
assert('custom env codes merge with built-ins', merged.some((entry) => entry.code === 'VIP100'));
assert('custom env code is present', merged.some((entry) => entry.code === 'CUSTOM'));

console.log('check-voucher: ok');
