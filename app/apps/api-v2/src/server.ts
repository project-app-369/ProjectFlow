import { createServer, type IncomingMessage } from 'node:http';
import { promisify } from 'node:util';
import { gzip as gzipCb } from 'node:zlib';
import { Api } from '../../sheets/src/api';
import { MemoryStore } from '../../sheets/src/memory-store';
import { noMailer } from '../../sheets/src/mailer';
import { handle, handleBatch, type ApiRequest, type Envelope } from '../../sheets/src/router';
import { createPool, datasetVersion, readSnapshot, withWriteLock, writeSnapshot } from './db';
import type { StoreSnapshot } from '../../sheets/src/memory-store';

/**
 * The last snapshot read from PostgreSQL. `checkedAt` is when its version was last compared with the database: within
 * CACHE_TTL_MS a read trusts the cache without asking (this instance's own writes update it at once; another instance's
 * writes show up within the TTL). `generation` rises on every local write so a slow load that started earlier cannot put an older snapshot back.
 */
let cache: { version: string; snapshot: StoreSnapshot; checkedAt: number } | null = null;
let generation = 0;
let versionCheck: Promise<string> | null = null;
let loading: Promise<StoreSnapshot> | null = null;
const gzip = promisify(gzipCb);
/** When set, API v2 requires sign-in: requests carry a session token issued at login and a stated user is ignored. */
const sessionSecret = process.env.SESSION_SECRET;
const CACHE_TTL_MS = Number(process.env.CACHE_TTL_MS ?? 1500);

const token = process.env.API_V2_TOKEN;
if (!token) throw new Error('API_V2_TOKEN is required; API v2 must not be exposed without a server-side token.');
const port = Number(process.env.PORT ?? 3300);
const pool = createPool();
const sheetUrl = process.env.BACKUP_SHEET_URL ?? 'https://docs.google.com/spreadsheets/d/LOCAL-SIMULATOR/edit';
const corsOrigin = process.env.CORS_ORIGIN ?? '';
const fail = (status: number, code: string, message: string): Envelope => ({ ok: false, status, error: { code, message } });

async function bodyOf(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 2_000_000) throw new Error('Request body exceeds 2 MB.');
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

interface Payload extends Partial<ApiRequest> {
  token?: string;
  requests?: { method?: string; path: string }[];
}

