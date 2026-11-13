// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { hashOf, hashTag, mix32, parseSeed, rngFor, valueNoise } from '../src/core/rng.js';

test('hashes are stable 32 bit numbers', () => {
  // Fixed values: if these change, every saved seed gives a different forest.
  assert.equal(mix32(1), 2261973619);
  assert.equal(hashTag('tree'), 1837839573);
  assert.equal(hashOf(20261113, 3, -2, 'tree'), hashOf(20261113, 3, -2, 'tree'));
  for (const n of [0, 1, 2 ** 31, 2 ** 32 - 1]) {
    const h = mix32(n);
    assert.ok(Number.isInteger(h) && h >= 0 && h < 2 ** 32);
  }
});

test('the same seed, chunk and purpose give the same numbers', () => {
  const a = rngFor(42, 5, -7, 'bush');
  const b = rngFor(42, 5, -7, 'bush');
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test('a different seed, chunk or purpose gives different numbers', () => {
  const base = rngFor(42, 5, -7, 'bush')();
  assert.notEqual(rngFor(43, 5, -7, 'bush')(), base);
  assert.notEqual(rngFor(42, 6, -7, 'bush')(), base);
  assert.notEqual(rngFor(42, 5, -6, 'bush')(), base);
  assert.notEqual(rngFor(42, 5, -7, 'rock')(), base);
});

test('generators stay in [0, 1) and spread evenly', () => {
  const roll = rngFor(7, 0, 0, 'spread');
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    const v = roll();
    assert.ok(v >= 0 && v < 1);
    sum += v;
  }
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02);
});

test('value noise is deterministic, bounded and continuous', () => {
  assert.equal(valueNoise(99, 12.25, -3.5), valueNoise(99, 12.25, -3.5));
  for (let i = 0; i < 500; i++) {
    const x = i * 0.37 - 40;
    const y = i * 0.11 - 9;
    const v = valueNoise(99, x, y);
    assert.ok(v >= 0 && v < 1);
    // A small step in position is a small step in value: no seams anywhere,
    // which includes chunk borders.
    assert.ok(Math.abs(valueNoise(99, x + 0.01, y) - v) < 0.03);
    assert.ok(Math.abs(valueNoise(99, x, y + 0.01) - v) < 0.03);
  }
});

test('seeds can be read from a link', () => {
  assert.equal(parseSeed(null, 5), 5);
  assert.equal(parseSeed('', 5), 5);
  assert.equal(parseSeed('123', 5), 123);
  assert.equal(parseSeed('greenwood', 5), hashTag('greenwood'));
  assert.equal(parseSeed('greenwood', 5), parseSeed('greenwood', 9));
});
