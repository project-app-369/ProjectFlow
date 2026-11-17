import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SHEET } from '../../sheets/src/datasets';
import type { StoreSnapshot } from '../../sheets/src/memory-store';

const url = process.env.GOOGLE_SHEETS_EXEC_URL;
const token = process.env.GOOGLE_SHEETS_API_TOKEN;
if (!url || !token) throw new Error('GOOGLE_SHEETS_EXEC_URL and GOOGLE_SHEETS_API_TOKEN are required.');
const output = resolve(process.argv[2] ?? '../../../.tmp/projectflow-sheets-backup.json');
const sheets: StoreSnapshot['sheets'] = [];
for (const key of Object.keys(SHEET) as (keyof typeof SHEET)[]) {
  let offset = 0;
  let total = 0;
  const rows: Record<string, string | number | null>[] = [];
  let gid: number | null = null;
  let header: string[] = [];
  do {
    const endpoint = new URL(url);
    endpoint.searchParams.set('path', `/admin/export?dataset=${key}&offset=${offset}`);
    endpoint.searchParams.set('user', 'u-admin');
    endpoint.searchParams.set('token', token);
    const response = await fetch(endpoint);
    const envelope = await response.json() as { ok: boolean; error?: { message: string }; data?: { sheet: string; gid: number | null; header: string[]; rows: typeof rows; total: number } };
    if (!envelope.ok || !envelope.data) throw new Error(`${key}: ${envelope.error?.message ?? 'Export failed.'}`);
    ({ gid, header, total } = envelope.data);
    rows.push(...envelope.data.rows);
    offset = rows.length;
  } while (offset < total);
  if (gid !== null) sheets.push({ name: SHEET[key], gid, header, rows });
  console.log(`${key}: ${rows.length} rows`);
}
await mkdir(resolve(output, '..'), { recursive: true });
await writeFile(output, JSON.stringify({ sheets } satisfies StoreSnapshot));
console.log(`Saved a read-only Sheet archive to ${output}`);
