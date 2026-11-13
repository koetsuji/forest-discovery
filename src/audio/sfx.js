// @ts-check
/**
 * Interface sounds. Each one is shorter than 150 ms and answers an event from
 * the bus: a soft wooden knock on press, two plucked notes on release, a very
 * quiet tick on hover.
 *
 * The plucked string is the game's signature instrument. It is a short
 * Karplus-Strong string: a burst of noise fed around a delay line.
 */

import { tuning } from '../tuning.js';
import { vary } from './engine.js';

/** Note frequencies in Hz. A rising fifth confirms, a falling fifth goes back. */
const D4 = 293.66;
const A4 = 440.0;

/**
 * Renders one plucked note into a buffer.
 * @param {AudioContext} ctx
 * @param {number} hz
 * @param {number} seconds
 * @returns {AudioBuffer}
 */
export function pluckBuffer(ctx, hz, seconds) {
  const rate = ctx.sampleRate;
  const length = Math.floor(rate * seconds);
  const period = Math.max(2, Math.round(rate / hz));
  const buffer = ctx.createBuffer(1, length, rate);
  const out = buffer.getChannelData(0);
  // The string starts as soft noise. Fresh noise every time: no two plucks match.
  const ring = new Float32Array(period);
  let smooth = 0;
  for (let i = 0; i < period; i++) {
    smooth += 0.55 * (Math.random() * 2 - 1 - smooth);
    ring[i] = smooth;
  }
  let at = 0;
  for (let i = 0; i < length; i++) {
    const next = (at + 1) % period;
    const sample = ring[at];
    // Averaging two neighbours is the string losing its brightness as it rings.
    ring[at] = 0.497 * (sample + ring[next]);
    out[i] = sample;
    at = next;
  }
  return buffer;
}

/**
 * @param {import('./engine.js').Audio} audio
 * @param {import('../core/events.js').Bus} bus
 */
export function createSfx(audio, bus) {
  let lastHover = -Infinity;

  /**
   * @param {number} hz
   * @param {number} when seconds from now
   * @param {number} level
   * @param {number} ringSec how long the note is left to ring
   */
  function pluck(hz, when, level, ringSec) {
    const ctx = audio.ctx;
    if (!ctx || !audio.running || !audio.takeVoice(when + ringSec)) return;
    const v = vary();
    const t = ctx.currentTime + when;
    const source = ctx.createBufferSource();
    source.buffer = pluckBuffer(ctx, hz * v.pitch, ringSec + 0.02);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(level * v.level, t);
    // Damped like a finger laid back on the string.
    gain.gain.setTargetAtTime(0, t + ringSec * 0.25, ringSec * 0.16);
    source.connect(gain).connect(audio.bus('interface'));
    source.start(t);
    source.stop(t + ringSec);
  }

  /** Soft wooden knock: a low body that drops in pitch, and a short tap on top. */
  function knock() {
    const ctx = audio.ctx;
    if (!ctx || !audio.running || !audio.takeVoice(0.1)) return;
    const v = vary();
    const t = ctx.currentTime;
    const out = audio.bus('interface');

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(235 * v.pitch, t);
    body.frequency.exponentialRampToValueAtTime(160 * v.pitch, t + 0.045);
    const bodyGain = ctx.createGain();
    bodyGain.gain.setValueAtTime(0.0001, t);
    bodyGain.gain.exponentialRampToValueAtTime(0.42 * v.level, t + 0.004);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.085);
    body.connect(bodyGain).connect(out);
    body.start(t);
    body.stop(t + 0.09);

    const tap = ctx.createBufferSource();
    tap.buffer = audio.noise;
    const tone = ctx.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = 950 * v.pitch;
    tone.Q.value = 1.4;
    const tapGain = ctx.createGain();
    tapGain.gain.setValueAtTime(0.3 * v.level, t);
    tapGain.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    tap.connect(tone).connect(tapGain).connect(out);
    tap.start(t, Math.random() * 1.9, 0.03);
  }

  /** Very quiet, and never more often than the rate limit. */
  function tick() {
    const ctx = audio.ctx;
    const now = performance.now();
    if (!ctx || !audio.running || now - lastHover < tuning.audio.hoverMinGapMs) return;
    if (!audio.takeVoice(0.02)) return;
    lastHover = now;
    const v = vary();
    const t = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = audio.noise;
    const tone = ctx.createBiquadFilter();
    tone.type = 'bandpass';
    tone.frequency.value = 2300 * v.pitch;
    tone.Q.value = 2;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05 * v.level, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.012);
    source.connect(tone).connect(gain).connect(audio.bus('interface'));
    source.start(t, Math.random() * 1.9, 0.02);
  }

  bus.on('ui-press', knock);
  bus.on('ui-release', (/** @type {{ tone?: string }} */ detail) => {
    const back = detail && detail.tone === 'back';
    pluck(back ? A4 : D4, 0, 0.5, 0.085);
    pluck(back ? D4 : A4, 0.055, 0.45, 0.09);
  });
  bus.on('ui-hover', tick);
  // A switch answers with one note: up for on, down for off.
  bus.on('ui-toggle', (/** @type {{ on: boolean }} */ detail) => {
    pluck(detail.on ? A4 : D4, 0, 0.45, 0.1);
  });

  return { knock, pluck, tick };
}
