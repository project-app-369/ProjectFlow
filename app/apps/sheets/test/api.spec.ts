import { beforeEach, describe, expect, it } from 'vitest';
import { Api } from '../src/api';
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryStore } from '../src/memory-store';
import { handle, type Envelope } from '../src/router';
import { seedStore } from '../src/seed';

const P = '/projects/sttp2b';
const ADMIN = 'u-admin', MANAGER = 'u-manager', MEMBER = 'u-member', CLIENT = 'u-client';
let store: MemoryStore;
let api: Api;
const call = (method: string, path: string, body?: unknown, user: string | null = ADMIN) => handle(api, { method, path, body, user: user ?? undefined });
const ok = (e: Envelope) => { expect(e.ok, JSON.stringify(e)).toBe(true); return (e as Extract<Envelope, { ok: true }>).data as any; };
const err = (e: Envelope) => { expect(e.ok).toBe(false); return e as Extract<Envelope, { ok: false }>; };

beforeEach(() => {
  store = new MemoryStore();
  seedStore(store);
  api = new Api(store, () => new Date('2026-11-08T10:00:00Z'));
});

describe('setup', () => {
  it('generates the worksheets grouped by area: settings first, then each workspace', () => {
    expect(store.sheetNames()).toEqual([
      'Settings - Projects', 'Settings - Users', 'Settings - Memberships', 'Settings - Modules', 'Settings - Module changes',
      'Personal - Tasks', 'Personal - Subtasks',
      'EPCIC - S-curve', 'EPCIC - Work packages', 'EPCIC - Milestones', 'EPCIC - Procurement packages', 'EPCIC - Expediting packages',
      'Governance - Risks', 'Governance - Interfaces', 'Governance - Interface points',
      'Reports - Cut-off snapshots', 'Reports - Snapshot data',
    ]);
  });

  it('loads the reference data and is idempotent', () => {
    expect(store.readRows(SHEET.procurement, COLUMNS.procurement)).toHaveLength(137);
    expect(store.readRows(SHEET.expediting, COLUMNS.expediting)).toHaveLength(153);
    expect(store.readRows(SHEET.milestones, COLUMNS.milestones)).toHaveLength(48);
    expect(store.readRows(SHEET.users, COLUMNS.users)).toHaveLength(4);
    expect(seedStore(store)).toBe(false);
    expect(store.readRows(SHEET.procurement, COLUMNS.procurement)).toHaveLength(137);
  });

  it('keeps project rows tagged with their project', () => {
    expect(store.readRows(SHEET.procurement, COLUMNS.procurement).every(r => r.projectId === 'sttp2b')).toBe(true);
    expect(store.readRows(SHEET.memberships, COLUMNS.memberships)).toHaveLength(4);
  });
});

