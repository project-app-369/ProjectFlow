import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { COLUMNS, SHEET } from '../../sheets/src/datasets';
import { MemoryStore, type StoreSnapshot } from '../../sheets/src/memory-store';
import { seedData } from '../../sheets/src/seed-data';
import { seedStore } from '../../sheets/src/seed';
import { connectWithRetry, createPool, migrate, readSnapshot, withWriteLock, writeSnapshot } from './db';

export async function loadArchive(input: string): Promise<StoreSnapshot> {
  if (input === '--seed') {
    const store = new MemoryStore();
    seedStore(store, seedData);
    return store.snapshot();
  }
  const path = resolve(input);
  if (!path.endsWith('.json')) throw new Error('The import source must be a JSON archive or --seed.');
  const archive = JSON.parse(await readFile(path, 'utf8')) as StoreSnapshot;
  upgradeArchive(archive);
  validate(archive);
  return archive;
}

/** Add columns introduced after the archive was written, so an older archive still loads. */
export function upgradeArchive(archive: StoreSnapshot) {
  for (const [key, name] of Object.entries(SHEET)) {
    const sheet = archive.sheets.find(s => s.name === name);
    if (!sheet) continue;
    const expected = COLUMNS[key as keyof typeof COLUMNS];
    for (const column of expected) {
      if (sheet.header.includes(column.key)) continue;
      sheet.header.push(column.key);
      for (const row of sheet.rows) row[column.key] = null;
    }
  }
}

export function validate(archive: StoreSnapshot) {
  if (!archive || !Array.isArray(archive.sheets) || !archive.sheets.length) throw new Error('The import archive has no sheets.');
  const seen = new Set<string>();
  for (const sheet of archive.sheets) {
    if (!sheet.name || seen.has(sheet.name) || !Number.isInteger(sheet.gid) || !Array.isArray(sheet.header) || !Array.isArray(sheet.rows)) throw new Error(`Invalid or duplicate sheet: ${sheet.name}`);
    if (new Set(sheet.header).size !== sheet.header.length) throw new Error(`Duplicate columns in ${sheet.name}.`);
    if (sheet.rows.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error(`Invalid rows in ${sheet.name}.`);
    seen.add(sheet.name);
  }
  if (!seen.has(SHEET.projects) || !seen.has(SHEET.users)) throw new Error('The archive must include Projects and Users.');
  for (const [key, name] of Object.entries(SHEET)) {
    const sheet = archive.sheets.find(s => s.name === name);
    if (!sheet) continue;
    const expected = COLUMNS[key as keyof typeof COLUMNS];
    if (expected && expected.some(c => !sheet.header.includes(c.key))) throw new Error(`Missing expected columns in ${name}.`);
  }
}

if (process.argv[1] && /(?:^|[/\\])import\.(?:ts|js)$/.test(process.argv[1])) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: pnpm --filter @projectflow/api-v2 db:import <archive.json|--seed>');
  const archive = await loadArchive(source);
  const pool = createPool();
  try {
    const client = await connectWithRetry(pool);
    try {
      await client.query('begin');
      await migrate(client);
      await withWriteLock(client);
      const before = await readSnapshot(client);
      if (before.sheets.length && process.env.REPLACE_SUPABASE_DATA !== 'true') throw new Error('Supabase already has data. Set REPLACE_SUPABASE_DATA=true only after verifying a backup.');
      await writeSnapshot(client, before, archive);
      const rows = archive.sheets.reduce((n, sheet) => n + sheet.rows.length, 0);
      await client.query('insert into projectflow_v2.imports (source, sheet_count, row_count, sha256) values ($1, $2, $3, $4)', [source, archive.sheets.length, rows, createHash('sha256').update(JSON.stringify(archive)).digest('hex')]);
      await client.query('commit');
      console.log(`Imported ${archive.sheets.length} sheets and ${rows} rows to Supabase.`);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  } finally { await pool.end(); }
}
