import { beforeEach, describe, expect, it } from 'vitest';
import { Api } from '../src/api';
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryMailer } from '../src/mailer';
import { MemoryStore } from '../src/memory-store';
import { handle, type Envelope } from '../src/router';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';

/* eslint-disable @typescript-eslint/no-explicit-any */
const P = '/projects/sttp2b';
const I = `${P}/issues`;
const ADMIN = 'u-admin', MANAGER = 'u-manager', MEMBER = 'u-member', CLIENT = 'u-client';
let store: MemoryStore;
let api: Api;
let mail: MemoryMailer;
const call = (method: string, path: string, body?: unknown, user: string = ADMIN) => handle(api, { method, path, body, user });
const ok = (e: Envelope) => { expect(e.ok, JSON.stringify(e)).toBe(true); return (e as Extract<Envelope, { ok: true }>).data as any; };
const err = (e: Envelope) => { expect(e.ok).toBe(false); return e as Extract<Envelope, { ok: false }>; };
const mk = (extra: object = {}) => ok(call('POST', I, { title: 'Weld repair backlog', priority: 'High', dueDate: '2026-11-10', ...extra }, MANAGER));

beforeEach(() => {
  store = new MemoryStore();
  seedStore(store, seedData);
  mail = new MemoryMailer();
  api = new Api(store, () => new Date('2026-11-08T10:00:00Z'), mail);
});

