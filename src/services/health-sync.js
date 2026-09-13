/**
 * Apple Health / Google Health Connect adapter.
 * Web and PWA use file export/import. Native Capacitor Health plugins
 * are used only when already installed — this module does not add plugins.
 */

import { getMealsInRange, todayKey as storageTodayKey, sumNutrition } from './storage.js';
import { listWeighIns } from './weigh-ins.js';

export const HEALTH_ENERGY_KEY = 'mealnova_health_active_energy_v1';
export const HEALTH_SYNC_META_KEY = 'mealnova_health_sync_meta_v1';
export const HEALTH_SYNC_KIND = 'mealnova-health-sync-v1';

function defaultStorage() {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function isFoodMeal(meal) {
  return meal?.meal_type !== 'supplement' && meal?.source !== 'supplement';
}

export function detectHealthBridge(globalObj = globalThis) {
  const cap = globalObj?.Capacitor || {};
  const plugins = cap.Plugins || {};
  const platform = cap.getPlatform?.() || cap.platform || 'web';
  if (plugins.HealthConnect || plugins.Health) {
    return {
      available: true,
      platform: platform === 'android' ? 'android' : platform,
      name: plugins.HealthConnect ? 'Health Connect' : 'Health',
      plugin: plugins.HealthConnect ? 'HealthConnect' : 'Health',
    };
  }
  if (plugins.HealthKit) {
    return { available: true, platform: 'ios', name: 'Apple Health', plugin: 'HealthKit' };
  }
  return { available: false, platform: platform || 'web', name: null, plugin: null };
}

export function parseActiveEnergyMap(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { return {}; }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const out = {};
  for (const [date, kcal] of Object.entries(data)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const value = Math.round(num(kcal));
    if (value >= 0 && value <= 20000) out[date] = value;
  }
  return out;
}

export function readActiveEnergyMap(storage = defaultStorage()) {
  if (!storage?.getItem) return {};
  return parseActiveEnergyMap(storage.getItem(HEALTH_ENERGY_KEY));
}

export function writeActiveEnergyMap(map, storage = defaultStorage()) {
  const next = parseActiveEnergyMap(map);
  storage?.setItem?.(HEALTH_ENERGY_KEY, JSON.stringify(next));
  return next;
}

export function setActiveEnergyForDate(date, kcal, storage = defaultStorage()) {
  const map = readActiveEnergyMap(storage);
  const key = String(date || storageTodayKey()).slice(0, 10);
  const value = Math.round(num(kcal));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Enter a valid date');
  if (value < 0 || value > 20000) throw new Error('Active energy must be 0–20,000 kcal');
  map[key] = value;
  return writeActiveEnergyMap(map, storage);
}

export function getActiveEnergyForDate(date, storage = defaultStorage()) {
  return readActiveEnergyMap(storage)[String(date || storageTodayKey()).slice(0, 10)] || 0;
}

export function dailyMacroRows(meals = [], energyMap = {}) {
  const byDate = new Map();
  for (const meal of meals) {
    if (!isFoodMeal(meal) || !meal.date) continue;
    if (!byDate.has(meal.date)) byDate.set(meal.date, []);
    byDate.get(meal.date).push(meal);
  }
  return [...byDate.keys()].sort().map((date) => {
    const dayMeals = byDate.get(date);
    const totals = sumNutrition(dayMeals);
    return {
      date,
      intake_kcal: Math.round(totals.calories_kcal),
      protein_g: Math.round(totals.protein_g * 10) / 10,
      carbs_g: Math.round(totals.carbs_g * 10) / 10,
      fat_g: Math.round(totals.fat_g * 10) / 10,
      fibre_g: Math.round(totals.fibre_g * 10) / 10,
      sugar_g: Math.round(totals.sugar_g * 10) / 10,
      salt_mg: Math.round(totals.salt_mg),
      active_energy_kcal: num(energyMap[date]),
      meals_logged: dayMeals.length,
    };
  });
}

export function buildHealthSyncBundle({
  meals = [],
  weighIns = [],
  activeEnergy = {},
  exportedAt = new Date().toISOString(),
} = {}) {
  return {
    kind: HEALTH_SYNC_KIND,
    exportedAt,
    app: 'MealNova',
    daily: dailyMacroRows(meals, activeEnergy),
    weighIns: Array.isArray(weighIns) ? weighIns : [],
    activeEnergy,
    note: 'Wellness export of logged macros and active energy. Not medical data. Import back into MealNova, or use a Health Connect / Apple Health bridge when the native plugin is installed.',
  };
}

export function parseHealthImport(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try { data = JSON.parse(raw); } catch { throw new Error('Health file is not valid JSON'); }
  }
  if (!data || typeof data !== 'object') throw new Error('Health file is empty');

  const energy = { ...parseActiveEnergyMap(data.activeEnergy) };
  const weighIns = [];

  const daily = Array.isArray(data.daily) ? data.daily : [];
  for (const row of daily) {
    const date = String(row?.date || '').slice(0, 10);
    if (row?.active_energy_kcal != null) energy[date] = num(row.active_energy_kcal);
  }

  const records = Array.isArray(data.records) ? data.records : [];
  for (const rec of records) {
    const type = String(rec?.type || rec?.dataType || '').toLowerCase();
    const date = String(rec?.date || rec?.startDate || '').slice(0, 10);
    const kcal = rec?.kcal ?? rec?.value ?? rec?.activeEnergyKcal;
    if (/active.?energy|exercise.?calorie|activecaloriesburned/.test(type) && date) {
      energy[date] = num(kcal);
    }
    if (/body.?mass|weight/.test(type) && date && rec?.kg != null) {
      weighIns.push({ date, kg: num(rec.kg), source: 'health' });
    }
  }

  if (Array.isArray(data.weighIns)) {
    for (const row of data.weighIns) {
      if (row?.date && row?.kg != null) weighIns.push({ date: String(row.date).slice(0, 10), kg: num(row.kg), source: 'health' });
    }
  }

  return {
    kind: data.kind || 'import',
    activeEnergy: parseActiveEnergyMap(energy),
    weighIns,
  };
}

