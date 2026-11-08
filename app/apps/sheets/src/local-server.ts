/**
 * Local stand-in for the deployed Apps Script web app: same envelope protocol, same router and service,
 * rows held in memory (reset on restart). `pnpm --filter @projectflow/sheets dev`.
 */
import { createServer } from 'node:http';
import { MemoryStore } from './memory-store';
import { handle, type Envelope } from './router';
import { seedStore } from './seed';
import { Api } from './api';

const port = Number(process.env.PORT ?? 3200);
const token = process.env.API_TOKEN;
const store = new MemoryStore();
seedStore(store);
const api = new Api(store);

const readBody = (req: import('node:http').IncomingMessage) =>
  new Promise<string>(resolve => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => resolve(d)); });

createServer(async (req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Content-Type': 'application/json; charset=utf-8' };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers).end(); return; }
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  let envelope: Envelope;
  try {
    if (req.method === 'POST') {
      const p = JSON.parse(await readBody(req));
      envelope = token && p.token !== token
        ? { ok: false, status: 401, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API token.' } }
        : handle(api, { method: p.method, path: p.path, body: p.body, user: p.user });
    } else if (url.searchParams.get('path')) {
      envelope = token && url.searchParams.get('token') !== token
        ? { ok: false, status: 401, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API token.' } }
        : handle(api, { method: 'GET', path: url.searchParams.get('path')!, user: url.searchParams.get('user') ?? undefined });
    } else {
      envelope = { ok: true, status: 200, data: { name: 'Project Flow sheets API (local simulator)' } };
    }
  } catch {
    envelope = { ok: false, status: 400, error: { code: 'BAD_REQUEST', message: 'Body must be JSON.' } };
  }
  res.writeHead(200, headers).end(JSON.stringify(envelope));
}).listen(port, () => console.log(`Local sheets API simulator on http://localhost:${port}/exec  (sheets: ${store.sheetNames().join(', ')})`));
