/**
 * API v2 on an embedded PostgreSQL (PGlite) instead of Supabase: `pnpm --filter @projectflow/api-v2 dev:local`.
 *
 * The data lives in apps/api-v2/.local-db. On first start it is filled from the live-Sheet archive in the repository's `.tmp/`
 * (projectflow-live-archive.json) when that exists, otherwise from the demo seed, and the facility equipment list is loaded and the
 * Facility Layout module switched on. After that, what you add, edit and delete stays in the database between runs. Point
 * SUPABASE_DB_URL at Supabase and use `dev` instead to run against the real database.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryStore } from '../../sheets/src/memory-store';
import { appendSeedFacilityEquipment, enableModuleChain, ensureAllSheets } from '../../sheets/src/seed';
import { seedData } from '../../sheets/src/seed-data';
import { createLocalPool, migrate, readSnapshot, withWriteLock, writeSnapshot } from './db';
import { loadArchive } from './import';

const dir = resolve(process.env.LOCAL_PGLITE_DIR ?? '.local-db');
process.env.LOCAL_PGLITE_DIR = dir;
process.env.API_V2_TOKEN ??= 'local-dev-token';

const pool = createLocalPool(dir);
const client = await pool.connect();
try {
  await client.query('begin');
  await migrate(client);
  await withWriteLock(client);
  const before = await readSnapshot(client);
  const archivePath = resolve('../../../.tmp/projectflow-live-archive.json');
  const source = before.sheets.length ? null : existsSync(archivePath) ? archivePath : '--seed';
  const store = new MemoryStore(process.env.BACKUP_SHEET_URL);
  store.loadSnapshot(source ? await loadArchive(source) : before);
  ensureAllSheets(store);
  const loaded = appendSeedFacilityEquipment(store, seedData);
  if (loaded) enableModuleChain(store, 'construction.facility-layout'); // the feature arrives with its data
  const after = store.snapshot();
  if (source || loaded) {
    await writeSnapshot(client, before, after);
    const rows = after.sheets.reduce((n, s) => n + s.rows.length, 0);
    await client.query('insert into projectflow_v2.imports (source, sheet_count, row_count, sha256) values ($1, $2, $3, $4)',
      [source ? `local:${source}` : 'local:facility-equipment', after.sheets.length, rows, createHash('sha256').update(JSON.stringify(after)).digest('hex')]);
    console.log(`Local database ${source ? `filled from ${source === '--seed' ? 'the demo seed' : 'the live-Sheet archive'}` : 'updated'}${loaded ? `, ${loaded} facility equipment loaded` : ''}.`);
  }
  await client.query('commit');
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  client.release();
}

await import('./server');
