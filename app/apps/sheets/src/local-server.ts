/**
 * Local stand-in for the deployed Apps Script web app: same envelope protocol, same router and service,
 * rows held in memory (reset on restart). `pnpm --filter @projectflow/sheets dev`.
 */
import { createServer } from 'node:http';
import { MemoryStore } from './memory-store';
import { handle, handleBatch, type Envelope } from './router';
import { COLUMNS, SHEET } from './datasets';
import { hashPassword } from './hash';
import { seedStore } from './seed';
import { seedData } from './seed-data';
import { Api } from './api';

const port = Number(process.env.PORT ?? 3200);
const token = process.env.API_TOKEN;
const store = new MemoryStore();
seedStore(store, seedData);
// With SESSION_SECRET the simulator asks for passwords; DEV_PASSWORD gives every seeded account one so the screens can be tried (the data resets on restart).
if (process.env.SESSION_SECRET && process.env.DEV_PASSWORD) {
  for (const u of store.readRows(SHEET.users, COLUMNS.users)) store.updateRow(SHEET.users, COLUMNS.users, 'id', String(u.id), { passwordHash: hashPassword(process.env.DEV_PASSWORD, String(u.id)), passwordChangedAt: new Date().toISOString() });
}
// No mail goes out from the simulator; each message is printed so reminders can be checked.
// SESSION_SECRET switches the simulator to password sign-in, like a deployment that requires it; without it the demo user picker is used.
const api = new Api(store, () => new Date(), { send: (to, subject) => console.log(`[mail] to ${to.join(', ')} | ${subject}`) }, process.env.SESSION_SECRET ? { secret: process.env.SESSION_SECRET } : undefined);

const readBody = (req: import('node:http').IncomingMessage) =>
  new Promise<string>(resolve => { let d = ''; req.on('data', c => (d += c)); req.on('end', () => resolve(d)); });

createServer(async (req, res) => {
  const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type', 'Content-Type': 'application/json; charset=utf-8' };
  if (req.method === 'OPTIONS') { res.writeHead(204, headers).end(); return; }
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  let envelope: Envelope | Envelope[];
  try {
    if (req.method === 'POST') {
      const p = JSON.parse(await readBody(req));
      if (token && p.token !== token) {
        envelope = { ok: false, status: 401, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API token.' } };
      } else if (p.method === 'BATCH' && Array.isArray(p.requests)) {
        // Batch: run multiple requests in one round trip
        const reqs = (p.requests as { method?: string; path: string }[]).map(r => ({
          method: r.method ?? 'GET', path: r.path, user: p.user, session: p.session,
        }));
        envelope = handleBatch(api, reqs);
      } else {
        envelope = handle(api, { method: p.method, path: p.path, body: p.body, user: p.user, session: p.session });
      }
    } else if (url.searchParams.get('path')) {
      envelope = token && url.searchParams.get('token') !== token
        ? { ok: false, status: 401, error: { code: 'UNAUTHORIZED', message: 'Missing or invalid API token.' } }
        : handle(api, { method: 'GET', path: url.searchParams.get('path')!, user: url.searchParams.get('user') ?? undefined, session: url.searchParams.get('session') ?? undefined });
    } else {
      envelope = { ok: true, status: 200, data: { name: 'Project Flow sheets API (local simulator)' } };
    }
  } catch {
    envelope = { ok: false, status: 400, error: { code: 'BAD_REQUEST', message: 'Body must be JSON.' } };
  }
  res.writeHead(200, headers).end(JSON.stringify(envelope));
}).listen(port, () => console.log(`Local sheets API simulator on http://localhost:${port}/exec  (sheets: ${store.sheetNames().join(', ')})`));
