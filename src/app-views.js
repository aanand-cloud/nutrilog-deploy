/** Lazy-loaded view modules — keeps initial bundle smaller on first paint. */

let logViewPromise;
let todayViewPromise;
let reportsViewPromise;
let calendarViewPromise;
let supplementsViewPromise;

export function loadLogView() {
  logViewPromise ||= import('./views/log.js');
  return logViewPromise;
}

export function loadTodayView() {
  todayViewPromise ||= import('./views/today.js');
  return todayViewPromise;
}

export function loadReportsView() {
  reportsViewPromise ||= import('./views/reports.js');
  return reportsViewPromise;
}

export function loadCalendarView() {
  calendarViewPromise ||= import('./views/calendar.js');
  return calendarViewPromise;
}

export function loadSupplementsView() {
  supplementsViewPromise ||= import('./views/supplements.js');
  return supplementsViewPromise;
}

/** Warm likely next view after idle (e.g. user on Today → prefetch Log). */
export function prefetchLogView() {
  if (typeof window === 'undefined') return;
  const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
  idle(() => { loadLogView().catch(() => {}); });
}
