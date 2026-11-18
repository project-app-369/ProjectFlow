import { createHmac } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import { Api } from '../src/api';
import { COLUMNS, SHEET } from '../src/datasets';
import { hashPassword, hmacSha256, b64url, fromB64url } from '../src/hash';
import { MemoryStore } from '../src/memory-store';
import { handle, type Envelope } from '../src/router';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';

const P = '/projects/sttp2b';
const ADMIN = 'u-admin', MANAGER = 'u-manager', MEMBER = 'u-member', CLIENT = 'u-client';
const SECRET = 'test-signing-secret-with-enough-length';
let store: MemoryStore;
let api: Api;
let now = new Date('2026-11-08T10:00:00Z');
const call = (method: string, path: string, body?: unknown, user: string | null = ADMIN) => handle(api, { method, path, body, user: user ?? undefined });
const ok = (e: Envelope) => { expect(e.ok, JSON.stringify(e)).toBe(true); return (e as Extract<Envelope, { ok: true }>).data as any; };
const err = (e: Envelope) => { expect(e.ok).toBe(false); return e as Extract<Envelope, { ok: false }>; };
const code = (e: Envelope) => err(e).error.code;

beforeEach(() => {
  now = new Date('2026-11-08T10:00:00Z');
  store = new MemoryStore();
  seedStore(store, seedData);
  api = new Api(store, () => now);
});

describe('hashing helpers', () => {
  it('computes HMAC-SHA256 like Node, for short, long and non-ASCII keys and messages', () => {
    for (const [key, msg] of [['k', 'm'], ['k'.repeat(100), 'message'], ['sécret-ключ', 'pf1.payload ✓ 日本語'], ['', '']]) {
      expect(hmacSha256(key, msg)).toBe(createHmac('sha256', key).update(msg).digest('hex'));
    }
  });
  it('round-trips base64url, including non-ASCII text', () => {
    for (const s of ['', 'a', 'ab', 'abc', '{"u":"u-admin","e":1}', 'Đặng Thị — 日本 ✓ 😀']) {
      expect(fromB64url(b64url(s))).toBe(s);
      expect(b64url(s)).toBe(Buffer.from(s, 'utf8').toString('base64url'));
    }
  });
});

describe('demo mode (no signing secret)', () => {
  it('still trusts the stated user, offers the picker and has no login', () => {
    expect(ok(call('GET', '/auth/config', undefined, null))).toMatchObject({ mode: 'demo' });
    expect(ok(call('GET', '/directory', undefined, null)).length).toBeGreaterThan(2);
    expect(ok(call('GET', '/me', undefined, MEMBER)).id).toBe(MEMBER);
    expect(code(call('POST', '/auth/login', { email: 'admin@example.com', password: 'x' }, null))).toBe('AUTH_NOT_ENABLED');
  });
});

