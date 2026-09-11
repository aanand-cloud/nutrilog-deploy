/**
 * Run the full test suite locally. Skip on Vercel — source data may be absent
 * and the suite is already run before push when developing.
 */
if (process.env.VERCEL) {
  console.log('Vercel build: skipping npm test in prebuild');
  process.exit(0);
}

import { spawnSync } from 'node:child_process';

const result = spawnSync('npm', ['test'], { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
