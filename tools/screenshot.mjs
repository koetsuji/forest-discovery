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

    console.log('Sound');
    // Run the forest through a gust and listen for trees answering it.
    let rustled = 0;
    for (let i = 0; i < 40 && !rustled; i++) {
      await page.evaluate('fd.advance(0.5)');
      rustled = await page.evaluate('fd.ambience.rustling');
    }
    expect(rustled > 0, 'a gust reaching a tree starts a rustle');
    expect(await page.evaluate('fd.audio.voices <= 16'), 'never more than 16 voices');
    const mute = await page.evaluate(`(() => { const r = document.querySelector('.hud .btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, shown: getComputedStyle(document.querySelector('.hud')).opacity }; })()`);
    expect(mute.shown === '1', 'the sound switch is on screen after Begin');
    await page.mouse('mouseMoved', mute.x, mute.y);
    await page.mouse('mousePressed', mute.x, mute.y);
    await page.sleep(60);
    await page.mouse('mouseReleased', mute.x, mute.y);
    await page.sleep(250);
    await shot(page, 'muted');
    expect(await page.evaluate('fd.state.settings.muted === true && document.querySelector(".hud .btn").getAttribute("aria-pressed") === "true"'), 'the switch mutes and says so');
    expect(await page.evaluate('JSON.parse(localStorage.getItem("forest-discovery.save")).settings.muted === true'), 'mute is saved');
    await page.key('keyDown', 'm', 'KeyM', 77);
    await page.key('keyUp', 'm', 'KeyM', 77);
    await page.sleep(60);
    expect(await page.evaluate('fd.state.settings.muted === false && document.querySelector(".hud .btn").getAttribute("aria-pressed") === "false"'), 'M turns the sound back on');
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

    console.log('Living forest');
    const pixels = `(() => { const c = document.getElementById('view'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let h = 2166136261; for (let i = 0; i < d.length; i++) h = Math.imul(h ^ d[i], 16777619); return h >>> 0; })()`;
    await open(page, base, DESKTOP, 't=6.5&freeze=1&title=0');
    const first = await page.evaluate(pixels);
    await open(page, base, DESKTOP, 't=6.5&freeze=1&title=0');
    await shot(page, 'forest-06_5s');
    expect((await page.evaluate(pixels)) === first, 'the same seed and clock give the same picture');
    expect(await page.evaluate('fd.foliage.snapshot().length') > 8, 'plants on screen are posed from the atlas');
    expect(await page.evaluate('fd.leaves.count') > 0, 'a gust has shaken leaves loose');
    // One whole gust schedule, a pose at a time.
    const motion = await page.evaluate(`(() => {
      const tally = { clumps: 0, rest: 0, one: 0, far: 0, whole: true, leaves: 0, reach: 0 };
      for (let k = 0; k < 200; k++) {
        fd.advance(0.1);
        tally.leaves = Math.max(tally.leaves, fd.leaves.count);
        for (const plant of fd.foliage.snapshot()) {
          for (let i = 0; i < plant.dx.length; i++) {
            const d = Math.max(Math.abs(plant.dx[i]), Math.abs(plant.dy[i]));
            tally.clumps++;
            if (d === 0) tally.rest++;
            else if (d === 1) tally.one++;
            else tally.far++;
            tally.reach = Math.max(tally.reach, d);
            if (!Number.isInteger(plant.dx[i]) || !Number.isInteger(plant.dy[i])) tally.whole = false;
          }
        }
      }
      return tally;
    })()`);
    const share = (/** @type {number} */ n) => `${Math.round((100 * n) / motion.clumps)}%`;
    console.log(`        over 20 s: ${share(motion.rest)} of clumps at rest, ${share(motion.one)} one pixel away, ${share(motion.far)} further, farthest ${motion.reach} px, up to ${motion.leaves} leaves`);
    expect(motion.whole, 'every clump sits on a whole pixel');
    expect((motion.rest + motion.one) / motion.clumps > 0.85 && motion.far > 0, 'most clumps are at rest or one pixel away, and gusts push some further');
    expect(motion.reach >= 4 && motion.reach <= 9, 'the strongest gust moves a clump 4 to 9 px');
    expect(motion.leaves > 5 && motion.leaves <= 120, 'falling leaves stay inside their limit');
    await shot(page, 'forest-26_5s');
    await page.evaluate('fd.advance(6)');
    await shot(page, 'forest-32_5s');
    await page.key('keyDown', 'g', 'KeyG', 71);
    await page.key('keyUp', 'g', 'KeyG', 71);
    await page.sleep(100);
    await shot(page, 'wind-overlay');
    expect(await page.evaluate('fd.state.settings.showWind === true'), 'G shows the wind overlay');
    await page.key('keyDown', 'g', 'KeyG', 71);
    await page.key('keyUp', 'g', 'KeyG', 71);
    expect(await page.evaluate('fd.state.settings.showWind === false'), 'G hides it again');
    checkConsole(page, 'forest');
    checkRequests(page, base, 'forest');

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
    // A rough stand-in for a mid-range phone: this machine's processor made four times slower.
    await page.throttleCpu(4);
    await page.goto(`${base}?seed=${SEED}&t=4&title=0`);
    await page.waitFor('document.documentElement.dataset.ready === "1"');
    await page.sleep(4000);
    // The median frame, not an average: one slow frame on a busy machine must not decide the check.
    const cost = await page.evaluate(`(() => {
      const n = Math.min(fd.perf.frames, fd.perf.recent.length);
      const sorted = Array.from(fd.perf.recent.slice(0, n)).sort((a, b) => a - b);
      return { work: sorted[Math.floor(n / 2)], slow: sorted[Math.floor(n * 0.95)], frames: fd.perf.frames };
    })()`);
    await page.throttleCpu(1);
    await shot(page, 'forest-phone');
    console.log(`        phone view, 4x slower processor: median frame ${cost.work.toFixed(1)} ms of work, 1 in 20 over ${cost.slow.toFixed(1)} ms, ${Math.round(cost.frames / 4)} frames per second in this headless browser`);
    expect(cost.work < 10, 'the median frame takes under 10 ms of work on a 4x slower processor (16.7 ms is the 60 fps limit)');
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
