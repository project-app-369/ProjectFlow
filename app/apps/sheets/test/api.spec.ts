import { beforeEach, describe, expect, it } from 'vitest';
import { Api } from '../src/api';
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryStore } from '../src/memory-store';
import { handle, type Envelope } from '../src/router';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';

const P = '/projects/sttp2b';
const ADMIN = 'u-admin', MANAGER = 'u-manager', MEMBER = 'u-member', CLIENT = 'u-client';
let store: MemoryStore;
let api: Api;
const call = (method: string, path: string, body?: unknown, user: string | null = ADMIN) => handle(api, { method, path, body, user: user ?? undefined });
const ok = (e: Envelope) => { expect(e.ok, JSON.stringify(e)).toBe(true); return (e as Extract<Envelope, { ok: true }>).data as any; };
const err = (e: Envelope) => { expect(e.ok).toBe(false); return e as Extract<Envelope, { ok: false }>; };

/**
 * The tests run on a fixed reporting week (cut-off 6 Nov 2026, two days before the test clock), whatever cut-off the reference data
 * currently carries, so refreshing the data from newer workbooks changes counts here but not the dates the tests reason about.
 */
const TEST_CUTOFF = '2026-11-06';

beforeEach(() => {
  store = new MemoryStore();
  seedStore(store, { ...seedData, project: { ...seedData.project, cutoff: TEST_CUTOFF } });
  api = new Api(store, () => new Date('2026-11-08T10:00:00Z'));
});

