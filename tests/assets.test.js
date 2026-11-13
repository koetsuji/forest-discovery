// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { colourDistance, snapToPalette } from '../src/render/palette.js';
import { kinds } from '../src/world/kinds/index.js';
import { tuning } from '../src/tuning.js';
import { repoRoot } from '../tools/serve.mjs';

const atlas = JSON.parse(readFileSync(join(repoRoot, 'assets', 'atlas.json'), 'utf8'));

/** Width and height from a PNG header. @param {string} file */
function pngSize(file) {
  const bytes = readFileSync(file);
  assert.equal(bytes.toString('latin1', 1, 4), 'PNG');
  return { w: bytes.readUInt32BE(16), h: bytes.readUInt32BE(20) };
}

test('the atlas image matches its JSON', () => {
  assert.equal(atlas.v, 1);
  const size = pngSize(join(repoRoot, 'assets', atlas.image));
  assert.deepEqual(size, { w: atlas.w, h: atlas.h });
});

test('every kind has a sprite in the atlas, and every layer lies inside the image', () => {
  for (const kind of Object.values(kinds)) {
    const sprite = atlas.sprites[kind.sprite];
    assert.ok(sprite, `${kind.sprite} is in the atlas`);
    const layers = [sprite.trunk, sprite.inside, sprite.frame, ...(sprite.clumps || [])].filter(Boolean);
    assert.ok(layers.length > 0);
    for (const [x, y, w, h, ox, oy] of layers) {
      assert.ok(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= atlas.w && y + h <= atlas.h, `${kind.sprite} layer in atlas`);
      assert.ok(ox >= 0 && oy >= 0 && ox + w <= sprite.w && oy + h <= sprite.h, `${kind.sprite} layer in sprite`);
    }
    const [footX, footY] = sprite.foot;
    assert.ok(footX > 0 && footX < sprite.w && footY > sprite.h * 0.8 && footY < sprite.h, `${kind.sprite} foot`);
  }
});

test('plants carry what the wind needs: a profile, and centre, weight and height per clump', () => {
  for (const kind of Object.values(kinds)) {
    const sprite = atlas.sprites[kind.sprite];
    if (!kind.wind) {
      assert.equal(sprite.clumps, undefined, `${kind.sprite} does not move`);
      continue;
    }
    assert.equal(sprite.profile, kind.wind);
    assert.ok(tuning.wind.profiles[sprite.profile], `${sprite.profile} has tuning`);
    assert.ok(sprite.inside, `${kind.sprite} has an inside layer`);
    assert.ok(sprite.clumps.length >= 4 && sprite.clumps.length <= 24, `${kind.sprite} has ${sprite.clumps.length} clumps`);
    for (const clump of sprite.clumps) {
      assert.equal(clump.length, 10);
      const [, , , , , , cx, cy, weight, height] = clump;
      assert.ok(cx > 0 && cx < sprite.w && cy > 0 && cy < sprite.h);
      assert.ok(weight >= 0.35 && weight <= 1, `weight ${weight}`);
      assert.ok(height >= 0 && height <= 1, `height ${height}`);
    }
    for (const colour of sprite.leaf) assert.match(colour, /^#[0-9a-f]{6}$/);
    assert.ok(sprite.leaf.length >= 1);
  }
});

test('an oak splits into 10 to 20 clumps', () => {
  const count = atlas.sprites['oak-01'].clumps.length;
  assert.ok(count >= 10 && count <= 20, `${count} clumps`);
});

test('ground colours snap to the sprite palette, one palette colour per role', () => {
  const roles = { grass: '#8aa346', grassMid: '#77923f', trail: '#a48a5a' };
  assert.deepEqual(snapToPalette(roles, []), roles, 'no accepted sprites: provisional colours stay');
  const snapped = snapToPalette(roles, ['#88a040', '#86a248', '#a08050', '#000000']);
  assert.equal(snapped.grass, '#86a248');
  assert.equal(snapped.grassMid, '#88a040', 'the second role takes the next nearest colour');
  assert.equal(snapped.trail, '#a08050');
  assert.deepEqual(snapToPalette({ grass: '#8aa346' }, ['#ff00ff']), { grass: '#8aa346' }, 'nothing near: keep the colour');
  assert.equal(colourDistance('#123456', '#123456'), 0);
});
