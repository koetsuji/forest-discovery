// The running check: a local server plus headless Chrome load the game with a
// fixed seed and clock, press things, and write screenshots to out/shots/.
// It fails on console warnings or errors, on any request that leaves the site,
// and on a wrong state. Look at the screenshots: this script cannot judge them.
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { launchChrome } from './lib/cdp.mjs';
import { repoRoot, startServer } from './serve.mjs';

const OUT = join(repoRoot, 'out', 'shots');
const SEED = 7;

const DESKTOP = { width: 1920, height: 1080, dpr: 1 };
const PHONE = { width: 393, height: 852, dpr: 3, mobile: true };

/** @type {string[]} */
const failures = [];
/** @param {boolean} ok @param {string} what */
const expect = (ok, what) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${what}`);
  if (!ok) failures.push(what);
};

/**
 * @param {import('./lib/cdp.mjs').Page} page
 * @param {string} base
 * @param {{ width: number, height: number, dpr?: number, mobile?: boolean }} screen
 * @param {string} query
 */
async function open(page, base, screen, query) {
  await page.setScreen(screen);
  await page.goto(`${base}?seed=${SEED}&${query}`);
  await page.waitFor('document.documentElement.dataset.ready === "1"');
  await page.evaluate('document.fonts.ready.then(() => true)');
  // Let the title finish fading in.
  await page.sleep(450);
}

/** @param {import('./lib/cdp.mjs').Page} page */
async function buttonBox(page) {
  return page.evaluate(`(() => {
    const r = document.querySelector('.title .btn').getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height, w: r.width };
  })()`);
}

/** @param {import('./lib/cdp.mjs').Page} page @param {string} name */
async function shot(page, name) {
  await page.screenshot(join(OUT, `${name}.png`));
}

/** @param {import('./lib/cdp.mjs').Page} page @param {string} where */
function checkConsole(page, where) {
  const bad = page.console.filter((line) => line.level === 'error' || line.level === 'warning');
  expect(bad.length === 0, `${where}: console is clean`);
  for (const line of bad) console.log(`        ${line.level}: ${line.text}`);
}

/** @param {import('./lib/cdp.mjs').Page} page @param {string} base @param {string} where */
function checkRequests(page, base, where) {
  const origin = new URL(base).origin;
  const outside = page.requests.filter((r) => !r.url.startsWith(origin) && !r.url.startsWith('data:'));
  const failed = page.requests.filter((r) => r.status >= 400);
  expect(outside.length === 0, `${where}: no request leaves the site`);
  for (const r of outside) console.log(`        ${r.url}`);
  expect(failed.length === 0, `${where}: every request succeeds`);
  for (const r of failed) console.log(`        ${r.status} ${r.url}`);
}

async function main() {
  rmSync(OUT, { recursive: true, force: true });
  mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const chrome = await launchChrome();
  try {
    const page = await chrome.newPage();
    const base = server.url;

    console.log('Title, desktop');
    await open(page, base, DESKTOP, 't=3&freeze=1');
    await shot(page, 'title-desktop');
    const view = await page.evaluate('({ w: fd.renderer.w, h: fd.renderer.h, scale: fd.renderer.scale })');
    expect(view.w === 480 && view.h === 270 && view.scale === 4, `1080p gives 480 x 270 at scale 4 (got ${view.w} x ${view.h} at ${view.scale})`);
    expect(await page.evaluate('fd.audio.ctx === null'), 'no sound context before the first press');
    expect(await page.evaluate('document.fonts.check(\'16px "Geist Pixel"\') && document.fonts.check(\'16px "Geist"\')'), 'Geist fonts are loaded');
    checkConsole(page, 'title');
    checkRequests(page, base, 'title');
    const transferred = page.requests.reduce((sum, r) => sum + r.bytes, 0);
    console.log(`        ${page.requests.length} requests, ${(transferred / 1000).toFixed(1)} KB over the wire without compression`);

    console.log('Button states');
    const box = await buttonBox(page);
    await page.evaluate(`window.__events = []; for (const t of ['ui-press', 'ui-release', 'ui-hover', 'game-began']) fd.bus.on(t, () => window.__events.push(t));`);
    await page.mouse('mouseMoved', box.x, box.y);
    await page.sleep(120);
    await shot(page, 'button-hover');
    expect(await page.evaluate('document.querySelector(".title .btn").classList.contains("is-hover")'), 'hover: the button shows it');
    await page.mouse('mousePressed', box.x, box.y);
    await page.sleep(90);
    await shot(page, 'button-pressed');
    expect(await page.evaluate('document.querySelector(".title .btn").classList.contains("is-pressed")'), 'press: the button goes down at once');
    expect(await page.evaluate('fd.audio.ctx !== null && fd.audio.ctx.state === "running"'), 'press: the sound context starts');
    // Slide off, then release: nothing may fire.
    await page.mouse('mouseMoved', box.x, box.y + 200, true);
    await page.sleep(60);
    expect(!(await page.evaluate('document.querySelector(".title .btn").classList.contains("is-pressed")')), 'slide off: the button comes back up');
    await page.mouse('mouseMoved', box.x, box.y, true);
    await page.sleep(60);
    expect(await page.evaluate('document.querySelector(".title .btn").classList.contains("is-pressed")'), 'slide back on: the button goes down again');
    await page.mouse('mouseMoved', box.x, box.y + 200, true);
    await page.sleep(60);
    await page.mouse('mouseReleased', box.x, box.y + 200);
    await page.sleep(60);
    expect(await page.evaluate('!window.__events.includes("ui-release") && fd.audio.voices <= 2'), 'slide off: release is cancelled, silently');
    // A real press and release.
    await page.mouse('mouseMoved', box.x, box.y);
    await page.mouse('mousePressed', box.x, box.y);
    await page.sleep(80);
    await page.mouse('mouseReleased', box.x, box.y);
    await page.sleep(40);
    await shot(page, 'button-released');
    expect(await page.evaluate('window.__events.join(",")').then((e) => /ui-press,ui-release,game-began$/.test(e)), 'release: the action fires on release');
    await page.sleep(350);
    const fade = await page.evaluate('(() => { const s = document.querySelector(".title__scrim"); return s ? Number(getComputedStyle(s).opacity) : -1; })()');
    expect(fade > 0.05 && fade < 0.95, `the forest fades in slowly behind the title (scrim at ${fade.toFixed(2)} after 0.4 s)`);
    await page.sleep(1000);
    await shot(page, 'after-begin-desktop');
    expect(await page.evaluate('document.querySelector(".title") === null'), 'the title is gone after Begin');
    checkConsole(page, 'after Begin');

    console.log('Keyboard and disabled');
    await open(page, base, DESKTOP, 't=3&freeze=1');
    await page.key('keyDown', 'Tab', 'Tab', 9);
    await page.key('keyUp', 'Tab', 'Tab', 9);
    await page.sleep(120);
    await shot(page, 'button-focus');
    expect(await page.evaluate('document.activeElement === document.querySelector(".title .btn") && document.activeElement.matches(":focus-visible")'), 'focus: Tab reaches the button and shows a ring');
    await page.key('keyDown', 'Enter', 'Enter', 13);
    await page.sleep(80);
    expect(await page.evaluate('document.querySelector(".title .btn").classList.contains("is-pressed")'), 'keyboard: Enter presses');
    await page.key('keyUp', 'Enter', 'Enter', 13);
    await page.sleep(80);
    expect(await page.evaluate('!!document.querySelector(".title.is-leaving")'), 'keyboard: letting go begins the game');
    await open(page, base, DESKTOP, 't=3&freeze=1');
    await page.evaluate('(() => { const b = document.querySelector(".title .btn"); b.disabled = true; b.textContent = "Loading"; })()');
    const off = await buttonBox(page);
    await page.mouse('mouseMoved', off.x, off.y);
    await page.mouse('mousePressed', off.x, off.y);
    await page.sleep(80);
    await shot(page, 'button-disabled');
    expect(!(await page.evaluate('document.querySelector(".title .btn").classList.contains("is-pressed")')), 'disabled: a press does nothing');
    await page.mouse('mouseReleased', off.x, off.y);

    console.log('Scene, desktop');
    await open(page, base, DESKTOP, 't=3&freeze=1&title=0');
    await shot(page, 'scene-desktop');
    checkConsole(page, 'scene');

    console.log('Phone');
    await open(page, base, PHONE, 't=3&freeze=1');
    await shot(page, 'title-phone');
    const phone = await page.evaluate('({ w: fd.renderer.w, h: fd.renderer.h, scale: fd.renderer.scale })');
    expect(phone.scale === 4 && phone.w === 295 && phone.h === 639, `a 393 x 852 phone at 3x gives 295 x 639 at scale 4 (got ${phone.w} x ${phone.h} at ${phone.scale})`);
    const tap = await buttonBox(page);
    expect(tap.h >= 44, `the button is ${tap.h} px tall on touch (44 or more)`);
    await page.touch('touchStart', tap.x, tap.y);
    await page.sleep(90);
    await shot(page, 'button-pressed-phone');
    expect(await page.evaluate('document.querySelector(".title .btn").classList.contains("is-pressed")'), 'touch: press shows at once');
    await page.touch('touchEnd', tap.x, tap.y);
    await page.sleep(1300);
    expect(await page.evaluate('document.querySelector(".title") === null'), 'touch: release begins the game');
    await shot(page, 'after-begin-phone');
    checkConsole(page, 'phone');

    console.log('Reduced motion');
    await page.setReducedMotion('reduce');
    await open(page, base, DESKTOP, 't=3&freeze=1');
    const calm = await buttonBox(page);
    await page.mouse('mouseMoved', calm.x, calm.y);
    await page.mouse('mousePressed', calm.x, calm.y);
    await page.sleep(90);
    expect(await page.evaluate('getComputedStyle(document.querySelector(".title .btn")).transform === "none"'), 'reduced motion: the pressed button does not move');
    await page.mouse('mouseReleased', calm.x, calm.y);
    await page.setReducedMotion('no-preference');
  } finally {
    await chrome.close();
    await server.close();
  }

  console.log(failures.length ? `\n${failures.length} check(s) failed` : `\nAll running checks passed. Screenshots are in out/shots/`);
  return failures.length === 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().then(
    (ok) => process.exit(ok ? 0 : 1),
    (error) => {
      console.error(error);
      process.exit(1);
    },
  );
}