export function applyHealthImport(parsed, {
  storage = defaultStorage(),
  addWeighInFn,
} = {}) {
  const current = readActiveEnergyMap(storage);
  const next = writeActiveEnergyMap({ ...current, ...parsed.activeEnergy }, storage);
  const importedWeighIns = [];
  if (addWeighInFn) {
    for (const row of parsed.weighIns || []) {
      try {
        addWeighInFn({ ...row, source: 'health' }, storage);
        importedWeighIns.push(row);
      } catch (_) { /* skip invalid */ }
    }
  }
  storage?.setItem?.(HEALTH_SYNC_META_KEY, JSON.stringify({
    lastImportAt: new Date().toISOString(),
    energyDays: Object.keys(next).length,
  }));
  return { activeEnergy: next, weighIns: importedWeighIns };
}

export function healthSyncStatus(bridge = detectHealthBridge(), storage = defaultStorage()) {
  let meta = {};
  try { meta = JSON.parse(storage?.getItem?.(HEALTH_SYNC_META_KEY) || '{}'); } catch { meta = {}; }
  if (bridge.available) {
    return {
      label: `Ready: ${bridge.name}`,
      detail: 'Export or import active energy and logged macros. Native write uses the installed Health plugin when you tap Sync.',
      meta,
    };
  }
  return {
    label: 'File export / import',
    detail: 'This web app cannot write Apple Health or Health Connect directly. Export a JSON bundle, or install the native app with a Health plugin.',
    meta,
  };
}

export async function tryNativeHealthSync({
  bundle,
  globalObj = globalThis,
} = {}) {
  const bridge = detectHealthBridge(globalObj);
  if (!bridge.available) {
    return { ok: false, reason: 'no_plugin', bridge };
  }
  const plugin = globalObj.Capacitor?.Plugins?.[bridge.plugin];
  if (typeof plugin?.saveNutrition === 'function') {
    await plugin.saveNutrition({ daily: bundle.daily });
    return { ok: true, bridge, method: 'saveNutrition' };
  }
  if (typeof plugin?.requestAuthorization === 'function' && typeof plugin?.saveSample === 'function') {
    await plugin.requestAuthorization({ read: ['activeEnergy'], write: ['dietaryEnergy', 'protein', 'carbohydrates', 'fat'] });
    for (const row of bundle.daily || []) {
      await plugin.saveSample({ type: 'dietaryEnergy', date: row.date, value: row.intake_kcal, unit: 'kcal' });
      if (row.active_energy_kcal > 0) {
        await plugin.saveSample({ type: 'activeEnergy', date: row.date, value: row.active_energy_kcal, unit: 'kcal' });
      }
    }
    return { ok: true, bridge, method: 'saveSample' };
  }
  return { ok: false, reason: 'plugin_api_unknown', bridge };
}

export async function collectHealthBundle({ days = 14, storage = defaultStorage() } = {}) {
  const end = storageTodayKey();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - (days - 1));
  const start = storageTodayKey(startDate);
  const meals = await getMealsInRange(start, end);
  return buildHealthSyncBundle({
    meals,
    weighIns: listWeighIns(storage),
    activeEnergy: readActiveEnergyMap(storage),
  });
}

export function downloadHealthBundle(bundle) {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `mealnova-health-sync-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
