/** Local scale-weight history for 14-day adaptive TDEE. */

export const WEIGH_INS_KEY = 'mealnova_weigh_ins_v1';

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseWeighIns(raw) {
  let rows = raw;
  if (typeof raw === 'string') {
    try { rows = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row) => ({
      date: String(row?.date || '').slice(0, 10),
      kg: Number(row?.kg),
      source: row?.source === 'health' ? 'health' : 'scale',
    }))
    .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.kg) && row.kg >= 30 && row.kg <= 300)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function listWeighIns(storage = defaultStorage()) {
  if (!storage?.getItem) return [];
  return parseWeighIns(storage.getItem(WEIGH_INS_KEY));
}

export function saveWeighIns(rows, storage = defaultStorage()) {
  const next = parseWeighIns(rows);
  storage?.setItem?.(WEIGH_INS_KEY, JSON.stringify(next));
  return next;
}

export function addWeighIn({ date, kg, source = 'scale' } = {}, storage = defaultStorage()) {
  const row = {
    date: String(date || todayKey()).slice(0, 10),
    kg: Number(kg),
    source,
  };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error('Enter a valid weigh-in date');
  if (!Number.isFinite(row.kg) || row.kg < 30 || row.kg > 300) {
    throw new Error('Enter a scale weight between 30 and 300 kg');
  }
  const existing = listWeighIns(storage).filter((item) => item.date !== row.date);
  return saveWeighIns([...existing, row], storage);
}

export function latestWeighIn(storage = defaultStorage()) {
  const rows = listWeighIns(storage);
  return rows[rows.length - 1] || null;
}
