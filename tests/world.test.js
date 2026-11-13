// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildClearing } from '../src/world/clearing.js';
import { GROUND_COLOURS, paintGroundChunk } from '../src/world/ground.js';
import { CHUNK, chunkKey, chunksIn, createChunkCache } from '../src/world/chunks.js';
import { tuning } from '../src/tuning.js';

const SEED = tuning.world.defaultSeed;

/** @param {Uint8Array} bytes */
function checksum(bytes) {
  let h = 2166136261;
  for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619);
  return h >>> 0;
}

test('the same seed gives the same forest', () => {
  const a = buildClearing(SEED);
  const b = buildClearing(SEED);
  assert.deepEqual(
    a.objects.map((o) => [o.id, o.kind.id, o.x, o.y]),
    b.objects.map((o) => [o.id, o.kind.id, o.x, o.y]),
  );
  assert.deepEqual(a.trail, b.trail);
  assert.equal(a.openness(31, -12), b.openness(31, -12));
});

test('a different seed gives a different forest around the same clearing', () => {
  const a = buildClearing(1);
  const b = buildClearing(2);
  const ring = (/** @type {import('../src/world/clearing.js').Scene} */ s) =>
    s.objects.filter((o) => o.id.startsWith('ring:')).map((o) => [o.id, o.x, o.y]).sort();
  const scattered = (/** @type {import('../src/world/clearing.js').Scene} */ s) =>
    s.objects.filter((o) => !o.id.startsWith('ring:')).map((o) => [o.id, o.x, o.y]);
  assert.deepEqual(ring(a), ring(b));
  assert.notDeepEqual(scattered(a), scattered(b));
});

test('objects have stable unique ids, whole pixel positions and draw order by y', () => {
  const scene = buildClearing(SEED);
  assert.ok(scene.objects.length > 100);
  assert.equal(new Set(scene.objects.map((o) => o.id)).size, scene.objects.length);
  for (let i = 0; i < scene.objects.length; i++) {
    const o = scene.objects[i];
    assert.ok(Number.isInteger(o.x) && Number.isInteger(o.y), `${o.id} is on a whole pixel`);
    if (i > 0) assert.ok(scene.objects[i - 1].y <= o.y, 'sorted by the y of the base');
  }
});

test('no trunk stands on the trail', () => {
  const scene = buildClearing(SEED);
  for (const o of scene.objects) {
    if (o.kind.id === 'bush' || o.kind.id === 'rock') continue;
    const d = Math.min(...scene.trail.map((p) => Math.hypot(p.x - o.x, p.y - o.y)));
    assert.ok(d > 12, `${o.id} (${o.kind.id}) is ${d.toFixed(1)} px from the trail`);
  }
});

test('ground is a pure function of seed and chunk', () => {
  const scene = buildClearing(SEED);
  const a = paintGroundChunk(SEED, scene, 0, 0);
  const b = paintGroundChunk(SEED, scene, 0, 0);
  assert.equal(a.indices.length, CHUNK * CHUNK);
  assert.equal(checksum(a.indices), checksum(b.indices));
  assert.deepEqual(a.streaks, b.streaks);
  assert.notEqual(checksum(a.indices), checksum(paintGroundChunk(SEED, scene, 1, 0).indices));
  assert.notEqual(checksum(a.indices), checksum(paintGroundChunk(SEED + 1, buildClearing(SEED + 1), 0, 0).indices));
});

test('ground only uses known colours, and the clearing has grass, trail and gust streaks', () => {
  const scene = buildClearing(SEED);
  const chunk = paintGroundChunk(SEED, scene, 0, 0);
  const used = new Set(chunk.indices);
  for (const index of used) assert.ok(index < GROUND_COLOURS.length);
  assert.ok(used.has(GROUND_COLOURS.indexOf('grass')));
  assert.ok(used.has(GROUND_COLOURS.indexOf('trail')));
  assert.ok(chunk.streaks.length >= 30 && chunk.streaks.length % 3 === 0);
  for (const name of GROUND_COLOURS) assert.match(tuning.ground.colours[name], /^#[0-9a-f]{6}$/);
});

test('chunk maths', () => {
  assert.equal(chunkKey(-1, 2), '-1,2');
  assert.deepEqual(chunksIn({ x: -240, y: -135, w: 480, h: 270 }), { cx0: -1, cy0: -1, cx1: 0, cy1: 0 });
  assert.deepEqual(chunksIn({ x: 0, y: 0, w: 256, h: 256 }), { cx0: 0, cy0: 0, cx1: 0, cy1: 0 });
  assert.deepEqual(chunksIn({ x: 0, y: 0, w: 257, h: 1 }), { cx0: 0, cy0: 0, cx1: 1, cy1: 0 });
});

test('the chunk cache makes each chunk once and drops the far ones', () => {
  let made = 0;
  const cache = createChunkCache((cx, cy) => ({ cx, cy, n: made++ }), 4);
  assert.equal(cache.ensure(0, 0), cache.ensure(0, 0));
  for (let cx = 1; cx <= 6; cx++) cache.ensure(cx, 0);
  assert.equal(made, 7);
  cache.prune(6, 0);
  assert.equal(cache.size, 4);
  assert.equal(cache.peek(0, 0), undefined);
  assert.ok(cache.peek(6, 0));
});
