/** Project Flow API v3 for Supabase Edge Functions. The Sheet remains the rollback backup. */
// Supabase's Deno runtime resolves npm: imports at deployment time.
// @ts-ignore Deno specifier is resolved by Supabase, not the local TypeScript compiler.
import postgres from 'npm:postgres@3.4.7';
import { handleAi } from '../../sheets/src/ai';
import { Api } from '../../sheets/src/api';
import { MemoryStore, type StoreSnapshot } from '../../sheets/src/memory-store';
import { noMailer } from '../../sheets/src/mailer';
import { handle, handleBatch, type ApiRequest, type Envelope } from '../../sheets/src/router';

declare const Deno: { env: { get(name: string): string | undefined } };

const connectionString = Deno.env.get('SUPABASE_DB_URL');
if (!connectionString) throw new Error('Supabase did not provide SUPABASE_DB_URL.');
const sql = postgres(connectionString, { prepare: false, max: 1, idle_timeout: 10, connect_timeout: 10 });
// When SESSION_SECRET is set (supabase secrets set SESSION_SECRET=...), sign-in with a password is required and a stated user is ignored.
const sessionSecret = Deno.env.get('SESSION_SECRET');
// The AI helpers of Issues, Risks and Concerns (supabase secrets set OPENAI_API_KEY=... OPENAI_MODEL=...): without a key they report that they are not set up.
const ai = { apiKey: Deno.env.get('OPENAI_API_KEY'), model: Deno.env.get('OPENAI_MODEL'), baseUrl: Deno.env.get('OPENAI_BASE_URL') };
const backupSheet = 'https://docs.google.com/spreadsheets/d/1CTkxAb2HEhjLEIoz0EAQHN1qm4VF4Sg6mwoorClnKQY/edit';
const headers = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-headers': 'content-type',
};
const fail = (status: number, code: string, message: string): Envelope => ({ ok: false, status, error: { code, message } });

type Tx = { unsafe(query: string, params?: unknown[]): Promise<Record<string, any>[]>; json(value: unknown): unknown };

async function readSnapshot(tx: Tx): Promise<StoreSnapshot> {
  const datasets = await tx.unsafe('select name, gid, header from projectflow_v2.datasets order by gid');
  const rows = await tx.unsafe('select dataset, data from projectflow_v2.dataset_rows order by dataset, position');
  const byName = new Map(datasets.map(s => [String(s.name), { name: String(s.name), gid: Number(s.gid), header: s.header as string[], rows: [] as StoreSnapshot['sheets'][number]['rows'] }]));
  for (const row of rows) byName.get(String(row.dataset))?.rows.push(row.data);
  return { sheets: [...byName.values()] };
}

async function writeSnapshot(tx: Tx, before: StoreSnapshot, after: StoreSnapshot) {
  const old = new Map(before.sheets.map(s => [s.name, s]));
  for (const sheet of after.sheets) {
    if (JSON.stringify(old.get(sheet.name)) === JSON.stringify(sheet)) continue;
    await tx.unsafe(
      `insert into projectflow_v2.datasets (name, gid, header) values ($1, $2, $3::jsonb)
       on conflict (name) do update set gid = excluded.gid, header = excluded.header, updated_at = now()`,
      [sheet.name, sheet.gid, tx.json(sheet.header)],
    );
    await tx.unsafe('delete from projectflow_v2.dataset_rows where dataset = $1', [sheet.name]);
    for (let offset = 0; offset < sheet.rows.length; offset += 250) {
      await tx.unsafe(
        `insert into projectflow_v2.dataset_rows (dataset, position, data)
         select $1, $2 + ordinality - 1, value from jsonb_array_elements($3::jsonb) with ordinality`,
        [sheet.name, offset, tx.json(sheet.rows.slice(offset, offset + 250))],
      );
    }
  }
}

interface Payload extends Partial<ApiRequest> { requests?: { path: string }[]; session?: string }
async function serve(payload: Payload): Promise<Envelope | Envelope[]> {
  const batch = payload.method === 'BATCH' && Array.isArray(payload.requests);
  const requests: ApiRequest[] = batch
    ? (payload.requests ?? []).slice(0, 20).map(r => ({ method: 'GET', path: r.path, user: payload.user, session: payload.session }))
    : [{ method: payload.method ?? 'GET', path: payload.path ?? '', body: payload.body, user: payload.user, session: payload.session }];
  if (!requests.length || requests.some(r => !r.path.startsWith('/'))) return fail(400, 'BAD_REQUEST', 'An absolute API path is required.');
  if (requests.some(r => /\/remind(?:-due)?(?:\?|$)/.test(r.path))) return fail(403, 'OWNER_ONLY', 'Email reminders remain with the Sheet owner.');
  const writing = requests.some(r => r.method !== 'GET');
  return sql.begin(async (tx: Tx) => {
    if (writing) await tx.unsafe('select pg_advisory_xact_lock(723945113)');
    else await tx.unsafe('set transaction isolation level repeatable read read only');
    const before = await readSnapshot(tx);
    if (!before.sheets.length) return fail(503, 'MIGRATION_REQUIRED', 'Project Flow data has not been imported.');
    const store = new MemoryStore(backupSheet);
    store.loadSnapshot(before);
    const api = new Api(store, () => new Date(), noMailer, sessionSecret ? { secret: sessionSecret } : undefined);
    let result = batch ? handleBatch(api, requests) : handle(api, requests[0]);
    if (!batch && requests[0].path === '/health' && !Array.isArray(result) && result.ok) {
      result = { ok: true, status: 200, data: { status: 'ok', database: 'supabase', api: 'v3', backupSpreadsheet: backupSheet } };
    }
    if (writing && !Array.isArray(result) && result.ok) await writeSnapshot(tx, before, store.snapshot());
    return result;
  });
}

export default {
  async fetch(request: Request) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'GET' && request.method !== 'POST') return new Response(JSON.stringify(fail(405, 'METHOD_NOT_ALLOWED', 'Use GET or POST.')), { status: 405, headers });
    try {
      const url = new URL(request.url);
      const payload = request.method === 'POST'
        ? await request.json() as Payload
        : { method: 'GET', path: url.searchParams.get('path') ?? '', user: url.searchParams.get('user') ?? undefined, session: url.searchParams.get('session') ?? undefined };
      const result = (await handleAi(payload, async r => { const out = await serve(r); return Array.isArray(out) ? out[0] : out; }, ai)) ?? await serve(payload);
      return new Response(JSON.stringify(result), { status: 200, headers });
    } catch (error) {
      return new Response(JSON.stringify(fail(500, 'API_V3_ERROR', error instanceof Error ? error.message : 'Unexpected error.')), { status: 200, headers });
    }
  },
};
