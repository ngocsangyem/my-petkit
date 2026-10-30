// Serves a built fixture preview with the production Content-Security-Policy, so
// a screenshot run also proves the screens obey it.
//
//   node preview/serve.mjs <dir> <port>
//
// The policy is read from the server's source (SPA_CSP in web/spa.py) on start,
// never copied, so a change there is what this server sends.
import { createServer } from 'node:http';
import { open, readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPA_PY = fileURLToPath(
  new URL('../../../services/api/src/my_petkit/web/spa.py', import.meta.url),
);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};

/** The SPA_CSP constant: adjacent Python string literals inside `SPA_CSP = ( ... )`. */
async function readCsp() {
  const source = await readFile(SPA_PY, 'utf8');
  const block = /^SPA_CSP\s*=\s*\(([\s\S]*?)^\)/m.exec(source);
  if (!block) throw new Error(`SPA_CSP not found in ${SPA_PY}`);
  const parts = [...block[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)].map(m => m[1]);
  if (!parts.length) throw new Error('SPA_CSP has no string literals');
  return parts.join('');
}

const [dirArg, portArg] = process.argv.slice(2);
const port = Number(portArg);
if (!dirArg || !Number.isInteger(port) || port <= 0 || port > 65535) {
  console.error('usage: node preview/serve.mjs <dir> <port>');
  process.exit(2);
}
const root = resolve(dirArg);
const csp = await readCsp();

/** The file a URL path names, or null when it would leave the root. */
function fileFor(urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const path = resolve(join(root, decoded.endsWith('/') ? decoded + 'index.html' : decoded));
  return path === root || path.startsWith(root + sep) ? path : null;
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://preview.local');
  const path = fileFor(url.pathname);
  const headers = { 'Content-Security-Policy': csp, 'Cache-Control': 'no-cache' };
  // One handle for the check and the read, so the file cannot change in between.
  let file;
  try {
    if (!path) throw new Error('outside the root');
    file = await open(path, 'r');
    if (!(await file.stat()).isFile()) throw new Error('not a file');
    const body = await file.readFile();
    res.writeHead(200, {
      ...headers,
      'Content-Type': TYPES[extname(path)] ?? 'application/octet-stream',
    });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { ...headers, 'Content-Type': 'text/plain' });
    res.end('Not found\n');
  } finally {
    await file?.close();
  }
});

server.on('error', error => {
  console.error(`preview server: ${error.message}`);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`fixture preview of ${root} on http://127.0.0.1:${port}/`);
  console.log(`CSP: ${csp}`);
});
