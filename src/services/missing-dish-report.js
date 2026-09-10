/**
 * Queue missing-dish names locally for reference expansion (no server required).
 */

import { normalizeDishReportName } from '../../shared/missing-dish-report.js';

const STORAGE_KEY = 'nutrilog_missing_dish_reports';
const MAX_REPORTS = 40;
const DEDUPE_MS = 24 * 60 * 60 * 1000;

function readReports() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeReports(reports) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reports.slice(0, MAX_REPORTS)));
  } catch {
    /* private mode / quota */
  }
}

/**
 * @param {{ dishName: string, mealSummary?: string, screen?: string, itemIndex?: number|null }} payload
 * @returns {'added' | 'duplicate' | 'invalid'}
 */
export function reportMissingDish(payload = {}) {
  const dishName = String(payload.dishName || '').trim();
  const normalized = normalizeDishReportName(dishName);
  if (!normalized || normalized.length < 2) return 'invalid';

  const now = Date.now();
  const reports = readReports().filter((row) => now - Date.parse(row.at || 0) < 90 * 24 * 60 * 60 * 1000);
  const recentDuplicate = reports.some(
    (row) => row.normalized === normalized && now - Date.parse(row.at || 0) < DEDUPE_MS,
  );
  if (recentDuplicate) return 'duplicate';

  reports.unshift({
    dishName,
    normalized,
    mealSummary: String(payload.mealSummary || '').trim().slice(0, 120) || undefined,
    screen: String(payload.screen || 'log').slice(0, 32),
    itemIndex: Number.isFinite(payload.itemIndex) ? payload.itemIndex : undefined,
    at: new Date().toISOString(),
  });
  writeReports(reports);
  return 'added';
}

export function listMissingDishReports() {
  return readReports();
}

export function missingDishReportCount() {
  return readReports().length;
}
