import { Api } from '../../sheets/src/api';
import { MemoryStore } from '../../sheets/src/memory-store';
import { handle } from '../../sheets/src/router';
import { loadArchive } from './import';

const source = process.argv[2];
if (!source) throw new Error('Usage: tsx src/smoke-import.ts <archive.json>');
const archive = await loadArchive(source);
const store = new MemoryStore();
store.loadSnapshot(archive);
const api = new Api(store);
const paths = [
  '/directory', '/me', '/projects', '/projects/sttp2b/modules',
  '/projects/sttp2b/dashboard', '/projects/sttp2b/cpn',
  '/projects/sttp2b/procurement/dashboard', '/projects/sttp2b/logistics/insights',
  '/projects/sttp2b/risks/summary', '/projects/sttp2b/issues',
];
for (const path of paths) {
  const response = handle(api, { method: 'GET', path, user: 'u-admin' });
  if (!response.ok) throw new Error(`${path}: ${response.status} ${response.error.code} ${response.error.message}`);
  console.log(`${path}: ${response.status}`);
}
