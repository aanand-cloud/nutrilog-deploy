/** GTIN / UPC helpers for packaged-food barcode lookup. */

export function digitsOnly(code = '') {
  return String(code || '').replace(/\D/g, '');
}

/** Normalise a scanned code to a lookup GTIN (UPC-A becomes EAN-13). */
export function normalizeGtin(code = '') {
  const digits = digitsOnly(code);
  if (digits.length === 12) return `0${digits}`;
  return digits;
}

export function gtinCandidates(code = '') {
  const raw = digitsOnly(code);
  const gtin = normalizeGtin(raw);
  const unique = new Set();
  if (gtin.length >= 8) unique.add(gtin);
  if (raw.length >= 8) unique.add(raw);
  if (gtin.length === 13 && gtin.startsWith('0')) unique.add(gtin.slice(1));
  return [...unique];
}

export function isValidGtin(code = '') {
  const digits = digitsOnly(code);
  return digits.length >= 8 && digits.length <= 14;
}
