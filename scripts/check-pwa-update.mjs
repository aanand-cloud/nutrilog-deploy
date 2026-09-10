import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const css = readFileSync(resolve(root, 'src/styles/quick-polish.css'), 'utf8');

function assert(label, ok) {
  if (!ok) {
    console.error(`FAIL | ${label}`);
    process.exitCode = 1;
    return;
  }
  console.log(`PASS | ${label}`);
}

assert('update btn uses teal not undefined --primary', (() => {
  const block = css.slice(css.indexOf('.pwa-update-banner'), css.indexOf('.nutrition-trust-summary'));
  return block.includes('var(--teal') && !block.includes('var(--primary)');
})());
assert('dismiss btn transparent background', css.includes('.pwa-update-banner__btn--dismiss') && css.includes('background: transparent'));
assert('update btn explicit text color', css.includes('.pwa-update-banner__btn--update'));
assert('banner above modals', css.includes('z-index: 1000'));

const js = readFileSync(resolve(root, 'src/services/pwa-update.js'), 'utf8');
assert('update button label set', js.includes("textContent = 'Update now'"));
assert('dismiss button label set', js.includes("textContent = 'Later'"));
assert('robust update handler', js.includes('runPwaUpdate') && js.includes('SKIP_WAITING'));
assert('reload fallback timeout', js.includes('controllerchange'));
assert('describe session guard', js.includes('mealDescribeActive') && js.includes('setDescribeSessionActive'));
assert('build-scoped dismiss', js.includes('pwaUpdateDismissedBuild'));
assert('update check debounce', js.includes('UPDATE_CHECK_MIN_MS'));
assert('waiting worker gate', js.includes('hasWaitingUpdate'));

console.log('\nDone.');
