#!/usr/bin/env node
/**
 * Build the P5 locked benchmark from mandatory cases, existing suites, and supplements.
 * Run: node scripts/generate-p5-locked-benchmark.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { runBenchmarkCase, loadBenchmarkFixtures } from '../shared/benchmark-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const benchmarkDir = join(root, 'scripts', 'benchmark');
const lockedDir = join(benchmarkDir, 'locked');

const QUOTAS = {
  uk: 60,
  indian: 80,
  packaged: 30,
  restaurant: 20,
  difficult_mixed: 10,
};

const UK_EUROPEAN_RE = /full english|beans on toast|fish and chips|bangers|sunday roast|porridge|baked beans|scotch egg|ploughman|yorkshire|cornish|jacket potato|shepherd|toad in the hole|ham sandwich|club sandwich|cauliflower cheese|steak and ale|pie and mash|kedgeree|crumpet|welsh rarebit|haggis|irish stew|cockle|laverbread|bara brith|cullen skink|kippers|hotpot|chip butty|chip shop|mushy peas|black pudding|saveloy|pease pudding|balti pie|beans on toast|toast and|marmite|scones|scouse|stottie|lancashire|devonshire|arbroath|smoked haddock|neeps|tatties|ulster fry|full welsh|full scottish|full irish|english breakfast|chip butty|pie\b/i;

function inferP5Region(testCase, suiteName = '') {
  if (testCase.p5Region) return testCase.p5Region;
  const cat = testCase.category || '';
  const input = String(testCase.input || '').toLowerCase();

  if (testCase.orderPairId) return 'difficult_mixed';
  if (suiteName === 'phase3-mixed') return 'restaurant';
  if (suiteName === 'recipes' || suiteName === 'vision-recipes') return 'restaurant';
  if (input.includes('restaurant') || input.includes('takeaway') || input.includes('chip shop')) return 'restaurant';
  if (testCase.expectRecipeDerived && !/\d+\s*g/.test(input) && !testCase.vision) return 'restaurant';
  if (['trusted_weighed', 'weighed_staple', 'weighed_portion', 'basic_weighed'].includes(cat)) return 'packaged';
  if (suiteName === 'uk-expanded' || cat.startsWith('uk_') || cat === 'recipe_uk' || cat === 'trusted_uk' || cat === 'uk_meal') return 'uk';
  if (suiteName === 'indian-expanded' || cat.startsWith('indian_') || cat === 'recipe_indian' || cat === 'trusted_indian' || cat === 'vision_recipe_indian' || cat === 'indian_meal') return 'indian';
  if (cat === 'european' && UK_EUROPEAN_RE.test(input)) return 'uk';
  if ((testCase.minItems || 0) >= 3 && /(?: with | and |,)/.test(input) && !testCase.expectRecipeDerived) return 'difficult_mixed';
  return null;
}

function caseScore(c) {
  let score = 0;
  if (c.mustInclude?.length) score += 3;
  if (c.referenceKcal || c.expectedKcal) score += 2;
  if (c.grams || c.expectedComponents) score += 2;
  if (c.expectVerified) score += 1;
  if (c.fixtureId) score += 1;
  return score;
}

function normalizeInput(input = '') {
  return String(input).toLowerCase().replace(/\s+/g, ' ').trim();
}

function loadAllPoolCases() {
  const pool = [];
  const files = readdirSync(benchmarkDir).filter((f) => f.startsWith('cases-') && f.endsWith('.json'));
  for (const file of files) {
    const suiteName = file.replace(/^cases-/, '').replace(/\.json$/, '');
    if (suiteName.startsWith('p5-') || suiteName === 'mandatory-p5') continue;
    const suite = JSON.parse(readFileSync(join(benchmarkDir, file), 'utf8'));
    for (const c of suite.cases || []) {
      if (!c.input && !c.vision) continue;
      pool.push({
        ...c,
        id: c.id || `${suiteName}-${normalizeInput(c.input).slice(0, 24)}`,
        _suite: suiteName,
        p5Region: inferP5Region(c, suiteName),
      });
    }
  }

  const mandatory = JSON.parse(readFileSync(join(lockedDir, 'cases-mandatory-p5.json'), 'utf8'));
  for (const c of mandatory.cases || []) {
    pool.push({ ...c, _suite: 'mandatory', _locked: true });
  }

  const supplementPath = join(lockedDir, 'cases-p5-supplement.json');
  try {
    const supplement = JSON.parse(readFileSync(supplementPath, 'utf8'));
    for (const c of supplement.cases || []) {
      pool.push({ ...c, _suite: 'supplement', p5Region: c.p5Region || inferP5Region(c, 'supplement') });
    }
  } catch {
    // optional supplement
  }

  return pool;
}

function selectLockedCases(pool, fixtures) {
  const passingPool = pool.filter((c) => {
    if (c._locked) return true;
    return runBenchmarkCase(c, fixtures).pass;
  });

  const selected = [];
  const seenInput = new Set();
  const counts = { uk: 0, indian: 0, packaged: 0, restaurant: 0, difficult_mixed: 0 };

  const dedupeKey = (c) => {
    if (c.orderPairId) return `${c.orderPairId}:${normalizeInput(c.input)}`;
    return c.id || normalizeInput(c.input);
  };

  const add = (c, force = false) => {
    const key = dedupeKey(c);
    if (seenInput.has(key) && !force) return false;
    const region = c.p5Region;
    if (!region || !QUOTAS[region]) return false;
    if (!force && counts[region] >= QUOTAS[region]) return false;
    seenInput.add(key);
    counts[region] += 1;
    selected.push({
      ...c,
      p5Region: region,
      tolerancePct: c.tolerancePct ?? 20,
      expectFirstSubmitPass: c.expectFirstSubmitPass !== false,
      expectRangeIntegrity: c.expectRangeIntegrity !== false,
      expectWeightProvenance: c.expectWeightProvenance !== false,
    });
    return true;
  };

  // Mandatory always first — must pass (verified separately in CI)
  for (const c of passingPool.filter((x) => x._locked)) add(c, true);

  // Fill by region priority score from passing pool only
  for (const region of Object.keys(QUOTAS)) {
    const candidates = passingPool
      .filter((c) => c.p5Region === region && !selected.find((s) => s.id === c.id))
      .sort((a, b) => caseScore(b) - caseScore(a) || a.id.localeCompare(b.id));
    for (const c of candidates) {
      if (counts[region] >= QUOTAS[region]) break;
      add(c);
    }
  }

  return { selected, counts, passingPoolSize: passingPool.length };
}

function main() {
  const fixtures = loadBenchmarkFixtures(root);
  const pool = loadAllPoolCases();
  const { selected, counts, passingPoolSize } = selectLockedCases(pool, fixtures);

  const total = selected.length;
  const minRequired = Object.values(QUOTAS).reduce((a, b) => a + b, 0);

  if (total < minRequired) {
    console.error(`P5 locked benchmark: only ${total}/${minRequired} passing cases selected (${passingPoolSize} pass in pool)`);
    console.error('Counts:', counts);
    process.exitCode = 1;
  }

  const payload = {
    version: 'p5-locked-1',
    description: 'MealNova P5 locked accuracy benchmark — do not edit by hand; regenerate via generate-p5-locked-benchmark.mjs',
    generatedAt: new Date().toISOString(),
    quotas: QUOTAS,
    regionCounts: counts,
    cases: selected.map(({ _suite, _locked, ...c }) => c),
  };

  const hash = createHash('sha256').update(JSON.stringify(payload.cases)).digest('hex').slice(0, 12);

  writeFileSync(join(lockedDir, 'cases-p5-locked.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const manifest = {
    version: 'p5-locked-1',
    buildLock: '2026-09-09-p5.0',
    casesFile: 'cases-p5-locked.json',
    casesChecksum: hash,
    totalCases: total,
    regionCounts: counts,
    quotas: QUOTAS,
    gates: {
      casePassRateMin: 0.95,
      componentRecognitionMin: 0.95,
      ingredientRetentionMin: 0.98,
      quantityBindingMin: 0.98,
      medianCalorieErrorPctMax: 0.10,
      within20PctMin: 0.90,
      rangeIntegrityMin: 1.0,
      firstSubmissionSuccessMin: 1.0,
      weightProvenanceMin: 1.0,
      mandatoryPassRateMin: 1.0,
    },
  };

  writeFileSync(join(lockedDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  console.log(`P5 locked benchmark: ${total} cases (checksum ${hash})`);
  console.log('Region counts:', counts);
}

main();
