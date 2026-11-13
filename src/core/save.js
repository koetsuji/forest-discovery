// @ts-check
/**
 * Saving: versioned JSON in localStorage. A broken or older save migrates or
 * falls back to a fresh start. It never throws and never shows an error.
 */

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'forest-discovery.save';

/**
 * @typedef {{ volume: number, muted: boolean, reducedMotion: boolean, showWind: boolean }} Settings
 * @typedef {{
 *   v: number,
 *   seed: number,
 *   player: { x: number, y: number, facing: string },
 *   found: string[],
 *   inventory: unknown[],
 *   deltas: Record<string, Record<string, unknown>>,
 *   settings: Settings,
 * }} GameState
 * @typedef {Record<number, (data: Record<string, any>) => Record<string, any>>} MigrationSteps
 */

/**
 * One function per schema change: STEPS[n] turns a version n save into
 * version n + 1. Empty while version 1 is the only one that ever shipped.
 * @type {MigrationSteps}
 */
const STEPS = {};

/**
 * @param {number} seed
 * @returns {GameState}
 */
export function freshState(seed) {
  return {
    v: SAVE_VERSION,
    seed: seed >>> 0,
    player: { x: 0, y: 0, facing: 'down' },
    found: [],
    inventory: [],
    deltas: {},
    settings: { volume: 0.8, muted: false, reducedMotion: false, showWind: false },
  };
}

/**
 * Walks a save up the version ladder. Stops early if a step is missing.
 * @param {Record<string, any>} data
 * @param {number} from
 * @param {number} to
 * @param {MigrationSteps} steps
 * @returns {{ data: Record<string, any>, version: number }}
 */
export function runMigrations(data, from, to, steps) {
  let version = from;
  while (version < to && steps[version]) {
    data = steps[version](data);
    version++;
  }
  return { data, version };
}

/**
 * Turns whatever was stored into a valid current state. Every field is
 * checked on its own, so one bad value never costs the rest of the save.
 * @param {unknown} raw parsed JSON, or anything else
 * @param {number} fallbackSeed
 * @param {MigrationSteps} [steps]
 * @returns {GameState}
 */
export function migrate(raw, fallbackSeed, steps = STEPS) {
  const state = freshState(fallbackSeed);
  if (!isRecord(raw)) return state;
  const stored = typeof raw.v === 'number' ? raw.v : SAVE_VERSION;
  // A save from a newer game than this one cannot be trusted. Start fresh.
  if (stored > SAVE_VERSION) return state;
  const upgraded = runMigrations(raw, stored, SAVE_VERSION, steps);
  // An old save with no path to the current version: start fresh.
  if (upgraded.version !== SAVE_VERSION) return state;
  const data = upgraded.data;

  if (isNumber(data.seed)) state.seed = data.seed >>> 0;
  if (isRecord(data.player)) {
    if (isNumber(data.player.x)) state.player.x = data.player.x;
    if (isNumber(data.player.y)) state.player.y = data.player.y;
    if (typeof data.player.facing === 'string') state.player.facing = data.player.facing;
  }
  if (Array.isArray(data.found)) state.found = data.found.filter((id) => typeof id === 'string');
  if (Array.isArray(data.inventory)) state.inventory = data.inventory;
  if (isRecord(data.deltas)) state.deltas = /** @type {GameState['deltas']} */ (data.deltas);
  if (isRecord(data.settings)) {
    const s = data.settings;
    if (isNumber(s.volume)) state.settings.volume = Math.min(1, Math.max(0, s.volume));
    if (typeof s.muted === 'boolean') state.settings.muted = s.muted;
    if (typeof s.reducedMotion === 'boolean') state.settings.reducedMotion = s.reducedMotion;
    if (typeof s.showWind === 'boolean') state.settings.showWind = s.showWind;
  }
  return state;
}

/**
 * @param {Pick<Storage, 'getItem'> | null} storage
 * @param {number} fallbackSeed
 * @returns {GameState}
 */
export function loadState(storage, fallbackSeed) {
  try {
    const text = storage ? storage.getItem(SAVE_KEY) : null;
    return migrate(text ? JSON.parse(text) : null, fallbackSeed);
  } catch {
    return freshState(fallbackSeed);
  }
}

/**
 * @param {Pick<Storage, 'setItem'> | null} storage
 * @param {GameState} state
 * @returns {boolean} whether the save was written
 */
export function saveState(storage, state) {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch {
    // Private mode or a full disk: playing goes on without saving.
    return false;
  }
}

/**
 * localStorage, or null where the browser refuses it.
 * @returns {Storage | null}
 */
export function browserStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** @param {unknown} v @returns {v is Record<string, any>} */
function isRecord(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** @param {unknown} v @returns {v is number} */
function isNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}
