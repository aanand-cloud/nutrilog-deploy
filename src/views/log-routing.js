/**
 * Log entry routing — kept out of log.js so the main bundle can lazy-load the log view.
 * Do not change: photo → camera, barcode → scanner, describe → text.
 */

import { primeWebCameraStream } from '../services/web-camera.js';
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
  'analyzing',
  'clarify',
  'review',
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

export function requestLogFocus(section = 'describe') {
  if (section === 'describe' || section === 'barcode' || section === 'photo') {
    pendingLogFocus = section;
    pendingBarcodeOnly = section === 'barcode';
    pendingPhotoOnly = section === 'photo';
    pendingDescribeOnly = section === 'describe';
  } else {
    pendingLogFocus = null;
    pendingBarcodeOnly = false;
    pendingPhotoOnly = false;
    pendingDescribeOnly = false;
  }
}

export function beginPhotoLogEntry() {
  requestLogFocus('photo');
  primeWebCameraStream();
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