describe('password sign-in (signing secret set)', () => {
  const asSession = (token: string | undefined, path = '/me', method = 'GET', body?: unknown) => handle(api, { method, path, body, session: token });
  const setPassword = (id: string, password: string) => store.updateRow(SHEET.users, COLUMNS.users, 'id', id, { passwordHash: hashPassword(password, 'salt12345678'), passwordChangedAt: now.toISOString() });
  const login = (email: string, password: string) => call('POST', '/auth/login', { email, password }, null);

  beforeEach(() => {
    api = new Api(store, () => now, undefined, { secret: SECRET });
    setPassword(ADMIN, 'correct horse battery');
    setPassword(MEMBER, 'member password 1');
  });

  it('reports password mode, hides the user list and ignores a stated user', () => {
    expect(ok(call('GET', '/auth/config', undefined, null))).toMatchObject({ mode: 'password', lockAfter: 5 });
    expect(code(call('GET', '/directory', undefined, null))).toBe('ROUTE_NOT_FOUND');
    expect(code(call('GET', '/me', undefined, ADMIN))).toBe('AUTH_REQUIRED'); // a stated administrator is not believed
    expect(code(asSession(undefined))).toBe('AUTH_REQUIRED');
    expect(ok(call('GET', '/health', undefined, null))).toBeTruthy();
  });

  it('signs in with e-mail and password and acts as that person, whatever user is stated', () => {
    const r = ok(login('Member@Example.com', 'member password 1'));
    expect(r.user).toMatchObject({ id: MEMBER });
    expect(r.token).toMatch(/^pf1\.[\w-]+\.[0-9a-f]{64}$/);
    expect(new Date(r.expiresAt).getTime()).toBe(now.getTime() + 12 * 3600_000);
    expect(ok(asSession(r.token)).id).toBe(MEMBER);
    // the member cannot pose as the administrator by stating a user next to their own token
    const posing = handle(api, { method: 'GET', path: '/users', user: ADMIN, session: r.token });
    expect(code(posing)).toBe('ADMIN_REQUIRED');
    expect(store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === MEMBER)!.lastLoginAt).toBeTruthy();
  });

  it('gives one answer for an unknown e-mail, a wrong password, no password and a suspended account', () => {
    const answers = [
      login('nobody@example.com', 'whatever1'), login('member@example.com', 'wrong password'), login('manager@example.com', 'no password set'),
    ].map(e => err(e).error);
    expect(new Set(answers.map(a => a.code))).toEqual(new Set(['INVALID_LOGIN']));
    expect(new Set(answers.map(a => a.message)).size).toBe(1);
    store.updateRow(SHEET.users, COLUMNS.users, 'id', 'u-manager', { status: 'Suspended' });
    expect(code(login('manager@example.com', 'no password set'))).toBe('INVALID_LOGIN');
  });

  it('refuses a tampered, malformed or expired token, and one from before a password change or suspension', () => {
    const { token } = ok(login('member@example.com', 'member password 1'));
    const [h, body, sig] = token.split('.');
    const forged = b64url(JSON.stringify({ u: ADMIN, e: 9_999_999_999, s: 'x' }));
    for (const bad of [`${h}.${body}.${'0'.repeat(64)}`, `${h}.${forged}.${sig}`, 'pf1.abc', 'garbage', `pf2.${body}.${sig}`]) expect(code(asSession(bad))).toBe('AUTH_REQUIRED');
    now = new Date(now.getTime() + 13 * 3600_000);
    expect(code(asSession(token))).toBe('AUTH_REQUIRED'); // 12 hours are over
    now = new Date('2026-11-08T10:00:00Z');
    expect(ok(asSession(token)).id).toBe(MEMBER);
    setPassword(MEMBER, 'a new password 22');
    expect(code(asSession(token))).toBe('AUTH_REQUIRED'); // the old password's sessions end
    const again = ok(login('member@example.com', 'a new password 22')).token;
    store.updateRow(SHEET.users, COLUMNS.users, 'id', MEMBER, { status: 'Suspended' });
    expect(code(asSession(again))).toBe('AUTH_REQUIRED');
    expect(code(login('member@example.com', 'a new password 22'))).toBe('INVALID_LOGIN');
  });

  it('locks after five wrong passwords for 15 minutes, and an administrator reset opens it at once', () => {
    for (let i = 0; i < 4; i++) expect(code(login('member@example.com', 'nope nope nope'))).toBe('INVALID_LOGIN');
    expect(code(login('member@example.com', 'nope nope nope'))).toBe('INVALID_LOGIN'); // the fifth locks
    const locked = err(login('member@example.com', 'member password 1')); // even the right password
    expect(locked.status).toBe(429);
    expect(locked.error.code).toBe('TOO_MANY_ATTEMPTS');
    now = new Date(now.getTime() + 16 * 60_000);
    expect(ok(login('member@example.com', 'member password 1')).user.id).toBe(MEMBER);

    for (let i = 0; i < 5; i++) login('member@example.com', 'nope nope nope');
    const admin = ok(login('admin@example.com', 'correct horse battery')).token;
    ok(asSession(admin, `/users/${MEMBER}/password`, 'POST', { password: 'reset by admin 33' }));
    expect(ok(login('member@example.com', 'reset by admin 33')).user.id).toBe(MEMBER);
    expect(code(asSession(admin, `/users/${MEMBER}/password`, 'POST', { password: 'short' }))).toBe('VALIDATION_ERROR');
  });

  it('lets only an administrator reset a password, and records sign-ins and resets in the access log', () => {
    const member = ok(login('member@example.com', 'member password 1')).token;
    expect(code(asSession(member, `/users/${ADMIN}/password`, 'POST', { password: 'takeover pass 1' }))).toBe('ADMIN_REQUIRED');
    login('member@example.com', 'bad one here');
    const admin = ok(login('admin@example.com', 'correct horse battery')).token;
    ok(asSession(admin, `/users/${MEMBER}/password`, 'POST', { password: 'reset by admin 33' }));
    const log = ok(asSession(admin, '/access-log'));
    expect(log.map((e: any) => e.action)).toEqual(expect.arrayContaining(['login', 'login-failed', 'password-reset']));
    expect(JSON.stringify(log)).not.toMatch(/reset by admin|member password|correct horse/); // never a password
  });
});

