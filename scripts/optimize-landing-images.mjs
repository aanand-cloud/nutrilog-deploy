/** Crop landing JPGs and emit matching WebP for faster loads. */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { LANDING_IMAGES } from './landing-image-specs.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, '..', 'public', 'images');

async function main() {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const spec of LANDING_IMAGES) {
    const input = path.join(outDir, spec.file);
    if (!fs.existsSync(input)) {
      console.warn(`skip missing ${spec.file}`);
      continue;
    }

    const tmp = `${input}.opt.jpg`;
    const resized = sharp(input)
      .rotate()
      .resize(spec.width, spec.height, {
        fit: 'cover',
        position: spec.position,
      });

    await resized.clone().jpeg({ quality: 88, mozjpeg: true }).toFile(tmp);
    fs.renameSync(tmp, input);
    console.log(`${spec.file} → ${spec.width}×${spec.height}`);

    const webpPath = path.join(outDir, `${spec.base}.webp`);
    await resized.clone().webp({ quality: 82 }).toFile(webpPath);
    console.log(`${spec.base}.webp created`);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
