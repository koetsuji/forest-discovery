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
import { hashOf, parseSeed, rngFrom } from './core/rng.js';
import { browserStorage, loadState, saveState } from './core/save.js';
import { createRenderer } from './render/renderer.js';
import { createLayers } from './render/layers.js';
import { createGroundLayer } from './render/ground-layer.js';
import { createStandingLayer } from './render/standing-layer.js';
import { createShadowLayer } from './render/shadows.js';
import { snapToPalette } from './render/palette.js';
import { spriteFromAtlas } from './render/sprites.js';
import { createWorld } from './world/world.js';
import { breeze, gust } from './wind/field.js';
import { createFoliage } from './wind/foliage.js';
import { createLeaves } from './wind/leaves.js';
import { createWindDebug } from './wind/debug.js';
import { createAudio } from './audio/engine.js';
import { createSfx } from './audio/sfx.js';
import { createAmbience } from './audio/ambience.js';
import { createTitle } from './ui/title.js';
import { createHud } from './ui/hud.js';

const params = new URLSearchParams(window.location.search);
const storage = browserStorage();
const state = loadState(storage, tuning.world.defaultSeed);
// Until the endless world arrives, everyone walks the same forest unless the link says otherwise.
const seed = parseSeed(params.get('seed'), tuning.world.defaultSeed);
if (params.get('wind') === '1') state.settings.showWind = true;

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
const ambience = createAmbience(audio, bus);

const reducedMotion = () =>
  state.settings.reducedMotion || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
document.documentElement.classList.toggle('reduced-motion', state.settings.reducedMotion);

/** Simulation clock. Everything that moves reads this, never the wall clock. */
const sim = { t: 0, pose: -1 };

// Leaves take their chances from the seed, so a fixed clock gives a fixed picture.
const leaves = createLeaves(rngFrom(hashOf(seed, 0, 0, 'leaf-flutter')));
const foliage = createFoliage(world, bus, { roll: rngFrom(hashOf(seed, 0, 0, 'leaf-shed')), shed: leaves.shed });
foliage.setTint(state.settings.showWind);
const ground = createGroundLayer(seed, world.scene);
const shadows = createShadowLayer(world, foliage.shadowOf);
const standing = createStandingLayer(world, { imageOf: foliage.imageOf });
const windDebug = createWindDebug(sim);

layers.add('ground', (ctx, view) => ground.draw(ctx, view));
layers.add('details', (ctx, view) => ground.drawLit(ctx, view));
layers.add('shadows', (ctx, view) => shadows.draw(ctx, view));
layers.add('standing', (ctx, view) => standing.draw(ctx, view));
layers.add('particles', (ctx, view) => leaves.draw(ctx, view));
layers.add('debug', (ctx, view) => {
  if (state.settings.showWind) windDebug.draw(ctx, view);
});

/** @param {number} dt */
function step(dt) {
  sim.t += dt;
  camera.update(dt);
  const view = camera.view(renderer.w, renderer.h);
  const seen = world.visible(view, tuning.shadows.viewMarginPx);
  foliage.update(dt, sim.t, view, seen);
  leaves.update(dt, sim.t, view);

  // The pose clock: foliage and everything that moves with it steps together.
  const pose = Math.floor(sim.t * tuning.loop.posesPerSec + 1e-6);
  if (pose === sim.pose) return;
  sim.pose = pose;
  const t = pose / tuning.loop.posesPerSec;
  foliage.pose(t, view, seen);
  foliage.prune(t);
  ground.pose(t, view);
  leaves.pose(pose);
  // The listener is the middle of the view until the wanderer arrives.
  const earX = view.x + view.w / 2;
  const earY = view.y + view.h / 2;
  ambience.update(earX, earY, breeze(earX, earY, t, view), gust(earX, earY, t, view));
}

function draw() {
  layers.draw(renderer.ctx, camera.view(renderer.w, renderer.h));
}

/** How long a frame's work takes, smoothed. Read by the checks. */
const perf = { workMs: 0, worstMs: 0, frames: 0 };

const loop = createLoop({
  step,
  draw,
  stepsPerSec: tuning.loop.stepsPerSec,
  maxFrameSec: tuning.loop.maxFrameSec,
  onFrame(ms) {
    perf.frames++;
    perf.workMs += (ms - perf.workMs) * 0.05;
    perf.worstMs = Math.max(perf.worstMs, ms);
  },
});

function persist() {
  saveState(storage, state);
}

function toggleMute() {
  state.settings.muted = !state.settings.muted;
  // Coming back on, sound returns at once. Going off, the engine waits for the switch's note.
  audio.applySettings();
  bus.emit('ui-toggle', { id: 'mute', on: !state.settings.muted });
  bus.emit('settings-changed');
  persist();
}

function toggleWind() {
  state.settings.showWind = !state.settings.showWind;
  foliage.setTint(state.settings.showWind);
  bus.emit('settings-changed');
  persist();
}

// The title rests a little off the focus, and Begin lets the camera settle on it.
const focus = world.scene.focus;
camera.lookAt(focus.x + tuning.camera.titleOffsetXPx, focus.y + tuning.camera.titleOffsetYPx);
camera.snap();

const title = createTitle(uiRoot, bus);
createHud(uiRoot, bus, { isMuted: () => state.settings.muted, toggleMute });

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

input.on('mute', toggleMute);
input.on('show-wind', toggleWind);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) persist();
});

loop.start();

loadAtlas('assets/atlas.json').then((atlas) => {
  const image = atlas.image;
  world.setSprites((id) => (image && atlas.data.sprites[id] ? spriteFromAtlas(id, atlas.data.sprites[id], image) : null));
  ground.setColours(snapToPalette(tuning.ground.colours, atlas.data.palette || []));

  // A fixed clock for the screenshot check: ?t=12.5 runs the forest to that
  // moment, &freeze=1 holds it there, &title=0 skips the title.
  if (params.get('title') === '0') {
    camera.lookAt(focus.x, focus.y);
    camera.snap();
  }
  const startAt = Number(params.get('t'));
  if (Number.isFinite(startAt) && startAt > 0) {
    // Start from zero: the time spent loading must not leak into the picture.
    sim.t = 0;
    sim.pose = -1;
    for (let i = 0; i < Math.round(startAt * tuning.loop.stepsPerSec); i++) step(loop.stepSec);
  }
  if (params.get('freeze') === '1') loop.setFrozen(true);

  title.setReady();
  if (params.get('title') === '0') title.skip();
  document.documentElement.dataset.ready = '1';
});

// A small handle for the checks in tools/. Nothing in the game reads it.
const advance = (/** @type {number} */ seconds) => {
  for (let i = 0; i < Math.round(seconds * tuning.loop.stepsPerSec); i++) step(loop.stepSec);
};
Object.assign(window, { fd: { sim, state, world, audio, ambience, camera, renderer, bus, foliage, leaves, perf, advance } });