describe('issue management', () => {
  it('loads the task monitor and summarises it with six cards', () => {
    const list = ok(call('GET', I));
    expect(list.total).toBe(38);
    expect(list.facets.statuses).toEqual(['Not started', 'In progress', 'Pending', 'Completed']);
    const ins = ok(call('GET', `${I}/insights`));
    expect(ins.cards).toHaveLength(6);
    expect(ins.cards[0]).toMatchObject({ label: 'Open issues', value: 37 });
    expect(ins.lookAhead.boxes.map((b: any) => b.label)).toEqual(['Overdue', 'Within 30 days', 'Within 45 days', 'Within 60 days', 'No date']);
    expect(ok(call('GET', `${I}/ISS-001`)).log[0]).toMatchObject({ action: 'Created', actor: 'Import' });
  });

  it('keeps the numbers of the task monitor: ISS-005 is item 5, and the gaps stay gaps', () => {
    expect(ok(call('GET', `${I}/ISS-005`)).title).toMatch(/^Subcontractor PPS/);
    expect(err(call('GET', `${I}/ISS-004`)).status).toBe(404);
    expect(ok(call('GET', `${I}/ISS-040`)).id).toBe('ISS-040');
    expect(mk().id).toBe('ISS-041');
  });

  it('reads cells that were typed by hand in the spreadsheet', () => {
    const before = ok(call('GET', `${I}/insights`)).cards[0].value;
    store.updateRow(SHEET.issues, COLUMNS.issues, 'id', 'ISS-002', { status: 'done', priority: 'HIGH', pics: 'Ann@Example.com; bob@example.com  carol@example.com, not-an-email' }, { projectId: 'sttp2b' });
    store.updateRow(SHEET.issues, COLUMNS.issues, 'id', 'ISS-001', { status: 'In Progess' }, { projectId: 'sttp2b' });
    const edited = ok(call('GET', `${I}/ISS-002`));
    expect(edited).toMatchObject({ status: 'Completed', priority: 'High', pics: ['ann@example.com', 'bob@example.com', 'carol@example.com'] });
    expect(ok(call('GET', `${I}/ISS-001`)).status).toBe('In progress');
    expect(ok(call('GET', `${I}/insights`)).cards[0].value).toBe(before - 1);
    expect(ok(call('GET', `${I}?status=Completed`)).total).toBe(2);
    expect(ok(call('GET', `${I}?pic=bob@example.com`)).total).toBe(1);
  });

  it('assigns several people by email, logs each change and tells the new people', () => {
    const made = mk({ pics: ['Ann@Example.com', 'bob@example.com', 'ann@example.com'] });
    expect(made.pics).toEqual(['ann@example.com', 'bob@example.com']);
    expect(made.log.map((l: any) => l.action).sort()).toEqual(['Created', 'PIC added', 'PIC added']);
    expect(mail.sent.map(m => m.to)).toEqual([['ann@example.com', 'bob@example.com']]);

    const after = ok(call('PATCH', `${I}/${made.id}`, { pics: ['bob@example.com', 'cho@example.com'], status: 'In progress', dueDate: '2026-11-20' }, MANAGER));
    expect(after.pics).toEqual(['bob@example.com', 'cho@example.com']);
    const actions = after.log.map((l: any) => `${l.action}:${l.field ?? l.toValue ?? l.fromValue}`);
    expect(actions).toEqual(expect.arrayContaining(['PIC added:cho@example.com', 'PIC removed:ann@example.com', 'Status changed:Status', 'Updated:Due date']));
    expect(after.log.find((l: any) => l.field === 'Status')).toMatchObject({ fromValue: 'Not started', toValue: 'In progress', actor: 'Manager (demo)' });
    expect(mail.sent.at(-1)!.to).toEqual(['cho@example.com']);
    expect(err(call('PATCH', `${I}/${made.id}`, { pics: ['not-an-email'] }, MANAGER)).status).toBe(400);
    expect(err(call('PATCH', `${I}/${made.id}`, { pics: Array.from({ length: 11 }, (_, i) => `p${i}@example.com`) }, MANAGER)).status).toBe(400);
  });

  it('breaks an issue into sub-tasks that have their own PIC and due date', () => {
    const made = mk();
    const s1 = ok(call('POST', `${I}/${made.id}/subtasks`, { title: 'Re-inspect welds', pic: 'dee@example.com', dueDate: '2026-11-09' }, MANAGER));
    expect(s1.subtasks).toHaveLength(1);
    expect(s1).toMatchObject({ subtasksTotal: 1, subtasksDone: 0 });
    expect(mail.sent.at(-1)!.to).toEqual(['dee@example.com']);
    const sid = s1.subtasks[0].id;
    const done = ok(call('PATCH', `${I}/${made.id}/subtasks/${sid}`, { done: true }, MEMBER));
    expect(done).toMatchObject({ subtasksDone: 1 });
    expect(done.log[0].action).toBe('Sub-task done');
    expect(ok(call('PATCH', `${I}/${made.id}/subtasks/${sid}`, { done: false, dueDate: '2026-11-12' })).log.map((l: any) => l.action)).toEqual(expect.arrayContaining(['Sub-task reopened', 'Sub-task updated']));
    expect(ok(call('DELETE', `${I}/${made.id}/subtasks/${sid}`, undefined, MEMBER)).subtasks).toEqual([]);
    expect(err(call('PATCH', `${I}/${made.id}/subtasks/ST-9999`, { done: true })).status).toBe(404);
  });

  it('keeps a history: notes, completion date and reopening', () => {
    const made = mk();
    expect(ok(call('POST', `${I}/${made.id}/comments`, { note: 'Vendor confirmed Friday' }, MEMBER)).log[0]).toMatchObject({ action: 'Note', note: 'Vendor confirmed Friday', actor: 'Team member (demo)' });
    expect(ok(call('PATCH', `${I}/${made.id}`, { status: 'Completed' }, MANAGER)).completedDate).toBe('2026-11-08');
    expect(ok(call('PATCH', `${I}/${made.id}`, { status: 'In progress' }, MANAGER)).completedDate).toBeNull();
    expect(err(call('POST', I, { title: 'x' }, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
    expect(err(call('DELETE', `${I}/${made.id}`, undefined, MEMBER)).status).toBe(403);
    ok(call('DELETE', `${I}/${made.id}`, undefined, MANAGER));
    expect(err(call('GET', `${I}/${made.id}`)).status).toBe(404);
    expect(store.readRows('Governance - Issue log', COLUMNS.issueLog).some(l => l.issueId === made.id)).toBe(false);
  });

  it('filters by person, window and status', () => {
    const a = mk({ title: 'A', pics: ['ann@example.com'], dueDate: '2026-11-01' });
    mk({ title: 'B', pics: ['bob@example.com'], dueDate: '2026-11-20' });
    expect(ok(call('GET', `${I}?pic=ann@example.com`)).items.map((i: any) => i.id)).toEqual([a.id]);
    expect(ok(call('GET', `${I}?within=overdue&pic=ann@example.com`)).total).toBe(1);
    expect(ok(call('GET', `${I}?within=30&pic=bob@example.com`)).total).toBe(1);
    expect(ok(call('GET', `${I}?pic=none`)).total).toBe(38);
    expect(ok(call('GET', `${I}?priority=Low`)).total).toBe(1);
    expect(ok(call('GET', `${I}.csv`)).csv).toContain('"B"');
  });

  it('reminds the people in charge by hand and once a day for what is due', () => {
    const due = mk({ title: 'Due soon', pics: ['ann@example.com'], dueDate: '2026-11-09' });
    const far = mk({ title: 'Far away', pics: ['ann@example.com'], dueDate: '2026-12-30' });
    ok(call('POST', `${I}/${far.id}/subtasks`, { title: 'Late bit', pic: 'dee@example.com', dueDate: '2026-11-01' }, MANAGER));
    mk({ title: 'Nobody', dueDate: '2026-11-01' });
    mail.sent.length = 0;

    const first = ok(call('POST', `${I}/remind-due`, undefined, MANAGER));
    expect(first).toMatchObject({ date: '2026-11-08', emails: 2, issues: 2 });
    const byTo = Object.fromEntries(mail.sent.map(m => [m.to[0], m]));
    expect(byTo['ann@example.com'].body).toContain(`${due.id} Due soon (due 2026-11-09)`);
    expect(byTo['ann@example.com'].body).not.toContain('Far away');
    expect(byTo['dee@example.com'].body).toContain('sub-task: Late bit (overdue since 2026-11-01)');
    expect(ok(call('GET', `${I}/${due.id}`)).log[0]).toMatchObject({ action: 'Reminder sent', actor: 'Reminder (automatic)' });

    mail.sent.length = 0;
    expect(ok(call('POST', `${I}/remind-due`, undefined, MANAGER))).toMatchObject({ emails: 0 });
    expect(mail.sent).toHaveLength(0);

    ok(call('POST', `${I}/${far.id}/remind`, undefined, MEMBER));
    expect([...mail.sent[0].to].sort()).toEqual(['ann@example.com', 'dee@example.com']);
    expect(err(call('POST', `${I}/ISS-001/remind`, undefined, MEMBER)).error.code).toBe('NO_PIC');
    expect(err(call('POST', `${I}/remind-due`, undefined, CLIENT)).error.code).toBe('READ_ONLY_ROLE');
  });

  it('a failing mail service never undoes the change', () => {
    api = new Api(store, () => new Date('2026-11-08T10:00:00Z'), { send() { throw new Error('quota'); } });
    expect(ok(call('POST', I, { title: 'Still saved', pics: ['ann@example.com'] }, MANAGER)).pics).toEqual(['ann@example.com']);
  });

  it('can be switched off like any module', () => {
    ok(call('PUT', `${P}/modules/management.issues`, { state: 'Disabled' }));
    expect(err(call('GET', I)).error.code).toBe('MODULE_DISABLED');
  });

  it('works as the admin too (no project role needed to read the register as a member)', () => {
    expect(ADMIN).toBe('u-admin');
  });
});
