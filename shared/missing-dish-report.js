/** Pure helpers for missing-dish user reports. */

export function normalizeDishReportName(name = '') {
  return String(name || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function shouldOfferMissingDishReport(trust = '') {
  return trust === 'estimate';
}
