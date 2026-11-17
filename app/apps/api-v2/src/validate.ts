import { loadArchive } from './import';

const source = process.argv[2];
if (!source) throw new Error('Usage: pnpm --filter @projectflow/api-v2 db:validate <archive.json>');
const archive = await loadArchive(source);
console.log(`Validated ${archive.sheets.length} sheets and ${archive.sheets.reduce((n, s) => n + s.rows.length, 0)} rows.`);
