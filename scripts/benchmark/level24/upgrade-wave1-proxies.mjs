/**
 * Upgrade Wave 1 family_proxy / incompatible image mappings.
 * Development only. Clears predictions for replaced cases so Gemini can re-run.
 *
 * Run: node scripts/benchmark/level24/upgrade-wave1-proxies.mjs
 */
import { createWriteStream, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  classifyFood,
  familyFallback,
  mappingRank,
  titleCompatibleWithFood,
} from './image-classify.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const imageDir = resolve(root, 'data/benchmark/level24/images/development');
const predDir = resolve(root, 'data/benchmark/level24/predictions/development');
const manifestPath = resolve(root, 'data/benchmark/level24/image-manifest-wave1.json');
const titleCachePath = resolve(root, '.tmp/l24-commons-titles.json');
const UA = 'MealNovaLevel24B/1.0 (local development benchmark; proxy upgrade)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

const EXTRA_SEARCHES = [
  'Dindigul Thalappakatti Biryani',
  'Dindigul chicken biryani',
  'Dindigul mutton biryani',
  'mutton biryani plate',
  'goat biryani',
  'Ambur Chicken Biryani',
  'Ambur Mutton Briyani',
  'Ambur mutton biryani',
  'Thalassery mutton biryani',
  'Set dosa',
  'Set dosai',
  'Ghee roast dosa',
  'Sambar idli',
  'Idli sambar',
  'Idli with sambar',
  'Podi idli',
  'plain idli plate',
  'steamed idli',
  'Hyderabadi chicken biryani',
  'Hydrabadi Chicken Dum Biryani',
  'Hyderabadi mutton biryani',
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function commonsJson(params) {
  const url = `${COMMONS}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) throw new Error(`Commons ${res.status}`);
    await sleep(1200 * attempt);
  }
  throw new Error('Commons rate-limited');
}

async function searchFiles(query) {
  const json = await commonsJson({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: '6',
    srlimit: '30',
  });
  return (json.query?.search || []).map((row) => row.title);
}

function commonsUrls(title) {
  const name = String(title).replace(/^File:/i, '');
  return {
    title,
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1600`,
    source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    mime: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg',
  };
}

async function downloadImage(url, dest) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (res.ok && res.body) {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      return;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(1500 * attempt);
      continue;
    }
    throw new Error(`download ${res.status}`);
  }
  throw new Error('download failed');
}

mkdirSync(imageDir, { recursive: true });
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const titleSet = new Set(existsSync(titleCachePath) ? JSON.parse(readFileSync(titleCachePath, 'utf8')) : []);

for (const query of EXTRA_SEARCHES) {
  try {
    for (const title of await searchFiles(query)) titleSet.add(title);
    await sleep(700);
    console.log(`search ${query}: ${titleSet.size} titles`);
  } catch (error) {
    console.warn(`skip search ${query}: ${error.message}`);
  }
}
writeFileSync(titleCachePath, `${JSON.stringify([...titleSet], null, 2)}\n`);

const pools = new Map();
for (const title of titleSet) {
  const food = classifyFood(title);
  if (!food) continue;
  if (!pools.has(food)) pools.set(food, []);
  pools.get(food).push(commonsUrls(title));
}

const used = new Set();
for (const row of manifest.cases) {
  if (row.source_title) used.add(row.source_title);
  if (row.download_url) used.add(row.download_url);
}

function bestCandidate(food, avoidTitles = new Set()) {
  const keys = [food, ...familyFallback(food)];
  const candidates = keys
    .flatMap((key) => (pools.get(key) || []).map((info) => ({ key, info })))
    .filter((row) => !used.has(row.info.url) && !used.has(row.info.title) && !avoidTitles.has(row.info.title))
    .map((row) => ({
      ...row,
      rank: mappingRank(food, row.key, row.info.title),
    }))
    .filter((row) => row.rank > 0)
    .sort((a, b) => b.rank - a.rank);
  return candidates[0] || null;
}

const replaced = [];
const flagged = [];

for (const row of manifest.cases) {
  const currentRank = mappingRank(row.canonical_name, row.match_key, row.source_title || '');
  const incompatible = currentRank < 0;
  const isProxy = row.mapping_confidence === 'family_proxy';
  if (!incompatible && !isProxy) continue;

  const avoid = new Set([row.source_title].filter(Boolean));
  const picked = bestCandidate(row.canonical_name, avoid);
  if (!picked) {
    if (incompatible) {
      row.mapping_confidence = 'weak_proxy';
      row.mapping_note = 'No compatible Commons replacement found; keep flagged for manual photo.';
      flagged.push(row.case_id);
    }
    continue;
  }

  // Only replace if better than current (or current is incompatible).
  if (!incompatible && picked.rank <= currentRank) continue;

  const ext = /png/i.test(picked.info.mime || picked.info.title) ? 'png' : 'jpg';
  const fileName = `${row.case_id}.${ext}`;
  const dest = resolve(imageDir, fileName);
  try {
    await downloadImage(picked.info.url, dest);
  } catch (error) {
    console.warn(`skip ${row.case_id}: ${error.message}`);
    continue;
  }

  used.add(picked.info.url);
  used.add(picked.info.title);
  if (row.source_title) used.delete(row.source_title);
  if (row.download_url) used.delete(row.download_url);

  const prev = row.source_title;
  row.image_path = `data/benchmark/level24/images/development/${fileName}`;
  row.source_title = picked.info.title;
  row.source_url = picked.info.source_url;
  row.download_url = picked.info.url;
  row.match_key = picked.key;
  row.mapping_confidence = picked.key === row.canonical_name ? 'exact_or_named' : 'family_proxy';
  delete row.mapping_note;

  const predPath = resolve(predDir, `${row.case_id}.json`);
  if (existsSync(predPath)) unlinkSync(predPath);

  replaced.push({ case_id: row.case_id, from: prev, to: picked.info.title, confidence: row.mapping_confidence });
  console.log(`upgraded ${row.case_id}: ${prev} → ${picked.info.title} (${row.mapping_confidence})`);
}

manifest.mapping_confidence_counts = manifest.cases.reduce((acc, row) => {
  acc[row.mapping_confidence] = (acc[row.mapping_confidence] || 0) + 1;
  return acc;
}, {});
manifest.proxy_upgrade = {
  replaced: replaced.length,
  flagged_weak: flagged.length,
  updated_at: new Date().toISOString().slice(0, 10),
};
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(JSON.stringify({
  replaced: replaced.length,
  flagged_weak: flagged.length,
  mapping_confidence_counts: manifest.mapping_confidence_counts,
  sample: replaced.slice(0, 12),
}, null, 2));
console.log('Cleared predictions for replaced cases. Re-run: node scripts/benchmark/level24/run-wave1.mjs');
