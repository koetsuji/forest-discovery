// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { SAVE_KEY, SAVE_VERSION, freshState, loadState, migrate, runMigrations, saveState } from '../src/core/save.js';

/** A stand-in for localStorage. */
function fakeStorage() {
  /** @type {Map<string, string>} */
  const map = new Map();
  return {
    map,
    getItem: (/** @type {string} */ key) => map.get(key) ?? null,
    setItem: (/** @type {string} */ key, /** @type {string} */ value) => void map.set(key, value),
  };
}

test('nothing stored gives a fresh state', () => {
  const state = migrate(null, 77);
  assert.deepEqual(state, freshState(77));
  assert.equal(state.v, SAVE_VERSION);
  assert.deepEqual(state.deltas, {});
  assert.deepEqual(state.inventory, []);
});

test('a broken save falls back to a fresh start and never throws', () => {
  for (const junk of [undefined, 42, 'text', [], true, { v: 'one' }, { v: 1, settings: 5, player: 'x', found: 'no' }]) {
    const state = migrate(junk, 3);
    assert.equal(state.v, SAVE_VERSION);
    assert.equal(typeof state.settings.volume, 'number');
    assert.ok(Array.isArray(state.found));
  }
  const storage = fakeStorage();
  storage.map.set(SAVE_KEY, '{ not json');
  assert.deepEqual(loadState(storage, 3), freshState(3));
});

test('good values survive and bad values are replaced one by one', () => {
  const state = migrate(
    {
      v: 1,
      seed: 1234,
      player: { x: 10.5, y: -3, facing: 'left' },
      found: ['stone-circle:1', 7, null],
      settings: { volume: 4, muted: true, reducedMotion: 'yes', showWind: true },
    },
    99,
  );
  assert.equal(state.seed, 1234);
  assert.deepEqual(state.player, { x: 10.5, y: -3, facing: 'left' });
  assert.deepEqual(state.found, ['stone-circle:1']);
  assert.equal(state.settings.volume, 1, 'volume is clamped');
  assert.equal(state.settings.muted, true);
  assert.equal(state.settings.reducedMotion, false, 'a wrong type falls back');
  assert.equal(state.settings.showWind, true);
});

test('a save from a newer game is not trusted', () => {
  assert.deepEqual(migrate({ v: SAVE_VERSION + 1, seed: 5 }, 8), freshState(8));
});

test('older saves climb one version at a time', () => {
  const steps = {
    1: (/** @type {Record<string, any>} */ d) => ({ ...d, v: 2, renamed: d.old }),
    2: (/** @type {Record<string, any>} */ d) => ({ ...d, v: 3, count: (d.count ?? 0) + 1 }),
  };
  const result = runMigrations({ v: 1, old: 'kept' }, 1, 3, steps);
  assert.equal(result.version, 3);
  assert.equal(result.data.renamed, 'kept');
  assert.equal(result.data.count, 1);
  // A missing step stops the climb, and migrate then starts fresh.
  assert.equal(runMigrations({ v: 0 }, 0, 3, steps).version, 0);
  assert.deepEqual(migrate({ v: 0, seed: 5 }, 8, {}), freshState(8));
  assert.equal(migrate({ v: 0, seed: 5 }, 8, { 0: (d) => ({ ...d, v: 1 }) }).seed, 5);
});

test('saving and loading round trips', () => {
  const storage = fakeStorage();
  const state = freshState(11);
  state.settings.muted = true;
  state.found.push('spring:4');
  assert.equal(saveState(storage, state), true);
  assert.deepEqual(loadState(storage, 0), state);
});

test('a browser that refuses storage does not stop the game', () => {
  const refusing = {
    getItem: () => {
      throw new Error('denied');
    },
    setItem: () => {
      throw new Error('denied');
    },
  };
  assert.deepEqual(loadState(refusing, 5), freshState(5));
  assert.equal(saveState(refusing, freshState(5)), false);
  assert.equal(saveState(null, freshState(5)), false);
  assert.deepEqual(loadState(null, 5), freshState(5));
});
