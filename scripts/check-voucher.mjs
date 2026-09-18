import { getVoucherCodes, validateVoucherCode } from '../netlify/lib/voucher.mjs';

function assert(label, condition) {
  if (!condition) throw new Error(`FAIL: ${label}`);
}

const codes = getVoucherCodes({});
const vip = codes.find((entry) => entry.code === 'VIP100');
assert('VIP100 is configured', Boolean(vip));
assert('VIP100 is a topup code', vip?.type === 'topup');
assert('VIP100 grants 100 scans', vip?.topupScans === 100);

const india = codes.find((entry) => entry.code === 'INDIA100');
assert('INDIA100 is configured', Boolean(india));
assert('INDIA100 is a topup code', india?.type === 'topup');
assert('INDIA100 grants 100 scans', india?.topupScans === 100);

const valid = validateVoucherCode('india100');
assert('india100 validates case-insensitively', valid.ok && valid.type === 'topup' && valid.topupScans === 100);

const customOnly = getVoucherCodes({ VOUCHER_CODES: 'CUSTOM:2027-12-31:discount' });
assert('VOUCHER_CODES env replaces built-ins', customOnly.length === 1 && customOnly[0].code === 'CUSTOM');

console.log('check-voucher: ok');
