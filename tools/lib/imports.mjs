// Follows the static imports from src/main.js. Used to keep the modulepreload
// list in index.html complete, and by the test that guards it.
import { readFileSync } from 'node:fs';
import { dirname, join, posix, relative, sep } from 'node:path';
import { repoRoot } from '../serve.mjs';

const IMPORT = /^\s*(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|^\s*import\s*['"]([^'"]+)['"]/gm;

/**
 * @param {string} [entry] path relative to the repo root
 * @returns {string[]} every module reached from the entry, entry first, as posix paths relative to the repo root
 */
export function moduleGraph(entry = 'src/main.js') {
  const seen = new Set([entry]);
  const queue = [entry];
  for (let i = 0; i < queue.length; i++) {
    const file = queue[i];
    const source = readFileSync(join(repoRoot, file), 'utf8');
    for (const match of source.matchAll(IMPORT)) {
      const spec = match[1] ?? match[2];
      if (!spec.startsWith('.')) throw new Error(`${file} imports "${spec}". Only relative imports are allowed.`);
      const target = relative(repoRoot, join(repoRoot, dirname(file), spec)).split(sep).join(posix.sep);
      if (!seen.has(target)) {
        seen.add(target);
        queue.push(target);
      }
    }
  }
  return queue;
}

export const PRELOAD_START = '<!-- modulepreload:start -->';
export const PRELOAD_END = '<!-- modulepreload:end -->';

/** The lines that belong between the two markers in index.html. */
export function preloadBlock() {
  return moduleGraph()
    .slice(1)
    .sort()
    .map((file) => `  <link rel="modulepreload" href="${file}">`)
    .join('\n');
}
