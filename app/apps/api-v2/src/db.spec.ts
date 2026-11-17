import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import type { PoolClient } from 'pg';
import { describe, expect, it } from 'vitest';
import { readSnapshot, writeSnapshot } from './db';

describe('Supabase dataset migration', () => {
  it('creates the private schema and round-trips edited rows', async () => {
    const db = new PGlite();
    try {
      await db.exec(await readFile(join(import.meta.dirname, '../sql/001_dataset_store.sql'), 'utf8'));
      const client = db as unknown as PoolClient;
      const first = { sheets: [{ name: 'Settings - Projects', gid: 1000, header: ['id', 'name'], rows: [{ id: 'p1', name: 'First' }] }] };
      await writeSnapshot(client, { sheets: [] }, first);
      expect(await readSnapshot(client)).toEqual(first);
      const second = { sheets: [{ ...first.sheets[0], rows: [{ id: 'p1', name: 'Edited' }, { id: 'p2', name: 'Second' }] }] };
      await writeSnapshot(client, first, second);
      expect(await readSnapshot(client)).toEqual(second);
    } finally { await db.close(); }
  });
});