describe('identity and access', () => {
  it('needs a known, active user for everything except health and the directory', () => {
    expect(err(call('GET', '/projects', undefined, null)).error.code).toBe('USER_REQUIRED');
    expect(err(call('GET', '/projects', undefined, 'u-nobody')).status).toBe(401);
    expect(ok(call('GET', '/health', undefined, null)).database).toBe('sheets');
    expect(ok(call('GET', '/directory', undefined, null)).map((u: any) => u.id)).toEqual([ADMIN, MANAGER, MEMBER, CLIENT]);
    expect(ok(call('GET', '/directory', undefined, null))[0]).not.toHaveProperty('email');
  });

  it('describes the current user and memberships', () => {
    expect(ok(call('GET', '/me'))).toMatchObject({ id: ADMIN, isAdmin: true, memberships: [{ projectId: 'sttp2b', role: 'Project Manager' }] });
    expect(ok(call('GET', '/me', undefined, CLIENT)).isAdmin).toBe(false);
  });

  it('lets a client read but not write project records', () => {
    expect(ok(call('GET', `${P}/risks`, undefined, CLIENT)).total).toBe(0);
    expect(err(call('POST', `${P}/risks`, { title: 'x' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
  });

});

describe('data endpoints match the NestJS API contract', () => {
  it('dashboard aggregates the data modules', () => {
    const d = ok(call('GET', `${P}/dashboard`));
    expect(d.procurement.total).toBe(137);
    expect(d.expediting).toMatchObject({ total: 153, delayed: 11, atRisk: 6 });
    expect(d.workPackages.items).toHaveLength(5);
    expect(d.workPackages.overall.thisWeekActual).toBeCloseTo(45.1, 1);
    expect(d.overallProgress.latest).toMatchObject({ date: '2026-10-30', actual: 39.89 });
    expect(d.overallProgress.scurve.at(-1).actual).toBeNull();
    expect(d.milestones.total).toBe(48);
    expect(d.risks).toMatchObject({ total: 0, active: 0 });
    expect(d.interfaces).toMatchObject({ total: 0, open: 0 });
  });

  it('procurement list filters, sorts, pages and validates', () => {
    const r = ok(call('GET', `${P}/procurement/packages?discipline=Piping&pageSize=5&sort=code&order=desc`));
    expect(r.total).toBe(30);
    expect(r.items).toHaveLength(5);
    expect(r.items[0].code > r.items[4].code).toBe(true);
    expect(r.items[0]).not.toHaveProperty('projectId');
    expect(r.facets.disciplines).toContain('Pipeline');
    expect(r.facets.disciplines).not.toContain('Pipline');
    const bad = err(call('GET', `${P}/procurement/packages?sort=password`));
    expect(bad.status).toBe(400);
    expect(bad.error.code).toBe('VALIDATION_ERROR');
  });

  it('expediting detail is flattened and drops empty fields', () => {
    const one = ok(call('GET', `${P}/expediting/packages/EX-001`));
    expect(one).toMatchObject({ discipline: 'Equipment', status: 'Delay', rosDate: '2026-11-15' });
    expect('planExw' in one).toBe(false);
    expect(err(call('GET', `${P}/expediting/packages/NOPE`)).status).toBe(404);
  });

  it('csv export neutralises formulas', () => {
    store.updateRow(SHEET.expediting, COLUMNS.expediting, 'id', 'EX-001', { name: '=HYPERLINK("http://x")' });
    const { csv, filename } = ok(call('GET', `${P}/expediting/packages.csv`));
    expect(filename).toBe('expediting-packages.csv');
    expect(csv).toContain(`"'=HYPERLINK`);
  });
});

describe('module registry and sheet links', () => {
  const put = (key: string, state: string, user = ADMIN) => call('PUT', `${P}/modules/${key}`, { state }, user);

  it('lists every module with a sheet link for dataset modules only', () => {
    const { modules } = ok(call('GET', `${P}/modules`));
    const by = (k: string) => modules.find((m: any) => m.key === k);
    expect(by('procurement.procurement-plan')).toMatchObject({ sheetCapable: true, sheet: { name: 'EPCIC - Procurement packages' } });
    expect(by('management.risks').sheet.name).toBe('Governance - Risks');
    expect(by('interface.matrix').sheet.name).toBe('Governance - Interfaces');
    expect(by('management.issues')).toMatchObject({ sheetCapable: true, sheet: null });
    expect(by('management').sheetCapable).toBe(false);
    expect(by('dashboard').sheetCapable).toBe(false);
  });

  it('enforces core, required-by and unknown-module rules, and who may configure', () => {
    expect(err(put('dashboard', 'Disabled')).error.code).toBe('CORE_MODULE');
    expect(err(put('document-control', 'Disabled')).error.code).toBe('REQUIRED_BY');
    expect(err(put('nope', 'Enabled')).status).toBe(409);
    expect(err(put('hse', 'Enabled', MANAGER)).error.code).toBe('PROJECT_MANAGER_REQUIRED');
    expect(err(call('PUT', `${P}/modules/hse`, {})).status).toBe(400);
  });

  it('a disabled module rejects data requests and the dashboard reports it unavailable', () => {
    expect(ok(put('procurement.procurement-plan', 'Disabled')).state).toBe('Disabled');
    expect(err(call('GET', `${P}/procurement/packages`)).status).toBe(403);
    expect(ok(call('GET', `${P}/dashboard`)).procurement).toBeNull();
    expect(ok(put('procurement.procurement-plan', 'Enabled')).state).toBe('Enabled');
    expect(ok(call('GET', `${P}/module-changes`))).toHaveLength(2);
    expect(ok(call('GET', `${P}/module-changes`))[0].actor).toBe(ADMIN);
  });

  it('establishing a module generates a sheet named for its workspace and returns the link', () => {
    expect(ok(put('ti', 'Enabled')).sheetsCreated).toEqual([]);
    const one = ok(put('ti.workpacks', 'Enabled'));
    expect(one.sheetsCreated.map((s: any) => s.name)).toEqual(['EPCIC - T&I - Workpacks']);
    expect(one.sheet.url).toMatch(/#gid=\d+$/);
    expect(ok(put('ti.workpacks', 'Enabled')).sheetsCreated).toEqual([]);
  });

  it('generates a sheet on request and reads only this project\'s rows', () => {
    const g = ok(call('POST', `${P}/modules/management.issues/sheet`));
    expect(g).toMatchObject({ created: true, sheet: { name: 'Governance - Management - Issues' } });
    store.appendRows(g.sheet.name, COLUMNS.generic, [{ projectId: 'sttp2b', id: 'I1', title: 'Late drawings', status: 'Open' }, { projectId: 'other', id: 'I2', title: 'Elsewhere' }]);
    const rec = ok(call('GET', `${P}/modules/management.issues/records`));
    expect(rec.columns).not.toContain('projectId');
    expect(rec.items).toMatchObject([{ id: 'I1', title: 'Late drawings' }]);
    expect(err(call('POST', `${P}/modules/management/sheet`)).error.code).toBe('NO_SHEET');
  });
});

describe('projects', () => {
  const create = (body: object = { code: 'NEW-1', name: 'New project' }, user = ADMIN) => call('POST', '/projects', body, user);

  it('lists projects by membership; administrators see all', () => {
    ok(create());
    expect(ok(call('GET', '/projects')).map((p: any) => p.code)).toEqual(['NEW-1', 'STTP2B-26']);
    expect(ok(call('GET', '/projects', undefined, MEMBER)).map((p: any) => p.code)).toEqual(['STTP2B-26']);
    expect(ok(call('GET', '/projects')).find((p: any) => p.code === 'STTP2B-26')).toMatchObject({ myRole: 'Project Manager', memberCount: 4 });
  });

  it('creates a project for administrators only, with the creator as Project Manager', () => {
    expect(err(create({ code: 'X', name: 'x' }, MANAGER)).error.code).toBe('ADMIN_REQUIRED');
    expect(err(create({ code: 'A', name: 'x' })).status).toBe(400);
    const p = ok(create({ code: 'Su Tu Trang 3', name: 'Next project', client: 'ACME' }));
    expect(p).toMatchObject({ id: 'su-tu-trang-3', lifecycle: 'Setup', myRole: 'Project Manager', client: 'ACME' });
    expect(err(create({ code: 'su tu trang 3', name: 'dup' })).error.code).toBe('CODE_TAKEN');
  });

  it('edits a project; renaming the code is an administrator action', () => {
    const p = ok(create());
    expect(ok(call('PATCH', `/projects/${p.id}`, { name: 'Renamed', location: 'Vung Tau' }))).toMatchObject({ name: 'Renamed', location: 'Vung Tau', id: p.id });
    expect(ok(call('PATCH', `/projects/${p.id}`, { code: 'NEW-2' })).code).toBe('NEW-2');
    expect(err(call('PATCH', `/projects/sttp2b`, { name: 'x' }, MANAGER)).error.code).toBe('PROJECT_MANAGER_REQUIRED');
    expect(err(call('PATCH', `/projects/sttp2b`, { code: 'STTP2B-26' }, MEMBER)).status).toBe(403);
  });

  it('follows the lifecycle and needs a reason to restore', () => {
    const id = ok(create()).id;
    const go = (to: string, reason?: string) => call('POST', `/projects/${id}/lifecycle`, { to, reason });
    expect(err(go('Closing')).error.code).toBe('INVALID_TRANSITION');
    expect(ok(go('Active')).lifecycle).toBe('Active');
    expect(ok(go('Closing')).lifecycle).toBe('Closing');
    expect(ok(go('Archived')).lifecycle).toBe('Archived');
    expect(err(go('Active')).error.code).toBe('REASON_REQUIRED');
    expect(ok(go('Active', 'Re-opened for warranty')).lifecycle).toBe('Active');
    expect(ok(call('GET', '/projects')).find((p: any) => p.id === id)).toBeDefined();
  });

  it('hides archived projects from normal lists', () => {
    const id = ok(create()).id;
    ['Active', 'Closing', 'Archived'].forEach(to => ok(call('POST', `/projects/${id}/lifecycle`, { to })));
    expect(ok(call('GET', '/projects')).some((p: any) => p.id === id)).toBe(false);
    expect(ok(call('GET', '/projects?includeArchived=true')).some((p: any) => p.id === id)).toBe(true);
  });

  it('deletes only an empty Draft project, never one with records', () => {
    const id = ok(create()).id;
    expect(err(call('DELETE', `/projects/sttp2b`)).error.code).toBe('ARCHIVE_INSTEAD');
    expect(err(call('DELETE', `/projects/${id}`, undefined, MANAGER)).error.code).toBe('ADMIN_REQUIRED');
    ok(call('POST', `/projects/${id}/lifecycle`, { to: 'Draft' }));
    ok(call('POST', `/projects/${id}/risks`, { title: 'A risk', category: 'Cost', owner: 'Me', likelihood: 2, impact: 2 }));
    expect(err(call('DELETE', `/projects/${id}`)).error.code).toBe('PROJECT_HAS_RECORDS');
    ok(call('DELETE', `/projects/${id}/risks/RSK-001`));
    expect(call('DELETE', `/projects/${id}`)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `/projects/${id}`)).status).toBe(404);
    expect(store.readRows(SHEET.memberships, COLUMNS.memberships).some(m => m.projectId === id)).toBe(false);
  });

  it('keeps each project\'s records apart', () => {
    const id = ok(create()).id;
    const body = { title: 'Same id, other project', category: 'Cost', owner: 'Me', likelihood: 3, impact: 3 };
    expect(ok(call('POST', `${P}/risks`, body)).id).toBe('RSK-001');
    expect(ok(call('POST', `/projects/${id}/risks`, body)).id).toBe('RSK-001');
    ok(call('PATCH', `/projects/${id}/risks/RSK-001`, { status: 'Closed' }));
    expect(ok(call('GET', `${P}/risks/RSK-001`)).status).toBe('Open');
    expect(ok(call('GET', `/projects/${id}/procurement/packages`)).total).toBe(0);
    expect(ok(call('GET', `/projects/${id}/dashboard`)).milestones.total).toBe(0);
  });

  it('refuses business data to a non-member', () => {
    const id = ok(create({ code: 'P2', name: 'P2' }, ADMIN)).id;
    expect(err(call('GET', `/projects/${id}/risks`, undefined, MEMBER)).error.code).toBe('NOT_A_MEMBER');
    expect(err(call('GET', `/projects/${id}`, undefined, MEMBER)).error.code).toBe('NOT_A_MEMBER');
  });
});

describe('members and users', () => {
  it('lets an administrator or the Project Manager assign members; the last Project Manager stays', () => {
    expect(ok(call('GET', `${P}/members`)).map((m: any) => m.role)).toContain('Project Manager');
    expect(ok(call('PUT', `${P}/members/${MEMBER}`, { role: 'Leader', title: 'Lead expeditor' }))).toMatchObject({ role: 'Leader' });
    expect(err(call('PUT', `${P}/members/${MEMBER}`, { role: 'Leader' }, MANAGER)).status).toBe(403);
    expect(err(call('PUT', `${P}/members/${MEMBER}`, { role: 'Boss' })).status).toBe(400);
    expect(err(call('DELETE', `${P}/members/${ADMIN}`)).error.code).toBe('LAST_PROJECT_MANAGER');
    expect(call('DELETE', `${P}/members/${CLIENT}`)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `${P}/risks`, undefined, CLIENT)).error.code).toBe('NOT_A_MEMBER');
  });

  it('manages users in admin mode only', () => {
    expect(err(call('GET', '/users', undefined, MANAGER)).error.code).toBe('ADMIN_REQUIRED');
    const list = ok(call('GET', '/users'));
    expect(list).toHaveLength(4);
    expect(list.find((u: any) => u.id === MEMBER).memberships[0]).toMatchObject({ projectCode: 'STTP2B-26', role: 'Team Member' });
    const u = ok(call('POST', '/users', { name: 'New Person', email: 'New.Person@Example.com', isAdmin: false }));
    expect(u).toMatchObject({ email: 'new.person@example.com', status: 'Active', isAdmin: false });
    expect(err(call('POST', '/users', { name: 'Dup', email: 'new.person@example.com' })).error.code).toBe('EMAIL_TAKEN');
    expect(err(call('POST', '/users', { name: 'Bad', email: 'nope' })).status).toBe(400);
    expect(ok(call('PATCH', `/users/${u.id}`, { name: 'Renamed', isAdmin: true })).isAdmin).toBe(true);
  });

  it('blocks deactivated accounts and protects the last administrator', () => {
    expect(err(call('PATCH', `/users/${ADMIN}`, { isAdmin: false })).error.code).toBe('LAST_ADMIN');
    expect(err(call('PATCH', `/users/${ADMIN}`, { status: 'Deactivated' })).error.code).toBe('LAST_ADMIN');
    ok(call('PATCH', `/users/${MEMBER}`, { status: 'Deactivated' }));
    expect(err(call('GET', '/me', undefined, MEMBER)).status).toBe(401);
    expect(ok(call('GET', '/directory', undefined, null)).map((u: any) => u.id)).not.toContain(MEMBER);
    const second = ok(call('POST', '/users', { name: 'Second admin', email: 'two@example.com', isAdmin: true }));
    expect(ok(call('PATCH', `/users/${ADMIN}`, { isAdmin: false })).isAdmin).toBe(false);
    expect(ok(call('GET', '/users', undefined, second.id))).toHaveLength(5);
  });
});

describe('milestones (reference data)', () => {
  it('summarises against the reporting cut-off', () => {
    const s = ok(call('GET', `${P}/milestones/summary`));
    expect(s).toMatchObject({ total: 48, done: 9, cutoff: '2026-11-06' });
    expect(s.done + s.overdue + s.dueSoon + s.planned).toBe(48);
    expect(s.next).toHaveLength(5);
    expect(s.next.every((m: any) => m.status !== 'Done')).toBe(true);
    expect(Object.keys(s.bySub).sort()).toEqual(['AECC', 'MC', 'PSB', 'PVSM', 'VSP']);
  });

  it('lists, filters and derives status', () => {
    const all = ok(call('GET', `${P}/milestones?pageSize=200`));
    expect(all.total).toBe(48);
    const byId = (id: string) => all.items.find((m: any) => m.id === id);
    expect(byId('01-M-1000')).toMatchObject({ description: 'Project Effective Date', status: 'Done' });
    expect(byId('01-M-1350')).toMatchObject({ description: 'Final Acceptance', status: 'Planned' });
    expect(byId('04-M-1140')).toMatchObject({ status: 'Done', variance: 16 });
    expect(ok(call('GET', `${P}/milestones?sub=AECC`)).items.every((m: any) => m.subName === 'AECC')).toBe(true);
    expect(ok(call('GET', `${P}/milestones?status=Done`)).total).toBe(9);
    expect(ok(call('GET', `${P}/milestones?q=float-over`)).total).toBeGreaterThan(0);
    expect(ok(call('GET', `${P}/milestones.csv`)).csv).toContain('Project Effective Date');
  });

  it('is read-only', () => {
    expect(err(call('POST', `${P}/milestones`, { id: 'X' })).status).toBe(404);
  });
});

describe('risk management', () => {
  const risk = { title: 'Late steel delivery', category: 'Supply chain', cause: 'Mill backlog', event: 'Plate arrives late', effect: 'Fabrication start slips', owner: 'Procurement lead', likelihood: 4, impact: 4, mitigation: 'Air-freight critical plate', trigger: 'No ETD by 15 Nov', reviewDate: '2026-11-20' };

  it('scores risks with the 5x5 matrix and keeps inherent and residual apart', () => {
    const r = ok(call('POST', `${P}/risks`, { ...risk, residualLikelihood: 2, residualImpact: 3 }));
    expect(r).toMatchObject({ id: 'RSK-001', status: 'Open', inherentScore: 16, inherentLevel: 'High', residualScore: 6, residualLevel: 'Medium', currentScore: 6, currentLevel: 'Medium', createdBy: ADMIN });
    expect(ok(call('POST', `${P}/risks`, { ...risk, likelihood: 5, impact: 4 }))).toMatchObject({ id: 'RSK-002', inherentScore: 20, currentLevel: 'Extreme', residualScore: null });
    expect(ok(call('POST', `${P}/risks`, { ...risk, likelihood: 1, impact: 2 })).currentLevel).toBe('Low');
  });

  it('validates input', () => {
    expect(err(call('POST', `${P}/risks`, { ...risk, likelihood: 6 })).status).toBe(400);
    expect(err(call('POST', `${P}/risks`, { ...risk, title: '' })).status).toBe(400);
    expect(err(call('POST', `${P}/risks`, { ...risk, category: 'Whatever' })).status).toBe(400);
    expect(err(call('POST', `${P}/risks`, { ...risk, residualLikelihood: 2 })).error.issues).toMatchObject([{ path: 'residualLikelihood' }]);
    expect(err(call('POST', `${P}/risks`, { ...risk, milestoneId: 'NOPE' })).error.issues).toMatchObject([{ path: 'milestoneId' }]);
  });

  it('links a milestone and flags overdue reviews against the cut-off', () => {
    const r = ok(call('POST', `${P}/risks`, { ...risk, milestoneId: '03-M-1020', reviewDate: '2026-10-01' }));
    expect(r.milestone).toBe('First Steel Cut for Jacket');
    expect(r.reviewOverdue).toBe(true);
    ok(call('PATCH', `${P}/risks/${r.id}`, { status: 'Closed' }));
    expect(ok(call('GET', `${P}/risks/${r.id}`)).reviewOverdue).toBe(false);
  });

  it('updates, filters, sorts and summarises with a heatmap', () => {
    ok(call('POST', `${P}/risks`, { ...risk, residualLikelihood: 2, residualImpact: 3 }));
    ok(call('POST', `${P}/risks`, { ...risk, title: 'Weather window', category: 'Schedule', likelihood: 5, impact: 4 }));
    const closed = ok(call('POST', `${P}/risks`, { ...risk, title: 'Old risk', likelihood: 1, impact: 1, status: 'Closed' }));
    expect(ok(call('PATCH', `${P}/risks/RSK-001`, { status: 'Mitigating', owner: 'Site manager' }))).toMatchObject({ status: 'Mitigating', owner: 'Site manager', likelihood: 4 });
    expect(err(call('PATCH', `${P}/risks/RSK-001`, { residualImpact: null })).status).toBe(400);
    expect(ok(call('GET', `${P}/risks?level=Extreme`)).items.map((r: any) => r.title)).toEqual(['Weather window']);
    expect(ok(call('GET', `${P}/risks?category=Schedule`)).total).toBe(1);
    expect(ok(call('GET', `${P}/risks?q=steel`)).total).toBe(1);
    expect(ok(call('GET', `${P}/risks?sort=score&order=desc`)).items[0].title).toBe('Weather window');
    const s = ok(call('GET', `${P}/risks/summary`));
    expect(s).toMatchObject({ total: 3, active: 2, byStatus: { Mitigating: 1, Open: 1, Closed: 1 }, byLevel: { Extreme: 1, Medium: 1, High: 0, Low: 0 } });
    expect(s.heatmap.version).toBe('v1');
    expect(s.heatmap.inherent[3][3]).toBe(1);
    expect(s.heatmap.current[1][2]).toBe(1);
    expect(s.heatmap.current[4][3]).toBe(1);
    expect(ok(call('GET', `${P}/risks.csv`)).csv).toContain('Weather window');
    expect(closed.currentLevel).toBe('Low');
  });

  it('lets only managers delete', () => {
    ok(call('POST', `${P}/risks`, risk));
    expect(err(call('DELETE', `${P}/risks/RSK-001`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(ok(call('POST', `${P}/risks`, risk, MEMBER)).createdBy).toBe(MEMBER);
    expect(call('DELETE', `${P}/risks/RSK-001`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `${P}/risks/RSK-001`)).status).toBe(404);
  });

  it('is unavailable when the module is switched off', () => {
    ok(call('PUT', `${P}/modules/management.risks`, { state: 'Disabled' }));
    expect(err(call('GET', `${P}/risks`)).error.code).toBe('MODULE_DISABLED');
    expect(ok(call('GET', `${P}/dashboard`)).risks).toBeNull();
  });
});

describe('interface management', () => {
  const iface = { title: 'Topside to jacket boundary loads', type: 'Technical', originator: 'Topside fabricator', receiver: 'Jacket fabricator', coordinator: 'Interface lead', discipline: 'Structural', needDate: '2026-11-30' };
  const create = (extra: object = {}) => ok(call('POST', `${P}/interfaces`, { ...iface, ...extra }));
  const move = (id: string, to: string) => call('POST', `${P}/interfaces/${id}/transition`, { to });

  it('creates interfaces as Identified with a sequential reference', () => {
    expect(create()).toMatchObject({ id: 'INT-001', status: 'Identified', overdue: false, pointsTotal: 0, allowedNext: ['Assigned'] });
    expect(create({ title: 'Second' }).id).toBe('INT-002');
  });

  it('validates input', () => {
    expect(err(call('POST', `${P}/interfaces`, { ...iface, receiver: 'topside fabricator' })).error.issues).toMatchObject([{ path: 'receiver' }]);
    expect(err(call('POST', `${P}/interfaces`, { ...iface, type: 'Magic' })).status).toBe(400);
    expect(err(call('POST', `${P}/interfaces`, { ...iface, needDate: '30/11/2026' })).status).toBe(400);
  });

  it('ignores a status sent in a plain edit; only the transition route changes status', () => {
    const { id } = create();
    expect(ok(call('PATCH', `${P}/interfaces/${id}`, { status: 'Closed', title: 'Renamed' }))).toMatchObject({ status: 'Identified', title: 'Renamed' });
    expect(err(call('PATCH', `${P}/interfaces/${id}`, { receiver: iface.originator })).status).toBe(400);
  });

  it('walks the lifecycle and enforces its conditions', () => {
    const { id } = create({ coordinator: null });
    expect(err(move(id, 'Closed')).error.code).toBe('INVALID_TRANSITION');
    expect(err(move(id, 'Assigned')).error.code).toBe('COORDINATOR_REQUIRED');
    ok(call('PATCH', `${P}/interfaces/${id}`, { coordinator: 'Interface lead' }));
    expect(ok(move(id, 'Assigned')).status).toBe('Assigned');
    expect(ok(move(id, 'Information requested')).status).toBe('Information requested');
    expect(err(move(id, 'Responded')).error.code).toBe('RESPONSE_REQUIRED');
    ok(call('PATCH', `${P}/interfaces/${id}`, { response: 'Loads issued in doc rev B' }));
    ['Responded', 'Under review', 'Agreed'].forEach(s => expect(ok(move(id, s)).status).toBe(s));
    expect(ok(move(id, 'Closed')).allowedNext).toEqual(['Under review']);
    expect(ok(move(id, 'Under review')).status).toBe('Under review');
    expect(err(call('POST', `${P}/interfaces/${id}/transition`, { to: 'Nowhere' })).status).toBe(400);
  });

  it('keeps points under their interface and blocks closure while any is unresolved', () => {
    const { id } = create();
    ['Assigned', 'Information requested'].forEach(s => ok(move(id, s)));
    ok(call('PATCH', `${P}/interfaces/${id}`, { response: 'Done' }));
    ['Responded', 'Under review', 'Agreed'].forEach(s => ok(move(id, s)));
    const pt = ok(call('POST', `${P}/interface-points`, { interfaceId: id, title: 'Confirm flange rating', owner: 'Piping lead', due: '2026-11-01' }));
    expect(pt).toMatchObject({ id: 'IP-001', status: 'Open', overdue: true });
    expect(err(move(id, 'Closed')).error).toMatchObject({ code: 'POINTS_UNRESOLVED', message: '1 interface point is not accepted or closed yet.' });
    expect(ok(call('GET', `${P}/interfaces/${id}`))).toMatchObject({ pointsTotal: 1, pointsOpen: 1, points: [{ id: 'IP-001' }] });
    ok(call('PATCH', `${P}/interface-points/IP-001`, { status: 'Accepted' }));
    expect(ok(move(id, 'Closed')).status).toBe('Closed');
    expect(err(call('POST', `${P}/interface-points`, { interfaceId: id, title: 'Late point', owner: 'x' })).error.code).toBe('INTERFACE_CLOSED');
    expect(err(call('POST', `${P}/interface-points`, { interfaceId: 'INT-999', title: 'x', owner: 'x' })).status).toBe(400);
  });

  it('filters the register and lists points across interfaces', () => {
    const a = create();
    create({ title: 'Other', originator: 'Vendor A', receiver: 'Vendor B', type: 'Physical', needDate: '2026-10-01' });
    ok(call('POST', `${P}/interface-points`, { interfaceId: a.id, title: 'P1', owner: 'o1' }));
    expect(ok(call('GET', `${P}/interfaces?party=vendor a`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interfaces?type=Physical`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interfaces?overdue=true`)).items.map((i: any) => i.title)).toEqual(['Other']);
    expect(ok(call('GET', `${P}/interfaces?q=boundary`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interfaces`)).facets.parties).toEqual(['Jacket fabricator', 'Topside fabricator', 'Vendor A', 'Vendor B']);
    expect(ok(call('GET', `${P}/interface-points?interfaceId=${a.id}`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interface-points?status=Closed`)).total).toBe(0);
    expect(ok(call('GET', `${P}/interfaces.csv`)).csv).toContain('Topside to jacket');
  });

  it('derives the party matrix and summary from the register', () => {
    create(); create({ title: 'Again' });
    create({ title: 'Reverse', originator: 'Jacket fabricator', receiver: 'Topside fabricator', needDate: '2026-10-01' });
    const m = ok(call('GET', `${P}/interfaces/matrix`));
    expect(m.parties).toEqual(['Jacket fabricator', 'Topside fabricator']);
    expect(m.total).toBe(3);
    expect(m.cells.find((c: any) => c.originator === 'Topside fabricator')).toMatchObject({ total: 2, open: 2, overdue: 0, settled: 0 });
    expect(m.cells.find((c: any) => c.originator === 'Jacket fabricator')).toMatchObject({ total: 1, overdue: 1 });
    expect(ok(call('GET', `${P}/interfaces/summary`))).toMatchObject({ total: 3, open: 3, overdue: 1, pointsOpen: 0 });
  });

  it('deletes only interfaces without points, and only as a manager', () => {
    const { id } = create();
    ok(call('POST', `${P}/interface-points`, { interfaceId: id, title: 'P', owner: 'o' }));
    expect(err(call('DELETE', `${P}/interfaces/${id}`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(err(call('DELETE', `${P}/interfaces/${id}`)).error.code).toBe('HAS_POINTS');
    expect(err(call('DELETE', `${P}/interface-points/IP-001`, undefined, MEMBER)).status).toBe(403);
    ok(call('DELETE', `${P}/interface-points/IP-001`));
    expect(call('DELETE', `${P}/interfaces/${id}`)).toMatchObject({ ok: true, status: 204 });
  });

  it('shares one sheet between the register and the matrix', () => {
    const { modules } = ok(call('GET', `${P}/modules`));
    expect(modules.find((m: any) => m.key === 'interface.points').sheet.name).toBe('Governance - Interface points');
    ok(call('PUT', `${P}/modules/interface.matrix`, { state: 'Disabled' }));
    expect(err(call('GET', `${P}/interfaces/matrix`)).error.code).toBe('MODULE_DISABLED');
    expect(ok(call('GET', `${P}/interfaces`)).total).toBe(0);
  });
});

describe('personal tasks', () => {
  const mk = (extra: object = {}, user: string | null = ADMIN) => ok(call('POST', '/tasks', { title: 'Write report', ...extra }, user));

  it('shows tasks only to their owner, with seeded demo tasks for the administrator', () => {
    const list = ok(call('GET', '/tasks'));
    expect(list.items).toHaveLength(4);
    expect(list.items[0]).toMatchObject({ taskNo: 'TSK-0001', status: 'Ongoing', projects: ['sttp2b'], subtasksTotal: 0, overdue: false, ganttReady: true });
    expect(list.today).toBe('2026-11-08');
    expect(ok(call('GET', '/tasks', undefined, MEMBER)).items).toHaveLength(0);
    const mine = mk({}, MEMBER);
    expect(err(call('PATCH', `/tasks/${mine.id}`, { status: 'Completed' }, ADMIN)).status).toBe(404);
    expect(ok(call('PATCH', `/tasks/${mine.id}`, { status: 'Completed' }, MEMBER)).status).toBe('Completed');
    expect(err(call('DELETE', `/tasks/${mine.id}`, undefined, ADMIN)).status).toBe(404);
    expect(call('DELETE', `/tasks/${mine.id}`, undefined, MEMBER)).toMatchObject({ ok: true, status: 204 });
  });

  it('creates a task with defaults, an automatic unique number and every field', () => {
    expect(mk()).toMatchObject({ taskNo: 'TSK-0005', status: 'Backlog', urgency: 'Normal', projects: [], subtasks: [], effort: null, due: null, ganttReady: false });
    const full = mk({
      title: 'Review vendor data', description: 'Check the datasheets', urgency: 'Urgent', assigner: 'Manager (demo)', projects: ['sttp2b'],
      planStart: '2026-11-09', planFinish: '2026-11-11', due: '2026-11-12', status: 'Planned', effort: 6.5, remarks: 'Waiting for vendor',
      subtasks: [{ title: 'Datasheets' }, { title: 'Test reports', done: true }],
    }, MEMBER);
    expect(full).toMatchObject({
      taskNo: 'TSK-0006', urgency: 'Urgent', assigner: 'Manager (demo)', projects: ['sttp2b'], effort: 6.5, status: 'Planned', ganttReady: true,
      subtasksDone: 1, subtasksTotal: 2, remarks: 'Waiting for vendor',
    });
    expect(full.subtasks.map((x: any) => [x.title, x.done])).toEqual([['Datasheets', false], ['Test reports', true]]);
  });

  it('validates input', () => {
    const bad = (body: object, path: string, user = ADMIN) => expect(err(call('POST', '/tasks', { title: 'x', ...body }, user)).error.issues?.some((i: any) => i.path === path)).toBe(true);
    expect(err(call('POST', '/tasks', { title: '' })).status).toBe(400);
    bad({ urgency: 'Whenever' }, 'urgency');
    bad({ status: 'Overdue' }, 'status');
    bad({ due: '12/11/2026' }, 'due');
    bad({ effort: -1 }, 'effort');
    bad({ planStart: '2026-11-10', planFinish: '2026-11-09' }, 'planFinish');
    bad({ projects: ['nope'] }, 'projects');
  });

  it('only lets people link projects they belong to', () => {
    const p = ok(call('POST', '/projects', { code: 'OTHER-1', name: 'Other' }));
    expect(err(call('POST', '/tasks', { title: 'x', projects: [p.id] }, MEMBER)).status).toBe(400);
    expect(mk({ projects: [p.id, 'sttp2b'] }).projects).toEqual([p.id, 'sttp2b']);
  });

  it('derives Overdue from the deadline and the supplied day, never storing it', () => {
    const t = mk({ due: '2026-11-07', status: 'Ongoing' });
    expect(t.overdue).toBe(true);
    expect(t.status).toBe('Ongoing');
    expect(ok(call('PATCH', `/tasks/${t.id}`, { status: 'Completed' })).overdue).toBe(false);
    const later = ok(call('GET', '/tasks?today=2026-12-01')).items;
    expect(later.filter((x: any) => x.overdue).map((x: any) => x.taskNo)).toEqual(['TSK-0001', 'TSK-0002', 'TSK-0003', 'TSK-0004']);
    expect(ok(call('GET', '/tasks?today=junk')).today).toBe('2026-11-08');
  });

  it('adds, checks and removes sub-tasks through the task', () => {
    const t = mk({ subtasks: [{ title: 'One' }, { title: 'Two' }] });
    const [one, two] = t.subtasks;
    const checked = ok(call('PATCH', `/tasks/${t.id}`, { subtasks: [{ id: one.id, title: 'One', done: true }, { id: two.id, title: 'Two', done: false }, { title: 'Three' }] }));
    expect(checked).toMatchObject({ subtasksDone: 1, subtasksTotal: 3 });
    expect(checked.subtasks[0]).toMatchObject({ id: one.id, done: true });
    expect(ok(call('PATCH', `/tasks/${t.id}`, { title: 'Renamed' })).subtasksTotal).toBe(3);
    expect(ok(call('PATCH', `/tasks/${t.id}`, { subtasks: [] })).subtasksTotal).toBe(0);
  });

  it('deleting a task removes its sub-tasks; a finish before the stored start is refused on edit', () => {
    const t = mk({ planStart: '2026-11-10', subtasks: [{ title: 'One' }] });
    expect(err(call('PATCH', `/tasks/${t.id}`, { planFinish: '2026-11-09' })).error.issues).toMatchObject([{ path: 'planFinish' }]);
    call('DELETE', `/tasks/${t.id}`);
    expect(store.readRows(SHEET.subtasks, COLUMNS.subtasks).some(s => s.taskId === t.id)).toBe(false);
  });

  it('reports workload per week by project, counting a multi-project task in each but once in the total', () => {
    const p = ok(call('POST', '/projects', { code: 'OTHER-2', name: 'Other two' }));
    mk({ title: 'Shared', projects: [p.id, 'sttp2b'], due: '2026-11-18', effort: 5, status: 'Completed' });
    mk({ title: 'Floating', effort: 2 });
    mk({ title: 'Far away', due: '2027-06-01', effort: 8 });
    const w = ok(call('GET', '/tasks/workload?by=week'));
    expect(w.by).toBe('week');
    const wk = (start: string) => w.periods.find((x: any) => x.start === start);
    expect(wk('2026-11-09')).toMatchObject({ end: '2026-11-15', total: { tasks: 4, hours: 10, open: 4 }, byProject: { sttp2b: { tasks: 3, hours: 9 }, _personal: { tasks: 1, hours: 1 } } });
    expect(wk('2026-11-16')).toMatchObject({ total: { tasks: 1, hours: 5, open: 0, openHours: 0 }, byProject: { sttp2b: { tasks: 1, hours: 5 } } });
    expect(wk('2026-11-16').byProject[p.id]).toMatchObject({ tasks: 1, hours: 5 });
    expect(w.unscheduled).toMatchObject({ tasks: 1, hours: 2 });
    expect(w.outside).toEqual({ tasks: 1, hours: 8 });
    expect(w.totals.total).toMatchObject({ tasks: 5, hours: 15 });
    expect(w.totals.byProject.sttp2b).toMatchObject({ tasks: 4, hours: 14 });
    expect(w.projects[w.projects.length - 1]).toBe('_personal');
    expect(w.projects).toContain(p.id);
  });

  it('groups by month and honours a custom range', () => {
    const m = ok(call('GET', '/tasks/workload?by=month&from=2026-10-15&to=2026-12-31'));
    expect(m.periods.map((x: any) => x.start)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(m.periods[1]).toMatchObject({ end: '2026-11-30', total: { tasks: 4, hours: 10 } });
    expect(err(call('GET', '/tasks/workload?from=2026-12-01&to=2026-11-01')).status).toBe(400);
    expect(err(call('GET', '/tasks/workload?by=year')).status).toBe(400);
    expect(ok(call('GET', '/tasks/workload', undefined, MEMBER)).totals.total.tasks).toBe(0);
  });
});

describe('cut-off snapshots', () => {
  const save = (body: object = { cutoff: '2026-10-30' }, user = MANAGER) => call('POST', `${P}/snapshots`, body, user);

  it('saves the current data as a report dated by its cut-off and lists it newest first', () => {
    const s = ok(save());
    expect(s).toMatchObject({ cutoff: '2026-10-30', createdBy: 'Manager (demo)', replaced: false });
    expect(s.rowCount).toBeGreaterThan(300);
    ok(save({ cutoff: '2026-11-06', note: 'Weekly report' }));
    const list = ok(call('GET', `${P}/snapshots`, undefined, CLIENT));
    expect(list.map((x: any) => x.cutoff)).toEqual(['2026-11-06', '2026-10-30']);
    expect(list[0]).toMatchObject({ note: 'Weekly report', createdBy: 'Manager (demo)' });
  });

  it('defaults to the project cut-off and refuses a duplicate unless it is replaced', () => {
    expect(ok(save({})).cutoff).toBe('2026-11-06');
    expect(err(save({})).error.code).toBe('SNAPSHOT_EXISTS');
    expect(ok(save({ replace: true })).replaced).toBe(true);
    expect(ok(call('GET', `${P}/snapshots`)).filter((x: any) => x.cutoff === '2026-11-06')).toHaveLength(1);
  });

  it('keeps who may save, delete and read snapshots', () => {
    expect(err(save({}, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(err(save({}, CLIENT)).status).toBe(403);
    expect(err(save({ cutoff: '2030-01-01' })).error.issues).toMatchObject([{ path: 'cutoff' }]);
    ok(save());
    expect(err(call('DELETE', `${P}/snapshots/2026-10-30`, undefined, MANAGER)).error.code).toBe('PROJECT_MANAGER_REQUIRED');
    expect(call('DELETE', `${P}/snapshots/2026-10-30`)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('DELETE', `${P}/snapshots/2026-10-30`)).error.code).toBe('SNAPSHOT_NOT_FOUND');
    expect(ok(call('GET', `${P}/snapshots`)).length).toBe(0);
  });

  it('reads the saved data, not the live data, with ?asOf and reports the snapshot cut-off', () => {
    ok(call('POST', `${P}/risks`, { title: 'Before', category: 'Cost', owner: 'Me', likelihood: 3, impact: 3 }));
    ok(save({ cutoff: '2026-10-30' }));
    ok(call('POST', `${P}/risks`, { title: 'After', category: 'Cost', owner: 'Me', likelihood: 3, impact: 3 }));
    store.updateRow(SHEET.procurement, COLUMNS.procurement, 'id', 'PR-001', { status: 'Changed live' }, { projectId: 'sttp2b' });

    expect(ok(call('GET', `${P}/risks`)).total).toBe(2);
    expect(ok(call('GET', `${P}/risks?asOf=2026-10-30`)).items.map((r: any) => r.title)).toEqual(['Before']);
    expect(ok(call('GET', `${P}/risks/summary?asOf=2026-10-30`)).total).toBe(1);
    expect(ok(call('GET', `${P}/procurement/packages?pageSize=200&asOf=2026-10-30`)).items.find((p: any) => p.id === 'PR-001').status).not.toBe('Changed live');
    expect(ok(call('GET', `${P}/procurement/packages?pageSize=200`)).items.find((p: any) => p.id === 'PR-001').status).toBe('Changed live');

    const live = ok(call('GET', `${P}/milestones/summary`));
    const old = ok(call('GET', `${P}/milestones/summary?asOf=2026-10-30`));
    expect(live.cutoff).toBe('2026-11-06');
    expect(old.cutoff).toBe('2026-10-30');
    expect(old.dueSoon).toBeLessThan(live.dueSoon);
    expect(ok(call('GET', `${P}/dashboard?asOf=2026-10-30`)).project.cutoff).toBe('2026-10-30');
    expect(ok(call('GET', `${P}/dashboard`)).project.cutoff).toBe('2026-11-06');
  });

  it('round-trips a large dataset split across several cells', () => {
    ok(save());
    const p = ok(call('GET', `${P}/procurement/packages?pageSize=200&asOf=2026-10-30`));
    expect(p.total).toBe(137);
    expect(ok(call('GET', `${P}/expediting/packages?pageSize=200&asOf=2026-10-30`)).total).toBe(153);
    const chunks = store.readRows(SHEET.snapshotData, COLUMNS.snapshotData).filter(r => r.dataset === 'expediting');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => String(c.json).length <= 40_000)).toBe(true);
  });

  it('is read-only and strict about the date', () => {
    ok(save());
    expect(err(call('POST', `${P}/risks?asOf=2026-10-30`, { title: 'x', category: 'Cost', owner: 'o', likelihood: 1, impact: 1 })).error.code).toBe('READ_ONLY_SNAPSHOT');
    expect(err(call('GET', `${P}/risks?asOf=2026-01-01`)).error.code).toBe('SNAPSHOT_NOT_FOUND');
    expect(err(call('GET', `${P}/risks?asOf=yesterday`)).status).toBe(400);
    expect(err(call('GET', `${P}/risks?asOf=2026-10-30`, undefined, 'u-nobody')).status).toBe(401);
  });

  it('keeps snapshots of one project away from another', () => {
    ok(save());
    const other = ok(call('POST', '/projects', { code: 'OTHER-S', name: 'Other' }));
    expect(ok(call('GET', `/projects/${other.id}/snapshots`)).length).toBe(0);
    expect(err(call('GET', `/projects/${other.id}/risks?asOf=2026-10-30`)).error.code).toBe('SNAPSHOT_NOT_FOUND');
  });
});

describe('routing', () => {
  it('reports unknown routes and projects', () => {
    expect(err(call('GET', '/nowhere')).status).toBe(404);
    expect(err(call('GET', '/projects/nope/modules')).error.code).toBe('PROJECT_NOT_FOUND');
  });
});
