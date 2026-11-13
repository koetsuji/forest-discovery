// Prints the budgets from docs/architecture.md against what the game ships.
// Exits with 1 when a limit is passed. Going over is a decision for the owner.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { repoRoot } from './serve.mjs';

/** What the browser can load. Docs, tools, tests and art sources are not part of the game. */
const GAME_PATHS = ['index.html', 'styles', 'src', 'assets'];
const TEXT = new Set(['.html', '.css', '.js', '.json', '.svg']);
const CODE = new Set(['.html', '.css', '.js']);
const AUDIO = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.flac', '.opus', '.aac']);
/** Files that sit next to game files but are never requested by the page. */
const NOT_LOADED = new Set(['LICENSE.txt', '.gitkeep', 'README.md']);

const LIMITS = {
  transferred: 1_000_000,
  code: 200_000,
  art: 600_000,
  fonts: 60_000,
  audioFiles: 0,
};

/** @param {string} path @returns {string[]} */
function walk(path) {
  if (statSync(path).isFile()) return [path];
  return readdirSync(path).flatMap((name) => walk(join(path, name)));
}

export function measure() {
  const files = GAME_PATHS.flatMap((p) => walk(join(repoRoot, p))).filter((f) => !NOT_LOADED.has(f.split(/[\\/]/).pop() ?? ''));
  const totals = { transferred: 0, code: 0, art: 0, fonts: 0, audioFiles: 0, files: files.length };
  /** @type {{ file: string, raw: number, sent: number }[]} */
  const rows = [];
  for (const file of files) {
    const ext = extname(file);
    const body = readFileSync(file);
    // Pages compresses text. Images and fonts are already compressed.
    const sent = TEXT.has(ext) ? gzipSync(body, { level: 9 }).length : body.length;
    totals.transferred += sent;
    if (CODE.has(ext)) totals.code += body.length;
    if (file.startsWith(join(repoRoot, 'assets'))) totals.art += body.length;
    if (ext === '.woff2') totals.fonts += body.length;
    if (AUDIO.has(ext)) totals.audioFiles += 1;
    rows.push({ file: relative(repoRoot, file), raw: body.length, sent });
  }
  return { totals, rows };
}

const kb = (/** @type {number} */ n) => `${(n / 1000).toFixed(1)} KB`;

export function report() {
  const { totals, rows } = measure();
  const lines = [
    ['Whole game, transferred', kb(totals.transferred), kb(LIMITS.transferred), totals.transferred <= LIMITS.transferred],
    ['Code, uncompressed', kb(totals.code), kb(LIMITS.code), totals.code <= LIMITS.code],
    ['Art', kb(totals.art), kb(LIMITS.art), totals.art <= LIMITS.art],
    ['Fonts', kb(totals.fonts), kb(LIMITS.fonts), totals.fonts <= LIMITS.fonts],
    ['Audio files', String(totals.audioFiles), String(LIMITS.audioFiles), totals.audioFiles <= LIMITS.audioFiles],
  ];
  console.log(`Size report (${totals.files} files the page can load)`);
  for (const [what, value, limit, ok] of lines) {
    console.log(`  ${ok ? 'ok  ' : 'OVER'}  ${String(what).padEnd(26)} ${String(value).padStart(10)}  of ${limit}`);
  }
  if (process.argv.includes('--files')) {
    for (const row of rows.sort((a, b) => b.sent - a.sent)) {
      console.log(`    ${kb(row.sent).padStart(9)}  ${row.file}`);
    }
  }
  return lines.every((line) => line[3]);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(report() ? 0 : 1);
}
