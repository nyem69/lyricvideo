// Tiny static server with COOP/COEP so the page is cross-origin isolated and
// transformers.js can use SharedArrayBuffer (multithreaded WASM).
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const PORT = 8787;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript',
  '.json': 'application/json', '.wav': 'audio/wav', '.wasm': 'application/wasm',
};

createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (req.method === 'POST' && path === '/log') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      const { appendFile } = await import('node:fs/promises');
      await appendFile('bench.log', body.replace(/\n*$/, '\n'));
      res.writeHead(204).end();
    });
    return;
  }
  const file = join(process.cwd(), path === '/' ? 'bench.html' : path);
  if (!file.startsWith(process.cwd())) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cache-Control': 'no-store',
    });
    res.end(body);
  } catch {
    res.writeHead(404).end('not found');
  }
}).listen(PORT, () => console.log(`http://localhost:${PORT}/`));
