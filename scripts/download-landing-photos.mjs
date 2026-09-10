#!/usr/bin/env node
/** Download royalty-free meal photos into scripts/landing-photo-source/ (Unsplash License). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'landing-photo-source');

/** @type {Array<{ file: string, unsplashId: string, meal: string, photographer: string, url: string }>} */
const PHOTOS = [
  {
    file: 'hero-meal.png',
    unsplashId: 'faHiAEp7YvA',
    meal: 'Fish, chips & mushy peas',
    photographer: 'Tomi Saputra (@udatommo)',
    url: 'https://unsplash.com/photos/fish-and-chips-with-lemon-and-sauce-on-a-plate-faHiAEp7YvA',
  },
  {
    file: 'meal-india-idli.png',
    unsplashId: 'WKLEP0uk6yI',
    meal: 'Idli, sambar & coconut chutney',
    photographer: 'Mayur Roxan (@mayurroxanphotography)',
    url: 'https://unsplash.com/photos/idlis-with-various-chutneys-and-sambar-on-a-banana-leaf-WKLEP0uk6yI',
  },
  {
    file: 'meal-italy-pasta.png',
    unsplashId: '2d4lAQAlbDA',
    meal: 'Pasta with tomato sauce & parmesan',
    photographer: 'Eiliv Aceron (@shootfood)',
    url: 'https://unsplash.com/photos/a-plate-of-pasta-with-sauce-and-cheese-2d4lAQAlbDA',
  },
  {
    file: 'meal-asia-thai-curry.png',
    unsplashId: '-wejEQuvw0E',
    meal: 'Thai curry with jasmine rice',
    photographer: 'Christopher Yiu Chung (@christopher_chung_photography)',
    url: 'https://unsplash.com/photos/a-spread-of-delicious-thai-dishes-on-a-patterned-surface--wejEQuvw0E',
  },
  {
    file: 'meal-middle-east-platter.png',
    unsplashId: 'CVsLz7HXcnY',
    meal: 'Grilled chicken, rice, hummus & salad',
    photographer: 'Mayte Baque (@mtbaque)',
    url: 'https://unsplash.com/photos/grilled-chicken-leg-with-rice-and-salad-CVsLz7HXcnY',
  },
  {
    file: 'meal-africa-jollof.png',
    unsplashId: 'woC24wGXsQ8',
    meal: 'Jollof rice with grilled chicken',
    photographer: "Keesha's Kitchen (@keeshasskitchen)",
    url: 'https://unsplash.com/photos/a-bowl-of-food-woC24wGXsQ8',
  },
];

async function downloadPhoto({ file, unsplashId }) {
  const dest = path.join(outDir, file);
  const downloadUrl = `https://unsplash.com/photos/${unsplashId}/download?force=true&w=1600`;
  const res = await fetch(downloadUrl, { redirect: 'follow' });
  if (!res.ok) throw new Error(`${file}: download failed ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  console.log(`downloaded ${file} (${Math.round(buf.length / 1024)} KB)`);
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const photo of PHOTOS) {
    await downloadPhoto(photo);
  }

  fs.writeFileSync(
    path.join(outDir, 'ATTRIBUTION.json'),
    `${JSON.stringify({ license: 'Unsplash License (https://unsplash.com/license)', photos: PHOTOS }, null, 2)}\n`,
  );
  console.log('download-landing-photos: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
