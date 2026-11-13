// @ts-check
/**
 * Boot and wiring. Systems are created here in a fixed order and talk to each
 * other through the event bus.
 */

import { tuning } from './tuning.js';
import { createBus } from './core/events.js';
import { createLoop } from './core/loop.js';
import { createCamera } from './core/camera.js';
import { createInput } from './core/input.js';
import { loadAtlas } from './core/assets.js';
import { parseSeed } from './core/rng.js';
import { browserStorage, loadState, saveState } from './core/save.js';
import { createRenderer } from './render/renderer.js';
import { createLayers } from './render/layers.js';
import { createGroundLayer } from './render/ground-layer.js';
import { createStandingLayer } from './render/standing-layer.js';
import { createWorld } from './world/world.js';
import { createAudio } from './audio/engine.js';
import { createSfx } from './audio/sfx.js';
import { createTitle } from './ui/title.js';

const params = new URLSearchParams(window.location.search);
const storage = browserStorage();
const state = loadState(storage, tuning.world.defaultSeed);
// Until the endless world arrives, everyone walks the same forest unless the link says otherwise.
const seed = parseSeed(params.get('seed'), tuning.world.defaultSeed);

const bus = createBus();
const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('view'));
const uiRoot = /** @type {HTMLElement} */ (document.getElementById('ui'));

const renderer = createRenderer(canvas, bus);
const camera = createCamera({ settleSec: tuning.camera.settleSec });
const input = createInput(window);
const world = createWorld(seed);
const layers = createLayers();
const audio = createAudio(state.settings);
createSfx(audio, bus);

const reducedMotion = () =>
  state.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('reduced-motion', state.settings.reducedMotion);

const ground = createGroundLayer(seed, world.scene, tuning.ground.colours);
const standing = createStandingLayer(world);
layers.add('ground', (ctx, view) => ground.draw(ctx, view));
layers.add('standing', (ctx, view) => standing.draw(ctx, view));

/** Simulation clock. Everything that moves reads this, never the wall clock. */
const sim = { t: 0 };

/** @param {number} dt */
function step(dt) {
  sim.t += dt;
  camera.update(dt);
}

function draw() {
  layers.draw(renderer.ctx, camera.view(renderer.w, renderer.h));
}

const loop = createLoop({
  step,
  draw,
  stepsPerSec: tuning.loop.stepsPerSec,
  maxFrameSec: tuning.loop.maxFrameSec,
});

function persist() {
  saveState(storage, state);
}

// The title rests a little off the focus, and Begin lets the camera settle on it.
const focus = world.scene.focus;
camera.lookAt(focus.x + tuning.camera.titleOffsetXPx, focus.y + tuning.camera.titleOffsetYPx);
camera.snap();

const title = createTitle(uiRoot, bus);

bus.on('game-began', () => {
  camera.lookAt(focus.x, focus.y);
  if (reducedMotion()) camera.snap();
});

// Browsers only let sound start inside a user gesture. Any first press will do.
// A finger going down does not count yet. A finger coming up does.
for (const type of ['pointerdown', 'pointerup', 'keydown', 'touchend']) {
  window.addEventListener(
    type,
    (event) => {
      const activation = /** @type {any} */ (navigator).userActivation;
      const allowed = activation
        ? activation.isActive
        : type !== 'pointerdown' || /** @type {PointerEvent} */ (event).pointerType === 'mouse';
      if (allowed) audio.unlock();
    },
    { capture: true, passive: true },
  );
}

input.on('mute', () => {
  state.settings.muted = !state.settings.muted;
  audio.applySettings();
  bus.emit('ui-toggle', { id: 'mute', on: !state.settings.muted });
  persist();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});

loop.start();

loadAtlas('assets/atlas.json').then(() => {
  world.setSprites(() => null);

  // A fixed clock for the screenshot check: ?t=12.5 runs the forest to that
  // moment, &freeze=1 holds it there, &title=0 skips the title.
  const startAt = Number(params.get('t'));
  if (Number.isFinite(startAt) && startAt > 0) {
    for (let i = 0; i < Math.round(startAt * tuning.loop.stepsPerSec); i++) step(loop.stepSec);
  }
  if (params.get('freeze') === '1') loop.setFrozen(true);

  title.setReady();
  if (params.get('title') === '0') title.skip();
  document.documentElement.dataset.ready = '1';
});

// A small handle for the checks in tools/. Nothing in the game reads it.
Object.assign(window, { fd: { sim, state, world, audio, camera, renderer, bus } });
