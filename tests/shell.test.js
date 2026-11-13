// @ts-check
// Guards on the repo itself: what the page loads, and the house rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { moduleGraph, PRELOAD_END, PRELOAD_START, preloadBlock } from '../tools/lib/imports.mjs';
import { repoRoot } from '../tools/serve.mjs';

const read = (/** @type {string} */ file) => readFileSync(join(repoRoot, file), 'utf8');

/** Every text file git knows about, plus new ones not yet committed. */
function textFiles() {
  const list = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8' });
  return list.split('\n').filter((f) => /\.(js|mjs|css|html|md|json|py|txt|svg)$/.test(f) && existsSync(join(repoRoot, f)));
}

test('index.html preloads exactly the modules the game imports', () => {
  const html = read('index.html');
  const start = html.indexOf(PRELOAD_START);
  const end = html.indexOf(PRELOAD_END);
  assert.ok(start > 0 && end > start, 'markers are present');
  assert.equal(html.slice(start + PRELOAD_START.length, end).trim(), preloadBlock().trim(), 'run: node tools/sync-preloads.mjs');
});

test('every import is relative and points at a real file', () => {
  for (const file of moduleGraph()) assert.ok(existsSync(join(repoRoot, file)), file);
});

test('the page only uses relative paths, so it works under /forest-discovery/', () => {
  const html = read('index.html');
  for (const match of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    const url = match[1];
    if (url.startsWith('data:')) continue;
    assert.ok(!/^(?:[a-z]+:)?\/\//i.test(url) && !url.startsWith('/'), `absolute path in index.html: ${url}`);
  }
  for (const file of ['styles/tokens.css', 'styles/ui.css']) {
    for (const match of read(file).matchAll(/url\(([^)]+)\)/g)) {
      const url = match[1].replace(/["']/g, '');
      assert.ok(!/^(?:[a-z]+:)?\/\//i.test(url) && !url.startsWith('/'), `absolute path in ${file}: ${url}`);
    }
  }
});

test('the game makes no request to another site', () => {
  for (const file of moduleGraph()) {
    const source = read(file);
    assert.ok(!/https?:\/\//.test(source.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')), `${file} mentions a URL outside comments`);
  }
});

test('world code never calls Math.random', () => {
  for (const file of moduleGraph().filter((f) => /^src\/(world|wind)\//.test(f) || f === 'src/core/rng.js')) {
    const code = read(file).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!code.includes('Math.random'), file);
  }
});

test('no long dashes anywhere', () => {
  for (const file of textFiles()) {
    const text = read(file);
    const at = text.search(/[\u2012-\u2015]/);
    assert.equal(at, -1, `${file} has a long dash near: ${text.slice(Math.max(0, at - 30), at + 10)}`);
  }
});

test('player-facing strings live in one file', () => {
  const strings = read('src/ui/strings.js');
  assert.match(strings, /title: 'Forest Discovery'/);
  assert.match(read('index.html'), /<title>Forest Discovery<\/title>/);
});
