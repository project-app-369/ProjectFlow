/**
 * Sets or resets one person's password directly in the database, for the first administrator (nobody can sign in before a password
 * exists) or when every administrator is locked out. After that, administrators reset passwords in the app (Settings -> Users).
 *
 *   NEW_PASSWORD='…' pnpm db:set-password -- admin@example.com
 *
 * The password comes from the environment, not the command line, so it stays out of the shell history and the process list.
 */
import { COLUMNS, SHEET } from '../../sheets/src/datasets';
import { hashPassword } from '../../sheets/src/hash';
import { MemoryStore } from '../../sheets/src/memory-store';
import { createPool, readSnapshot, withWriteLock, writeSnapshot } from './db';

const email = process.argv.slice(2).find(a => a.includes('@'))?.trim().toLowerCase();
const password = process.env.NEW_PASSWORD ?? '';
if (!email) throw new Error('Give the e-mail of the account: pnpm db:set-password -- someone@example.com');
if (password.length < 8) throw new Error('Set NEW_PASSWORD to a password of at least 8 characters.');

const pool = createPool();
const client = await pool.connect();
try {
  await client.query('begin');
  await withWriteLock(client);
  const before = await readSnapshot(client);
  const store = new MemoryStore();
  store.loadSnapshot(before);
  const user = store.readRows(SHEET.users, COLUMNS.users).find(u => String(u.email).toLowerCase() === email);
  if (!user) throw new Error(`No account has the e-mail ${email}.`);
  const now = new Date().toISOString();
  store.updateRow(SHEET.users, COLUMNS.users, 'id', String(user.id), { passwordHash: hashPassword(password, store.newId().slice(0, 12)), passwordChangedAt: now, failedLogins: 0, lockedUntil: null });
  store.appendRows(SHEET.accessLog, COLUMNS.accessLog, [{ id: store.newId(), at: now, actor: null, actorName: 'database', action: 'password-reset', target: String(user.name), detail: 'Password set from the command line' }]);
  await writeSnapshot(client, before, store.snapshot());
  await client.query('commit');
  console.log(`Password set for ${user.name} (${email}). Sessions signed in with the old password have ended.`);
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  client.release();
  await pool.end();
}
