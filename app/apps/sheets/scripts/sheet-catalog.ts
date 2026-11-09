/**
 * Prints a Markdown table of every worksheet: its name, its columns with types, and how many rows the seed loads.
 * Used to keep docs/ProjectFlow_prebuild_database.md in step with the code. Usage: tsx scripts/sheet-catalog.ts
 */
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryStore } from '../src/memory-store';
import type { Column } from '../src/store';
import { seedStore } from '../src/seed';

const store = new MemoryStore();
seedStore(store);

const keys = Object.keys(SHEET) as (keyof typeof SHEET)[];
console.log('| Sheet | Rows seeded | Columns (in order; type if not text) |\n|---|---|---|');
for (const k of keys) {
  const columns = COLUMNS[k as keyof typeof COLUMNS] as readonly Column[] | undefined;
  if (!columns) continue;
  const rows = store.readRows(SHEET[k], [...columns]).length;
  const cols = columns.map(c => (c.type === 'text' ? `\`${c.key}\`` : `\`${c.key}\` (${c.type})`)).join(', ');
  console.log(`| \`${SHEET[k]}\` | ${rows} | ${cols} |`);
}
