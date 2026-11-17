import { Api } from '../../sheets/src/api';
import { MemoryStore } from '../../sheets/src/memory-store';
import { handle } from '../../sheets/src/router';
import { createPool, readSnapshot } from './db';

const pool = createPool();
try {
  const client = await pool.connect();
  try {
    const snapshot = await readSnapshot(client);
    const rows = snapshot.sheets.reduce((count, sheet) => count + sheet.rows.length, 0);
    const latest = await client.query<{ sheet_count: number; row_count: number }>('select sheet_count, row_count from projectflow_v2.imports order by id desc limit 1');
    if (latest.rows.length !== 1 || latest.rows[0].sheet_count !== snapshot.sheets.length || latest.rows[0].row_count !== rows) {
      throw new Error('Database rows do not match the latest import audit record.');
    }
    const store = new MemoryStore(process.env.BACKUP_SHEET_URL);
    store.loadSnapshot(snapshot);
    const api = new Api(store);
    const routes = ['/directory', '/projects', '/projects/sttp2b/dashboard', '/projects/sttp2b/cpn', '/projects/sttp2b/procurement/dashboard', '/projects/sttp2b/issues'];
    for (const path of routes) {
      const result = handle(api, { method: 'GET', path, user: 'u-admin' });
      if (!result.ok) throw new Error(`${path}: ${result.status} ${result.error.code}`);
    }
    console.log(`Verified Supabase: ${snapshot.sheets.length} sheets, ${rows} rows, ${routes.length} API routes.`);
  } finally { client.release(); }
} finally { await pool.end(); }
