// @ts-check
/**
 * The sound engine: one context, a master with volume, mute and a limiter,
 * and four buses. Every sound in the game is synthesized. There are no audio
 * files.
 *
 *   master      volume, mute, limiter
 *     ambience  wind bed, canopy rustle (later: birds, dusk voices)
 *     world     (later: footsteps, leaves, landmarks)
 *     interface hover, press, release, toggle
 *     music     (later: sparse notes)
 */

import { tuning } from '../tuning.js';

/**
 * @typedef {'ambience' | 'world' | 'interface' | 'music'} BusName
 * @typedef {ReturnType<typeof createAudio>} Audio
 */

/**
 * @param {import('../core/save.js').Settings} settings read live, so changes apply at once
 */
export function createAudio(settings) {
  /** @type {AudioContext | null} */
  let ctx = null;
  /** @type {GainNode | null} */
  let master = null;
  /** @type {Record<BusName, GainNode> | null} */
  let buses = null;
  /** @type {AudioBuffer | null} */
  let noiseBuffer = null;
  /** @type {((ctx: AudioContext) => void)[]} */
  const waiting = [];
  let voices = 0;

  function build() {
    const Ctor = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor({ latencyHint: 'interactive' });
    ctx = context;

    // Headroom: the limiter only works when a gust, a phrase and a button meet.
    const limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 6;
    limiter.ratio.value = 14;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.14;
    limiter.connect(context.destination);

    master = context.createGain();
    master.gain.value = settings.muted ? 0 : settings.volume;
    master.connect(limiter);

    /** @param {number} level */
    const bus = (level) => {
      const gain = context.createGain();
      gain.gain.value = level;
      gain.connect(/** @type {GainNode} */ (master));
      return gain;
    };
    buses = {
      ambience: bus(tuning.audio.ambienceGain),
      world: bus(tuning.audio.worldGain),
      interface: bus(tuning.audio.interfaceGain),
      music: bus(tuning.audio.musicGain),
    };

    // Two seconds of white noise, shared by every noise based sound.
    noiseBuffer = context.createBuffer(1, context.sampleRate * 2, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    for (const fn of waiting.splice(0)) fn(context);
  }

  // Sound pauses with the tab.
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });

  return {
    /**
     * Call from inside a user gesture. Browsers only let sound start there.
     * Safe to call again.
     */
    unlock() {
      if (!ctx) build();
      if (ctx && ctx.state === 'suspended' && !document.hidden) ctx.resume().catch(() => {});
    },
    /** Runs once the context exists. */
    whenReady(/** @type {(ctx: AudioContext) => void} */ fn) {
      if (ctx) fn(ctx);
      else waiting.push(fn);
    },
    /** Volume or mute changed in the settings. */
    applySettings() {
      if (!ctx || !master) return;
      // Going quiet waits a moment, so the switch's own note is still heard.
      const delay = settings.muted ? 0.14 : 0;
      master.gain.setTargetAtTime(settings.muted ? 0 : settings.volume, ctx.currentTime + delay, 0.03);
    },
    /** @param {BusName} name */
    bus(name) {
      return /** @type {Record<BusName, GainNode>} */ (buses)[name];
    },
    get noise() {
      return /** @type {AudioBuffer} */ (noiseBuffer);
    },
    /** The mix before the limiter. The checks measure levels here. */
    get master() {
      return master;
    },
    get ctx() {
      return ctx;
    },
    /** True when a sound started now would be heard. */
    get running() {
      return !!ctx && ctx.state === 'running';
    },
    /**
     * Voice accounting: a sound asks before it starts and is refused when
     * too many are playing.
     * @param {number} seconds how long the voice lives
     */
    takeVoice(seconds) {
      if (voices >= tuning.audio.maxVoices) return false;
      voices++;
      window.setTimeout(() => {
        voices--;
      }, seconds * 1000 + 50);
      return true;
    },
    get voices() {
      return voices;
    },
  };
}

/**
 * Small random spread so no one-shot sounds the same twice.
 * @returns {{ pitch: number, level: number }} multipliers around 1
 */
export function vary() {
  const { pitchVariance, levelVariance } = tuning.audio;
  return {
    pitch: 1 + (Math.random() * 2 - 1) * pitchVariance,
    level: 1 - Math.random() * levelVariance,
  };
}
