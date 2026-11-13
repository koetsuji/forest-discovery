// @ts-check
/**
 * The frame loop: fixed simulation steps, decoupled from drawing.
 */

/**
 * Turns real frame times into a whole number of fixed steps.
 * @param {{ stepSec: number, maxFrameSec: number }} opts
 */
export function createStepper({ stepSec, maxFrameSec }) {
  let owed = 0;
  return {
    /**
     * @param {number} frameSec time since the last frame
     * @returns {number} steps to run now
     */
    advance(frameSec) {
      // Clamp long frames so a hiccup never turns into a burst of steps.
      const clamped = Math.min(Math.max(frameSec, 0), maxFrameSec);
      owed += clamped;
      let steps = 0;
      while (owed >= stepSec - 1e-9) {
        owed -= stepSec;
        steps++;
      }
      return steps;
    },
    reset() {
      owed = 0;
    },
  };
}

/**
 * @param {{ step: (dt: number) => void, draw: () => void, stepsPerSec: number, maxFrameSec: number }} opts
 */
export function createLoop({ step, draw, stepsPerSec, maxFrameSec }) {
  const stepSec = 1 / stepsPerSec;
  const stepper = createStepper({ stepSec, maxFrameSec });
  /** @type {number | null} */
  let last = null;
  let handle = 0;
  let wanted = false;
  let ticking = false;
  let frozen = false;

  /** @param {number} now */
  function frame(now) {
    handle = requestAnimationFrame(frame);
    if (last === null) last = now;
    const steps = frozen ? 0 : stepper.advance((now - last) / 1000);
    last = now;
    for (let i = 0; i < steps; i++) step(stepSec);
    draw();
  }

  function resume() {
    if (ticking || !wanted || document.hidden) return;
    ticking = true;
    // Forget the old timestamp, so time does not jump after a pause.
    last = null;
    stepper.reset();
    handle = requestAnimationFrame(frame);
  }

  function pause() {
    if (!ticking) return;
    ticking = false;
    cancelAnimationFrame(handle);
  }

  // The loop stops with the tab and picks up where it left off.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else resume();
  });

  return {
    stepSec,
    start() {
      wanted = true;
      resume();
    },
    stop() {
      wanted = false;
      pause();
    },
    /** Stops time but keeps drawing. Used by the screenshot check. */
    setFrozen(/** @type {boolean} */ value) {
      frozen = value;
    },
  };
}
