/**
 * Log entry routing — kept out of log.js so the main bundle can lazy-load the log view.
 * Main Log meal opens the method picker. Shortcuts may jump to photo, barcode, describe or search.
 */

import { MEAL_TYPES } from '../services/meal-types.js';

let pendingLogFocus = null;
let pendingOfflineResumeId = null;
let pendingLogMealType = null;
let pendingBarcodeOnly = false;
let pendingPhotoOnly = false;
let pendingDescribeOnly = false;

const BUSY_STEPS = new Set([
  'photo_details',
  'adjust',
  'weight_confirm',
  'hidden_details',
  'side_details',
  'preview',
  'weight',
  'analyzing',
  'clarify',
  'review',
  'confirm',
  'saving',
  'failed',
]);
let logSessionStep = null;

export function setLogSessionStep(step) {
  logSessionStep = step || null;
}

export function isLogBusy() {
  return BUSY_STEPS.has(logSessionStep);
}

export function requestLogMealType(mealType) {
  if (MEAL_TYPES.some((t) => t.id === mealType)) {
    pendingLogMealType = mealType;
  }
}

export function requestLogFocus(section = 'method') {
  if (section === 'describe' || section === 'barcode' || section === 'photo' || section === 'search' || section === 'upload' || section === 'method') {
    pendingLogFocus = section;
    pendingBarcodeOnly = section === 'barcode';
    pendingPhotoOnly = section === 'photo' || section === 'upload';
    pendingDescribeOnly = section === 'describe';
  } else {
    pendingLogFocus = null;
    pendingBarcodeOnly = false;
    pendingPhotoOnly = false;
    pendingDescribeOnly = false;
  }
}

export function beginSearchLogEntry() {
  requestLogFocus('search');
}

export function beginPhotoLogEntry() {
  requestLogFocus('photo');
}

export function beginBarcodeLogEntry() {
  requestLogFocus('barcode');
}

export function beginDescribeLogEntry() {
  requestLogFocus('describe');
}

export function resumeOfflinePhotoMeal(queueId) {
  if (!queueId) return;
  pendingOfflineResumeId = queueId;
  requestLogFocus('photo');
}

export function hasPendingLogShortcut() {
  return pendingPhotoOnly || pendingBarcodeOnly || pendingDescribeOnly || Boolean(pendingLogFocus);
}

/** Read and clear pending routing flags when log view mounts. */
export function takePendingLogRouting() {
  const routing = {
    focus: pendingLogFocus,
    barcodeOnly: pendingBarcodeOnly,
    photoOnly: pendingPhotoOnly,
    describeOnly: pendingDescribeOnly,
    mealType: pendingLogMealType,
    offlineResumeId: pendingOfflineResumeId,
  };
  pendingLogFocus = null;
  pendingBarcodeOnly = false;
  pendingPhotoOnly = false;
  pendingDescribeOnly = false;
  pendingLogMealType = null;
  pendingOfflineResumeId = null;
  return routing;
}

export function peekPendingOfflineResumeId() {
  return pendingOfflineResumeId;
}
