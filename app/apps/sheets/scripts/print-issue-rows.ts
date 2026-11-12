// Prints the seeded issue and log rows as JSON arrays (header first), for loading into a live spreadsheet.
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryStore } from '../src/memory-store';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';

const store = new MemoryStore();
seedStore(store, seedData);
const dump = (name: string, columns: readonly { key: string }[]) => [columns.map(c => c.key), ...store.readRows(name, [...columns] as never).map(r => columns.map(c => r[c.key] ?? ''))];
const which = process.argv[2];
console.log(JSON.stringify(which === 'log' ? dump(SHEET.issueLog, COLUMNS.issueLog) : dump(SHEET.issues, COLUMNS.issues)));
