// A small static server for local play and for the checks.
// Usage: node tools/serve.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

export const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * @param {{ root?: string, port?: number, base?: string }} [opts] base mimics the /forest-discovery/ path on Pages
 * @returns {Promise<{ url: string, close: () => Promise<void> }>}
 */
export function startServer({ root = repoRoot, port = 0, base = '/forest-discovery/' } = {}) {
  const server = createServer(async (req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
      if (path === '/' || !path.startsWith(base)) {
        res.writeHead(302, { location: base }).end();
        return;
      }
      let file = normalize(join(root, path.slice(base.length)));
      if (file !== root && !file.startsWith(root + sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
      const body = await readFile(file);
      res.writeHead(200, {
        'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
        'cache-control': 'no-store',
      });
      res.end(body);
    } catch {
      res.writeHead(404, { 'content-type': 'text/plain' }).end('not found');
    }
  });
  return new Promise((done) => {
    server.listen(port, '127.0.0.1', () => {
      const address = /** @type {import('node:net').AddressInfo} */ (server.address());
      done({
        url: `http://127.0.0.1:${address.port}${base}`,
        close: () => new Promise((closed) => server.close(() => closed())),
      });
    });
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { url } = await startServer({ port: Number(process.argv[2]) || 8080 });
  console.log(`Forest Discovery is at ${url}`);
}
