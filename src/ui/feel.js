// @ts-check
/**
 * How a button feels. Press answers in the same frame with motion, sound and,
 * where the phone supports it, a short vibration. The action fires on release,
 * as on a real button. Sliding off before release cancels it, silently.
 *
 * The look of each state is in styles/ui.css. The sounds are in audio/sfx.js,
 * which listens to the events sent from here.
 */

import { tuning } from '../tuning.js';

/** A real click arriving this soon after our own release is the same gesture. */
const CLICK_ECHO_MS = 500;
/** A little longer than the release spring in styles/ui.css. */
const RELEASE_SPRING_MS = 200;

/**
 * @param {HTMLButtonElement} el
 * @param {{ bus: import('../core/events.js').Bus, id: string, tone?: 'confirm' | 'back', onRelease: () => void }} opts
 */
export function attachButton(el, { bus, id, tone = 'confirm', onRelease }) {
  let held = false;
  let inside = false;
  let pointerId = -1;
  /** @type {string | null} */
  let heldKey = null;
  let lastLift = -Infinity;
  let springTimer = 0;

  const disabled = () => el.disabled || el.getAttribute('aria-disabled') === 'true';

  /** A short tick on phones that support it. Browsers refuse it before the first tap. */
  function vibrate() {
    const activation = /** @type {any} */ (navigator).userActivation;
    if (!navigator.vibrate || !activation || !activation.hasBeenActive) return;
    navigator.vibrate(tuning.feel.pressVibrationMs);
  }

  function press() {
    held = true;
    inside = true;
    window.clearTimeout(springTimer);
    el.classList.remove('is-released');
    el.classList.add('is-pressed');
    bus.emit('ui-press', { id });
    vibrate();
  }

  /** @param {boolean} fire */
  function lift(fire) {
    held = false;
    heldKey = null;
    lastLift = performance.now();
    el.classList.remove('is-pressed');
    if (!fire) return;
    el.classList.add('is-released');
    // Cleared on a timer, not on animationend, which browsers can send early.
    springTimer = window.setTimeout(() => el.classList.remove('is-released'), RELEASE_SPRING_MS);
    bus.emit('ui-release', { id, tone });
    onRelease();
  }

  el.addEventListener('pointerdown', (event) => {
    if (held || disabled() || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointerId = event.pointerId;
    // Keep receiving moves after the pointer leaves, so sliding back re-presses.
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // A pointer that is already gone cannot be captured. The press still counts.
    }
    press();
  });

  el.addEventListener('pointermove', (event) => {
    if (!held || event.pointerId !== pointerId) return;
    const box = el.getBoundingClientRect();
    const over =
      event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (over === inside) return;
    inside = over;
    el.classList.toggle('is-pressed', inside);
  });

  el.addEventListener('pointerup', (event) => {
    if (!held || event.pointerId !== pointerId) return;
    lift(inside);
  });

  el.addEventListener('pointercancel', (event) => {
    if (held && event.pointerId === pointerId) lift(false);
  });

  // If the browser takes the pointer away, the button must not stay stuck down.
  el.addEventListener('lostpointercapture', (event) => {
    if (held && heldKey === null && event.pointerId === pointerId) lift(false);
  });

  // Hover is for pointers that can hover. A finger arriving is not a hover.
  el.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'touch' || disabled()) return;
    el.classList.add('is-hover');
    bus.emit('ui-hover', { id });
  });

  el.addEventListener('pointerleave', () => {
    el.classList.remove('is-hover');
  });

  el.addEventListener('keydown', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    // The browser's own click is replaced by press and release below.
    event.preventDefault();
    if (event.repeat || held || disabled()) return;
    heldKey = event.key;
    press();
  });

  el.addEventListener('keyup', (event) => {
    if (event.key !== ' ' && event.key !== 'Enter') return;
    event.preventDefault();
    if (held && event.key === heldKey) lift(true);
  });

  el.addEventListener('blur', () => {
    if (held) lift(false);
  });

  el.addEventListener('click', (event) => {
    event.preventDefault();
    // A click with no press before it comes from assistive technology.
    // It gets the whole gesture at once.
    if (held || disabled() || performance.now() - lastLift < CLICK_ECHO_MS) return;
    press();
    lift(true);
  });

  return {
    /** Press and release from outside, for keys that act on a button without focusing it first. */
    press() {
      if (!held && !disabled()) press();
    },
    /** @param {boolean} fire */
    lift(fire) {
      if (held) lift(fire);
    },
    get held() {
      return held;
    },
  };
}
