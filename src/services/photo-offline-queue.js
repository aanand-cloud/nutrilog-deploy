/**
 * Offline photo queue — save meal photos locally when AI analysis can't run;
 * retry automatically when back online (no scan charged until analysis succeeds).
 */

import { isQueueableAnalysisError } from '../../shared/photo-offline-queue.js';
import { analyzeFoodPhoto } from './ai-analysis.js';

export { isQueueableAnalysisError };

const DB_NAME = 'nutrilog_offline_queue';
const DB_VERSION = 1;
const STORE = 'photos';
const MAX_ITEMS = 5;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
}

function generateId() {
  return `pq-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isFresh(item = {}) {
  const age = Date.now() - Date.parse(item.createdAt || 0);
  return Number.isFinite(age) && age >= 0 && age <= MAX_AGE_MS;
}
async function listAllItems() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function putItem(item) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve(item);
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteItem(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function pruneStale(items = []) {
  const stale = items.filter((item) => !isFresh(item));
  await Promise.all(stale.map((item) => deleteItem(item.id)));
  return items.filter(isFresh);
}

/**
 * @param {{ base64: string, mimeType?: string, previewDataUrl?: string, userMealNotes?: string }} payload
 */
export async function enqueueOfflinePhoto(payload = {}) {
  const base64 = String(payload.base64 || '').trim();
  if (!base64) throw new Error('Photo missing');

  let items = await pruneStale(await listAllItems());
  if (items.length >= MAX_ITEMS) {
    items.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
    await deleteItem(items[0].id);
    items = items.slice(1);
  }

  const item = {
    id: generateId(),
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    imageBase64: base64,
    mimeType: payload.mimeType || 'image/jpeg',
    previewDataUrl: payload.previewDataUrl || null,
    userMealNotes: String(payload.userMealNotes || '').trim(),
    attemptCount: 0,
    lastError: '',
  };
  await putItem(item);
  return item;
}

export async function getOfflineQueueItem(id) {
  const items = await pruneStale(await listAllItems());
  return items.find((item) => item.id === id) || null;
}

export async function removeOfflineQueueItem(id) {
  if (!id) return;
  await deleteItem(id);
}

export async function getOfflineQueueSummary() {
  const items = await pruneStale(await listAllItems());
  let pending = 0;
  let ready = 0;
  let processing = 0;
  for (const item of items) {
    if (item.status === 'ready') ready += 1;
    else if (item.status === 'processing') processing += 1;
    else pending += 1;
  }
  return { pending, ready, processing, total: items.length, items };
}

let processingLock = false;

/**
 * Retry pending queued photos when online.
 * @returns {Promise<{ processed: number, ready: number, failed: number }>}
 */
export async function processOfflinePhotoQueue() {
  if (processingLock || typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { processed: 0, ready: 0, failed: 0 };
  }

  processingLock = true;
  let processed = 0;
  let ready = 0;
  let failed = 0;

  try {
    const items = (await getOfflineQueueSummary()).items
      .filter((item) => item.status === 'pending')
      .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

    for (const item of items) {
      const working = {
        ...item,
        status: 'processing',
        updatedAt: new Date().toISOString(),
        attemptCount: (item.attemptCount || 0) + 1,
      };
      await putItem(working);

      try {
        const analysis = await analyzeFoodPhoto(
          working.imageBase64,
          working.mimeType,
          working.userMealNotes,
        );
        await putItem({
          ...working,
          status: 'ready',
          analysis,
          lastError: '',
          updatedAt: new Date().toISOString(),
        });
        processed += 1;
        ready += 1;
      } catch (err) {
        if (!isQueueableAnalysisError(err)) {
          await putItem({
            ...working,
            status: 'pending',
            lastError: String(err?.message || err || 'Analysis failed'),
            updatedAt: new Date().toISOString(),
          });
          failed += 1;
          break;
        }
        await putItem({
          ...working,
          status: 'pending',
          lastError: String(err?.message || err || 'Still offline'),
          updatedAt: new Date().toISOString(),
        });
        failed += 1;
        break;
      }
    }
  } finally {
    processingLock = false;
  }

  return { processed, ready, failed };
}

export function bindOfflinePhotoQueue(onChange) {
  if (typeof window === 'undefined') return () => {};

  const handler = async () => {
    if (!navigator.onLine) return;
    const before = await getOfflineQueueSummary();
    const result = await processOfflinePhotoQueue();
    const after = await getOfflineQueueSummary();
    if (after.ready > before.ready || result.processed > 0) {
      onChange?.(after, { readyAdded: Math.max(0, after.ready - before.ready) });
    }
  };

  window.addEventListener('online', handler);
  handler();

  return () => window.removeEventListener('online', handler);
}
