/**
 * Lightweight navigation/date state shared by app shell and views (no heavy UI imports).
 */

import { todayKey } from '../services/storage.js';
import { isDateInCalendarRange } from '../services/meal-calendar.js';

let activeSettingsTab = 'targets';
let passwordResetMode = false;
let openDiscountSectionPending = false;
let pendingDiscountPathFocus = null;
let todayViewDateKey = null;
let logTargetDateKey = null;

function resolveTodayViewDate() {
  const today = todayKey();
  if (!todayViewDateKey) return today;
  if (!isDateInCalendarRange(todayViewDateKey)) return today;
  return todayViewDateKey;
}

export function setTodayViewDate(dateKey) {
  todayViewDateKey = dateKey || null;
}

export function clearTodayViewDate() {
  todayViewDateKey = null;
}

export function getTodayViewDate() {
  return resolveTodayViewDate();
}

export function setLogTargetDate(dateKey) {
  logTargetDateKey = dateKey || null;
}

export function getLogTargetDate() {
  return logTargetDateKey;
}

export function clearLogTargetDate() {
  logTargetDateKey = null;
}

export function setSettingsTab(tab) {
  if (['targets', 'account', 'plans', 'alerts'].includes(tab)) {
    activeSettingsTab = tab;
  }
}

export function getSettingsTab() {
  return activeSettingsTab;
}

export function requestOpenDiscountSection(path = null) {
  openDiscountSectionPending = true;
  pendingDiscountPathFocus = path === 'senior' ? 'senior' : path === 'public' ? 'public' : null;
}

export function consumeOpenDiscountSection() {
  const pending = openDiscountSectionPending;
  openDiscountSectionPending = false;
  return pending;
}

export function getPendingDiscountPathFocus() {
  return pendingDiscountPathFocus;
}

export function clearPendingDiscountPathFocus() {
  pendingDiscountPathFocus = null;
}

export function setPasswordResetMode(on = true) {
  passwordResetMode = Boolean(on);
}

export function isPasswordResetMode() {
  return passwordResetMode;
}
