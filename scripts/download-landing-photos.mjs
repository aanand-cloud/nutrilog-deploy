#!/usr/bin/env node
/** Download royalty-free meal photos into scripts/landing-photo-source/. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, 'landing-photo-source');

/** @type {Array<{ file: string, meal: string, photographer: string, url: string, license: string, unsplashId?: string, downloadUrl?: string }>} */
const PHOTOS = [
  {
    file: 'hero-meal.png',
    meal: 'Fish, chips & mushy peas',
    photographer: 'Damon Kestle',
    url: 'https://www.pexels.com/photo/food-on-a-plate-14924014/',
    license: 'Pexels License',
    downloadUrl: 'https://images.pexels.com/photos/14924014/pexels-photo-14924014.jpeg?auto=compress&cs=tinysrgb&w=1600',
  },
  {
    file: 'meal-india-idli.png',
    unsplashId: 'WKLEP0uk6yI',
    meal: 'Idli, sambar & coconut chutney',
    photographer: 'Mayur Roxan (@mayurroxanphotography)',
    url: 'https://unsplash.com/photos/idlis-with-various-chutneys-and-sambar-on-a-banana-leaf-WKLEP0uk6yI',
    license: 'Unsplash License',
  },
  {
    file: 'meal-italy-pasta.png',
    meal: 'Spaghetti with tomato sauce & basil',
    photographer: 'Darya Sheydel',
    url: 'https://www.pexels.com/photo/pasta-with-red-sauce-on-black-ceramic-plate-10456297/',
    license: 'Pexels License',
    downloadUrl: 'https://images.pexels.com/photos/10456297/pexels-photo-10456297.jpeg?auto=compress&cs=tinysrgb&w=1600',
  },
  {
    file: 'meal-asia-thai-curry.png',
    unsplashId: '-wejEQuvw0E',
    meal: 'Thai curry with jasmine rice',
    photographer: 'Christopher Yiu Chung (@christopher_chung_photography)',
    url: 'https://unsplash.com/photos/a-spread-of-delicious-thai-dishes-on-a-patterned-surface--wejEQuvw0E',
    license: 'Unsplash License',
  },
  {
    file: 'meal-middle-east-platter.png',
    unsplashId: 'CVsLz7HXcnY',
    meal: 'Grilled chicken, rice, hummus & salad',
    photographer: 'Mayte Baque (@mtbaque)',
    url: 'https://unsplash.com/photos/grilled-chicken-leg-with-rice-and-salad-CVsLz7HXcnY',
    license: 'Unsplash License',
  },
  {
    file: 'meal-africa-jollof.png',
    unsplashId: 'woC24wGXsQ8',
    meal: 'Jollof rice with grilled chicken',
    photographer: "Keesha's Kitchen (@keeshasskitchen)",
    url: 'https://unsplash.com/photos/a-bowl-of-food-woC24wGXsQ8',
    license: 'Unsplash License',
  },
];

async function downloadPhoto({ file, unsplashId, downloadUrl }) {
  const dest = path.join(outDir, file);
  const url = downloadUrl || `https://unsplash.com/photos/${unsplashId}/download?force=true&w=1600`;
  const res = await fetch(url, { redirect: 'follow' });
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
    `${JSON.stringify({
      licenses: {
        unsplash: 'https://unsplash.com/license',
        pexels: 'https://www.pexels.com/license/',
      },
      photos: PHOTOS,
    }, null, 2)}\n`,
  );
  console.log('download-landing-photos: ok');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
