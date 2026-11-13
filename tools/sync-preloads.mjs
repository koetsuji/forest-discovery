// Rewrites the modulepreload list in index.html from the real import graph.
// Run it after adding or removing a module. tests/shell.test.js fails if it was forgotten.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PRELOAD_END, PRELOAD_START, preloadBlock } from './lib/imports.mjs';
import { repoRoot } from './serve.mjs';

const file = join(repoRoot, 'index.html');
const html = readFileSync(file, 'utf8');
const start = html.indexOf(PRELOAD_START);
const end = html.indexOf(PRELOAD_END);
if (start < 0 || end < 0) throw new Error('index.html has lost its modulepreload markers');
const next = `${html.slice(0, start + PRELOAD_START.length)}\n${preloadBlock()}\n  ${html.slice(end)}`;
if (next !== html) writeFileSync(file, next);
console.log(next === html ? 'index.html preload list is up to date' : 'index.html preload list updated');
