#!/usr/bin/env node
/** Build compressed MP4/WebM landing demo from captured MealNova UI frames. */
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const framesDir = join(root, 'public', 'images', 'landing-demo');
const outDir = join(root, 'public', 'images');

const FRAME_ORDER = [
  'frame-01-hero.png',
  'frame-02-result-card.png',
  'frame-03-log-photo.png',
  'frame-04-signup.png',
  'frame-05-describe-ready.png',
  'frame-06-pricing.png',
];

function pickFrames() {
  const picked = [];
  for (const name of FRAME_ORDER) {
    const path = join(framesDir, name);
    if (existsSync(path)) picked.push(path);
  }
  if (picked.length >= 3) return picked;
  return readdirSync(framesDir)
    .filter((f) => f.startsWith('frame-') && f.endsWith('.png'))
    .sort()
    .map((f) => join(framesDir, f));
}

function runFfmpeg(args) {
  const result = spawnSync(ffmpegPath, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`ffmpeg failed (${result.status})`);
  }
}

function formatBytes(n) {
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  if (!ffmpegPath || !existsSync(ffmpegPath)) {
    throw new Error('ffmpeg-static binary missing');
  }
  mkdirSync(framesDir, { recursive: true });
  mkdirSync(outDir, { recursive: true });

  const frames = pickFrames();
  if (frames.length < 2) {
    console.log('build-landing-demo-video: skip — run npm run landing:demo:capture first');
    process.exit(0);
  }

  const listPath = join(framesDir, 'frames.txt');
  const secondsPerFrame = 2.5;
  const lines = frames.flatMap((frame) => [
    `file '${frame.replace(/\\/g, '/')}'`,
    `duration ${secondsPerFrame}`,
  ]);
  lines.push(`file '${frames[frames.length - 1].replace(/\\/g, '/')}'`);
  writeFileSync(listPath, `${lines.join('\n')}\n`);

  const mp4Path = join(outDir, 'landing-demo.mp4');
  const webmPath = join(outDir, 'landing-demo.webm');
  const posterPath = join(outDir, 'landing-demo-poster.jpg');

  runFfmpeg([
    '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', 'scale=800:600:force_original_aspect_ratio=decrease,pad=800:600:(ow-iw)/2:(oh-ih)/2:color=#f4faf9,format=yuv420p',
    '-r', '30',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '28', '-movflags', '+faststart',
    '-an',
    mp4Path,
  ]);

  runFfmpeg([
    '-y', '-f', 'concat', '-safe', '0', '-i', listPath,
    '-vf', 'scale=800:600:force_original_aspect_ratio=decrease,pad=800:600:(ow-iw)/2:(oh-ih)/2:color=#f4faf9,format=yuv420p',
    '-r', '30',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '35',
    '-an',
    webmPath,
  ]);

  runFfmpeg(['-y', '-i', frames[0], '-frames:v', '1', '-q:v', '2', '-update', '1', posterPath]);

  const duration = frames.length * secondsPerFrame;
  const mp4Size = statSync(mp4Path).size;
  const webmSize = statSync(webmPath).size;
  console.log(`landing-demo.mp4 → ${formatBytes(mp4Size)} (~${duration}s)`);
  console.log(`landing-demo.webm → ${formatBytes(webmSize)}`);
  console.log(`poster → ${posterPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
