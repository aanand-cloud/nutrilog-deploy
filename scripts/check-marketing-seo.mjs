#!/usr/bin/env node
/** SEO and static marketing page checks. */

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MARKETING_PAGE_SLUGS,
  MARKETING_PAGES,
  MEALNOVA_FAQ,
  SITE_URL,
  buildSitemapXml,
} from '../src/services/marketing-seo.js';
import { landingFaqHtml } from '../src/services/guest-marketing.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

let failed = false;
const fail = (msg) => {
  console.error(`check-marketing-seo: ${msg}`);
  failed = true;
};

if (!existsSync(join(root, 'public/robots.txt'))) {
  fail('missing public/robots.txt');
} else {
  const robots = readFileSync(join(root, 'public/robots.txt'), 'utf8');
  if (!/Sitemap:/i.test(robots)) fail('robots.txt must reference sitemap');
}

if (!existsSync(join(root, 'public/sitemap.xml'))) {
  fail('missing public/sitemap.xml — run node scripts/build-marketing-pages.mjs');
} else {
  const sitemap = readFileSync(join(root, 'public/sitemap.xml'), 'utf8');
  for (const slug of MARKETING_PAGE_SLUGS) {
    const path = MARKETING_PAGES[slug].path;
    if (!sitemap.includes(`${path}/`)) fail(`sitemap missing ${path}/`);
  }
}

if (!existsSync(join(root, 'public/faq-schema.json'))) {
  fail('missing public/faq-schema.json');
} else {
  const schema = JSON.parse(readFileSync(join(root, 'public/faq-schema.json'), 'utf8'));
  if (schema['@type'] !== 'FAQPage') fail('faq-schema.json must be FAQPage');
  if ((schema.mainEntity || []).length !== MEALNOVA_FAQ.length) {
    fail(`faq-schema question count ${schema.mainEntity?.length} vs ${MEALNOVA_FAQ.length}`);
  }
}

for (const slug of MARKETING_PAGE_SLUGS) {
  const file = join(root, slug, 'index.html');
  if (!existsSync(file)) {
    fail(`missing static page ${slug}/index.html`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  const page = MARKETING_PAGES[slug];
  if ((html.match(/<h1\b/g) || []).length !== 1) fail(`${slug} must have exactly one H1`);
  if (!html.includes(`<link rel="canonical" href="${SITE_URL}${page.path}/"`)) fail(`${slug} canonical mismatch`);
  if (!html.includes('og:title')) fail(`${slug} missing Open Graph tags`);
  if (!html.includes('application/ld+json')) fail(`${slug} missing JSON-LD`);
}

const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');
if (!indexHtml.includes('MEALNOVA_FAQ_SCHEMA')) fail('index.html must include FAQ schema placeholder');
if (!indexHtml.includes('MEALNOVA_SITE_VERIFICATION')) fail('index.html must include verification placeholder');

const faqLanding = landingFaqHtml();
for (const item of MEALNOVA_FAQ) {
  if (!faqLanding.includes(item.q)) fail(`landing FAQ missing question: ${item.q.slice(0, 40)}`);
}

const sitemapBuilt = buildSitemapXml();
if (!sitemapBuilt.includes('<loc>https://www.mealnova.co.uk/</loc>')) {
  fail('sitemap builder must include homepage');
}

if (failed) process.exit(1);
console.log('check-marketing-seo: ok');
