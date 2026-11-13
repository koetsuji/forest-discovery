// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { along, breeze, gust, phase, waveSpeedPxPerSec } from '../src/wind/field.js';
import { leanOffset, loopOffset, loopSize, roundPx, rowShift, stepLean } from '../src/wind/pose.js';
import { tuning } from '../src/tuning.js';

const W = tuning.wind;
const VIEW = { x: -240, y: -135, w: 480, h: 270 };
const close = (/** @type {number} */ a, /** @type {number} */ b, eps = 1e-9) => Math.abs(a - b) <= eps;

test('a clump with a one pixel loop steps up, right, down, back at the quarter phases', () => {
  assert.deepEqual(loopOffset(1, 1, 0), [0, 0]);
  assert.deepEqual(loopOffset(1, 1, Math.PI / 2), [0, -1]);
  assert.deepEqual(loopOffset(1, 1, Math.PI), [1, -1]);
  assert.deepEqual(loopOffset(1, 1, (3 * Math.PI) / 2), [1, 0]);
  assert.deepEqual(loopOffset(1, 1, 2 * Math.PI), [0, 0]);
});

test('loop offsets are whole pixels and stay inside the loop size', () => {
  for (let i = 0; i < 2000; i++) {
    const ax = (i % 40) / 10;
    const ay = (i % 17) / 8;
    const [dx, dy] = loopOffset(ax, ay, i * 0.731);
    assert.ok(Number.isInteger(dx) && Number.isInteger(dy));
    assert.ok(dx >= 0 && dx <= Math.round(ax), `dx ${dx} for size ${ax}`);
    assert.ok(dy <= 0 && -dy <= Math.round(ay), `dy ${dy} for size ${ay}`);
    assert.ok(!Object.is(dy, -0), 'no negative zero');
  }
});

test('in still air the loop shrinks to nothing, and inner clumps sit out a breeze', () => {
  for (let ph = 0; ph < 7; ph += 0.1) {
    assert.deepEqual(loopOffset(...loopSize(0, 0), ph), [0, 0]);
    const [ax, ay] = loopSize(1, 0);
    assert.deepEqual(loopOffset(ax * 0.35, ay * 0.35, ph), [0, 0]);
  }
  // The same inner clump joins in when a full gust arrives.
  const [gx, gy] = loopSize(1, 1.25);
  let moved = false;
  for (let ph = 0; ph < 7; ph += 0.1) moved ||= loopOffset(gx * 0.35, gy * 0.35, ph)[0] !== 0;
  assert.ok(moved);
});

test('a breeze gives a one pixel loop and a gust widens it to two or three', () => {
  const reach = (/** @type {number} */ b, /** @type {number} */ g) => {
    let far = 0;
    for (let ph = 0; ph < 7; ph += 0.05) far = Math.max(far, loopOffset(...loopSize(b, g), ph)[0]);
    return far;
  };
  assert.equal(reach(1, 0), 1);
  assert.ok(reach(1, 0.75) === 2);
  assert.ok(reach(1, 1.25) === 3);
});

test('phase is equal along lines of equal position on the wind axis', () => {
  for (const [x, y, t] of [[0, 0, 0], [120, -40, 3.3], [-800, 512, 91.7]]) {
    for (const dy of [-60, 8, 200]) {
      const x2 = x - W.axisSlope * dy;
      assert.ok(close(along(x, y), along(x2, y + dy)));
      assert.ok(close(phase(x, y, t), phase(x2, y + dy, t), 1e-9));
    }
  }
});

test('the wave travels along the wind at wavelength over period', () => {
  assert.equal(waveSpeedPxPerSec, W.waveLengthPx / W.wavePeriodSec);
  for (const dt of [0.1, 0.77, 5]) {
    assert.ok(close(phase(10 + waveSpeedPxPerSec * dt, 20, 1 + dt), phase(10, 20, 1), 1e-9));
  }
  // One period later, and one wavelength downwind, the phase has turned once.
  assert.ok(close(phase(0, 0, W.wavePeriodSec) - phase(0, 0, 0), 2 * Math.PI));
  assert.ok(close(phase(0, 0, 0) - phase(W.waveLengthPx, 0, 0), 2 * Math.PI));
});

test('the wind field is pure: the same point and time give the same answer', () => {
  const a = gust(33, -20, 7.7, VIEW);
  gust(-400, 90, 1.2, VIEW);
  breeze(0, 0, 15, VIEW);
  assert.equal(gust(33, -20, 7.7, VIEW), a);
});

test('the gust schedule repeats', () => {
  for (let i = 0; i < 200; i++) {
    const x = -240 + ((i * 37) % 480);
    const y = -135 + ((i * 53) % 270);
    const t = (i * 0.613) % 40;
    assert.ok(close(gust(x, y, t, VIEW), gust(x, y, t + W.schedulePeriodSec, VIEW), 1e-9));
    assert.ok(close(breeze(x, y, t, VIEW), breeze(x, y, t + 3 * W.schedulePeriodSec, VIEW), 1e-9));
  }
});

test('gusts are measured from the view, so they always cross the screen', () => {
  const far = { x: 91000, y: -45000, w: 480, h: 270 };
  for (let i = 0; i < 100; i++) {
    const x = (i * 37) % 480;
    const y = (i * 53) % 270;
    const t = i * 0.41;
    assert.ok(close(gust(VIEW.x + x, VIEW.y + y, t, VIEW), gust(far.x + x, far.y + y, t, far), 1e-9));
  }
  // Every point of the view is hit by a strong gust once per schedule.
  for (const [x, y] of [[5, 5], [240, 135], [470, 260]]) {
    let peak = 0;
    for (let t = 0; t < W.schedulePeriodSec; t += 0.05) peak = Math.max(peak, gust(far.x + x, far.y + y, t, far));
    assert.ok(peak > 1, `peak ${peak} at ${x}, ${y}`);
  }
});

