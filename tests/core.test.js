// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { createBus } from '../src/core/events.js';
import { createStepper } from '../src/core/loop.js';
import { createCamera } from '../src/core/camera.js';
import { pickView } from '../src/render/renderer.js';
import { standInMask } from '../src/render/sprites.js';
import { kinds } from '../src/world/kinds/index.js';

test('the bus delivers events and lets listeners leave', () => {
  const bus = createBus();
  /** @type {any[]} */
  const seen = [];
  const off = bus.on('ui-press', (d) => seen.push(d));
  bus.emit('ui-press', { id: 'a' });
  bus.emit('other');
  off();
  bus.emit('ui-press', { id: 'b' });
  assert.deepEqual(seen, [{ id: 'a' }]);
});

test('a listener may unsubscribe while an event is being delivered', () => {
  const bus = createBus();
  let count = 0;
  const off = bus.on('x', () => {
    count++;
    off();
  });
  bus.on('x', () => count++);
  bus.emit('x');
  bus.emit('x');
  assert.equal(count, 3);
});

test('the simulation takes fixed steps whatever the frame rate is', () => {
  const stepper = createStepper({ stepSec: 1 / 60, maxFrameSec: 0.1 });
  assert.equal(stepper.advance(1 / 60), 1);
  // A 30 fps display: two steps per frame.
  assert.equal(stepper.advance(1 / 30), 2);
  // A 144 Hz display: most frames take no step, and none are lost.
  let steps = 0;
  for (let i = 0; i < 144; i++) steps += stepper.advance(1 / 144);
  assert.equal(steps, 60);
});

test('long frames are clamped', () => {
  const stepper = createStepper({ stepSec: 1 / 60, maxFrameSec: 0.1 });
  assert.equal(stepper.advance(5), 6);
  assert.equal(stepper.advance(-1), 0);
});

test('the view keeps the short side at 240 art pixels or more, at a whole scale', () => {
  assert.deepEqual(pickView(1920, 1080), { scale: 4, w: 480, h: 270 });
  assert.deepEqual(pickView(1179, 2556), { scale: 4, w: 295, h: 639 });
  assert.deepEqual(pickView(2560, 1440), { scale: 6, w: 427, h: 240 });
  assert.deepEqual(pickView(1280, 720), { scale: 3, w: 427, h: 240 });
  assert.deepEqual(pickView(300, 200), { scale: 1, w: 300, h: 200 });
  for (const [w, h] of [[1366, 768], [3840, 2160], [828, 1792], [2732, 2048], [1512, 982]]) {
    const view = pickView(w, h);
    assert.ok(Number.isInteger(view.scale) && view.scale >= 1);
    assert.ok(Math.min(view.w, view.h) >= 240, `${w} x ${h}`);
    // The canvas always covers the screen.
    assert.ok(view.w * view.scale >= w && view.h * view.scale >= h);
  }
});

test('the camera settles on its target and reports whole pixels', () => {
  const camera = createCamera({ settleSec: 0.3 });
  camera.lookAt(100, -40);
  camera.update(1 / 60);
  assert.ok(camera.x > 0 && camera.x < 100, 'it eases, it does not jump');
  for (let i = 0; i < 60; i++) camera.update(1 / 60);
  assert.ok(Math.abs(camera.x - 100) < 0.01 && Math.abs(camera.y + 40) < 0.01);
  const view = camera.view(480, 270);
  assert.deepEqual(view, { x: -140, y: -175, w: 480, h: 270 });
  camera.lookAt(0.4, 0.4);
  camera.snap();
  assert.ok(Number.isInteger(camera.view(295, 639).x) && Number.isInteger(camera.view(295, 639).y));
});

test('every kind has a stand-in silhouette that stands on its foot', () => {
  for (const kind of Object.values(kinds)) {
    const { w, h } = kind.standIn;
    const mask = standInMask(kind.standIn);
    assert.equal(mask.length, w * h);
    const filled = mask.reduce((sum, v) => sum + v, 0);
    assert.ok(filled > w * h * 0.2, `${kind.id} has a body`);
    // Something touches the ground near the bottom middle.
    const footRow = kind.standIn.shape === 'bush' || kind.standIn.shape === 'rock' ? h - 2 : h - 1;
    assert.equal(mask[footRow * w + Math.round((w - 1) / 2)], 1, `${kind.id} foot`);
  }
});
