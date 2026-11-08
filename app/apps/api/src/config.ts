import { join } from 'node:path';

export const config = {
  port: Number(process.env.PORT ?? 3100),
  /** When unset, the API runs on an embedded PGlite database (no Docker needed). */
  databaseUrl: process.env.DATABASE_URL,
  pgliteDir: process.env.PGLITE_DIR ?? join(process.cwd(), '.data', 'pglite'),
  autoSeed: (process.env.AUTO_SEED ?? 'true') !== 'false',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
};
