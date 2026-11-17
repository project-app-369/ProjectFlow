import { readFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool, type PoolClient } from 'pg';
import type { StoreSnapshot } from '../../sheets/src/memory-store';

export function createPool() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) throw new Error('SUPABASE_DB_URL is required; API v2 cannot fall back to another database.');
  const caPath = process.env.SUPABASE_CA_CERT ?? fileURLToPath(new URL('../certs/prod-ca-2021.crt', import.meta.url));
  return new Pool({ connectionString, ssl: { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true }, max: Number(process.env.PG_POOL_SIZE ?? 5), connectionTimeoutMillis: 10_000, idleTimeoutMillis: 10 * 60_000, keepAlive: true });
}

export async function migrate(client: PoolClient) {
  const sql = await readFile(join(fileURLToPath(new URL('../sql/', import.meta.url)), '001_dataset_store.sql'), 'utf8');
  await client.query(sql);
}

export async function readSnapshot(client: PoolClient): Promise<StoreSnapshot> {
  const [datasets, rows] = await Promise.all([
    client.query<{ name: string; gid: number; header: string[] }>('select name, gid, header from projectflow_v2.datasets order by gid'),
    client.query<{ dataset: string; data: Record<string, string | number | null> }>('select dataset, data from projectflow_v2.dataset_rows order by dataset, position'),
  ]);
  const byName = new Map(datasets.rows.map(s => [s.name, { ...s, rows: [] as typeof rows.rows[number]['data'][] }]));
  for (const row of rows.rows) byName.get(row.dataset)?.rows.push(row.data);
  return { sheets: [...byName.values()] };
}

/**
 * A cheap token that changes whenever any dataset is written: writeSnapshot stamps `updated_at` on every changed
 * dataset and deletes removed ones, so the count and latest stamp move together. Lets a server reuse its last snapshot.
 */
export async function datasetVersion(client: PoolClient): Promise<string> {
  const { rows } = await client.query<{ n: string; at: string | null }>('select count(*)::text as n, max(updated_at)::text as at from projectflow_v2.datasets');
  return `${rows[0].n}@${rows[0].at ?? ''}`;
}

/** Called inside one transaction after the writer has taken the advisory lock. */
export async function writeSnapshot(client: PoolClient, before: StoreSnapshot, after: StoreSnapshot) {
  const old = new Map(before.sheets.map(s => [s.name, s]));
  const next = new Set(after.sheets.map(s => s.name));
  for (const sheet of after.sheets) {
    if (JSON.stringify(old.get(sheet.name)) === JSON.stringify(sheet)) continue;
    await client.query(
      `insert into projectflow_v2.datasets (name, gid, header) values ($1, $2, $3::jsonb)
       on conflict (name) do update set gid = excluded.gid, header = excluded.header, updated_at = now()`,
      [sheet.name, sheet.gid, JSON.stringify(sheet.header)],
    );
    await client.query('delete from projectflow_v2.dataset_rows where dataset = $1', [sheet.name]);
    for (let offset = 0; offset < sheet.rows.length; offset += 250) {
      const batch = sheet.rows.slice(offset, offset + 250);
      await client.query(
        `insert into projectflow_v2.dataset_rows (dataset, position, data)
         select $1, $2 + ordinality - 1, value from jsonb_array_elements($3::jsonb) with ordinality`,
        [sheet.name, offset, JSON.stringify(batch)],
      );
    }
  }
  for (const sheet of before.sheets) {
    if (!next.has(sheet.name)) await client.query('delete from projectflow_v2.datasets where name = $1', [sheet.name]);
  }
}

export async function withWriteLock(client: PoolClient) {
  await client.query('select pg_advisory_xact_lock(723945113)');
}