describe('access by role and by person', () => {
  const modules = (user = MEMBER) => ok(call('GET', '/me', undefined, user)).moduleAccess.sttp2b as { hidden: string[]; readOnly: string[] };

  it('gives the project role its default: a client reads, everyone else may change', () => {
    expect(modules(MEMBER)).toEqual({ hidden: [], readOnly: [] });
    expect(modules(CLIENT).readOnly).toContain('management.risks');
    expect(modules(CLIENT).readOnly.length).toBeGreaterThan(20);
  });

  it('lets a Project Manager hide a screen from a role, and lets the screens under it follow', () => {
    const m = ok(call('GET', `${P}/access/roles`, undefined, ADMIN));
    expect(m.roles).toEqual(['Project Manager', 'Manager', 'Leader', 'Team Member', 'Client']);
    expect(m.caps.Client).toBe('read');
    ok(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Team Member', moduleKey: 'procurement', level: 'none' }] }));
    expect(modules(MEMBER).hidden).toEqual(expect.arrayContaining(['procurement', 'procurement.logistics', 'procurement.expediting.vendor-overview']));
    expect(code(call('GET', `${P}/logistics/shipments`, undefined, MEMBER))).toBe('NO_ACCESS');
    expect(code(call('GET', `${P}/procurement/packages`, undefined, MEMBER))).toBe('NO_ACCESS');
    expect(ok(call('GET', `${P}/procurement/packages`, undefined, MANAGER)).items.length).toBeGreaterThan(0); // another role is untouched
    // a setting on a child beats the one on its parent
    ok(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Team Member', moduleKey: 'procurement.logistics', level: 'read' }] }));
    expect(ok(call('GET', `${P}/logistics/shipments`, undefined, MEMBER)).items).toBeTruthy();
    expect(code(call('POST', `${P}/logistics/shipments`, {}, MEMBER))).toBe('READ_ONLY_FOR_YOU');
    // back to the default
    ok(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Team Member', moduleKey: 'procurement', level: null }, { role: 'Team Member', moduleKey: 'procurement.logistics', level: null }] }));
    expect(modules(MEMBER)).toEqual({ hidden: [], readOnly: [] });
  });

  it('makes a role read-only in a screen, and never lets a client be given write', () => {
    ok(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Team Member', moduleKey: 'management.risks', level: 'read' }] }));
    expect(ok(call('GET', `${P}/risks`, undefined, MEMBER)).items).toBeTruthy();
    expect(code(call('POST', `${P}/risks`, { title: 'x' }, MEMBER))).toBe('READ_ONLY_FOR_YOU');
    expect(code(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Client', moduleKey: 'management.risks', level: 'write' }] }))).toBe('CLIENT_READ_ONLY');
    expect(code(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Team Member', moduleKey: 'nope', level: 'none' }] }))).toBe('UNKNOWN_MODULE');
  });

  it('lets one person differ from their role, up to the ceiling of that role', () => {
    ok(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Team Member', moduleKey: 'management.risks', level: 'none' }] }));
    expect(code(call('GET', `${P}/risks`, undefined, MEMBER))).toBe('NO_ACCESS');
    const view = ok(call('PUT', `${P}/access/users/${MEMBER}`, { cells: [{ moduleKey: 'management.risks', level: 'read' }] }));
    expect(view.modules.find((x: any) => x.key === 'management.risks')).toMatchObject({ byRole: 'none', override: 'read', effective: 'read' });
    expect(ok(call('GET', `${P}/risks`, undefined, MEMBER)).items).toBeTruthy();
    expect(code(call('POST', `${P}/risks`, { title: 'x' }, MEMBER))).toBe('READ_ONLY_FOR_YOU');
    // and the other way: a person closed out of a screen their role has
    ok(call('PUT', `${P}/access/users/${MANAGER}`, { cells: [{ moduleKey: 'management.issues', level: 'none' }] }));
    expect(code(call('GET', `${P}/issues`, undefined, MANAGER))).toBe('NO_ACCESS');
    expect(ok(call('GET', `${P}/issues`, undefined, MEMBER))).toBeTruthy();
    // a client stays read-only whatever is set for them
    expect(code(call('PUT', `${P}/access/users/${CLIENT}`, { cells: [{ moduleKey: 'management.risks', level: 'write' }] }))).toBe('CLIENT_READ_ONLY');
    expect(code(call('PUT', `${P}/access/users/u-nobody`, { cells: [] }))).toBe('NOT_A_MEMBER');
  });

  it('drops a person\'s own settings when they leave the project', () => {
    ok(call('PUT', `${P}/access/users/${MEMBER}`, { cells: [{ moduleKey: 'management.risks', level: 'none' }] }));
    expect(store.readRows(SHEET.personAccess, COLUMNS.personAccess)).toHaveLength(1);
    ok(call('DELETE', `${P}/members/${MEMBER}`));
    expect(store.readRows(SHEET.personAccess, COLUMNS.personAccess)).toHaveLength(0);
  });

  it('applies party hiding on top, and keeps screens a party may not see out of the dashboard', () => {
    expect(ok(call('GET', `${P}/dashboard`, undefined, CLIENT)).risks).not.toBeNull();
    ok(call('PUT', '/party-access', { cells: [{ moduleKey: 'management.risks', party: 'Client', visible: false }] }));
    expect(code(call('GET', `${P}/risks`, undefined, CLIENT))).toBe('NOT_FOR_YOUR_PARTY');
    expect(ok(call('GET', `${P}/dashboard`, undefined, CLIENT)).risks).toBeNull(); // used to leak the summary
    expect(ok(call('GET', `${P}/dashboard`, undefined, MEMBER)).risks).not.toBeNull();
    // a role setting hides the widget the same way
    ok(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Team Member', moduleKey: 'procurement.procurement-plan', level: 'none' }] }));
    expect(ok(call('GET', `${P}/dashboard`, undefined, MEMBER)).procurement).toBeNull();
    expect(ok(call('GET', `${P}/dashboard`, undefined, MANAGER)).procurement).not.toBeNull();
  });

  it('lets only an administrator or the Project Manager configure access', () => {
    expect(code(call('GET', `${P}/access/roles`, undefined, MEMBER))).toBe('PROJECT_MANAGER_REQUIRED');
    expect(code(call('PUT', `${P}/access/roles`, { cells: [] }, MANAGER))).toBe('PROJECT_MANAGER_REQUIRED');
    expect(code(call('PUT', `${P}/access/users/${MEMBER}`, { cells: [] }, CLIENT))).toBe('PROJECT_MANAGER_REQUIRED');
  });

  it('writes every change to an access log that a manager reads for the project and an administrator reads whole', () => {
    ok(call('PUT', `${P}/access/roles`, { cells: [{ role: 'Leader', moduleKey: 'management.risks', level: 'read' }] }));
    ok(call('PUT', `${P}/access/users/${MEMBER}`, { cells: [{ moduleKey: 'management.issues', level: 'none' }] }));
    ok(call('PATCH', `/users/${MEMBER}`, { title: 'Senior expeditor' }));
    ok(call('PUT', `${P}/members/${CLIENT}`, { role: 'Client', title: 'Owner representative' }));
    const log = ok(call('GET', '/access-log'));
    expect(log.map((e: any) => e.action)).toEqual(expect.arrayContaining(['role-access', 'person-access', 'user-update', 'member-update']));
    expect(log[0].at >= log[log.length - 1].at).toBe(true);
    expect(log.find((e: any) => e.action === 'role-access')).toMatchObject({ actor: ADMIN, target: 'Leader', detail: 'Risks: default → read', projectId: 'sttp2b' });
    expect(ok(call('GET', `/access-log?projectId=sttp2b`)).every((e: any) => e.projectId === 'sttp2b')).toBe(true);
    expect(code(call('GET', '/access-log', undefined, MANAGER))).toBe('ADMIN_REQUIRED');
    expect(code(call('GET', '/access-log?projectId=sttp2b', undefined, MEMBER))).toBe('PROJECT_MANAGER_REQUIRED');
  });
});

describe('closed holes from the audit', () => {
  it('F02: the generic records route no longer returns another person\'s private tasks', () => {
    ok(call('POST', '/tasks', { title: 'Private to the administrator', urgency: 'High' }, ADMIN));
    expect(code(call('GET', `${P}/modules/task-management.board/records`, undefined, CLIENT))).toBe('PERSONAL_DATA');
    expect(code(call('GET', `${P}/modules/task-management.board/records`, undefined, ADMIN))).toBe('PERSONAL_DATA');
    expect(ok(call('GET', '/tasks', undefined, CLIENT)).items?.length ?? ok(call('GET', '/tasks', undefined, CLIENT)).length ?? 0).toBe(0);
  });

  it('F06: a Read-only parent freezes the screens under it', () => {
    const id = ok(call('GET', `${P}/procurement/packages?pageSize=1`)).items[0].id;
    ok(call('PATCH', `${P}/procurement/packages/${id}`, { remarks: 'before' }, ADMIN));
    ok(call('PUT', `${P}/modules/procurement`, { state: 'Read-only' }));
    const refused = err(call('PATCH', `${P}/procurement/packages/${id}`, { remarks: 'after' }, ADMIN));
    expect(refused.error.code).toBe('MODULE_READ_ONLY');
    expect(refused.error.message).toContain('"procurement"');
    expect(ok(call('GET', `${P}/procurement/packages/${id}`, undefined, ADMIN)).id).toBe(id); // still readable
  });

  it('F07: the last Project Manager cannot be demoted or suspended', () => {
    expect(code(call('PUT', `${P}/members/${ADMIN}`, { role: 'Team Member' }))).toBe('LAST_PROJECT_MANAGER');
    ok(call('PUT', `${P}/members/${MANAGER}`, { role: 'Project Manager' })); // a second one frees the first
    ok(call('PUT', `${P}/members/${ADMIN}`, { role: 'Team Member' }));
    expect(code(call('PUT', `${P}/members/${MANAGER}`, { role: 'Manager' }))).toBe('LAST_PROJECT_MANAGER');
    expect(code(call('PATCH', `/users/${MANAGER}`, { status: 'Suspended' }))).toBe('LAST_PROJECT_MANAGER');
    expect(code(call('PATCH', `/users/${MANAGER}`, { status: 'Deactivated' }))).toBe('LAST_PROJECT_MANAGER');
  });
});
