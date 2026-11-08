import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleLite } from 'drizzle-orm/pglite';
import { migrate as migrateLite } from 'drizzle-orm/pglite/migrator';
import { drizzle as drizzlePg } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';
import * as schema from './schema';

export type Db = PgDatabase<any, typeof schema>;
export interface DbHandle {
  db: Db;
  kind: 'postgres' | 'pglite';
  close: () => Promise<void>;
}

const migrationsFolder = join(__dirname, '..', '..', 'drizzle');

/** Connects to PostgreSQL when a URL is given, otherwise to an embedded PGlite database, and applies migrations. */
export async function createDb(opts: { url?: string; pgliteDir?: string }): Promise<DbHandle> {
  if (opts.url) {
    const pool = new Pool({ connectionString: opts.url });
    const db = drizzlePg(pool, { schema });
    await migratePg(db, { migrationsFolder });
    return { db: db as unknown as Db, kind: 'postgres', close: () => pool.end() };
  }
  const dir = opts.pgliteDir;
  if (dir) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  const db = drizzleLite(client, { schema });
  await migrateLite(db, { migrationsFolder });
  return { db: db as unknown as Db, kind: 'pglite', close: () => client.close() };
}
