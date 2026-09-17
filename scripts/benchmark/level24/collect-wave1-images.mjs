/**
 * Collect 187 real development-set photos for Level 2.4B Wave 1.
 * Isolated from matcher/UI. Never touches holdout cases.
 *
 * Run: node scripts/benchmark/level24/collect-wave1-images.mjs
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { loadLevel24Spec, selectWave1Cases } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const spec = loadLevel24Spec(root);
const wave1 = selectWave1Cases(spec.cases, 200);
if (wave1.length !== 187) throw new Error(`Expected 187 wave-1 cases, got ${wave1.length}`);
if (wave1.some((row) => row.split !== 'development')) {
  throw new Error('Wave 1 leaked a holdout case.');
}

const imageDir = resolve(root, 'data/benchmark/level24/images/development');
const manifestPath = resolve(root, 'data/benchmark/level24/image-manifest-wave1.json');
const titleCachePath = resolve(root, '.tmp/l24-commons-titles.json');
const infoCachePath = resolve(root, '.tmp/l24-commons-infos.json');
mkdirSync(imageDir, { recursive: true });
mkdirSync(dirname(titleCachePath), { recursive: true });

const UA = 'MealNovaLevel24B/1.0 (local development benchmark; real-image collection)';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';

const CATEGORIES = [
  'Category:Hyderabadi_biryani',
  'Category:Hyderabadi_chicken_biryani',
  'Category:Chicken_biryani',
  'Category:Mutton_biryani',
  'Category:Biryani',
  'Category:Vegetable_biryani',
  'Category:Dosa',
  'Category:Masala_dosa',
  'Category:Rava_dosa',
  'Category:Idli',
  'Category:Sambar',
];

const SEARCHES = [
  'Dindigul Thalappakatti Biryani',
  'Ambur Mutton Briyani',
  'Ambur Chicken Biryani',
  'Thalassery biryani',
  'Hyderabadi mutton biryani',
  'Paneer Biryani',
  'Vegetable Biryani',
  'Ghee roast dosa',
  'Set dosa',
  'Rava dosa',
  'Podi idli',
  'Ghee podi idli',
  'Sambar idli',
  'Masala dosa',
  'Plain dosa',
];

function sleep(ms) {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, ms));
}

async function commonsJson(params) {
  const url = `${COMMONS}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return res.json();
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`Commons ${res.status} ${params.action}`);
    }
    await sleep(1500 * attempt);
  }
  throw new Error(`Commons rate-limited ${params.action}`);
}

function normalizeTitle(title = '') {
  return String(title).replace(/^File:/i, '').toLowerCase();
}

function isRejectedTitle(title = '') {
  return /stamp|logo|icon|map|video|webm|svg|gif|falooda|illustration|drawing|cartoon|poster|advert|recipe book|packaging|packet|wiki\s*love/i.test(title);
}

function classifyFood(title = '') {
  const t = normalizeTitle(title);
  if (isRejectedTitle(t)) return null;
  if (!/(biryani|biriyani|briyani|dosa|dosai|idli|idly)/i.test(t)) return null;

  if (/dindigul|thalappakatti/.test(t) && /biry|briy/.test(t)) {
    return /chicken|murg/.test(t) ? 'dindigul chicken biryani' : 'dindigul mutton biryani';
  }
  if (/ambur/.test(t) && /biry|briy/.test(t)) {
    return /chicken|murg/.test(t) ? 'ambur chicken biryani' : 'ambur mutton biryani';
  }
  if (/thalassery|thalassery|tellicherry/.test(t) && /biry|briy/.test(t)) {
    return 'thalassery mutton biryani';
  }
  if (/hyderabad/.test(t) && /biry|briy/.test(t)) {
    if (/veg|vegetable/.test(t)) return 'vegetable biryani';
    if (/paneer|panner/.test(t)) return 'paneer biryani';
    if (/chicken|murg/.test(t)) return 'hyderabadi chicken biryani';
    if (/mutton|gosht|lamb|goat/.test(t)) return 'hyderabadi mutton biryani';
    return 'hyderabadi mutton biryani';
  }
  if (/paneer|panner/.test(t) && /biry|briy/.test(t)) return 'paneer biryani';
  if (/(vegetable|veg)\b/.test(t) && /biry|briy/.test(t)) return 'vegetable biryani';
  if (/ghee\s*roast/.test(t) && /dosa/.test(t)) return 'ghee roast dosa';
  if (/rava|rava\s*dosa|ravva/.test(t) && /dosa/.test(t)) return 'rava dosa';
  if (/set\s*dosa/.test(t)) return 'set dosa';
  if (/masala/.test(t) && /dosa/.test(t)) return 'masala dosa';
  if (/podi/.test(t) && /idli|idly/.test(t)) return 'ghee podi idli';
  if (/sambar|sambaar/.test(t) && /idli|idly/.test(t)) return 'sambar idli';
  if (/idli|idly/.test(t) && !/dosa/.test(t)) return 'plain idli';
  if (/dosa|dosai/.test(t)) return 'plain dosa';
  if (/mutton|gosht|lamb|goat/.test(t) && /biry|briy/.test(t)) return 'family:mutton_biryani';
  if (/chicken|murg/.test(t) && /biry|briy/.test(t)) return 'family:chicken_biryani';
  if (/biry|briy/.test(t)) return 'family:biryani';
  return null;
}

function familyFallback(food) {
  if (/mutton biryani/.test(food)) return ['family:mutton_biryani', 'family:biryani'];
  if (/chicken biryani/.test(food)) return ['family:chicken_biryani', 'family:biryani'];
  if (food === 'vegetable biryani' || food === 'paneer biryani') return ['family:biryani'];
  if (/idli/.test(food)) return ['plain idli'];
  if (/dosa/.test(food)) return ['plain dosa', 'masala dosa'];
  return [];
}

function scenarioScore(title, scenario) {
  const t = normalizeTitle(title);
  const checks = {
    with_common_side: /raita|chutney|sambar|salan|side/,
    restaurant_normal: /hotel|restaurant|dhaba|alpha|paradise/,
    restaurant_rich: /hotel|restaurant|dum|ghee|rich/,
    home_small: /home|homemade|home made/,
    home_normal: /home|homemade|home made/,
    home_large: /home|homemade|platter|family/,
    takeaway_large: /pack|box|takeaway|parcel|container/,
    lean_preparation: /steam|plain|simple|light/,
    rich_preparation: /ghee|dum|rich|oily|fried/,
    difficult_angle: /crop|close|side|partial|angle/,
    lookalike_challenge: /biry|dosa|idli/,
  };
  return checks[scenario]?.test(t) ? 2 : 0;
}

async function listCategoryFiles(category) {
  const titles = [];
  let cmcontinue;
  for (let page = 0; page < 8; page += 1) {
    const json = await commonsJson({
      action: 'query',
      list: 'categorymembers',
      cmtitle: category,
      cmtype: 'file',
      cmlimit: '100',
      ...(cmcontinue ? { cmcontinue } : {}),
    });
    for (const row of json.query?.categorymembers || []) titles.push(row.title);
    cmcontinue = json.continue?.cmcontinue;
    await sleep(800);
    if (!cmcontinue) break;
  }
  return titles;
}

async function searchFiles(query) {
  const json = await commonsJson({
    action: 'query',
    list: 'search',
    srsearch: query,
    srnamespace: '6',
    srlimit: '20',
  });
  return (json.query?.search || []).map((row) => row.title);
}

async function fileInfo(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 16) {
    const chunk = titles.slice(i, i + 16);
    let json;
    try {
      json = await commonsJson({
        action: 'query',
        titles: chunk.join('|'),
        prop: 'imageinfo',
        iiprop: 'url|size|mime',
        iiurlwidth: '1600',
      });
    } catch (error) {
      console.warn(`skip fileInfo batch: ${error.message}`);
      await sleep(2000);
      continue;
    }
    for (const page of Object.values(json.query?.pages || {})) {
      const info = page.imageinfo?.[0];
      if (!info) continue;
      if (!/^image\/(jpeg|png|webp)$/i.test(info.mime || '')) continue;
      if ((info.width || 0) < 400 || (info.height || 0) < 300) continue;
      out.push({
        title: page.title,
        url: info.thumburl || info.url,
        source_url: info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
        mime: info.mime,
        width: info.width,
        height: info.height,
      });
    }
    await sleep(900);
  }
  return out;
}

async function downloadImage(url, dest) {
  if (existsSync(dest) && (await import('node:fs')).statSync(dest).size > 8000) return;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const res = await fetch(url, { headers: { 'User-Agent': UA }, redirect: 'follow' });
    if (res.ok && res.body) {
      await pipeline(Readable.fromWeb(res.body), createWriteStream(dest));
      return;
    }
    if (res.status === 429 || res.status >= 500) {
      await sleep(2000 * attempt);
      continue;
    }
    throw new Error(`download ${res.status} ${url}`);
  }
  throw new Error(`download 429 ${url}`);
}

async function searchOpenverse(query) {
  const url = `https://api.openverse.org/v1/images/?${new URLSearchParams({
    q: query,
    page_size: '20',
    mature: 'false',
  })}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results || []).map((row) => ({
    title: row.title || query,
    url: row.url,
    source_url: row.foreign_landing_url || row.url,
    mime: /png/i.test(row.url) ? 'image/png' : 'image/jpeg',
    width: row.width || 800,
    height: row.height || 600,
  })).filter((row) => row.url && classifyFood(row.title || query));
}

const titleSet = new Set(existsSync(titleCachePath) ? JSON.parse(readFileSync(titleCachePath, 'utf8')) : []);
if (titleSet.size < 400) {
for (const category of CATEGORIES) {
  try {
    for (const title of await listCategoryFiles(category)) titleSet.add(title);
    console.log(`category ${category}: ${titleSet.size} unique files so far`);
  } catch (error) {
    console.warn(`skip category ${category}: ${error.message}`);
  }
}
for (const query of SEARCHES) {
  try {
    for (const title of await searchFiles(query)) titleSet.add(title);
    await sleep(800);
  } catch (error) {
    console.warn(`skip search ${query}: ${error.message}`);
  }
}
}

writeFileSync(titleCachePath, `${JSON.stringify([...titleSet], null, 2)}\n`);

function commonsUrls(title) {
  const name = String(title).replace(/^File:/i, '');
  return {
    title,
    url: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(name)}?width=1600`,
    source_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`,
    mime: /\.png$/i.test(name) ? 'image/png' : 'image/jpeg',
  };
}

const pools = new Map();
for (const title of titleSet) {
  const food = classifyFood(title);
  if (!food) continue;
  if (!pools.has(food)) pools.set(food, []);
  pools.get(food).push(commonsUrls(title));
}

for (const query of SEARCHES) {
  try {
    for (const info of await searchOpenverse(query)) {
      const food = classifyFood(info.title) || classifyFood(query);
      if (!food) continue;
      if (!pools.has(food)) pools.set(food, []);
      pools.get(food).push(info);
    }
    await sleep(300);
  } catch (error) {
    console.warn(`skip openverse ${query}: ${error.message}`);
  }
}

const foods = [...new Set(wave1.map((row) => row.canonical_name))];
const usedUrls = new Set();
const mappings = existsSync(manifestPath)
  ? (JSON.parse(readFileSync(manifestPath, 'utf8')).cases || []).filter((row) => {
    const dest = resolve(root, row.image_path || '');
    return existsSync(dest);
  })
  : [];
for (const row of mappings) {
  if (row.source_title) usedUrls.add(row.source_title);
  if (row.download_url) usedUrls.add(row.download_url);
}

function takeFrom(keys, scenario) {
  const candidates = keys.flatMap((key) => (pools.get(key) || []).map((info) => ({ key, info })))
    .filter((row) => !usedUrls.has(row.info.url) && !usedUrls.has(row.info.title))
    .sort((a, b) => scenarioScore(b.info.title, scenario) - scenarioScore(a.info.title, scenario));
  const picked = candidates[0];
  if (!picked) return null;
  usedUrls.add(picked.info.url);
  usedUrls.add(picked.info.title);
  return { ...picked.info, match_key: picked.key };
}

function writeManifest() {
  const manifest = {
    version: '2.4B.0',
    purpose: 'Wave 1 real-image map. Development only. Holdout never included.',
    source: 'Wikimedia Commons and Openverse real photographs',
    case_count: mappings.length,
    foods,
    holdout_included: false,
    actual_weights_recorded: 0,
    mapping_confidence_counts: mappings.reduce((acc, row) => {
      acc[row.mapping_confidence] = (acc[row.mapping_confidence] || 0) + 1;
      return acc;
    }, {}),
    cases: mappings,
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

for (const food of foods) {
  const cases = wave1.filter((row) => row.canonical_name === food);
  for (const row of cases) {
    if (mappings.some((item) => item.case_id === row.case_id)) continue;
    let picked = null;
    for (let attempt = 0; attempt < 16 && !picked; attempt += 1) {
      const candidate = takeFrom([food, ...familyFallback(food)], row.scenario);
      if (!candidate) break;
      const ext = /png/i.test(candidate.mime || candidate.title) ? 'png' : 'jpg';
      const fileName = `${row.case_id}.${ext}`;
      const dest = resolve(imageDir, fileName);
      try {
        await downloadImage(candidate.url, dest);
        picked = { ...candidate, dest, fileName };
      } catch (error) {
        console.warn(`retry ${row.case_id}: ${error.message}`);
      }
    }
    if (!picked) {
      throw new Error(`Not enough real photos for ${food} / ${row.scenario}. Do not invent images.`);
    }
    mappings.push({
      case_id: row.case_id,
      split: 'development',
      canonical_name: food,
      scenario: row.scenario,
      image_path: `data/benchmark/level24/images/development/${picked.fileName}`,
      source_title: picked.title,
      source_url: picked.source_url,
      download_url: picked.url,
      mapping_confidence: picked.match_key === food ? 'exact_or_named' : 'family_proxy',
      match_key: picked.match_key,
      actual_portion_g: null,
      actual_portion_note: 'Web photo; plate was not weighed. Score against spec portion_truth_g only.',
    });
    process.stdout.write(`mapped ${row.case_id} ← ${picked.title}\n`);
    writeManifest();
    await sleep(400);
  }
}

const manifest = writeManifest();
console.log(JSON.stringify({
  mapped: mappings.length,
  foods: foods.length,
  exact_or_named: manifest.mapping_confidence_counts.exact_or_named || 0,
  family_proxy: manifest.mapping_confidence_counts.family_proxy || 0,
  manifest: manifestPath,
}, null, 2));