async function serve(payload: Payload): Promise<Envelope | Envelope[]> {
  const batch = payload.method === 'BATCH' && Array.isArray(payload.requests);
  const requests: ApiRequest[] = batch
    ? (payload.requests ?? []).slice(0, 20).map(r => ({ method: 'GET', path: r.path, user: payload.user, session: payload.session }))
    : [{ method: payload.method ?? 'GET', path: payload.path ?? '', body: payload.body, user: payload.user, session: payload.session }];
  if (requests.some(r => !r.path.startsWith('/') || r.method === 'BATCH')) return fail(400, 'BAD_REQUEST', 'A method and absolute API path are required.');
  if (requests.some(r => /\/remind(?:-due)?(?:\?|$)/.test(r.path))) return fail(403, 'OWNER_ONLY', 'Email reminders remain with the Sheet owner.');
  const writing = requests.some(r => r.method.toUpperCase() !== 'GET');
  if (!writing) {
    const before = await freshSnapshot();
    if (!before.sheets.length) return fail(503, 'MIGRATION_REQUIRED', 'Import the Google Sheet archive into Supabase before using API v2.');
    return run(before, requests, batch).result;
  }
  const client = await pool.connect();
  let open = false;
  try {
    await client.query('begin');
    open = true;
    await withWriteLock(client);
    const version = await datasetVersion(client);
    const before = cache?.version === version ? cache.snapshot : await readSnapshot(client);
    if (!before.sheets.length) {
      await client.query('commit');
      open = false;
      return fail(503, 'MIGRATION_REQUIRED', 'Import the Google Sheet archive into Supabase before using API v2.');
    }
    const { result, store } = run(before, requests, batch);
    if (!Array.isArray(result) && result.ok) {
      const after = store.snapshot();
      generation++;
      cache = null;
      await writeSnapshot(client, before, after);
      // now() is the transaction's start time, so this is the version other instances see once it commits
      const next = await datasetVersion(client);
      await client.query('commit');
      open = false;
      cache = { version: next, snapshot: after, checkedAt: Date.now() };
    }
    if (open) await client.query('commit');
    return result;
  } catch (error) {
    if (open) await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/** Runs the routes against a copy of the snapshot (MemoryStore.loadSnapshot copies, so the cached one stays clean). */
function run(snapshot: StoreSnapshot, requests: ApiRequest[], batch: boolean) {
  const store = new MemoryStore(sheetUrl);
  store.loadSnapshot(snapshot);
  const api = new Api(store, () => new Date(), noMailer, sessionSecret ? { secret: sessionSecret } : undefined);
  let result = batch ? handleBatch(api, requests) : handle(api, requests[0]);
  if (!batch && requests[0].path === '/health' && !Array.isArray(result) && result.ok) {
    result = { ok: true, status: 200, data: { status: 'ok', database: 'supabase', api: 'v2', backupSpreadsheet: sheetUrl } };
  }
  return { result, store };
}

/** The dataset version, asked of PostgreSQL by one caller at a time however many reads arrive together. */
function currentVersion(): Promise<string> {
  versionCheck ??= pool.query<{ n: string; at: string | null }>('select count(*)::text as n, max(updated_at)::text as at from projectflow_v2.datasets')
    .then(r => `${r.rows[0].n}@${r.rows[0].at ?? ''}`)
    .finally(() => { versionCheck = null; });
  return versionCheck;
}

/** The snapshot for a read: the cached one while it is current, otherwise one shared load however many reads are waiting for it. */
async function freshSnapshot(): Promise<StoreSnapshot> {
  if (cache && Date.now() - cache.checkedAt < CACHE_TTL_MS) return cache.snapshot;
  const started = generation;
  const version = await currentVersion();
  if (cache && cache.version === version) { cache.checkedAt = Date.now(); return cache.snapshot; }
  loading ??= (async () => {
    const client = await pool.connect();
    try {
      await client.query('begin isolation level repeatable read read only');
      const v = await datasetVersion(client);
      const snapshot = await readSnapshot(client);
      await client.query('commit');
      if (generation === started) cache = { version: v, snapshot, checkedAt: Date.now() };
      return snapshot;
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally {
      client.release();
      loading = null;
    }
  })();
  return loading;
}

/** Opens a few connections now, so the first requests do not each pay for a TLS handshake to the database. */
async function warm() {
  const n = Math.min(Number(process.env.PG_POOL_WARM ?? 3), Number(process.env.PG_POOL_SIZE ?? 5));
  const clients = await Promise.all(Array.from({ length: n }, () => pool.connect()));
  clients.forEach(c => c.release());
  await freshSnapshot();
}
warm().catch(error => console.error('API v2 warm-up failed:', error instanceof Error ? error.message : error));

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${port}`);
  const headers: Record<string, string> = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
  if (corsOrigin) { headers['Access-Control-Allow-Origin'] = corsOrigin; headers['Access-Control-Allow-Headers'] = 'content-type, authorization'; }
  if (req.method === 'OPTIONS') { res.writeHead(corsOrigin ? 204 : 403, headers).end(); return; }
  if (url.pathname !== '/api/v2/exec') { res.writeHead(404, headers).end(JSON.stringify(fail(404, 'ROUTE_NOT_FOUND', 'Use /api/v2/exec.'))); return; }
  let result: Envelope | Envelope[];
  try {
    const payload = (req.method === 'POST'
      ? await bodyOf(req)
      : { method: 'GET', path: url.searchParams.get('path'), user: url.searchParams.get('user'), token: url.searchParams.get('token'), session: url.searchParams.get('session') }) as Payload;
    const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '') ?? payload.token;
    result = supplied === token ? await serve(payload) : fail(401, 'UNAUTHORIZED', 'Missing or invalid API v2 token.');
  } catch (error) {
    result = fail(500, 'API_V2_ERROR', error instanceof Error ? error.message : 'Unexpected error.');
  }
  // Existing Site clients expect the Apps Script envelope, including its status field.
  const body = Buffer.from(JSON.stringify(result));
  // the larger answers are tens of kilobytes of repetitive JSON: compressed they are a fraction of that over the wire
  if (body.length > 1024 && /gzip/.test(String(req.headers['accept-encoding'] ?? ''))) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' }).end(await gzip(body));
    return;
  }
  res.writeHead(200, headers).end(body);
}).listen(port, () => console.log(`Project Flow API v2 listening on http://localhost:${port}/api/v2/exec`));
