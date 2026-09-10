#!/usr/bin/env node
/** Generate static SEO marketing pages and sitemap.xml. */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MARKETING_PAGE_SLUGS,
  buildStaticMarketingPageHtml,
  buildSitemapXml,
  faqPageJsonLd,
} from '../src/services/marketing-seo.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = join(root, 'public');

let count = 0;
for (const slug of MARKETING_PAGE_SLUGS) {
  const dir = join(root, slug);
  mkdirSync(dir, { recursive: true });
  const html = buildStaticMarketingPageHtml(slug);
  writeFileSync(join(dir, 'index.html'), html, 'utf8');
  count += 1;
}

writeFileSync(join(publicRoot, 'sitemap.xml'), buildSitemapXml(), 'utf8');

const faqSchemaPath = join(publicRoot, 'faq-schema.json');
writeFileSync(faqSchemaPath, `${JSON.stringify(faqPageJsonLd(), null, 2)}\n`, 'utf8');

console.log(`Wrote ${count} marketing pages → */index.html`);
console.log('Wrote public/sitemap.xml');
console.log('Wrote public/faq-schema.json');