test('some gusts cross only part of the view, on a tall view too', () => {
  for (const view of [VIEW, { x: 0, y: 0, w: 295, h: 639 }]) {
    const quick = W.gusts.find((g) => g.name === 'quick one');
    assert.ok(quick);
    // When the quick one is over the middle of the view it is strong in its band and gone at the bottom.
    const t = quick.enterSec + (view.w / 2 + W.axisSlope * view.h * (quick.bandCentrePx / 270)) / quick.speedPxPerSec;
    const inBand = gust(view.x + view.w / 2, view.y + (view.h * quick.bandCentrePx) / 270, t, view);
    const atBottom = gust(view.x + view.w / 2 - W.axisSlope * view.h * (1 - quick.bandCentrePx / 270), view.y + view.h - 1, t, view);
    assert.ok(inBand > 0.5, `in band ${inBand}`);
    assert.ok(atBottom < 0.15 * inBand, `at bottom ${atBottom}`);
  }
});

test('the breeze reaches further than the gust, never passes 1, and never quite stops', () => {
  let widerSomewhere = false;
  for (let i = 0; i < 400; i++) {
    const x = -240 + ((i * 37) % 480);
    const y = -135 + ((i * 53) % 270);
    const t = i * 0.05;
    const b = breeze(x, y, t, VIEW);
    const g = gust(x, y, t, VIEW);
    assert.ok(b <= 1 && b >= W.breezeBase - 1e-12);
    assert.ok(g >= 0);
    if (g < 0.05 && b > 0.5) widerSomewhere = true;
  }
  assert.ok(widerSomewhere, 'the breeze arrives before the gust does');
  // The small base level is too weak to move even an outer clump.
  assert.deepEqual(loopOffset(...loopSize(W.breezeBase, 0), Math.PI), [0, 0]);
});

test('the lean spring settles on push times gust and swings back past upright', () => {
  const oak = W.profiles.oak;
  const state = { lean: 0, leanSpeed: 0 };
  for (let i = 0; i < 60 * 12; i++) stepLean(state, 1, oak, 1 / 60);
  assert.ok(close(state.lean, oak.pushPx, 0.02));
  let lowest = Infinity;
  for (let i = 0; i < 60 * 12; i++) {
    stepLean(state, 0, oak, 1 / 60);
    lowest = Math.min(lowest, state.lean);
  }
  assert.ok(lowest < -0.1, `overshoot ${lowest}`);
  assert.ok(Math.abs(state.lean) < 0.02 && Math.abs(state.leanSpeed) < 0.05, 'it settles');
});

test('lean moves clumps by whole pixels: by weight and height on an oak, by height squared on a pine', () => {
  const oak = W.profiles.oak;
  const pine = W.profiles.pine;
  const outerTop = { weight: 1, height: 1, rise: 1 };
  const inner = { weight: 0.35, height: 0.5, rise: 0.6 };
  assert.equal(leanOffset(3, outerTop, oak), 3);
  assert.equal(leanOffset(3, inner, oak), 1);
  assert.equal(leanOffset(-3, outerTop, oak), -3);
  assert.equal(leanOffset(5.4, { weight: 1, height: 0, rise: 0 }, pine), 0);
  assert.equal(leanOffset(5.4, { weight: 1, height: 1, rise: 1 }, pine), 5);
  assert.equal(leanOffset(5.4, { weight: 1, height: 0.5, rise: 0.5 }, pine), 1);
  for (let i = 0; i <= 20; i++) {
    assert.ok(Number.isInteger(rowShift(5.5, i / 20)));
    if (i > 0) assert.ok(rowShift(5.5, i / 20) >= rowShift(5.5, (i - 1) / 20), 'a trunk bends more toward the top');
  }
  assert.equal(roundPx(-2.5), -3);
  assert.equal(roundPx(2.5), 3);
  assert.ok(!Object.is(roundPx(-0.2), -0) || roundPx(-0.2) === 0);
});

test('in the strongest gust an outer oak clump ends up 5 to 7 px from rest, and a pine tip bends about 5.5 px', () => {
  const clump = { weight: 1, height: 1, rise: 1 };
  /** Farthest an outer top clump gets at a point, over one full schedule after a warm-up. */
  const reach = (/** @type {string} */ profile, /** @type {number} */ x) => {
    const state = { lean: 0, leanSpeed: 0 };
    let far = 0;
    let lean = 0;
    for (let i = 0; i < 60 * 40; i++) {
      const t = i / 60;
      const g = gust(x, 0, t, VIEW);
      stepLean(state, g, W.profiles[profile], 1 / 60);
      lean = Math.max(lean, state.lean);
      if (i % 6 !== 0 || t < 20) continue;
      const [ax, ay] = loopSize(breeze(x, 0, t, VIEW), g);
      far = Math.max(far, loopOffset(ax, ay, phase(x, 0, t))[0] + leanOffset(state.lean, clump, W.profiles[profile]));
    }
    return { far, lean };
  };
  let oakFar = 0;
  let pineTip = 0;
  for (let x = -230; x < 240; x += 23) {
    const oak = reach('oak', x);
    assert.ok(oak.far >= 4, `an oak at x ${x} reached only ${oak.far} px`);
    oakFar = Math.max(oakFar, oak.far);
    pineTip = Math.max(pineTip, reach('pine', x).lean);
  }
  // Lean and loop peak at slightly different moments, so 5 is the usual best.
  assert.ok(oakFar >= 5 && oakFar <= 7, `outer oak clump reached ${oakFar} px`);
  assert.ok(pineTip > 4.8 && pineTip < 6.2, `pine tip reached ${pineTip.toFixed(2)} px`);
});
