// @ts-check
/**
 * First ambience: a wind bed and canopy rustle. Both follow the simulation.
 * The bed is the breeze and the gust at the listener. A rustle is one tree
 * being reached by a gust, panned to where that tree is. Nothing loops on a
 * timer, so what you hear is the wind you see.
 */

import { tuning } from '../tuning.js';
import { vary } from './engine.js';

const A = tuning.audio;

/** Where each kind of foliage sits in the spectrum: [high pass Hz, centre Hz]. */
const RUSTLES = /** @type {Record<string, [number, number]>} */ ({
  broadleaf: [1900, 3400],
  lightleaf: [2600, 5000],
  needles: [1200, 2300],
});

/**
 * @param {import('./engine.js').Audio} audio
 * @param {import('../core/events.js').Bus} bus
 */
export function createAmbience(audio, bus) {
  /** @type {{ fade: GainNode, airTone: BiquadFilterNode, airGain: GainNode, leafTone: BiquadFilterNode, leafGain: GainNode } | null} */
  let bed = null;
  let began = false;
  let rustling = 0;
  let lastRustleAt = -Infinity;
  const listener = { x: 0, y: 0 };

  /**
   * @param {AudioContext} ctx
   * @param {number} rate playback rate: slower noise is darker noise
   */
  function noiseLoop(ctx, rate) {
    const source = ctx.createBufferSource();
    source.buffer = audio.noise;
    source.loop = true;
    source.playbackRate.value = rate;
    source.start(0, Math.random() * 1.9);
    return source;
  }

  /** @param {AudioContext} ctx */
  function build(ctx) {
    const fade = ctx.createGain();
    fade.gain.value = 0;
    fade.connect(audio.bus('ambience'));

    // Air: low and soft, always a little there.
    const airTone = ctx.createBiquadFilter();
    airTone.type = 'lowpass';
    airTone.frequency.value = A.airBaseHz;
    airTone.Q.value = 0.5;
    const airGain = ctx.createGain();
    airGain.gain.value = 0;
    noiseLoop(ctx, 0.5).connect(airTone).connect(airGain).connect(fade);

    // Wind in the leaves: a wide band that opens and rises with the gust.
    const leafTone = ctx.createBiquadFilter();
    leafTone.type = 'bandpass';
    leafTone.frequency.value = A.leafBaseHz;
    leafTone.Q.value = 0.45;
    const leafGain = ctx.createGain();
    leafGain.gain.value = 0;
    noiseLoop(ctx, 0.83).connect(leafTone).connect(leafGain).connect(fade);

    bed = { fade, airTone, airGain, leafTone, leafGain };
    if (began) start();
  }

  /** Sound never pops in: the world fades up after Begin. */
  function start() {
    const ctx = audio.ctx;
    if (!ctx || !bed) return;
    bed.fade.gain.cancelScheduledValues(ctx.currentTime);
    bed.fade.gain.setValueAtTime(0, ctx.currentTime);
    bed.fade.gain.linearRampToValueAtTime(1, ctx.currentTime + A.fadeInSec);
  }

  /**
   * A short bright swell from one tree.
   * @param {{ x: number, y: number, strength: number, rustle?: string }} detail
   */
  function rustle(detail) {
    const ctx = audio.ctx;
    const now = performance.now();
    if (!ctx || !bed || !began || !audio.running) return;
    if (rustling >= A.maxRustles || now - lastRustleAt < A.rustleMinGapMs) return;
    const dx = detail.x - listener.x;
    const dy = detail.y - listener.y;
    const near = 1 / (1 + (dx * dx + dy * dy) / (A.rustleRangePx * A.rustleRangePx));
    if (near < 0.1) return;
    const v = vary();
    const peak = A.rustleGain * Math.min(1.3, detail.strength) * near * v.level;
    // Too faint to hear: leave the voice for a tree that matters.
    if (peak < A.rustleFloor) return;
    const rise = 0.28 + Math.random() * 0.2;
    const fall = 0.3 + Math.random() * 0.18;
    const length = rise + fall * 5;
    if (!audio.takeVoice(length)) return;
    lastRustleAt = now;
    rustling++;
    window.setTimeout(() => rustling--, length * 1000);

    const [highPass, centre] = RUSTLES[detail.rustle || 'broadleaf'] || RUSTLES.broadleaf;
    const t = ctx.currentTime;
    const source = noiseLoop(ctx, 0.9 + Math.random() * 0.3);
    const cut = ctx.createBiquadFilter();
    cut.type = 'highpass';
    cut.frequency.value = highPass;
    const tone = ctx.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = centre * v.pitch;
    tone.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(peak, t + rise);
    gain.gain.setTargetAtTime(0, t + rise, fall);
    // Leaves do not hiss evenly. A fast flutter makes the swell sound like many of them.
    const flutter = ctx.createOscillator();
    flutter.frequency.value = 9 + Math.random() * 7;
    const depth = ctx.createGain();
    depth.gain.value = peak * 0.35;
    flutter.connect(depth).connect(gain.gain);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.9, Math.min(0.9, dx / A.rustlePanPx));
    source.connect(cut).connect(tone).connect(gain).connect(pan).connect(bed.fade);
    flutter.start(t);
    flutter.stop(t + length);
    source.stop(t + length);
  }

  audio.whenReady(build);
  bus.on('game-began', () => {
    began = true;
    start();
  });
  bus.on('gust-enter', rustle);

  return {
    /**
     * Call on the pose clock with the wind at the listener.
     * @param {number} x listener position in the world
     * @param {number} y
     * @param {number} breezeHere 0 to 1
     * @param {number} gustHere 0 to about 1.3
     */
    update(x, y, breezeHere, gustHere) {
      listener.x = x;
      listener.y = y;
      const ctx = audio.ctx;
      if (!ctx || !bed) return;
      const t = ctx.currentTime;
      const g = Math.min(1.4, gustHere);
      bed.airTone.frequency.setTargetAtTime(A.airBaseHz + A.airOpenHz * breezeHere, t, 0.3);
      bed.airGain.gain.setTargetAtTime(A.airBaseGain + A.airBreezeGain * breezeHere, t, 0.3);
      bed.leafTone.frequency.setTargetAtTime(A.leafBaseHz + A.leafOpenHz * g, t, 0.2);
      bed.leafGain.gain.setTargetAtTime(A.leafBreezeGain * breezeHere + A.leafGustGain * g * g, t, 0.2);
    },
    get rustling() {
      return rustling;
    },
  };
}
