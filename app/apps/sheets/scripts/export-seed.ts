/**
 * Writes each dataset sheet as {header, rows} JSON (blank cells as null) from the same seed the Apps Script
 * `setup` function loads. Usage: tsx scripts/export-seed.ts <output-dir>
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryStore } from '../src/memory-store';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';

const out = process.argv[2];
if (!out) throw new Error('Usage: tsx scripts/export-seed.ts <output-dir>');
mkdirSync(out, { recursive: true });

const store = new MemoryStore();
seedStore(store, seedData);

// Every dataset that has a sheet, so a pre-filled spreadsheet matches what `setup` creates.
const sheets = (Object.keys(COLUMNS) as (keyof typeof COLUMNS)[])
  .filter(k => k in SHEET)
  .map(k => [k, SHEET[k as keyof typeof SHEET], COLUMNS[k]] as const);

for (const [file, name, columns] of sheets) {
  const rows = store.readRows(name, [...columns]).map(r => columns.map(c => r[c.key] ?? null));
  const payload = { sheet: name, header: columns.map(c => c.key), types: columns.map(c => c.type), rows };
  writeFileSync(join(out, `${file}.json`), JSON.stringify(payload));
  console.log(`${name}: ${rows.length} rows × ${columns.length} columns, ${JSON.stringify(payload).length} bytes`);
}
