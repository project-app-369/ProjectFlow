import { createPool, migrate } from './db';

const pool = createPool();
try {
  const client = await pool.connect();
  try { await migrate(client); }
  finally { client.release(); }
  console.log('Project Flow API v2 schema is ready.');
} finally {
  await pool.end();
}
