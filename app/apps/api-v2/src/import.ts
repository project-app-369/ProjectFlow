import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { COLUMNS, SHEET } from '../../sheets/src/datasets';
import { MemoryStore, type StoreSnapshot } from '../../sheets/src/memory-store';
import { seedData } from '../../sheets/src/seed-data';
import { seedStore } from '../../sheets/src/seed';
import { createPool, migrate, readSnapshot, withWriteLock, writeSnapshot } from './db';

export async function loadArchive(input: string): Promise<StoreSnapshot> {
  if (input === '--seed') {
    const store = new MemoryStore();
    seedStore(store, seedData);
    return store.snapshot();
  }
  const path = resolve(input);
  if (path.endsWith('.json')) {
    const archive = JSON.parse(await readFile(path, 'utf8')) as StoreSnapshot;
    upgradeArchive(archive);
    validate(archive);
    return archive;
  }
  const sheets: StoreSnapshot['sheets'] = [];
  const names = new Set(await readdir(path));
  for (const [key, name] of Object.entries(SHEET)) {
    const file = join(path, `${key}.json`);
    if (!names.has(`${key}.json`)) continue;
    const exportData = JSON.parse(await readFile(file, 'utf8')) as { sheet: string; header: string[]; rows: unknown[][] };
    if (exportData.sheet !== name) throw new Error(`${file}: sheet name does not match ${name}.`);
    sheets.push({ name, gid: 1000 + sheets.length, header: exportData.header, rows: exportData.rows.map(cells => Object.fromEntries(exportData.header.map((column, i) => [column, cells[i] ?? null])) as never) });
  }
  const archive = { sheets };
  upgradeArchive(archive);
  validate(archive);
  return archive;
}

/** Add columns introduced after the live worksheet was created, without changing the Sheet itself. */
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
  if (!seen.has(SHEET.projects) || !seen.has(SHEET.users)) throw new Error('The archive must include Projects and Users from the live Sheet.');
  for (const [key, name] of Object.entries(SHEET)) {
    const sheet = archive.sheets.find(s => s.name === name);
    if (!sheet) continue;
    const expected = COLUMNS[key as keyof typeof COLUMNS];
    if (expected && expected.some(c => !sheet.header.includes(c.key))) throw new Error(`Missing expected columns in ${name}.`);
  }
}

if (process.argv[1] && /(?:^|[/\\])import\.(?:ts|js)$/.test(process.argv[1])) {
  const source = process.argv[2];
  if (!source) throw new Error('Usage: pnpm --filter @projectflow/api-v2 db:import <sheet-export-dir|archive.json|--seed>');
  const archive = await loadArchive(source);
  const pool = createPool();
  try {
    const client = await pool.connect();
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
      console.log(`Imported ${archive.sheets.length} sheets and ${rows} rows to Supabase. Google Sheets was not changed.`);
    } catch (error) {
      await client.query('rollback').catch(() => undefined);
      throw error;
    } finally { client.release(); }
  } finally { await pool.end(); }
}
