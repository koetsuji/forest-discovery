// @ts-check
/**
 * Every number that shapes the feel lives here, grouped, with units in the name.
 * Wind values start from Kimo's article (docs/wind-system.md) and are tuned by eye.
 */
export const tuning = {
  view: {
    /** The short side of the screen never shows fewer art pixels than this. */
    minShortSideArtPx: 240,
  },

  loop: {
    stepsPerSec: 60,
    /** Longer frames are clamped, so a hiccup never becomes a jump. */
    maxFrameSec: 0.1,
    /** Foliage moves on this clock, not every frame. The stepping is part of the look. */
    posesPerSec: 10,
  },

  camera: {
    /** Time the camera takes to settle on its target. */
    settleSec: 0.3,
    /** Where the camera rests on the title screen, relative to the scene focus. */
    titleOffsetXPx: -22,
    titleOffsetYPx: -14,
  },

  world: {
    chunkSizePx: 256,
    /** Baked ground chunks kept in memory. */
    keepChunks: 24,
    /** Until the seed lives in the URL (M3), every visit shows this forest. */
    defaultSeed: 20261113,
  },

  /**
   * Ground colours. Provisional: picked by eye, and snapped to the shared sprite
   * palette by the art pipeline once real sprites are accepted (docs/art-guide.md).
   */
  ground: {
    /** @type {Record<string, string>} */
    colours: {
      grassHi: '#a3b452',
      grass: '#8aa346',
      grassMid: '#77923f',
      grassLow: '#62803a',
      floor: '#46683a',
      floorLow: '#385636',
      floorDeep: '#2c4732',
      earth: '#5b4a35',
      earthLow: '#4a3c2d',
      trail: '#a48a5a',
      trailHi: '#b89f6c',
      trailLow: '#836a45',
    },
    /** Half width of the trail. */
    trailHalfWidthPx: 8,
    /** Gust-lit grass streaks per chunk, before the open ground test. */
    streaksPerChunk: 260,
    /** A streak lights up when the gust over it passes this level. */
    streakGustLevel: 0.28,
  },

  wind: {
    /** along(p) = x + axisSlope * y: wind blows right and a little toward the camera. */
    axisSlope: 0.25,
    wavePeriodSec: 1.54,
    waveLengthPx: 69,
    /** The gust schedule repeats with this period. */
    schedulePeriodSec: 20,
    /** Patch band positions are given for a view this tall and scale with the real view. */
    scheduleViewHeightPx: 270,
    /**
     * Gust patches. bandHalfPx 0 means the patch crosses the whole view.
     * @type {{ name: string, enterSec: number, speedPxPerSec: number, bandCentrePx: number, bandHalfPx: number, lengthPx: number, strength: number }[]}
     */
    gusts: [
      { name: 'big one', enterSec: 18.6, speedPxPerSec: 65, bandCentrePx: 0, bandHalfPx: 0, lengthPx: 44, strength: 1.25 },
      { name: 'its tail', enterSec: 19.8, speedPxPerSec: 65, bandCentrePx: 0, bandHalfPx: 0, lengthPx: 26, strength: 0.5 },
      { name: 'quick one', enterSec: 1.5, speedPxPerSec: 60, bandCentrePx: 95, bandHalfPx: 45, lengthPx: 30, strength: 0.6 },
      { name: 'medium front', enterSec: 6.0, speedPxPerSec: 55, bandCentrePx: 150, bandHalfPx: 60, lengthPx: 34, strength: 0.75 },
      { name: 'second hit', enterSec: 7.3, speedPxPerSec: 55, bandCentrePx: 145, bandHalfPx: 65, lengthPx: 30, strength: 0.9 },
      { name: 'light puff', enterSec: 8.5, speedPxPerSec: 50, bandCentrePx: 50, bandHalfPx: 55, lengthPx: 30, strength: 0.55 },
    ],
    /** The breeze is the same patches, this much longer and taller, boosted and capped at 1. */
    breezeLengthSpread: 2.2,
    breezeBandSpread: 1.6,
    breezeBoost: 1.6,
    /** A little air that never stops. Too small to move a clump, enough to hear. */
    breezeBase: 0.06,
    /** Loop size in pixels per unit of breeze and gust, sideways and upward. */
    loopXBreezePx: 0.9,
    loopXGustPx: 1.3,
    loopYBreezePx: 0.75,
    loopYGustPx: 0.5,
    /** A gust counts as "on a plant" above this level. Drives leaves and rustle. */
    gustOnLevel: 0.3,
    gustOffLevel: 0.18,
    /**
     * Spring profiles. trunkBend 1 means the trunk bends by shifting rows.
     * @type {Record<string, { pushPx: number, swingSec: number, damping: number, trunkBend: number }>}
     */
    profiles: {
      oak: { pushPx: 2.2, swingSec: 2.2, damping: 0.35, trunkBend: 0 },
      birch: { pushPx: 2.2, swingSec: 2.2, damping: 0.35, trunkBend: 0 },
      pine: { pushPx: 3.6, swingSec: 2.8, damping: 0.22, trunkBend: 1 },
      bush: { pushPx: 1.4, swingSec: 1.0, damping: 0.35, trunkBend: 0 },
    },
  },

  leaves: {
    maxAlive: 140,
    /** Leaves per second from a broad tree in a gust of strength 1. */
    shedPerSecAtGust1: 3.2,
    fallPxPerSec: 22,
    driftPxPerSec: 34,
    /** Extra drift per unit of gust at the leaf. */
    driftGustPxPerSec: 30,
    restSec: 2.6,
    fadeSec: 0.9,
  },

  shadows: {
    /** A point this high above the ground throws its shadow this far right and down. */
    reachXPerPx: 0.3,
    reachYPerPx: 0.36,
    /** Canopy shadows are the clump shapes, flattened by this factor. */
    squash: 0.5,
    colour: '#12333c',
    alpha: 0.62,
  },

  standIn: {
    outline: '#5a5a5a',
    /** Flat fills, one grey per kind so overlapping silhouettes stay readable. */
    fill: { broad: '#989898', cone: '#808080', oval: '#aaaaaa', bush: '#8c8c8c', rock: '#9e9e9e' },
  },

  audio: {
    /** Bus levels, linear gain. */
    ambienceGain: 0.9,
    worldGain: 0.8,
    interfaceGain: 0.7,
    musicGain: 0.6,
    fadeInSec: 1.5,
    /** One-shot sounds vary by this much in pitch and level. */
    pitchVariance: 0.03,
    levelVariance: 0.12,
    hoverMinGapMs: 60,
    maxVoices: 16,
  },

  feel: {
    /** Vibration on press, where the device supports it. */
    pressVibrationMs: 8,
  },
};
