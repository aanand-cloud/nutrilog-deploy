/** Generate branded landing JPG placeholders when source photos are missing. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { LANDING_IMAGES } from './landing-image-specs.mjs';
import { howStepSnapSvg, howStepEstimatesSvg, howStepTrackSvg } from './how-step-art.mjs';
import {
  fishChipsSvg,
  idliSambarSvg,
  pastaTomatoSvg,
  thaiCurrySvg,
  middleEastPlateSvg,
  jollofRiceSvg,
} from './meal-demo-art.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'images');
const sourceDir = path.join(__dirname, 'landing-photo-source');

/** Real photo PNGs in scripts/landing-photo-source/ — preferred over SVG placeholders. */
const REAL_PHOTO_SOURCES = {
  'hero-meal': 'hero-meal.png',
  'meal-india-idli': 'meal-india-idli.png',
  'meal-italy-pasta': 'meal-italy-pasta.png',
  'meal-asia-thai-curry': 'meal-asia-thai-curry.png',
  'meal-middle-east-platter': 'meal-middle-east-platter.png',
  'meal-africa-jollof': 'meal-africa-jollof.png',
  'how-step-snap': 'how-step-snap.png',
  'how-step-estimates': 'how-step-estimates.png',
  'how-step-track': 'how-step-track.png',
  'demo-food-diary': 'demo-food-diary.png',
  'demo-reports': 'demo-reports.png',
};

const CUSTOM_MEAL_ART = new Set([
  'hero-meal',
  'meal-india-idli',
  'meal-italy-pasta',
  'meal-asia-thai-curry',
  'meal-middle-east-platter',
  'meal-africa-jollof',
]);

const PLACEHOLDER_SVG = {
  'hero-meal': fishChipsSvg(),
  'meal-india-idli': idliSambarSvg(),
  'meal-italy-pasta': pastaTomatoSvg(),
  'meal-asia-thai-curry': thaiCurrySvg(),
  'meal-middle-east-platter': middleEastPlateSvg(),
  'meal-africa-jollof': jollofRiceSvg(),
  'barcode-scan': barcodeSvg('#0f172a', '#64748b', 'Scan packaged food'),
  'how-step-snap': howStepSnapSvg(),
  'how-step-estimates': howStepEstimatesSvg(),
  'how-step-track': howStepTrackSvg(),
};

function barcodeSvg(c1, c2, label) {
  const bars = Array.from({ length: 18 }, (_, i) =>
    `<rect x="${270 + i * 14}" y="220" width="6" height="120" fill="${c1}"/>`,
  ).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <rect width="800" height="600" fill="#f8fafc"/>
    <rect x="240" y="120" width="320" height="360" rx="24" fill="#fff" stroke="${c2}" stroke-width="3"/>
    ${bars}
    <text x="400" y="520" text-anchor="middle" fill="${c1}" font-family="Arial,sans-serif" font-size="26" font-weight="600">${label}</text>
  </svg>`;
}

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(sourceDir)) fs.mkdirSync(sourceDir, { recursive: true });

  for (const spec of LANDING_IMAGES) {
    const dest = path.join(outDir, spec.file);
    const realFile = REAL_PHOTO_SOURCES[spec.base];
    const realPath = realFile ? path.join(sourceDir, realFile) : null;

    if (realPath && fs.existsSync(realPath)) {
      await sharp(realPath)
        .rotate()
        .resize(spec.width, spec.height, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: 92, mozjpeg: true })
        .toFile(dest);
      console.log(`processed real photo ${spec.file}`);
      continue;
    }

    const svg = PLACEHOLDER_SVG[spec.base];
    if (!svg) continue;
    if (fs.existsSync(dest) && !CUSTOM_MEAL_ART.has(spec.base)) continue;
    await sharp(Buffer.from(svg)).jpeg({ quality: 90, mozjpeg: true }).toFile(dest);
    console.log(`rendered cuisine art ${spec.file}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
