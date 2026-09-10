import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const appJs = readFileSync(resolve(root, 'src/app.js'), 'utf8');
const appViews = readFileSync(resolve(root, 'src/app-views.js'), 'utf8');
const viteConfig = readFileSync(resolve(root, 'vite.config.js'), 'utf8');

function assert(label, ok, detail = '') {
  if (!ok) {
    console.error(`FAIL | ${label}${detail ? ` — ${detail}` : ''}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}${detail ? ` — ${detail}` : ''}`);
}

assert('app uses lazy view loaders', appJs.includes('loadLogView') && appJs.includes('loadTodayView'));
assert('log routing split from log view', readFileSync(resolve(root, 'src/views/log-routing.js'), 'utf8').includes('beginPhotoLogEntry'));
assert('app-views dynamic imports log', appViews.includes("import('./views/log.js')"));
assert('vite manualChunks configured', viteConfig.includes('manualChunks') && viteConfig.includes('view-log'));

const distAssets = resolve(root, 'dist/assets');
try {
  const files = readdirSync(distAssets).filter((f) => f.endsWith('.js'));
  const main = files.find((f) => f.startsWith('main-'));
  const viewLog = files.find((f) => f.startsWith('view-log-'));
  assert('dist has separate view-log chunk', Boolean(main && viewLog));
  if (main && viewLog) {
    const mainKb = Math.round(statSync(resolve(distAssets, main)).size / 1024);
    const logKb = Math.round(statSync(resolve(distAssets, viewLog)).size / 1024);
    assert('main chunk under 900kb', mainKb < 900, `${mainKb}kb`);
    console.log(`INFO | main ${mainKb}kb · view-log ${logKb}kb`);
  }
} catch {
  console.log('SKIP | dist assets (run npm run build first for size checks)');
}

console.log('\nDone.');
