import { isQueueableAnalysisError } from '../shared/photo-offline-queue.js';

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('network TypeError queueable', isQueueableAnalysisError(new TypeError('Failed to fetch')));
assert('timeout queueable', isQueueableAnalysisError(new Error('Analysis took too long — try again')));
assert('503 queueable', isQueueableAnalysisError(new Error('Analysis failed (503)')));
assert('could not reach queueable', isQueueableAnalysisError(new Error('Could not reach the server — try barcode')));

assert('auth not queueable', !isQueueableAnalysisError({ requiresAuth: true, message: 'Sign in required' }));
assert('scan limit not queueable', !isQueueableAnalysisError({ limitReached: true, message: 'Daily scan limit reached' }));
assert('rate limit not queueable', !isQueueableAnalysisError({ rateLimited: true, message: 'Too many requests' }));
assert('gemini down not queueable', !isQueueableAnalysisError(new Error('GEMINI not configured')));

console.log('\nDone.');