describe('setup', () => {
  it('generates the worksheets grouped by area: settings first, then each workspace', () => {
    expect(store.sheetNames()).toEqual([
      'Settings - Projects', 'Settings - Users', 'Settings - Party access', 'Settings - Role access', 'Settings - Person access', 'Settings - Access log', 'Settings - Memberships', 'Settings - Modules', 'Settings - Module changes',
      'Personal - Tasks', 'Personal - Subtasks',
      'EPCIC - Facility curves', 'EPCIC - Facility scopes', 'EPCIC - Facility WBS', 'EPCIC - Working schedule', 'EPCIC - CPN progress', 'EPCIC - S-curve', 'EPCIC - S-curve weekly', 'EPCIC - Work packages', 'EPCIC - Milestones', 'EPCIC - Procurement packages', 'EPCIC - Expediting packages', 'EPCIC - Logistics shipments', 'EPCIC - Material balance', 'EPCIC - Material summary', 'EPCIC - Procurement concerns', 'EPCIC - Procurement S-curves', 'EPCIC - Phase progress', 'EPCIC - Construction budget',
      'Governance - Risks', 'Governance - Risk actions', 'Governance - Risk matrix', 'Governance - Risk breakdown', 'Governance - Issues', 'Governance - Issue sub-tasks', 'Governance - Issue log',
      'Governance - Interfaces', 'Governance - Interface points', 'Governance - Interface parties', 'Governance - Responsibility matrix', 'Governance - RASCI',
      'Reports - Knowledge', 'Reports - Cut-off snapshots', 'Reports - Snapshot data',
    ]);
  });

  it('loads the reference data and is idempotent', () => {
    expect(store.readRows(SHEET.procurement, COLUMNS.procurement)).toHaveLength(148);
    expect(store.readRows(SHEET.expediting, COLUMNS.expediting)).toHaveLength(145);
    expect(store.readRows(SHEET.milestones, COLUMNS.milestones)).toHaveLength(83);
    expect(store.readRows(SHEET.users, COLUMNS.users)).toHaveLength(4);
    expect(seedStore(store, seedData)).toBe(false);
    expect(store.readRows(SHEET.procurement, COLUMNS.procurement)).toHaveLength(148);
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
    expect(ok(call('GET', `${P}/risks`, undefined, CLIENT)).total).toBe(90);
    expect(err(call('POST', `${P}/risks`, { title: 'x' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
  });

});

describe('data endpoints match the NestJS API contract', () => {
  it('dashboard aggregates the data modules', () => {
    const d = ok(call('GET', `${P}/dashboard`));
    expect(d.procurement.total).toBe(148);
    expect(d.expediting).toMatchObject({ total: 145, delayed: 12, atRisk: 6 });
    expect(d.workPackages.items).toHaveLength(5);
    expect(d.workPackages.overall.thisWeekActual).toBeCloseTo(29.3, 1);
    expect(d.workPackages.items.map((w: any) => w.code)).toEqual(['WP2', 'WP3', 'WP4', 'WP5', 'WP6']);
    expect(d.overallProgress.latest).toMatchObject({ date: '2026-11-13', actual: 29.3 });
    expect(d.overallProgress.phases.map((p: any) => p.phase).slice(0, 3)).toEqual(['Engineering', 'Procurement', 'Onshore construction']);
    expect(d.overallProgress.phases[1]).toMatchObject({ plan: 43.42, actual: 46.49, reportDate: '2026-11-13' });
    expect(d.overallProgress.scurve.at(-1).actual).toBeNull();
    // the same overall curve is also served weekly, with the actual stopping at the cut-off
    expect(d.overallProgress.scurveWeekly.length).toBeGreaterThan(d.overallProgress.scurve.length);
    expect(d.overallProgress.scurveWeekly.find((p: any) => p.date === '2026-11-13')).toMatchObject({ plan: 26.79, actual: 29.29 });
    expect(d.overallProgress.scurveWeekly.filter((p: any) => p.date > '2026-11-13').every((p: any) => p.actual === null)).toBe(true);
    expect(d.milestones.total).toBe(83);
    expect(d.risks).toMatchObject({ total: 90, active: 62, levels: ['High', 'Medium', 'Low'], top: 'High' });
    expect(d.interfaces).toMatchObject({ total: 0, open: 0, points: 34, pointsOpen: 33 });
  });

  it('procurement list filters, sorts, pages and validates', () => {
    const r = ok(call('GET', `${P}/procurement/packages?discipline=Piping&pageSize=5&sort=code&order=desc`));
    expect(r.total).toBe(36);
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
    expect(by('interface.matrix').sheet.name).toBe('Governance - Responsibility matrix');
    expect(by('management.lessons-learned')).toMatchObject({ sheetCapable: true, sheet: null });
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
    const g = ok(call('POST', `${P}/modules/management.lessons-learned/sheet`));
    expect(g).toMatchObject({ created: true, sheet: { name: 'Governance - Management - Lessons Learned' } });
    store.appendRows(g.sheet.name, COLUMNS.generic, [{ projectId: 'sttp2b', id: 'I1', title: 'Late drawings', status: 'Open' }, { projectId: 'other', id: 'I2', title: 'Elsewhere' }]);
    const rec = ok(call('GET', `${P}/modules/management.lessons-learned/records`));
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
    ok(call('POST', `/projects/${id}/risks`, { title: 'A risk', rbs: 'GEN', owner: 'Me' }));
    expect(err(call('DELETE', `/projects/${id}`)).error.code).toBe('PROJECT_HAS_RECORDS');
    ok(call('DELETE', `/projects/${id}/risks/GEN-0001`));
    expect(call('DELETE', `/projects/${id}`)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `/projects/${id}`)).status).toBe(404);
    expect(store.readRows(SHEET.memberships, COLUMNS.memberships).some(m => m.projectId === id)).toBe(false);
  });

  it('keeps each project\'s records apart', () => {
    const id = ok(create()).id;
    const body = { title: 'Same id, other project', rbs: 'PEP-PRO', owner: 'Me' };
    expect(ok(call('POST', `${P}/risks`, body)).id).toBe('PEP-PRO-0091');
    expect(ok(call('POST', `/projects/${id}/risks`, body)).id).toBe('PEP-PRO-0001');
    ok(call('PATCH', `/projects/${id}/risks/PEP-PRO-0001`, { status: 'Monitor', preProbability: 2, preCost: 2 }));
    expect(ok(call('GET', `${P}/risks/PEP-PRO-0091`)).status).toBe('New');
    expect(ok(call('GET', `/projects/${id}/risks/PEP-PRO-0001`)).status).toBe('Monitor');
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
    expect(s).toMatchObject({ total: 83, done: 11, cutoff: '2026-11-06' });
    expect(s.done + s.overdue + s.dueSoon + s.planned).toBe(83);
    expect(s.next).toHaveLength(5);
    expect(s.next.every((m: any) => m.status !== 'Done')).toBe(true);
    expect(Object.keys(s.bySub).sort()).toEqual(['AECC', 'MC', 'PSB', 'PVSM', 'VSP']);
  });

  it('lists, filters and derives status', () => {
    const all = ok(call('GET', `${P}/milestones?pageSize=200`));
    expect(all.total).toBe(83);
    const byId = (id: string) => all.items.find((m: any) => m.id === id);
    expect(byId('01-M-1000')).toMatchObject({ description: 'Project Effective Date', status: 'Done' });
    expect(byId('01-M-1350')).toMatchObject({ description: 'Final Acceptance', status: 'Planned' });
    expect(byId('04-M-1140')).toMatchObject({ status: 'Done', variance: 16 });
    expect(ok(call('GET', `${P}/milestones?sub=AECC`)).items.every((m: any) => m.subName === 'AECC')).toBe(true);
    expect(ok(call('GET', `${P}/milestones?status=Done`)).total).toBe(11);
    expect(ok(call('GET', `${P}/milestones?q=float-over`)).total).toBeGreaterThan(0);
    expect(ok(call('GET', `${P}/milestones.csv`)).csv).toContain('Project Effective Date');
  });

  it('creates, updates and deletes milestones, deriving variance and facility', () => {
    const made = ok(call('POST', `${P}/milestones`, { description: 'Hold point review', planBaseline: '2026-11-10', forecast: '2026-11-20', subName: 'MC' }));
    expect(made).toMatchObject({ id: 'KM-001', facility: 'Project', variance: 10, slipDays: 10, status: 'Due soon' });
    const done = ok(call('PATCH', `${P}/milestones/KM-001`, { actual: '2026-11-17', facility: 'CGF Topsides' }));
    expect(done).toMatchObject({ status: 'Done', variance: 7, facility: 'CGF Topsides' });
    expect(ok(call('GET', `${P}/milestones?facility=${encodeURIComponent('CGF Topsides')}`)).items.map((m: any) => m.id)).toContain('KM-001');
    expect(ok(call('GET', `${P}/milestones`)).facets.facilities).toEqual(expect.arrayContaining(['CGF Topsides', 'CGF Jacket', 'Bridge', 'LQ Module #2', 'Pipeline']));
    expect(ok(call('POST', `${P}/milestones`, { id: 'M-99', description: 'Own id' })).id).toBe('M-99');
    expect(err(call('POST', `${P}/milestones`, { id: 'M-99', description: 'Again' })).status).toBe(409);
    expect(err(call('POST', `${P}/milestones`, { description: '' })).status).toBe(400);
    expect(err(call('DELETE', `${P}/milestones/KM-001`, undefined, MEMBER)).status).toBe(403);
    expect(call('DELETE', `${P}/milestones/KM-001`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `${P}/milestones/KM-001`)).status).toBe(404);
  });

  it('refuses to delete a milestone a risk is linked to, and is read-only for clients', () => {
    const ms = ok(call('POST', `${P}/milestones`, { description: 'Linked' })).id;
    ok(call('POST', `${P}/risks`, { title: 'Linked risk', rbs: 'PEP-PRO', owner: 'o', milestoneId: ms }));
    expect(err(call('DELETE', `${P}/milestones/${ms}`, undefined, MANAGER)).error.code).toBe('IN_USE');
    expect(err(call('POST', `${P}/milestones`, { description: 'x' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
  });

  it('summarises milestones for the page: cards, status strip, look-ahead and charts', () => {
    const ins = ok(call('GET', `${P}/milestones/insights`));
    expect(ins.cards).toHaveLength(6);
    expect(ins.cards[0]).toMatchObject({ label: 'Milestones', value: 83 });
    expect(ins.strip.boxes.map((b: any) => b.label)).toEqual(['Done', 'Overdue', 'Due soon', 'Planned']);
    expect(ins.lookAhead.boxes.map((b: any) => b.label)).toEqual(['Overdue', 'Within 30 days', 'Within 45 days', 'Within 60 days', 'No date']);
    expect(ins.charts.map((c: any) => c.filterKey)).toEqual([undefined, 'facility']);
    const w = ok(call('GET', `${P}/milestones?within=60`));
    expect(w.total).toBe(ins.lookAhead.boxes[3].value);
  });
});

describe('risk management', () => {
  const risk = {
    title: 'Late steel delivery', rbs: 'PEP-PRO', owner: 'Procurement lead / Site manager', cause: 'Mill backlog', effect: 'Fabrication start slips',
    status: 'Under assessment', preProbability: 3, preSchedule: 4, preCost: 2, planDate: '2026-11-20', mitigationCause: '1. Air-freight plate\n2. Second mill',
  };

  it('loads the project register, its 4 x 4 matrix and RBS from the workbook', () => {
    const list = ok(call('GET', `${P}/risks?pageSize=200`));
    expect(list.total).toBe(90);
    expect(list.facets.levels).toEqual(['High', 'Medium', 'Low']);
    expect(list.facets.statuses).toEqual(['New', 'Firmed', 'Under assessment', 'Under resolving', 'Monitor', 'Closed']);
    // "Not closed" is the register's starting filter: every status but Closed
    const closed = ok(call('GET', `${P}/risks?pageSize=200&status=Closed`));
    const live = ok(call('GET', `${P}/risks?pageSize=200&status=Not+closed`));
    expect(live.total + closed.total).toBe(90);
    expect(live.items.some((r: any) => r.status === 'Closed')).toBe(false);
    const first = ok(call('GET', `${P}/risks/PEP-DEN-0001`));
    // Probable (4) x worst of schedule/cost/scope = Moderate (3) = 12, a red cell; after mitigation Unlikely x Minor = 4, green.
    expect(first).toMatchObject({ status: 'Closed', category: 'Project Executional', discipline: 'DE', preScore: 12, preLevel: 'High', preWorst: ['Schedule', 'Cost', 'Scope'], postScore: 4, postLevel: 'Low', currentLevel: 'Low', owners: ['CV Phong', 'DH Tien'] });
    expect(first.actions.length).toBe(3);
    const opts = ok(call('GET', `${P}/risks/options`));
    expect(opts.matrix).toMatchObject({ version: 'Project matrix (4 x 4)', probabilityLabels: ['Rare', 'Unlikely', 'Possible', 'Probable'], severityLabels: ['Negligible', 'Minor', 'Moderate', 'Major'], levels: ['Low', 'Medium', 'High'] });
    // The level is the cell's colour, not a score threshold: 4 is green at Unlikely x Minor but yellow at Probable x Negligible.
    expect(opts.matrix.cells[1][1]).toBe('Low');
    expect(opts.matrix.cells[3][0]).toBe('Medium');
    expect(opts.breakdown.find((b: any) => b.code === 'PEP-T&I')).toMatchObject({ categoryName: 'Project Executional', disciplineName: 'Transportation & Installation' });
  });

  it('rates each impact dimension, takes the worst, and numbers new risks after the register', () => {
    const r = ok(call('POST', `${P}/risks`, risk));
    expect(r).toMatchObject({ id: 'PEP-PRO-0091', no: 91, discipline: 'PRO', preSeverity: 4, preScore: 12, preLevel: 'High', preWorst: ['Schedule'], postLevel: null, currentLevel: 'High', createdBy: ADMIN });
    expect(r.owners).toEqual(['Procurement lead', 'Site manager']);
    const after = ok(call('PATCH', `${P}/risks/${r.id}`, { postProbability: 2, postSchedule: 2, status: 'Monitor' }));
    expect(after).toMatchObject({ status: 'Monitor', postScore: 4, postLevel: 'Low', currentLevel: 'Low', preLevel: 'High' });
  });

  it('validates the rating, the RBS and the lifecycle conditions', () => {
    expect(err(call('POST', `${P}/risks`, { ...risk, preProbability: 5 })).error.issues).toMatchObject([{ path: 'preProbability', message: 'Use 1 to 4.' }]);
    expect(err(call('POST', `${P}/risks`, { ...risk, rbs: 'XXX-YYY' })).error.issues).toMatchObject([{ path: 'rbs' }]);
    expect(err(call('POST', `${P}/risks`, { ...risk, preSchedule: null, preCost: null })).error.issues[0]).toMatchObject({ path: 'preProbability', message: expect.stringMatching(/at least one impact/) });
    expect(err(call('POST', `${P}/risks`, { ...risk, preProbability: null, preSchedule: null, preCost: null })).error.issues[0].message).toMatch(/before it moves beyond Firmed/);
    expect(ok(call('POST', `${P}/risks`, { ...risk, status: 'New', preProbability: null, preSchedule: null, preCost: null })).preLevel).toBeNull();
    expect(err(call('POST', `${P}/risks`, { ...risk, status: 'Closed' })).error.issues).toMatchObject([{ path: 'remark' }]);
    expect(err(call('POST', `${P}/risks`, { ...risk, title: '' })).status).toBe(400);
    expect(err(call('POST', `${P}/risks`, { ...risk, milestoneId: 'NOPE' })).error.issues).toMatchObject([{ path: 'milestoneId' }]);
  });

  it('flags a late response and an overdue review against the cut-off, and links a milestone', () => {
    const r = ok(call('POST', `${P}/risks`, { ...risk, planDate: '2026-10-01', reviewDate: '2026-10-15', milestoneId: '03-M-1020' }));
    expect(r).toMatchObject({ responseOverdue: true, reviewOverdue: true, milestone: 'First Steel Cut for Jacket' });
    expect(ok(call('PATCH', `${P}/risks/${r.id}`, { actualDate: '2026-10-20', actualActions: 'Plate air-freighted' })).responseOverdue).toBe(false);
    expect(ok(call('PATCH', `${P}/risks/${r.id}`, { status: 'Closed' })).reviewOverdue).toBe(false);
  });

  it('tracks mitigation actions with owners and due dates', () => {
    const r = ok(call('POST', `${P}/risks`, risk));
    let d = ok(call('POST', `${P}/risks/${r.id}/actions`, { action: 'Air-freight plate', owner: 'Logistics', dueDate: '2026-11-01' }));
    expect(d).toMatchObject({ actionsTotal: 1, actionsOverdue: 1, actions: [{ action: 'Air-freight plate', done: false, overdue: true }] });
    const aid = d.actions[0].id;
    d = ok(call('PATCH', `${P}/risks/${r.id}/actions/${aid}`, { done: true }));
    expect(d).toMatchObject({ actionsDone: 1, actionsOverdue: 0, actions: [{ done: true, doneDate: '2026-11-08' }] });
    expect(ok(call('DELETE', `${P}/risks/${r.id}/actions/${aid}`)).actionsTotal).toBe(0);
    expect(err(call('POST', `${P}/risks/${r.id}/actions`, { action: 'x' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
  });

  it('filters by one or several disciplines joined with |', () => {
    const all = ok(call('GET', `${P}/risks?pageSize=200`));
    const [a, b] = all.facets.disciplines as string[];
    const one = ok(call('GET', `${P}/risks?pageSize=200&discipline=${encodeURIComponent(a)}`));
    expect(one.total).toBeGreaterThan(0);
    expect(one.items.every((r: any) => r.discipline === a)).toBe(true);
    const both = ok(call('GET', `${P}/risks?pageSize=200&discipline=${encodeURIComponent(`${a}|${b}`)}`));
    expect(both.items.every((r: any) => r.discipline === a || r.discipline === b)).toBe(true);
    expect(both.total).toBe(all.items.filter((r: any) => r.discipline === a || r.discipline === b).length);
    expect(both.total).toBeGreaterThan(one.total);
    const issues = ok(call('GET', `${P}/issues?pageSize=200&sort=discipline`));
    expect(issues.items.length).toBeGreaterThan(0);
  });

  it('filters by level, owner, flag, heatmap cell and response window, and sorts by level', () => {
    const high = ok(call('GET', `${P}/risks?level=High&pageSize=200`));
    expect(high.items.every((r: any) => r.currentLevel === 'High')).toBe(true);
    expect(ok(call('GET', `${P}/risks?owner=TV Minh&pageSize=200`)).items.every((r: any) => r.owners.includes('TV Minh'))).toBe(true);
    expect(ok(call('GET', `${P}/risks?flag=unrated&pageSize=200`)).items.every((r: any) => r.active && !r.preLevel)).toBe(true);
    const hm = ok(call('GET', `${P}/risks/heatmap`));
    expect(hm.matrix.cells).toHaveLength(4);
    expect(ok(call('GET', `${P}/risks?cell=3-3`)).total).toBe(hm.current[2][2]);
    expect(ok(call('GET', `${P}/risks?cell=3-3&basis=pre`)).total).toBe(hm.pre[2][2]);
    const ins = ok(call('GET', `${P}/risks/insights`));
    expect(ins.cards.map((c: any) => c.label)).toEqual(['Active risks', 'High now', 'Response overdue', 'Awaiting post-mitigation', 'Not rated', 'Score reduced']);
    expect(ins.cards[0].value).toBe(62);
    expect(ins.strip.boxes.map((b: any) => b.value).reduce((a: number, b: number) => a + b, 0)).toBe(90);
    expect(ok(call('GET', `${P}/risks?within=overdue`)).total).toBe(ins.lookAhead.boxes[0].value);
    expect(ok(call('GET', `${P}/risks?flag=response-overdue`)).total).toBe(ins.cards[2].value);
    expect(ok(call('GET', `${P}/risks?sort=currentRank&order=desc`)).items[0].currentLevel).toBe('High');
    expect(ok(call('GET', `${P}/risks.csv?q=topsides`)).csv).toContain('Raise of Topsides elevation');
  });

  it('reads hand-edited cells by meaning: status prefixes, rating words, several owners', () => {
    store.updateRow(SHEET.risks, COLUMNS.risks, 'id', 'PEP-DEN-0001', { status: '5-monitor', preProbability: 'possible' as never, preSchedule: 'MAJOR' as never, owner: 'A Nguyen & B Tran' }, { projectId: 'sttp2b' });
    expect(ok(call('GET', `${P}/risks/PEP-DEN-0001`))).toMatchObject({ status: 'Monitor', preProbability: 3, preSchedule: 4, preScore: 12, owners: ['A Nguyen', 'B Tran'] });
  });

  it('falls back to the 5 x 5 matrix v1 for a project without its own', () => {
    const id = ok(call('POST', '/projects', { code: 'P-V1', name: 'No matrix', lifecycle: 'Active' })).id;
    const r = ok(call('POST', `/projects/${id}/risks`, { ...risk, rbs: 'ANY', preProbability: 5, preSchedule: 4 }));
    expect(r).toMatchObject({ id: 'ANY-0001', preScore: 20, preLevel: 'Extreme' });
    expect(ok(call('GET', `/projects/${id}/risks/options`)).matrix.version).toBe('v1 (5 x 5)');
  });

  it('lets only managers delete, and removes the actions with the risk', () => {
    const r = ok(call('POST', `${P}/risks`, risk, MEMBER));
    expect(r.createdBy).toBe(MEMBER);
    ok(call('POST', `${P}/risks/${r.id}/actions`, { action: 'x' }));
    expect(err(call('DELETE', `${P}/risks/${r.id}`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(call('DELETE', `${P}/risks/${r.id}`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `${P}/risks/${r.id}`)).status).toBe(404);
    expect(store.readRows(SHEET.riskActions, COLUMNS.riskActions).some(a => a.riskId === r.id)).toBe(false);
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
  const point = { description: 'Confirm flange rating at the tie-in', originator: 'TEN', target: 'OIC', discipline: 'DE', targetDate: '2026-11-01' };
  const movePoint = (id: string, to: string, extra: object = {}) => call('POST', `${P}/interface-points/${encodeURIComponent(id)}/transition`, { to, ...extra });

  it('loads the interface points register, parties and both matrices from the workbooks', () => {
    const list = ok(call('GET', `${P}/interface-points?pageSize=200`));
    expect(list.total).toBe(34);
    expect(ok(call('GET', `${P}/interface-points/IP-T%26I-0001`))).toMatchObject({ discipline: 'T&I', originator: 'TEN', target: 'OIC', status: 'Open', queryDate: '2026-05-06', ageDays: 184 });
    // The receiving party comes from the IDR number; the subject that was in the target column becomes the title.
    expect(ok(call('GET', `${P}/interface-points/IP-DE-0026`))).toMatchObject({ target: 'PVEP-CL', title: 'X-Mass Tree Data', status: 'Responded', overdue: true });
    expect(ok(call('GET', `${P}/interfaces/parties`)).find((p: any) => p.code === 'TEN').name).toBe('Technip Energy');
    const resp = ok(call('GET', `${P}/interfaces/responsibility`));
    expect(resp.facilities.map((f: any) => f.facility)).toContain('CGF Jacket');
    expect(resp.rows[0]).toMatchObject({ section: 'Project Management', level: 1, cells: { 'CGF Platform': 'CTR', 'Brownfield WHP-C Well Tie-in': 'CPY' } });
    const rasci = ok(call('GET', `${P}/interfaces/rasci`));
    expect(rasci.matrices.map((m: any) => m.name)).toEqual(['LQ Module #1 & #2', 'CGF Jacket & Link Bridge']);
    expect(rasci.matrices[0].rows[0]).toMatchObject({ activity: 'Project Management', roles: { CTR: 'R&A', CPY: 'C' } });
  });

  it('raises points with a register-style number, without needing an interface', () => {
    const p = ok(call('POST', `${P}/interface-points`, point));
    expect(p).toMatchObject({ id: 'IP-DE-0035', status: 'Open', overdue: true, queryDate: '2026-11-08', interfaceId: null, title: 'Confirm flange rating at the tie-in', allowedNext: ['Responded', 'Resolved'] });
    expect(err(call('POST', `${P}/interface-points`, { ...point, target: 'ten' })).error.issues).toMatchObject([{ path: 'target' }]);
    expect(err(call('POST', `${P}/interface-points`, { ...point, interfaceId: 'INT-999' })).status).toBe(400);
  });

  it('moves points through their lifecycle only by transition, needing a response', () => {
    const { id } = ok(call('POST', `${P}/interface-points`, point));
    expect(ok(call('PATCH', `${P}/interface-points/${id}`, { status: 'Closed', action: 'OIC to confirm' }))).toMatchObject({ status: 'Open', action: 'OIC to confirm' });
    expect(err(movePoint(id, 'Responded')).error.code).toBe('RESPONSE_REQUIRED');
    expect(err(movePoint(id, 'Closed')).error.code).toBe('INVALID_TRANSITION');
    expect(ok(movePoint(id, 'Responded', { resolution: 'Rating is class 600' }))).toMatchObject({ status: 'Responded', resolution: 'Rating is class 600' });
    expect(ok(movePoint(id, 'Resolved'))).toMatchObject({ status: 'Resolved', resolvedDate: '2026-11-08', settled: true, overdue: false, ageDays: 0 });
    expect(ok(movePoint(id, 'Open'))).toMatchObject({ status: 'Open', resolvedDate: null });
  });

  it('summarises points and filters by party, window, age and status', () => {
    const ins = ok(call('GET', `${P}/interface-points/insights`));
    expect(ins.cards.map((c: any) => c.label)).toEqual(['Open points', 'Overdue', 'Awaiting response', 'Awaiting acceptance', 'No target date', 'Average age']);
    expect(ins.cards[0].value).toBe(33);
    expect(ok(call('GET', `${P}/interface-points?overdue=true`)).total).toBe(ins.cards[1].value);
    expect(ok(call('GET', `${P}/interface-points?within=overdue`)).total).toBe(ins.lookAhead.boxes[0].value);
    expect(ok(call('GET', `${P}/interface-points?target=OIC`)).items.every((p: any) => p.target === 'OIC')).toBe(true);
    const age = ins.charts.find((c: any) => c.filterKey === 'age');
    const bars = age.series[0].data.map((n: number, i: number) => n + age.series[1].data[i]);
    expect(ok(call('GET', `${P}/interface-points?age=${age.filterValues[4]}`)).total).toBe(bars[4]);
    expect(ok(call('GET', `${P}/interface-points?status=Resolved`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interface-points.csv?q=bridge`)).csv).toContain('IP-T&I-0001');
  });

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

  it('groups points under an interface and blocks its closure while any is unresolved', () => {
    const { id } = create();
    ['Assigned', 'Information requested'].forEach(s => ok(move(id, s)));
    ok(call('PATCH', `${P}/interfaces/${id}`, { response: 'Done' }));
    ['Responded', 'Under review', 'Agreed'].forEach(s => ok(move(id, s)));
    const pt = ok(call('POST', `${P}/interface-points`, { ...point, interfaceId: id }));
    expect(pt).toMatchObject({ interfaceId: id, interfaceTitle: iface.title });
    expect(err(move(id, 'Closed')).error).toMatchObject({ code: 'POINTS_UNRESOLVED', message: '1 interface point is not resolved or closed yet.' });
    expect(ok(call('GET', `${P}/interfaces/${id}`))).toMatchObject({ pointsTotal: 1, pointsOpen: 1, points: [{ id: pt.id }] });
    ok(movePoint(pt.id, 'Resolved', { resolution: 'Agreed' }));
    expect(ok(move(id, 'Closed')).status).toBe('Closed');
    expect(err(call('POST', `${P}/interface-points`, { ...point, interfaceId: id })).error.code).toBe('INTERFACE_CLOSED');
  });

  it('filters the register', () => {
    create();
    create({ title: 'Other', originator: 'Vendor A', receiver: 'Vendor B', type: 'Physical', needDate: '2026-10-01' });
    expect(ok(call('GET', `${P}/interfaces?party=vendor a`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interfaces?type=Physical`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interfaces?overdue=true`)).items.map((i: any) => i.title)).toEqual(['Other']);
    expect(ok(call('GET', `${P}/interfaces?q=boundary`)).total).toBe(1);
    expect(ok(call('GET', `${P}/interfaces`)).facets.parties).toEqual(['Jacket fabricator', 'Topside fabricator', 'Vendor A', 'Vendor B']);
    expect(ok(call('GET', `${P}/interfaces.csv`)).csv).toContain('Topside to jacket');
  });

  it('derives the party matrix from the points and the register', () => {
    create({ originator: 'TEN', receiver: 'OIC' });
    const m = ok(call('GET', `${P}/interfaces/matrix`));
    expect(m.total).toBe(34);
    expect(m.interfaces).toBe(1);
    const cell = m.cells.find((c: any) => c.originator === 'TEN' && c.receiver === 'OIC');
    expect(cell).toMatchObject({ interfaces: 1 });
    expect(cell.total).toBe(ok(call('GET', `${P}/interface-points?originator=TEN&target=OIC`)).total);
    expect(m.names.TEN).toBe('Technip Energy');
    expect(ok(call('GET', `${P}/interfaces/summary`))).toMatchObject({ total: 1, open: 1, points: 34, pointsOpen: 33 });
  });

  it('deletes only interfaces without points, and only as a manager', () => {
    const { id } = create();
    const pt = ok(call('POST', `${P}/interface-points`, { ...point, interfaceId: id }));
    expect(err(call('DELETE', `${P}/interfaces/${id}`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(err(call('DELETE', `${P}/interfaces/${id}`)).error.code).toBe('HAS_POINTS');
    expect(err(call('DELETE', `${P}/interface-points/${pt.id}`, undefined, MEMBER)).status).toBe(403);
    ok(call('DELETE', `${P}/interface-points/${pt.id}`));
    expect(call('DELETE', `${P}/interfaces/${id}`)).toMatchObject({ ok: true, status: 204 });
  });

  it('links each module to its sheet and guards the matrix module', () => {
    const { modules } = ok(call('GET', `${P}/modules`));
    expect(modules.find((m: any) => m.key === 'interface.points').sheet.name).toBe('Governance - Interface points');
    expect(modules.find((m: any) => m.key === 'interface.matrix').sheet.name).toBe('Governance - Responsibility matrix');
    ok(call('PUT', `${P}/modules/interface.matrix`, { state: 'Disabled' }));
    expect(err(call('GET', `${P}/interfaces/matrix`)).error.code).toBe('MODULE_DISABLED');
    expect(err(call('GET', `${P}/interfaces/rasci`)).error.code).toBe('MODULE_DISABLED');
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
    ok(call('POST', `${P}/risks`, { title: 'Before', rbs: 'PEP-PRO', owner: 'Me' }));
    ok(save({ cutoff: '2026-10-30' }));
    ok(call('POST', `${P}/risks`, { title: 'After', rbs: 'PEP-PRO', owner: 'Me' }));
    store.updateRow(SHEET.procurement, COLUMNS.procurement, 'id', 'PR-001', { status: 'Changed live' }, { projectId: 'sttp2b' });

    expect(ok(call('GET', `${P}/risks`)).total).toBe(92);
    expect(ok(call('GET', `${P}/risks?asOf=2026-10-30&flag=active&q=e`)).items.map((r: any) => r.title)).toContain('Before');
    expect(ok(call('GET', `${P}/risks?asOf=2026-10-30&pageSize=200`)).items.map((r: any) => r.title)).not.toContain('After');
    expect(ok(call('GET', `${P}/risks/summary?asOf=2026-10-30`)).total).toBe(91);
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
    expect(p.total).toBe(148);
    expect(ok(call('GET', `${P}/expediting/packages?pageSize=200&asOf=2026-10-30`)).total).toBe(145);
    const chunks = store.readRows(SHEET.snapshotData, COLUMNS.snapshotData).filter(r => r.dataset === 'expediting');
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every(c => String(c.json).length <= 40_000)).toBe(true);
  });

  it('is read-only and strict about the date', () => {
    ok(save());
    expect(err(call('POST', `${P}/risks?asOf=2026-10-30`, { title: 'x', rbs: 'PEP-PRO', owner: 'o' })).error.code).toBe('READ_ONLY_SNAPSHOT');
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

describe('construction budget', () => {
  const B = `${P}/construction/budget`;
  const add = (wbs: string, extra: object = {}, user = ADMIN) => ok(call('POST', B, { wbs, name: `Activity ${wbs}`, ...extra }, user));

  describe('loaded from the MPI tracking workbook', () => {
    it('carries the WBS with budget, actual and earned manhours, rolled up from the activities', () => {
      const r = ok(call('GET', B));
      expect(r.summary.activities).toBeGreaterThan(300);
      expect(r.summary.totalHours).toBeGreaterThan(2_900_000);
      expect(r.summary.actualHours).toBeGreaterThan(340_000);
      expect(r.summary.cpi).toBeGreaterThan(0.9);
      expect(r.summary.cpi).toBeLessThan(1.1);
      expect(r.summary.progressPct).toBeGreaterThan(5);
      const areas = r.items.filter((n: any) => n.level === 1);
      expect(areas.map((n: any) => n.wbs)).toEqual(['CGF-TOPSIDE', 'PRELIMINARY']);
      // each area's figures are the sum of the activities below it, and every discipline adds up to its area
      for (const area of areas) {
        const below = r.items.filter((n: any) => n.leaf && n.top === area.wbs);
        expect(area.hours).toBeCloseTo(below.reduce((a: number, n: any) => a + n.ownHours, 0), 0);
        expect(area.actualHours).toBeCloseTo(below.reduce((a: number, n: any) => a + (n.ownActual ?? 0), 0), 0);
      }
      expect(areas[0].notes).toContain('2,148,412'); // the workbook's own area total disagrees with its disciplines, and says so
      expect(r.items.filter((n: any) => n.level === 4).every((n: any) => n.leaf)).toBe(true);
    });

    it('draws a histogram from the discipline spans of the baseline schedule, and exports actuals in the CSV', () => {
      const h = ok(call('GET', `${B}/histogram?by=month`));
      expect(h.periods.length).toBeGreaterThan(12);
      expect(h.scheduledHours).toBeGreaterThan(1_000_000);
      const csv = ok(call('GET', `${B}.csv`)).csv as string;
      expect(csv.split(String.fromCharCode(10))[0]).toContain('Actual manhours');
    });

    it('lets a manager correct the hours spent on an activity, and the totals follow', () => {
      const leaf = ok(call('GET', B)).items.find((n: any) => n.leaf && n.ownActual > 0);
      const before = ok(call('GET', B)).summary.actualHours;
      ok(call('PATCH', `${B}/${leaf.wbs}`, { actualHours: leaf.ownActual + 100 }, MANAGER));
      expect(ok(call('GET', B)).summary.actualHours).toBeCloseTo(before + 100, 1);
      expect(call('PATCH', `${B}/${leaf.wbs}`, { actualHours: 1 }, CLIENT).ok).toBe(false);
    });
  });

  describe('typed by hand', () => {
  beforeEach(() => { store.deleteRows(SHEET.budget, COLUMNS.budget, { projectId: 'sttp2b' }); });

  it('starts empty and keeps its own sheet', () => {
    expect(ok(call('GET', B))).toMatchObject({ items: [], summary: { totalHours: 0, activities: 0 } });
    expect(ok(call('GET', `${P}/modules`)).modules.find((m: any) => m.key === 'construction.budget').sheet.name).toBe('EPCIC - Construction budget');
    expect(ok(call('GET', `${P}/modules`)).modules.find((m: any) => m.key === 'construction').availability).toBe('Available');
  });

  it('rolls hours up the WBS and counts only activities at the bottom', () => {
    add('1', { name: 'Jacket', manhours: 999 });
    add('1.1', { parentWbs: '1', name: 'Fabrication' });
    add('1.1.1', { parentWbs: '1.1', name: 'Roll up', discipline: 'Structural', manhours: 400, planStart: '2026-11-02', planFinish: '2026-11-15' });
    add('1.1.2', { parentWbs: '1.1', name: 'Weld', discipline: 'Structural', manhours: 600 });
    add('2', { name: 'LQ module' });
    add('2.1', { parentWbs: '2', name: 'Stack up', discipline: 'Piping', manhours: 250 });
    const r = ok(call('GET', B));
    expect(r.items.map((n: any) => [n.wbs, n.level, n.hours, n.leaf])).toEqual([['1', 1, 1000, false], ['1.1', 2, 1000, false], ['1.1.1', 3, 400, true], ['1.1.2', 3, 600, true], ['2', 1, 250, false], ['2.1', 2, 250, true]]);
    expect(r.items[0]).toMatchObject({ ownHours: 999, top: '1', children: 1, start: '2026-11-02', finish: '2026-11-15' });
    expect(r.summary).toMatchObject({ totalHours: 1250, activities: 3, nodes: 6, scheduledHours: 400, unscheduledHours: 850, byDiscipline: { Structural: 1000, Piping: 250 } });
    expect(r.summary.topLevel).toEqual([{ wbs: '1', name: 'Jacket', hours: 1000 }, { wbs: '2', name: 'LQ module', hours: 250 }]);
  });

  it('sorts WBS codes naturally', () => {
    ['10', '2', '1'].forEach(c => add(c, { manhours: 1 }));
    expect(ok(call('GET', B)).items.map((n: any) => n.wbs)).toEqual(['1', '2', '10']);
  });

  it('validates codes, parents, dates and duplicates', () => {
    add('1');
    expect(err(call('POST', B, { wbs: '1', name: 'Dup' })).error.code).toBe('WBS_EXISTS');
    expect(err(call('POST', B, { wbs: 'a b', name: 'x' })).error.issues).toMatchObject([{ path: 'wbs' }]);
    expect(err(call('POST', B, { wbs: '9', name: 'x', parentWbs: 'nope' })).error.issues).toMatchObject([{ path: 'parentWbs' }]);
    expect(err(call('POST', B, { wbs: '9', name: 'x', manhours: -5 })).status).toBe(400);
    expect(err(call('POST', B, { wbs: '9', name: 'x', planStart: '2026-11-10', planFinish: '2026-11-09' })).error.issues).toMatchObject([{ path: 'planFinish' }]);
    expect(err(call('PATCH', `${B}/1`, { planStart: '2026-11-10', planFinish: '2026-11-09' })).status).toBe(400);
  });

  it('edits, moves and deletes, refusing loops and parents with children', () => {
    add('1'); add('1.1', { parentWbs: '1' }); add('1.1.1', { parentWbs: '1.1', manhours: 10 }); add('2');
    expect(ok(call('PATCH', `${B}/1.1.1`, { manhours: 30, name: 'Renamed' }))).toMatchObject({ ownHours: 30, name: 'Renamed' });
    expect(err(call('PATCH', `${B}/1`, { parentWbs: '1.1.1' })).error.issues).toMatchObject([{ path: 'parentWbs' }]);
    expect(err(call('PATCH', `${B}/1`, { parentWbs: '1' })).status).toBe(400);
    expect(ok(call('PATCH', `${B}/1.1`, { parentWbs: '2' })).level).toBe(2);
    expect(ok(call('GET', B)).items.find((n: any) => n.wbs === '2').hours).toBe(30);
    expect(err(call('DELETE', `${B}/2`)).error.code).toBe('HAS_CHILDREN');
    expect(err(call('DELETE', `${B}/1.1.1`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(call('DELETE', `${B}/1.1.1`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('PATCH', `${B}/nope`, { name: 'x' })).status).toBe(404);
  });

  it('spreads each activity evenly over its dates and adds up per week, with a cumulative curve', () => {
    add('1', { name: 'Jacket' });
    add('1.1', { parentWbs: '1', manhours: 700, planStart: '2026-11-02', planFinish: '2026-11-15', discipline: 'Structural' });
    add('2', { name: 'LQ' });
    add('2.1', { parentWbs: '2', manhours: 300, planStart: '2026-11-09', planFinish: '2026-11-22', discipline: 'Piping' });
    add('3', { manhours: 50 });
    const h = ok(call('GET', `${B}/histogram`));
    expect(h).toMatchObject({ by: 'week', group: 'wbs', from: '2026-11-02', to: '2026-11-22', totalHours: 1050, scheduledHours: 1000, unscheduledHours: 50, outsideHours: 0, peak: { start: '2026-11-09', hours: 500 } });
    expect(h.periods.map((p: any) => [p.start, p.total])).toEqual([['2026-11-02', 350], ['2026-11-09', 500], ['2026-11-16', 150]]);
    expect(h.periods[1].byGroup).toEqual({ '1': 350, '2': 150 });
    expect(h.cumulative).toEqual([350, 850, 1000]);
    expect(h.groups).toEqual([{ key: '1', label: '1 Jacket' }, { key: '2', label: '2 LQ' }]);
    const d = ok(call('GET', `${B}/histogram?group=discipline`));
    expect(d.groups.map((g: any) => g.key)).toEqual(['Piping', 'Structural']);
    expect(d.periods[1].byGroup).toEqual({ Structural: 350, Piping: 150 });
  });

  it('groups by month, honours a range and reports hours outside it', () => {
    add('1', { manhours: 310, planStart: '2026-10-25', planFinish: '2026-11-04' });
    const m = ok(call('GET', `${B}/histogram?by=month`));
    expect(m.periods.map((p: any) => [p.start, p.total])).toEqual([['2026-10-01', 197.27], ['2026-11-01', 112.73]]);
    const clipped = ok(call('GET', `${B}/histogram?by=month&from=2026-11-01&to=2026-11-30`));
    expect(clipped.periods).toHaveLength(1);
    expect(clipped.outsideHours).toBeCloseTo(197.27, 1);
    expect(err(call('GET', `${B}/histogram?from=2026-12-01&to=2026-11-01`)).status).toBe(400);
    expect(ok(call('GET', `${B}/histogram`, undefined, MEMBER)).totalHours).toBe(310);
  });

  it('imports a whole WBS at once and checks all of it first', () => {
    const rows = [
      { wbs: '1', name: 'Jacket' }, { wbs: '1.1', name: 'Fab', parentWbs: '1' },
      { wbs: '1.1.1', name: 'Roll up', parentWbs: '1.1', manhours: 120, discipline: 'Structural', planStart: '2026-11-02', planFinish: '2026-11-08' },
    ];
    expect(ok(call('POST', `${B}/import`, { rows }, MEMBER))).toMatchObject({ mode: 'append', imported: 3, totalHours: 120, activities: 1 });
    expect(err(call('POST', `${B}/import`, { rows: [{ wbs: '1', name: 'again' }] })).error.issues).toMatchObject([{ path: 'rows.0.wbs' }]);
    expect(err(call('POST', `${B}/import`, { rows: [{ wbs: '5', name: 'a' }, { wbs: '5', name: 'b' }] })).status).toBe(400);
    expect(err(call('POST', `${B}/import`, { rows: [{ wbs: '6', name: 'orphan', parentWbs: 'zz' }] })).error.issues).toMatchObject([{ path: 'rows.0.parentWbs' }]);
    expect(err(call('POST', `${B}/import`, { rows: [{ wbs: 'a', name: 'a', parentWbs: 'b' }, { wbs: 'b', name: 'b', parentWbs: 'a' }] })).status).toBe(400);
    expect(ok(call('GET', B)).summary.nodes).toBe(3);
    expect(err(call('POST', `${B}/import`, { mode: 'replace', rows: [{ wbs: 'n', name: 'New' }] }, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(ok(call('POST', `${B}/import`, { mode: 'replace', rows: [{ wbs: 'n', name: 'New', manhours: 5 }] }, MANAGER))).toMatchObject({ imported: 1, nodes: 1, totalHours: 5 });
  });

  it('exports CSV, is read-only for clients, is scoped to its project and sits in cut-off reports', () => {
    add('1', { name: 'Jacket, main', manhours: 80 });
    expect(ok(call('GET', `${B}.csv`)).csv).toContain('"Jacket, main"');
    expect(err(call('POST', B, { wbs: '2', name: 'x' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
    expect(ok(call('GET', B, undefined, CLIENT)).summary.totalHours).toBe(80);
    const other = ok(call('POST', '/projects', { code: 'BUD-2', name: 'Other' }));
    expect(ok(call('GET', `/projects/${other.id}/construction/budget`)).items).toEqual([]);
    expect(ok(call('POST', `${P}/snapshots`, { cutoff: '2026-10-30' }, MANAGER)).cutoff).toBe('2026-10-30');
    ok(call('PATCH', `${B}/1`, { manhours: 500 }));
    expect(ok(call('GET', `${B}?asOf=2026-10-30`)).summary.totalHours).toBe(80);
    expect(ok(call('GET', B)).summary.totalHours).toBe(500);
  });

  it('is unavailable when its module is switched off', () => {
    ok(call('PUT', `${P}/modules/construction.budget`, { state: 'Disabled' }));
    expect(err(call('GET', B)).error.code).toBe('MODULE_DISABLED');
  });
  });
});

describe('general knowledge', () => {
  const K = `${P}/knowledge`;
  const article = { domain: 'quality', category: 'Standard', title: 'Weld inspection', summary: 'What is inspected and when.', body: '## Scope\n- Visual', tags: ['weld', 'NDT', 'weld'], sources: [{ title: 'Quality plan', ref: 'QP-001', url: 'https://example.com/qp' }] };
  const mk = (extra: object = {}, user = MEMBER) => ok(call('POST', K, { ...article, ...extra }, user));

  it('ships starter articles taken from the project data, filed by area', () => {
    const s = ok(call('GET', `${K}/summary`));
    expect(s.total).toBe(4);
    expect(Object.keys(s.byDomain).sort()).toEqual(['construction', 'huc', 'procurement', 'ti']);
    expect(s.taxonomy.map((t: any) => t.domain)).toEqual(['engineering', 'procurement', 'services', 'quality', 'hse', 'construction', 'precom', 'ti', 'huc']);
    expect(s.taxonomy.find((t: any) => t.domain === 'engineering').categories).toEqual(['Process', 'Safety', 'Structure', 'Piping', 'Mechanical', 'Electrical', 'Instrument', 'Telecom', 'Materials', 'Pipeline', 'Other']);
    expect(s.taxonomy.find((t: any) => t.domain === 'precom').label).toBe('Pre-com / Commissioning');
    const seq = ok(call('GET', `${K}/KB-002`));
    expect(seq).toMatchObject({ domain: 'construction', category: 'Sequence', status: 'Published', createdBy: 'Admin (demo)', sources: [{ title: 'STTP2B - Key Milestones Rev 0' }] });
    expect(seq.body).toContain('- 7 May 2026: First Steel Cut for Jacket (03-M-1020, VSP)');
    expect(seq.body.indexOf('7 May 2026')).toBeLessThan(seq.body.indexOf('14 Nov 2026'));
    expect(ok(call('GET', `${K}/KB-001`)).body).toContain('PO placed: a PO number is recorded');
  });

  it('lists with filters, search and paging, without sending the full text', () => {
    const l = ok(call('GET', K));
    expect(l.total).toBe(4);
    expect(l.items[0]).not.toHaveProperty('body');
    expect(ok(call('GET', `${K}?domain=ti`)).items.map((a: any) => a.id)).toEqual(['KB-003']);
    expect(ok(call('GET', `${K}?domain=construction&category=Plan`)).total).toBe(0);
    expect(ok(call('GET', `${K}?q=float-over`)).total).toBeGreaterThan(0);
    expect(ok(call('GET', `${K}?tag=milestones`)).total).toBe(1);
    expect(ok(call('GET', `${K}?pageSize=2&page=2`)).items).toHaveLength(2);
    expect(ok(call('GET', `${K}?domain=construction`)).facets.categories).toEqual({ Sequence: 1 });
    expect(err(call('GET', `${K}?domain=nope`)).status).toBe(400);
  });

  it('creates, edits and deletes articles with the right roles', () => {
    const a = mk();
    expect(a).toMatchObject({ id: 'KB-005', status: 'Published', tags: ['weld', 'NDT'], createdBy: 'Team member (demo)', domainLabel: 'Quality', sources: [{ title: 'Quality plan', ref: 'QP-001', url: 'https://example.com/qp' }] });
    expect(ok(call('PATCH', `${K}/${a.id}`, { domain: 'hse', category: 'Event', title: 'Renamed', status: 'Draft' }, MANAGER))).toMatchObject({ domain: 'hse', category: 'Event', title: 'Renamed', status: 'Draft', updatedBy: 'Manager (demo)', createdBy: 'Team member (demo)' });
    expect(err(call('POST', K, article, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
    expect(ok(call('GET', K, undefined, CLIENT)).total).toBe(5);
    expect(err(call('DELETE', `${K}/${a.id}`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(call('DELETE', `${K}/${a.id}`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `${K}/${a.id}`)).status).toBe(404);
  });

  it('validates the area, topic, links and size', () => {
    const bad = (extra: object, path: string) => expect(err(call('POST', K, { ...article, ...extra })).error.issues?.some((i: any) => i.path.startsWith(path))).toBe(true);
    bad({ category: 'Weld' }, 'category');
    bad({ domain: 'nope' }, 'domain');
    bad({ summary: '' }, 'summary');
    bad({ title: '' }, 'title');
    bad({ sources: [{ title: 'x', url: 'javascript:alert(1)' }] }, 'sources');
    bad({ status: 'Archived' }, 'status');
    expect(err(call('PATCH', `${K}/KB-001`, { category: 'Seq' })).error.issues).toMatchObject([{ path: 'category' }]);
  });

  it('hides an area whose submodule is switched off, and refuses writes to it', () => {
    ok(call('PUT', `${P}/modules/knowledge.ti`, { state: 'Disabled' }));
    expect(ok(call('GET', K)).total).toBe(3);
    expect(ok(call('GET', `${K}/summary`)).taxonomy.find((t: any) => t.domain === 'ti').enabled).toBe(false);
    expect(err(call('GET', `${K}/KB-003`)).status).toBe(404);
    expect(err(call('POST', K, { ...article, domain: 'ti', category: 'Sequence' })).error.code).toBe('MODULE_DISABLED');
    ok(call('PUT', `${P}/modules/knowledge`, { state: 'Disabled' }));
    expect(err(call('GET', K)).error.code).toBe('MODULE_DISABLED');
  });

  it('keeps one project\'s articles away from another', () => {
    const other = ok(call('POST', '/projects', { code: 'KNW-2', name: 'Other' }));
    expect(ok(call('GET', `/projects/${other.id}/knowledge`)).total).toBe(0);
    expect(ok(call('POST', `/projects/${other.id}/knowledge`, article)).id).toBe('KB-001');
    expect(ok(call('GET', K)).total).toBe(4);
  });
});

describe('procurement registers', () => {
  it('summarises Logistics before the register with six cards, receiving windows and weight trends', () => {
    const insights = ok(call('GET', `${P}/logistics/insights`));
    expect(insights.cards).toHaveLength(6);
    expect(insights.lookAhead.boxes.map((b: any) => b.label)).toEqual(['Overdue', 'Within 30 days', 'Within 45 days', 'Within 60 days', 'No date']);
    expect(insights.charts.map((c: any) => c.title)).toEqual(['Arrivals at site by month (gross weight, t)', 'Weight at delivery yards (t)']);
    expect(insights.charts[0].series.map((s: any) => s.name)).toEqual(['Received (actual)', 'Open (forecast)']);
    expect(insights.charts[1].series.map((s: any) => s.name)).toEqual(['Received', 'Still to arrive']);
  });
  const PK = `${P}/procurement/packages`;
  const EX = `${P}/expediting/packages`;
  const LG = `${P}/logistics/shipments`;
  const MB = `${P}/materials/balance`;
  const MS = `${P}/materials/summary`;
  const PC = `${P}/procurement/concerns`;

  it('loads the procurement plan, logistics, material and concern data from the workbooks', () => {
    const pk = ok(call('GET', `${PK}?pageSize=200`));
    expect(pk.total).toBe(148);
    expect(pk.items.filter((p: any) => p.status === 'Planned')).toHaveLength(9);
    expect(pk.items.filter((p: any) => p.workPackage).length).toBeGreaterThan(130);
    expect(pk.items.find((p: any) => p.code === 'STTP2B-GF-MEC-017')).toMatchObject({ status: 'Planned', workPackage: 'WP2', packageType: 'PS', vendor: null });
    expect(ok(call('GET', `${LG}?pageSize=200`)).total).toBe(200);
    expect(ok(call('GET', `${LG}?source=Client`)).total).toBe(42);
    expect(ok(call('GET', `${MB}?pageSize=200`)).total).toBe(190);
    expect(ok(call('GET', MS)).items).toHaveLength(10);
    const c = ok(call('GET', `${PC}/summary`));
    expect(c).toMatchObject({ total: 29, open: 29, bySeverity: { High: 5, Medium: 24, Critical: 0, Low: 0 }, byType: { Issue: 5, Risk: 5, Concern: 19 } });
    expect(ok(call('GET', `${P}/modules`)).modules.find((m: any) => m.key === 'procurement.logistics').sheet.name).toBe('EPCIC - Logistics shipments');
    expect(ok(call('GET', `${P}/modules`)).modules.find((m: any) => m.key === 'procurement.concerns').sheet.name).toBe('EPCIC - Procurement concerns');
  });

  it('creates and edits procurement packages, deriving the status from what is recorded', () => {
    const a = ok(call('POST', PK, { code: 'STTP2B-GF-TST-001', description: 'Test package', discipline: 'Piping' }, MEMBER));
    expect(a).toMatchObject({ id: 'PR-149', status: 'Planned', vendor: null });
    expect(ok(call('PATCH', `${PK}/${a.id}`, { vendor: 'Acme Ltd' }, MEMBER)).status).toBe('In tendering');
    expect(ok(call('PATCH', `${PK}/${a.id}`, { loaNo: '001/LOA', loaDate: '2026-10-01' })).status).toBe('LOA issued');
    expect(ok(call('PATCH', `${PK}/${a.id}`, { poNo: '100-2026/PO', poDate: '2026-11-02', buyer: 'Hong' })).status).toBe('PO placed');
    expect(ok(call('PATCH', `${PK}/${a.id}`, { poNo: null })).status).toBe('LOA issued');
    expect(ok(call('GET', `${PK}/${a.id}`))).toMatchObject({ vendor: 'Acme Ltd', loaNo: '001/LOA', poNo: null });
    expect(err(call('POST', PK, { code: 'STTP2B-GF-TST-001' })).error.code).toBe('CODE_TAKEN');
    expect(err(call('PATCH', `${PK}/PR-001`, { code: 'STTP2B-GF-TST-001' })).error.code).toBe('CODE_TAKEN');
    expect(err(call('POST', PK, { code: 'x' })).status).toBe(400);
    expect(err(call('POST', PK, { code: 'STTP2B-GF-TST-002', loaDate: '1/2/2026' })).status).toBe(400);
    expect(err(call('POST', PK, { code: 'STTP2B-GF-TST-002' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
    expect(err(call('DELETE', `${PK}/${a.id}`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(call('DELETE', `${PK}/${a.id}`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(err(call('GET', `${PK}/${a.id}`)).status).toBe(404);
  });

  it('creates and edits expediting packages and works out the variance', () => {
    const x = ok(call('POST', EX, { code: 'STTP2B-GF-TST-009', name: 'Test skid', discipline: 'Equipment', status: 'Normal', planPct: 40, actualPct: 35.5, rosDate: '2026-12-01' }, MEMBER));
    expect(x).toMatchObject({ id: 'EX-146', variance: -4.5, rosDate: '2026-12-01' });
    expect(ok(call('PATCH', `${EX}/${x.id}`, { actualPct: 42, status: 'At Risk', highlight: 'Vendor behind', actionPlan: 'Weekly call' }))).toMatchObject({ variance: 2, status: 'At Risk', highlight: 'Vendor behind' });
    expect(ok(call('PATCH', `${EX}/${x.id}`, { planPct: null })).variance).toBeNull();
    expect(err(call('POST', EX, { code: 'STTP2B-GF-TST-009', status: 'Normal' })).error.code).toBe('CODE_TAKEN');
    expect(err(call('POST', EX, { code: 'STTP2B-GF-TST-010', status: 'Normal', actualPct: 120 })).status).toBe(400);
    expect(call('DELETE', `${EX}/${x.id}`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(ok(call('GET', `${P}/expediting/summary`)).total).toBe(145);
  });

  it('tracks shipments and flags the ones past their forecast date against the cut-off', () => {
    const s = ok(call('POST', LG, { source: 'PTSC', packageNo: 'STTP2B-GF-STR-001A', shipmentNo: 'SH-TEST', status: 'On Sailing', forecastOnSite: '2026-11-01', grossWeightKg: 1200 }, MEMBER));
    expect(s).toMatchObject({ id: 'LG-0201', overdue: true, daysLate: 5, status: 'On Sailing' });
    expect(ok(call('GET', `${LG}?pageSize=200`)).items.filter((r: any) => r.overdue)).toHaveLength(1);
    expect(ok(call('PATCH', `${LG}/${s.id}`, { actualOnSite: '2026-11-05' }))).toMatchObject({ status: 'Received', overdue: false, daysLate: null });
    expect(ok(call('GET', `${LG}.csv?source=PTSC`)).csv).toContain('SH-TEST');
    expect(ok(call('GET', `${LG}?q=sh-test`)).total).toBe(1);
    expect(err(call('POST', LG, { source: 'Other', packageNo: 'x', status: 'Planned' })).status).toBe(400);
    expect(err(call('POST', LG, { source: 'PTSC', packageNo: 'x', status: 'Planned', grossWeightKg: -1 })).status).toBe(400);
    expect(call('DELETE', `${LG}/${s.id}`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
  });

  it('keeps stock lines and material weights, with the arrived share worked out', () => {
    const line = ok(call('POST', MB, { description: 'PLATE S355 20 THK', facility: 'JACKET', balance: 12, unit: 'PCS', yard: 'VSP' }, MEMBER));
    expect(line).toMatchObject({ id: 'MB-191', balance: 12 });
    expect(ok(call('GET', `${MB}?yard=VSP&q=s355`)).total).toBeGreaterThan(0);
    expect(ok(call('PATCH', `${MB}/${line.id}`, { balance: 3 })).balance).toBe(3);
    expect(call('DELETE', `${MB}/${line.id}`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    const w = ok(call('POST', MS, { supply: 'Client', facility: 'TEST FACILITY', mtoKg: 1000, arrivedKg: 250 }));
    expect(w.arrivedPct).toBe(25);
    expect(ok(call('PATCH', `${MS}/${w.id}`, { arrivedKg: 1100 })).arrivedPct).toBe(110);
    expect(err(call('POST', MS, { supply: 'Nobody', facility: 'x' })).status).toBe(400);
  });

  it('raises, edits, filters and closes risks, concerns and issues against packages', () => {
    const c = ok(call('POST', PC, { packageCode: 'STTP2B-GF-STR-001A', title: 'Mill slot slipping', type: 'Risk', severity: 'Critical', owner: 'Linh', dueDate: '2026-11-01', action: 'Escalate to vendor director' }, MEMBER));
    expect(c).toMatchObject({ id: 'PC-030', status: 'Open', raisedDate: '2026-11-06', area: 'Delivery', source: 'Manual', overdue: true, ageDays: 0 });
    expect(err(call('POST', PC, { title: 'x', packageCode: 'NO-SUCH-PKG' })).error.issues).toMatchObject([{ path: 'packageCode' }]);
    expect(err(call('POST', PC, { title: '' })).status).toBe(400);
    expect(err(call('POST', PC, { title: 'x' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
    expect(ok(call('GET', `${PC}?severity=Critical`)).items.map((r: any) => r.id)).toEqual(['PC-030']);
    expect(ok(call('GET', `${PC}?type=Concern`)).total).toBe(19);
    expect(ok(call('GET', `${PC}?q=slot`)).total).toBe(1);
    expect(ok(call('GET', `${PC}/summary`))).toMatchObject({ open: 30, overdue: 1, bySeverity: { Critical: 1 } });
    expect(ok(call('GET', `${PC}/summary`)).byPackage.find((p: any) => p.code === 'STTP2B-GF-STR-001A')).toMatchObject({ open: 1, worst: 'Critical', score: 4 });
    expect(ok(call('PATCH', `${PC}/${c.id}`, { status: 'Resolved' }))).toMatchObject({ status: 'Resolved', overdue: false });
    expect(ok(call('GET', `${PC}/summary`))).toMatchObject({ open: 29, closed: 1, overdue: 0 });
    expect(err(call('DELETE', `${PC}/${c.id}`, undefined, MEMBER)).error.code).toBe('MANAGER_REQUIRED');
    expect(call('DELETE', `${PC}/${c.id}`, undefined, MANAGER)).toMatchObject({ ok: true, status: 204 });
    expect(ok(call('GET', `${PC}.csv`)).csv).not.toContain('Mill slot');
  });

  it('puts the pipeline, expediting, shipments, materials and concerns on one dashboard', () => {
    const d = ok(call('GET', `${P}/procurement/dashboard`));
    expect(d.cutoff).toBe('2026-11-06');
    expect(d.pipeline).toMatchObject({ total: 148, byStatus: { Planned: 9, 'In tendering': 0, 'LOA issued': 20, 'PO placed': 119 } });
    expect(d.pipeline.placedPct).toBeGreaterThan(70);
    expect(d.pipeline.byDiscipline.reduce((n: number, x: any) => n + x.total, 0)).toBe(148);
    expect(d.expediting).toMatchObject({ total: 145, health: { delay: 12, highRisk: 3, atRisk: 6, ok: 124 } });
    expect(d.expediting.behind.length).toBe(10);
    expect(d.expediting.behind[0].variance).toBeLessThanOrEqual(d.expediting.behind[9].variance);
    expect(d.logistics).toMatchObject({ total: 200, byStatus: { Received: 162, 'On Sailing': 20, 'Under Customs': 13, 'Inland transportation': 5 }, bySource: { PTSC: 158, Client: 42 }, heldCount: 19 });
    expect(d.materials.totals.map((t: any) => t.supply)).toEqual(['PTSC MC', 'Client']);
    expect(d.concerns).toMatchObject({ open: 29 });
    expect(d.attentionCount).toBe(34);
    const top = d.attention[0];
    expect(top).toMatchObject({ code: 'STTP2B-GF-STR-001L', level: 'Critical' });
    expect(top.reasons).toContain('Expediting: Delay');
    expect(d.attention.every((a: any, i: number, all: any[]) => i === 0 || all[i - 1].score >= a.score)).toBe(true);
  });

  it('serves the weekly procurement S-curve by facility and contract scope, with actuals stopping at the cut-off', () => {
    const all = ok(call('GET', `${P}/procurement/s-curve`));
    expect(all).toMatchObject({ facility: 'OVERALL', scope: 'OVR', cutoff: '2026-11-06' });
    expect(all.facilities[0]).toBe('OVERALL');
    expect(all.facilities).toEqual(expect.arrayContaining(['CGF TOPSIDES', 'CGF JACKET & BRIDGE', 'LQ MODULE #2', 'BROWN FIELD', 'PIPELINE']));
    expect(all.dates.length).toBe(all.plan.length);
    expect(all.dates[1]).toBe('2025-04-11');
    expect(all.actual.length).toBeLessThan(all.dates.length);
    expect(all.dates[all.actual.length - 1]).toBe('2026-11-06');
    expect(all.latest.date).toBe('2026-11-06');
    expect(all.latest.actual).toBeGreaterThan(40);

    const ls = ok(call('GET', `${P}/procurement/s-curve?facility=${encodeURIComponent('CGF TOPSIDES')}&scope=LS`));
    expect(ls).toMatchObject({ facility: 'CGF TOPSIDES', scope: 'LS' });
    expect(ls.scopes).toEqual(['OVR', 'LS', 'PS']);
    expect(ls.latest.actual).not.toBe(all.latest.actual);
    // a scope the facility does not have falls back to the first one it does have
    const lq = ok(call('GET', `${P}/procurement/s-curve?facility=${encodeURIComponent('LQ MODULE #2')}&scope=LS`));
    expect(lq.scopes).toEqual(['OVR', 'PS']);
    expect(lq.scope).toBe('OVR');
    // unknown facility falls back to the overall curve
    expect(ok(call('GET', `${P}/procurement/s-curve?facility=nope`)).facility).toBe('OVERALL');
  });

  it('shows procurement progress by work package from the procurement S-curves, apart from project progress, even when Planning is disabled', () => {
    const d = ok(call('GET', `${P}/procurement/dashboard`));
    expect(d.workPackages.items.length).toBe(5);
    expect(d.workPackages.items.find((w: any) => w.code === 'WP3')).toMatchObject({ plan: 50.04, actual: 48.97 });
    expect(d.workPackages.overall).toMatchObject({ plan: 43.31, actual: 45.6 });
    ok(call('PUT', `${P}/modules/planning.work-packages`, { state: 'Disabled' }));
    expect(ok(call('GET', `${P}/procurement/dashboard`)).workPackages).toEqual(d.workPackages);
    store.updateRow(SHEET.workPackages, COLUMNS.workPackages, 'code', 'WP3', { thisWeekActual: 12, thisWeekPlan: 15 });
    expect(ok(call('GET', `${P}/procurement/dashboard`)).workPackages.items.find((w: any) => w.code === 'WP3')).toMatchObject({ plan: 50.04, actual: 48.97 });
  });

  it('adds new signals to a package when they are raised and drops sections whose module is off', () => {
    const before = ok(call('GET', `${P}/procurement/dashboard`)).attention.find((a: any) => a.code === 'STTP2B-GF-STR-001A')?.score ?? 0;
    ok(call('POST', PC, { packageCode: 'STTP2B-GF-STR-001A', title: 'Hold point not released', severity: 'Critical', dueDate: '2026-10-30' }));
    const after = ok(call('GET', `${P}/procurement/dashboard`)).attention.find((a: any) => a.code === 'STTP2B-GF-STR-001A');
    expect(after.score).toBeGreaterThan(before);
    expect(after.reasons).toContain('Action overdue');
    ok(call('PUT', `${P}/modules/procurement.logistics`, { state: 'Disabled' }));
    ok(call('PUT', `${P}/modules/procurement.concerns`, { state: 'Disabled' }));
    const off = ok(call('GET', `${P}/procurement/dashboard`));
    expect(off.logistics).toBeNull();
    expect(off.concerns).toBeNull();
    expect(off.pipeline).not.toBeNull();
    expect(err(call('GET', LG)).error.code).toBe('MODULE_DISABLED');
    ok(call('PUT', `${P}/modules/procurement.dashboard`, { state: 'Disabled' }));
    expect(err(call('GET', `${P}/procurement/dashboard`)).error.code).toBe('MODULE_DISABLED');
  });

  it('is included in cut-off reports and cannot be changed while one is open', () => {
    ok(call('POST', `${P}/snapshots`, { cutoff: '2026-10-30' }, MANAGER));
    ok(call('POST', LG, { source: 'PTSC', packageNo: 'STTP2B-GF-STR-001A', status: 'Planned' }));
    expect(ok(call('GET', `${LG}?asOf=2026-10-30`)).total).toBe(200);
    expect(ok(call('GET', LG)).total).toBe(201);
    expect(ok(call('GET', `${P}/procurement/dashboard?asOf=2026-10-30`)).logistics.total).toBe(200);
    expect(err(call('POST', `${PC}?asOf=2026-10-30`, { title: 'x' })).error.code).toBe('READ_ONLY_SNAPSHOT');
  });
});

describe('routing', () => {
  it('reports unknown routes and projects', () => {
    expect(err(call('GET', '/nowhere')).status).toBe(404);
    expect(err(call('GET', '/projects/nope/modules')).error.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('profile, password and party access', () => {
  it('shows the person their own profile with party, title and company', () => {
    const me = ok(call('GET', '/me', undefined, CLIENT));
    expect(me).toMatchObject({ party: 'Client', title: 'Client representative', company: 'Client X', hiddenModules: [] });
    expect(me).not.toHaveProperty('passwordHash');
  });

  it('lets a person edit their name, title and company but not their party', () => {
    const me = ok(call('PATCH', '/me', { name: 'Anh Nguyen', title: 'Lead expeditor', company: 'PTSC MC', party: 'Client' }, MEMBER));
    expect(me).toMatchObject({ name: 'Anh Nguyen', title: 'Lead expeditor', company: 'PTSC MC', party: 'Contractor' });
    expect(err(call('PATCH', '/me', { email: 'admin@example.com' }, MEMBER)).status).toBe(409);
  });

  it('sets a first password, then needs the current one to change it', () => {
    expect(err(call('POST', '/me/password', { password: 'short' }, MEMBER)).status).toBe(400);
    ok(call('POST', '/me/password', { password: 'first-password' }, MEMBER));
    expect(ok(call('GET', '/me', undefined, MEMBER)).hasPassword).toBe(true);
    expect(err(call('POST', '/me/password', { current: 'wrong', password: 'second-password' }, MEMBER)).error.code).toBe('WRONG_PASSWORD');
    ok(call('POST', '/me/password', { current: 'first-password', password: 'second-password' }, MEMBER));
    const stored = String(store.readRows(SHEET.users, COLUMNS.users).find(u => u.id === MEMBER)!.passwordHash);
    expect(stored).not.toContain('second-password');
  });

  it('lets an administrator set title, company and party, and lists them without the hash', () => {
    const made = ok(call('POST', '/users', { name: 'Sub Lead', email: 'sub@example.com', party: 'Subcontractor', company: 'Fab Co', title: 'Site lead', password: 'initial-password' }));
    expect(made).toMatchObject({ party: 'Subcontractor', company: 'Fab Co', title: 'Site lead', hasPassword: true });
    const list = ok(call('GET', '/users')) as any[];
    expect(list.every(u => !('passwordHash' in u))).toBe(true);
    expect(ok(call('PATCH', `/users/${made.id}`, { party: 'Client' })).party).toBe('Client');
    expect(err(call('PATCH', `/users/${made.id}`, { party: 'Vendor' })).status).toBe(400);
    expect(err(call('GET', '/users', undefined, MEMBER)).status).toBe(403);
  });

  it('hides a screen from one party only, and its sub-screens with it', () => {
    const before = ok(call('GET', '/party-access'));
    expect(before.parties).toEqual(['Contractor', 'Client', 'Subcontractor']);
    ok(call('PUT', '/party-access', { cells: [{ moduleKey: 'procurement.logistics', party: 'Client', visible: false }, { moduleKey: 'management.risks', party: 'Client', visible: false }] }));
    expect(ok(call('GET', '/me', undefined, CLIENT)).hiddenModules).toEqual(expect.arrayContaining(['procurement.logistics', 'management.risks']));
    expect(ok(call('GET', '/me', undefined, MEMBER)).hiddenModules).toEqual([]);
    expect(ok(call('GET', '/me', undefined, ADMIN)).hiddenModules).toEqual([]);
    expect(err(call('GET', `${P}/risks`, undefined, CLIENT)).error.code).toBe('NOT_FOR_YOUR_PARTY');
    expect(err(call('GET', `${P}/logistics/shipments`, undefined, CLIENT)).error.code).toBe('NOT_FOR_YOUR_PARTY');
    ok(call('GET', `${P}/risks`, undefined, MEMBER));
    ok(call('PUT', '/party-access', { cells: [{ moduleKey: 'management.risks', party: 'Client', visible: true }] }));
    ok(call('GET', `${P}/risks`, undefined, CLIENT));
    expect(err(call('PUT', '/party-access', { cells: [] }, MEMBER)).status).toBe(403);
    expect(err(call('PUT', '/party-access', { cells: [{ moduleKey: 'nope', party: 'Client', visible: false }] })).error.code).toBe('UNKNOWN_MODULE');
  });
});

describe('major milestones for the S-curve', () => {
  it('lists the project gates in date order, not every component milestone', () => {
    const s = ok(call('GET', `${P}/milestones/summary`));
    const names = s.major.map((m: any) => m.description) as string[];
    expect(names[0]).toBe('Project Effective Date');
    expect(names).toContain('Final Acceptance');
    expect(names).toContain('Jacket Ready for Sail-away');
    expect(names).not.toContain('Stack Up Deck 1 at final location');
    expect(s.major.length).toBeGreaterThan(5);
    expect(s.major.length).toBeLessThan(s.total);
    const dates = s.major.map((m: any) => m.actual ?? m.forecast ?? m.planBaseline) as string[];
    expect([...dates].sort()).toEqual(dates);
  });

  it('lets the Major column of the sheet override the rule', () => {
    store.updateRow(SHEET.milestones, COLUMNS.milestones, 'id', 'M1040', { major: 'Yes' }, { projectId: 'sttp2b' });
    store.updateRow(SHEET.milestones, COLUMNS.milestones, 'id', '01-M-1350', { major: 'No' }, { projectId: 'sttp2b' });
    const names = ok(call('GET', `${P}/milestones/summary`)).major.map((m: any) => m.description) as string[];
    expect(names).toContain('Jacket - Roll up Row 2.1');
    expect(names).not.toContain('Final Acceptance');
  });
});

describe('facility schedule and progress', () => {
  it('lists the five facilities with data and DSF as later', () => {
    const r = ok(call('GET', `${P}/facilities`));
    expect(r.facilities.map((f: any) => f.label)).toEqual(['CGF Topside', 'CGF Jacket', 'Pile & Conductor', 'Bridge', 'LQM#2', 'DSF']);
    const dsf = r.facilities.find((f: any) => f.id === 'dsf');
    expect(dsf).toMatchObject({ later: true, headline: null, scopeCount: 0 });
    for (const f of r.facilities.filter((x: any) => !x.later)) {
      expect(f.headline, f.id).not.toBeNull();
      expect(f.headline.actual).toBeGreaterThanOrEqual(0);
      expect(f.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('gives each facility its own S-curves, plan reaching 100 percent', () => {
    for (const id of ['cgf-topsides', 'cgf-jacket', 'pile-conductor', 'bridge', 'lqm2']) {
      const p = ok(call('GET', `${P}/facilities/${id}/progress`));
      expect(p.scopes.length, id).toBeGreaterThan(0);
      const head = p.scopes.find((s: any) => s.headline);
      expect(head, id).toBeTruthy();
      expect(head.points[head.points.length - 1].plan).toBeGreaterThan(99);
      const dates = head.points.map((x: any) => x.date);
      expect([...dates].sort()).toEqual(dates);
    }
  });

  it('shows the overall curve and phases for the jacket, with the actual stopping at the cut-off', () => {
    const p = ok(call('GET', `${P}/facilities/cgf-jacket/progress`));
    expect(p.scopes.map((s: any) => s.scope)).toEqual(expect.arrayContaining(['overall', 'engineering', 'procurement', 'construction']));
    const overall = p.scopes.find((s: any) => s.scope === 'overall');
    expect(overall.headline).toBe(true);
    expect(overall.actual).toBeCloseTo(38.73, 1);
    expect(overall.asOf).toBe('2026-10-30');
    expect(overall.points.filter((x: any) => x.date > '2026-10-30').every((x: any) => x.actual === null)).toBe(true);
  });

  it('blends Pile and Conductor into one construction curve and keeps both parts', () => {
    const p = ok(call('GET', `${P}/facilities/pile-conductor/progress`));
    expect(p.scopes.map((s: any) => s.scope)).toEqual(['construction', 'pile', 'conductor']);
    expect(p.scopes[0].headline).toBe(true);
    expect(p.wbs.map((w: any) => w.name)).toEqual(['PILE', 'CONDUCTOR']);
  });

  it('lists the scopes of every facility in the order overall, engineering, procurement, construction, pre-com', () => {
    const order = ['overall', 'engineering', 'procurement', 'construction', 'precom'];
    for (const id of ['cgf-topsides', 'cgf-jacket', 'pile-conductor', 'bridge', 'lqm2']) {
      const keys = (ok(call('GET', `${P}/facilities/${id}/progress`)).scopes as any[]).map(x => x.scope).filter(k => order.includes(k));
      expect(keys, id).toEqual(order.filter(k => keys.includes(k)));
    }
  });

  it('gives CGF Topsides its overall, engineering and procurement curves, from the work package of the progress report', () => {
    const p = ok(call('GET', `${P}/facilities/cgf-topsides/progress`));
    expect(p.scopes.slice(0, 4).map((x: any) => x.scope)).toEqual(['overall', 'engineering', 'procurement', 'construction']);
    expect(p.scopes[0]).toMatchObject({ headline: true, asOf: '2026-11-13', actual: 27.7 });
    expect(p.scopes[1].actual).toBeCloseTo(96.79, 1);
    expect(p.scopes[2].actual).toBeCloseTo(45.2, 1);
  });

  it('sorts the key milestones into their facility', () => {
    const names = (id: string) => (ok(call('GET', `${P}/facilities/${id}/progress`)).milestones as any[]).map(m => m.description);
    expect(names('cgf-topsides')).toContain('First Steel Cut for CGF Topsides');
    expect(names('cgf-jacket')).toContain('Jacket Ready for Sail-away');
    expect(names('pile-conductor')).toEqual(expect.arrayContaining(['First Steel Cut for Pile', 'Conductor Ready for Load out']));
    expect(names('bridge')).toContain('Bridge Ready for Load out');
    expect(names('lqm2')).toContain('LQ Module Ready for Sail-away');
    expect(names('cgf-jacket')).not.toContain('First Steel Cut for Pile');
    expect(names('dsf')).toEqual([]);
  });

  it('puts every facility and its key milestones on one timeline, with the working schedule beside CGF Topsides', () => {
    const t = ok(call('GET', `${P}/facility-timeline`));
    expect(t.facilities.map((f: any) => f.id)).toEqual(['cgf-topsides', 'cgf-jacket', 'pile-conductor', 'bridge', 'lqm2', 'dsf', 'other-pipeline']);
    // every key date is on the timeline once: the rows add up to the key dates of the register
    const keyDates = ok(call('GET', `${P}/milestones?pageSize=200`)).items.filter((m: any) => m.kind !== 'Equipment').length;
    expect(t.facilities.reduce((n: number, f: any) => n + f.milestones.length, 0)).toBe(keyDates);
    // progress is the overall progress, not the construction curve
    expect(t.facilities[0]).toMatchObject({ basis: 'Overall', actual: 27.7 });
    expect(t.facilities[1].basis).toBe('Overall');
    expect(t.start <= t.finish).toBe(true);
    const top = t.facilities[0];
    expect(top.milestones.length).toBeGreaterThan(20);
    expect(top.milestones.some((m: any) => m.description === 'Install Pedestal Crane')).toBe(false); // equipment installation rows are not key dates
    expect(top.workStart).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(t.facilities[1].workStart).toBeNull();
    expect(t.facilities[5]).toMatchObject({ later: true, milestones: [] });
  });

  it('draws the CGF Jacket from its own schedule: span, and the nine key dates M1000 to M1080 with the subcontractor dates', () => {
    const t = ok(call('GET', `${P}/facility-timeline`));
    const jk = t.facilities.find((f: any) => f.id === 'cgf-jacket');
    expect(jk).toMatchObject({ start: '2026-02-23', finish: '2027-05-31' });
    const at = (id: string) => jk.milestones.find((m: any) => m.id === id);
    expect(at('M1000')).toMatchObject({ description: 'Effective Date (ED)', working: '2026-02-23', status: 'Done' });
    expect(at('M1010')).toMatchObject({ description: 'KOM', working: '2026-03-17' });
    expect(['03-M-1020', 'M1030', 'M1040', 'M1050', 'M1060', '03-M-1100', '03-M-1110'].map(id => at(id).working)).toEqual(
      ['2026-05-04', '2026-10-17', '2026-11-12', '2027-01-26', '2027-02-13', '2027-05-15', '2027-05-31']);
  });

  it('checks the CGF Topsides S-curve against the working schedule', () => {
    const p = ok(call('GET', `${P}/facilities/cgf-topsides/progress`));
    expect(p.scheduleCheck).toMatchObject({ scope: 'construction' });
    const c = p.scheduleCheck.curve;
    expect(c.length).toBeGreaterThan(20);
    expect(c[c.length - 1]).toMatchObject({ baseline: 100, working: 100 });
    expect(c.every((x: any) => x.working >= x.baseline - 0.01)).toBe(true); // the working schedule runs ahead of the baseline
    expect(ok(call('GET', `${P}/facilities/cgf-jacket/progress`)).scheduleCheck).toBeNull();
  });

  it('serves the critical path network: CPN progress, critical activities and the milestone chain', () => {
    const c = ok(call('GET', `${P}/cpn`));
    expect(c.overall).toMatchObject({ weight: 100, plan: 23.34, actual: 10.04, basePlan: 26.79, baseActual: 29.29 });
    expect(c.packages.map((w: any) => w.code)).toEqual(['WP2', 'WP3', 'WP4', 'WP5', 'WP6']);
    expect(c.curve.length).toBeGreaterThan(100);
    expect(c.curve.every((p: any) => p.date <= '2026-11-13' || p.actual === null)).toBe(true);
    expect(c.critical.threshold).toBe(7);
    expect(c.critical.items.every((a: any) => a.float <= 7 && a.finish >= c.cutoff)).toBe(true);
    expect(c.milestones.length).toBeGreaterThan(40);
    expect(c.milestones.some((m: any) => m.major)).toBe(true);
  });

  it('returns the WBS schedule with dates, and none for DSF', () => {
    const s = ok(call('GET', `${P}/facilities/lqm2/schedule`));
    expect(s.wbs.length).toBeGreaterThan(10);
    expect(s.wbs.every((w: any) => w.start <= w.finish)).toBe(true);
    expect(ok(call('GET', `${P}/facilities/dsf/schedule`)).wbs).toEqual([]);
    expect(err(call('GET', `${P}/facilities/nope/schedule`)).status).toBe(404);
  });

  it('follows the module switches and the party access', () => {
    ok(call('PUT', '/party-access', { cells: [{ moduleKey: 'planning.schedule', party: 'Client', visible: false }] }));
    expect(err(call('GET', `${P}/facilities/lqm2/schedule`, undefined, CLIENT)).error.code).toBe('NOT_FOR_YOUR_PARTY');
    ok(call('GET', `${P}/facilities/lqm2/progress`, undefined, CLIENT));
  });
});
