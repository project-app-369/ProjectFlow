/**
 * Brings the reference data in Supabase up to the current seed (apps/api/seed/sttp2b.json, written by the extractors)
 * without touching what people enter in the app: users, memberships, tasks, issues, risks, interfaces, lessons and the
 * other registers stay as they are.
 *
 * Dry run by default: prints what would change. `--apply` writes it in one transaction under the API write lock, after
 * saving the previous rows to a JSON backup, and records an audit row so `db:verify` keeps matching.
 */
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { COLUMNS, SHEET } from '../../sheets/src/datasets';
import { MemoryStore, type StoreSnapshot } from '../../sheets/src/memory-store';
import { appendSeedBudget, appendSeedFacilityEquipment, enableModuleChain, ensureAllSheets, seedRows } from '../../sheets/src/seed';
import { seedData } from '../../sheets/src/seed-data';
import { connectWithRetry, createPool, readSnapshot, withWriteLock, writeSnapshot } from './db';

/** Datasets that only the extractors produce: replaced row for row for the project. */
export const REFERENCE = [
  'scurve', 'scurveWeekly', 'workPackages', 'milestones', 'procurement', 'expediting', 'logistics', 'materialBalance',
  'materialSummary', 'procCurves', 'facilityCurves', 'facilityScopes', 'facilityWbs', 'workingSchedule', 'cpnItems', 'phaseProgress',
] as const satisfies readonly (keyof typeof SHEET & keyof typeof COLUMNS)[];

export interface Change { dataset: string; before: number; after: number }

/** Applies the seed's reference rows to the store; returns the datasets whose rows changed. */
export function refreshStore(store: MemoryStore, raw = seedData, now = new Date().toISOString()): Change[] {
  const rows = seedRows(raw) as unknown as Record<string, Record<string, unknown>[]>;
  const pid = String((rows.project[0] as { id?: string }).id ?? 'sttp2b');
  const changes: Change[] = [];
  ensureAllSheets(store); // new worksheets and columns (access, sign-in) that a database loaded earlier does not have yet
  for (const key of REFERENCE) {
    const name = SHEET[key], columns = COLUMNS[key];
    store.ensureSheet(name, columns);
    store.addMissingColumns(name, columns);
    const current = store.readRows(name, columns).filter(r => r.projectId === pid);
    // round-trip through a scratch store so the comparison sees the values as the store keeps them (trimmed, typed)
    const scratch = new MemoryStore();
    scratch.ensureSheet(name, columns);
    scratch.appendRows(name, columns, (rows[key] ?? []).map(r => ({ projectId: pid, ...r })) as never);
    const next = scratch.readRows(name, columns);
    const same = (a: Record<string, unknown>[], b: Record<string, unknown>[]) =>
      JSON.stringify(a.map(r => columns.map(c => r[c.key] ?? null))) === JSON.stringify(b.map(r => columns.map(c => r[c.key] ?? null)));
    if (same(current, next)) continue;
    store.deleteRows(name, columns, { projectId: pid });
    store.appendRows(name, columns, next as never);
    changes.push({ dataset: name, before: current.length, after: next.length });
  }
  // Facility equipment is kept by people in the app (add, edit, delete), so it is only loaded once, while the project has none.
  const seeded = appendSeedFacilityEquipment(store, raw, now);
  if (seeded) {
    changes.push({ dataset: `${SHEET.facilityEquipment} (loaded once, then kept in the app)`, before: 0, after: seeded });
    // the feature arrives with its data: switch it on, and the Construction group above it, where an older database has them Disabled
    for (const key of enableModuleChain(store, 'construction.facility-layout', now)) changes.push({ dataset: `${SHEET.modules} (${key}: Disabled → Enabled)`, before: 1, after: 1 });
  }
  // The construction budget carries hours that people correct in the app, so it is loaded once, while the project has none.
  const budget = appendSeedBudget(store, raw, now);
  if (budget) {
    changes.push({ dataset: `${SHEET.budget} (loaded once, then kept in the app)`, before: 0, after: budget });
    for (const key of enableModuleChain(store, 'construction.budget', now)) changes.push({ dataset: `${SHEET.modules} (${key}: Disabled → Enabled)`, before: 1, after: 1 });
  }
  const project = rows.project[0] as { cutoff?: string };
  const was = store.readRows(SHEET.projects, COLUMNS.projects).find(p => p.id === pid);
  if (was && project.cutoff && was.cutoff !== project.cutoff) {
    store.updateRow(SHEET.projects, COLUMNS.projects, 'id', pid, { cutoff: project.cutoff, updatedAt: now });
    changes.push({ dataset: `${SHEET.projects} (cut-off ${was.cutoff} → ${project.cutoff})`, before: 1, after: 1 });
  }
  return changes;
}

const count = (s: StoreSnapshot) => s.sheets.reduce((n, sheet) => n + sheet.rows.length, 0);

async function main() {
  const apply = process.argv.includes('--apply');
  const pool = createPool();
  const client = await connectWithRetry(pool);
  try {
    await client.query(apply ? 'begin' : 'begin isolation level repeatable read read only');
    if (apply) await withWriteLock(client);
    const before = await readSnapshot(client);
    if (!before.sheets.length) throw new Error('Supabase has no data; run db:import first.');
    const store = new MemoryStore();
    store.loadSnapshot(before);
    const changes = refreshStore(store);
    const after = store.snapshot();
    for (const c of changes) console.log(`${apply ? 'updated' : 'would update'}  ${c.dataset}: ${c.before} → ${c.after} rows`);
    if (!changes.length) console.log('Supabase reference data already matches the seed.');
    if (!apply || !changes.length) { await client.query('rollback'); if (!apply && changes.length) console.log('\nDry run. Re-run with --apply to write.'); return; }

    const backup = resolve(process.env.REFRESH_BACKUP ?? `../../../.tmp/supabase-before-refresh-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
    await mkdir(dirname(backup), { recursive: true });
    await writeFile(backup, JSON.stringify(before));
    await writeSnapshot(client, before, after);
    await client.query('insert into projectflow_v2.imports (source, sheet_count, row_count, sha256) values ($1, $2, $3, $4)',
      ['seed-refresh:apps/api/seed/sttp2b.json', after.sheets.length, count(after), createHash('sha256').update(JSON.stringify(after)).digest('hex')]);
    await client.query('commit');
    console.log(`\nCommitted ${changes.length} dataset changes. Previous rows saved to ${backup}.`);
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1]?.replace(/\\/g, '/').endsWith('src/refresh.ts')) await main();
