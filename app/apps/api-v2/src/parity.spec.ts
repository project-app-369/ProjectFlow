import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { Api } from '../../sheets/src/api';
import { COLUMNS, SHEET } from '../../sheets/src/datasets';
import { MemoryStore, type StoreSnapshot } from '../../sheets/src/memory-store';
import { handle } from '../../sheets/src/router';
import { seedStore } from '../../sheets/src/seed';
import { seedData } from '../../sheets/src/seed-data';
import { readSnapshot, writeSnapshot } from './db';
import { loadArchive } from './import';
import { refreshStore } from './refresh';

const P = '/projects/sttp2b';
/** The read routes of every module built on the Sheets backend; API v2 must answer each one exactly as the Sheets backend does. */
const READS = [
  '/health', '/me', '/modules', '/projects', '/users', '/directory', '/tasks', '/tasks/workload', '/access-log',
  `${P}/dashboard`, `${P}/modules`, `${P}/members`, `${P}/schedule/overall-progress`, `${P}/schedule/work-packages`,
  `${P}/facilities`, `${P}/facilities/cgf-topsides/progress`, `${P}/facility-timeline`, `${P}/cpn`,
  `${P}/milestones`, `${P}/milestones/summary`, `${P}/milestones/insights`,
  `${P}/procurement/summary`, `${P}/procurement/packages`, `${P}/procurement/dashboard`, `${P}/expediting/packages`,
  `${P}/logistics/shipments`, `${P}/materials/balance`, `${P}/materials/summary`, `${P}/procurement/concerns`,
  `${P}/construction/budget`, `${P}/construction/facility-layout/equipment`,
  `${P}/risks`, `${P}/interfaces`, `${P}/issues`, `${P}/knowledge`, `${P}/snapshots`, `${P}/access/roles`,
];
const api = (store: MemoryStore) => new Api(store, () => new Date('2026-11-26T10:00:00Z'));
const call = (store: MemoryStore, method: string, path: string, body?: unknown) => handle(api(store), { method, path, body, user: 'u-admin' });
const answers = (store: MemoryStore) => READS.map(path => JSON.stringify(call(store, 'GET', path)));

async function database() {
  const db = new PGlite();
  await db.exec(await readFile(join(import.meta.dirname, '../sql/001_dataset_store.sql'), 'utf8'));
  return { db, client: db as unknown as PoolClient };
}
const load = (snapshot: StoreSnapshot) => { const s = new MemoryStore('x'); s.loadSnapshot(snapshot); return s; };

describe('API v2 on PostgreSQL answers like the Sheets backend', () => {
  it('serves every read route identically after a round trip through the database', async () => {
    const seeded = new MemoryStore('x');
    seedStore(seeded, seedData);
    const { db, client } = await database();
    try {
      await writeSnapshot(client, { sheets: [] }, seeded.snapshot());
      expect(await readSnapshot(client)).toEqual(seeded.snapshot());
      const fromDb = load(await readSnapshot(client));
      const want = answers(seeded), got = answers(fromDb);
      READS.forEach((path, i) => expect(got[i], path).toBe(want[i]));
      // the routes are really answering, not all failing the same way
      expect(want.filter(a => JSON.parse(a).ok).length).toBeGreaterThan(READS.length - 6);
    } finally { await db.close(); }
  });

  it('keeps a write made through the routes after it is saved and read back', async () => {
    const seeded = new MemoryStore('x');
    seedStore(seeded, seedData);
    const { db, client } = await database();
    try {
      await writeSnapshot(client, { sheets: [] }, seeded.snapshot());
      const before = await readSnapshot(client);
      const store = load(before);
      const E = `${P}/construction/facility-layout/equipment`;
      const made = call(store, 'POST', E, { tag: 'ZZZ-PARITY', name: 'Saved to PostgreSQL', deck: 'Main Deck', method: 'Skidding' });
      expect(made.ok, JSON.stringify(made)).toBe(true);
      expect(call(store, 'POST', `${P}/milestones`, { id: 'M-PARITY', description: 'Saved to PostgreSQL' }).ok).toBe(true);
      await writeSnapshot(client, before, store.snapshot());
      const again = load(await readSnapshot(client));
      expect(JSON.stringify(call(again, 'GET', `${E}/ZZZ-PARITY`))).toBe(JSON.stringify(call(store, 'GET', `${E}/ZZZ-PARITY`)));
      expect(call(again, 'GET', `${P}/milestones/M-PARITY`).ok).toBe(true);
    } finally { await db.close(); }
  });

  const archive = resolve(import.meta.dirname, '../../../../.tmp/projectflow-live-archive.json');
  it.skipIf(!existsSync(archive))('brings the 17 November live archive up to the current seed and serves every route from it', async () => {
    const { db, client } = await database();
    try {
      const live = await loadArchive(archive);
      await writeSnapshot(client, { sheets: [] }, live);
      const before = await readSnapshot(client);
      const store = load(before);
      const changes = refreshStore(store);
      expect(changes.length).toBeGreaterThan(0);
      await writeSnapshot(client, before, store.snapshot());
      const refreshed = load(await readSnapshot(client));
      expect(refreshStore(refreshed)).toEqual([]); // nothing left to refresh
      const rows = (name: keyof typeof SHEET) => refreshed.readRows(SHEET[name], COLUMNS[name] as never).length;
      expect(rows('budget')).toBeGreaterThan(0);
      expect(rows('facilityEquipment')).toBeGreaterThan(111);
      expect(rows('logistics')).toBe((seedData as unknown as { logistics: unknown[] }).logistics.length);
      for (const path of READS) {
        const r = call(refreshed, 'GET', path) as { ok: boolean; error?: { code: string } };
        if (!r.ok) expect(['MODULE_DISABLED', 'NO_ACCESS', 'READ_ONLY_FOR_YOU'], `${path}: ${JSON.stringify(r)}`).toContain(r.error?.code);
      }
    } finally { await db.close(); }
  });
});
