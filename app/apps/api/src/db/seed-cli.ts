import { config } from '../config';
import { createDb } from './client';
import { seedIfEmpty } from './seed';

(async () => {
  const handle = await createDb({ url: config.databaseUrl, pgliteDir: config.pgliteDir });
  const seeded = await seedIfEmpty(handle.db);
  console.log(seeded ? `Seeded STTP2B reference data (${handle.kind}).` : 'Database already seeded.');
  await handle.close();
})();
