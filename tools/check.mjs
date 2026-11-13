// The checks before every push, in the order of docs/architecture.md:
// tests, the game running in a browser with a clean console, and the budgets.
import { spawnSync } from 'node:child_process';
import { repoRoot } from './serve.mjs';

const steps = [
  ['Tests', ['--test']],
  ['Game running in headless Chrome', ['tools/screenshot.mjs']],
  ['Budgets', ['tools/size-report.mjs']],
];

let failed = 0;
for (const [name, args] of steps) {
  console.log(`\n== ${name} ==`);
  const result = spawnSync(process.execPath, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.status !== 0) failed++;
}

console.log(failed ? `\n${failed} of ${steps.length} checks failed. Do not push.` : '\nAll checks passed. Now look at out/shots/ before pushing.');
process.exit(failed ? 1 : 0);
