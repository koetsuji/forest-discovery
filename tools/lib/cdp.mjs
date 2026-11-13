// Drives headless Chrome over the DevTools protocol with nothing but Node.
// Enough for the checks: open a page, set a screen size, press things,
// read the console, take screenshots.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.CHROME_BIN,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
];

export function findChrome() {
  const found = CANDIDATES.find((path) => path && existsSync(path));
  if (!found) throw new Error('Chrome not found. Set CHROME_BIN to its path.');
  return found;
}

/** @returns {Promise<{ newPage: () => Promise<Page>, close: () => Promise<void> }>} */
export async function launchChrome() {
  const profile = mkdtempSync(join(tmpdir(), 'forest-chrome-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--hide-scrollbars',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--force-color-profile=srgb',
    'about:blank',
  ];
  // Chrome refuses to sandbox itself when run as root, as in a container.
  if (typeof process.getuid === 'function' && process.getuid() === 0) args.unshift('--no-sandbox');
  const child = spawn(findChrome(), args, { stdio: ['ignore', 'ignore', 'pipe'] });

  const endpoint = await new Promise((resolve, reject) => {
    let text = '';
    const timer = setTimeout(() => reject(new Error(`Chrome did not start:\n${text}`)), 20000);
    child.stderr.on('data', (chunk) => {
      text += chunk;
      const match = text.match(/DevTools listening on (ws:\/\/\S+)/);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    child.on('exit', (code) => reject(new Error(`Chrome exited with ${code}:\n${text}`)));
  });

  const socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', () => reject(new Error('could not reach Chrome')), { once: true });
  });

  let nextId = 1;
  /** @type {Map<number, { resolve: (v: any) => void, reject: (e: Error) => void }>} */
  const pending = new Map();
  /** @type {Map<string, (method: string, params: any) => void>} */
  const sessions = new Map();

  socket.addEventListener('message', (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = pending.get(message.id);
      if (!waiter) return;
      pending.delete(message.id);
      if (message.error) waiter.reject(new Error(`${message.error.message} (${message.error.code})`));
      else waiter.resolve(message.result);
    } else if (message.sessionId) {
      sessions.get(message.sessionId)?.(message.method, message.params);
    }
  });

  /** @param {string} method @param {object} [params] @param {string} [sessionId] */
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });

  return {
    async newPage() {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      return createPage((method, params) => send(method, params, sessionId), (fn) => sessions.set(sessionId, fn));
    },
    async close() {
      try {
        await send('Browser.close');
      } catch {
        // Already gone.
      }
      // Wait for Chrome to let go of its profile before deleting it.
      await new Promise((done) => {
        if (child.exitCode !== null) return done(null);
        child.once('exit', done);
        setTimeout(() => {
          child.kill('SIGKILL');
          done(null);
        }, 3000);
      });
      try {
        rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
      } catch {
        // A leftover temp folder is not worth failing a check for.
      }
    },
  };
}

/**
 * @typedef {Awaited<ReturnType<typeof createPage>>} Page
 * @param {(method: string, params?: object) => Promise<any>} send
 * @param {(fn: (method: string, params: any) => void) => void} listen
 */
async function createPage(send, listen) {
  /** @type {{ level: string, text: string }[]} */
  const consoleLines = [];
  /** @type {{ url: string, bytes: number, status: number }[]} */
  const requests = [];
  /** @type {Map<string, { url: string, bytes: number, status: number }>} */
  const byId = new Map();

  listen((method, params) => {
    if (method === 'Runtime.consoleAPICalled') {
      const text = params.args.map((/** @type {any} */ a) => a.value ?? a.description ?? '').join(' ');
      consoleLines.push({ level: params.type, text });
    } else if (method === 'Runtime.exceptionThrown') {
      const details = params.exceptionDetails;
      consoleLines.push({ level: 'error', text: details.exception?.description ?? details.text });
    } else if (method === 'Log.entryAdded') {
      consoleLines.push({ level: params.entry.level, text: `${params.entry.text} ${params.entry.url ?? ''}`.trim() });
    } else if (method === 'Network.requestWillBeSent') {
      const entry = { url: params.request.url, bytes: 0, status: 0 };
      byId.set(params.requestId, entry);
      requests.push(entry);
    } else if (method === 'Network.responseReceived') {
      const entry = byId.get(params.requestId);
      if (entry) entry.status = params.response.status;
    } else if (method === 'Network.loadingFinished') {
      const entry = byId.get(params.requestId);
      if (entry) entry.bytes = params.encodedDataLength;
    }
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Network.enable');

  /** @param {string} expression */
  const evaluate = async (expression) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
    return result.value;
  };

  const sleep = (/** @type {number} */ ms) => new Promise((done) => setTimeout(done, ms));

  return {
    console: consoleLines,
    requests,
    evaluate,
    sleep,
    /** @param {{ width: number, height: number, dpr?: number, mobile?: boolean }} screen */
    async setScreen({ width, height, dpr = 1, mobile = false }) {
      await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dpr, mobile });
      await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    },
    /** @param {'reduce' | 'no-preference'} value */
    async setReducedMotion(value) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value }] });
    },
    /** @param {string} url */
    async goto(url) {
      consoleLines.length = 0;
      requests.length = 0;
      byId.clear();
      await send('Page.navigate', { url });
    },
    /** @param {string} expression @param {number} [timeoutMs] */
    async waitFor(expression, timeoutMs = 15000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        try {
          if (await evaluate(expression)) return;
        } catch {
          // The page may still be loading.
        }
        await sleep(50);
      }
      throw new Error(`timed out waiting for: ${expression}`);
    },
    /** @param {string} file */
    async screenshot(file) {
      const { data } = await send('Page.captureScreenshot', { format: 'png' });
      writeFileSync(file, Buffer.from(data, 'base64'));
    },
    /**
     * @param {'mouseMoved' | 'mousePressed' | 'mouseReleased'} type @param {number} x @param {number} y
     * @param {boolean} [held] for a move: whether the left button is down
     */
    async mouse(type, x, y, held = false) {
      await send('Input.dispatchMouseEvent', {
        type,
        x,
        y,
        button: type === 'mouseMoved' && !held ? 'none' : 'left',
        buttons: type === 'mousePressed' || (type === 'mouseMoved' && held) ? 1 : 0,
        clickCount: type === 'mouseMoved' ? 0 : 1,
      });
    },
    /** @param {'touchStart' | 'touchMove' | 'touchEnd'} type @param {number} x @param {number} y */
    async touch(type, x, y) {
      await send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    },
    /** @param {'keyDown' | 'keyUp'} type @param {string} key @param {string} code @param {number} keyCode */
    async key(type, key, code, keyCode) {
      await send('Input.dispatchKeyEvent', {
        type: type === 'keyDown' ? 'rawKeyDown' : 'keyUp',
        key,
        code,
        windowsVirtualKeyCode: keyCode,
      });
    },
    /** @param {number} rate 1 is no throttling */
    async throttleCpu(rate) {
      await send('Emulation.setCPUThrottlingRate', { rate });
    },
  };
}
