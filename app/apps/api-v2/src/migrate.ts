import { connectWithRetry, createPool, migrate } from './db';

const pool = createPool();
try {
  const client = await connectWithRetry(pool);
  try { await migrate(client); }
  finally { client.release(); }
  console.log('Project Flow API v2 schema is ready.');
} finally {
  await pool.end();
}
