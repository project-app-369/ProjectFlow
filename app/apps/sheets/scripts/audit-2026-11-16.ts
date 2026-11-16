/** Audit probes use only disposable in-memory reference data. No network or live writes. */
import assert from 'node:assert/strict';
import { Api } from '../src/api';
import { COLUMNS, SHEET } from '../src/datasets';
import { MemoryStore } from '../src/memory-store';
import { handle } from '../src/router';
import { seedStore } from '../src/seed';
import { seedData } from '../src/seed-data';
import { overallProgress } from '../../api/src/schedule/progress';

function fresh() {
  const store = new MemoryStore();
  seedStore(store, seedData);
  const api = new Api(store, () => new Date('2026-11-16T05:00:00Z'));
  const call = (method: string, path: string, body?: unknown, user = 'u-admin') => handle(api, { method, path, body, user });
  return { store, api, call };
}
function data(e: ReturnType<typeof handle>): any {
  assert.equal(e.ok, true, JSON.stringify(e));
  return (e as { data: unknown }).data;
}
const P = '/projects/sttp2b';
const results: Record<string, unknown> = {};

{
  const { call } = fresh();
  const task = data(call('POST', '/tasks', { title: 'Audit private administrator task' }));
  const own = data(call('GET', '/tasks', undefined, 'u-client'));
  assert.ok(!own.items.some((t: any) => t.id === task.id));
  const generic = data(call('GET', `${P}/modules/task-management.board/records`, undefined, 'u-client'));
  assert.ok(generic.items.some((t: any) => t.id === task.id));
  results.privateTasks = { ownerScopedRouteLeaks: false, genericRouteLeaks: true, genericRows: generic.items.length };
}
{
  const { call } = fresh();
  data(call('PUT', '/party-access', { cells: [{ moduleKey: 'management.risks', party: 'Client', visible: false }] }));
  assert.equal(call('GET', `${P}/risks`, undefined, 'u-client').status, 403);
  const dashboard = data(call('GET', `${P}/dashboard`, undefined, 'u-client'));
  assert.ok(dashboard.risks !== null);
  results.partyAccess = { directRisksStatus: 403, dashboardStillReturnsRiskSummary: true };
}
{
  const { store, call } = fresh();
  data(call('PUT', `${P}/members/u-admin`, { role: 'Team Member' }));
  const remaining = store.readRows(SHEET.memberships, COLUMNS.memberships).filter(r => r.projectId === 'sttp2b' && r.role === 'Project Manager');
  assert.equal(remaining.length, 0);
  results.lastProjectManager = { demotionStatus: 200, remaining: remaining.length };
}
{
  const { call } = fresh();
  data(call('PUT', `${P}/modules/procurement`, { state: 'Read-only' }));
  const packages = data(call('GET', `${P}/procurement/packages?pageSize=1`));
  const updated = call('PATCH', `${P}/procurement/packages/${packages.items[0].id}`, { description: 'Audit parent read-only bypass' });
  data(updated);
  results.parentReadOnly = { parentState: 'Read-only', childWriteStatus: updated.status };
}
{
  const { store, call } = fresh();
  data(call('POST', `${P}/snapshots`, { cutoff: '2026-11-13' }));
  const before = data(call('GET', `${P}/risks/options?asOf=2026-11-13`));
  const matrixBefore = JSON.stringify(before);
  const cell = store.readRows(SHEET.riskMatrix, COLUMNS.riskMatrix)[0];
  store.updateRow(SHEET.riskMatrix, COLUMNS.riskMatrix, 'probability', String(cell.probability), { level: 'Audit changed level' }, { projectId: 'sttp2b', severity: cell.severity });
  const after = data(call('GET', `${P}/risks/options?asOf=2026-11-13`));
  assert.notEqual(JSON.stringify(after), matrixBefore);
  const replace = call('POST', `${P}/snapshots`, { cutoff: '2026-11-13', replace: true });
  data(replace);
  results.snapshots = { historicalRiskOptionsChangeAfterLiveMatrixEdit: true, replacementStatus: replace.status };
}
{
  const result = overallProgress([]);
  assert.equal(result.thisWeekActual, 0);
  results.zeroDenominator = result;
}
{
  const { call } = fresh();
  const task = call('POST', '/tasks', { title: 'Audit invalid date', due: '2026-02-31' });
  data(task);
  results.invalidDate = { due: '2026-02-31', status: task.status };
}
{
  const { store, call } = fresh();
  const issue = data(call('POST', `${P}/issues`, { title: 'Audit failed reminder', pics: ['audit@example.invalid'], dueDate: '2026-11-16' }));
  let attempts = 0;
  const failing = new Api(store, () => new Date('2026-11-16T05:00:00Z'), { send: () => { attempts++; throw new Error('Simulated mail quota failure'); } });
  const first = failing.issues.remindDue('sttp2b');
  const retry = failing.issues.remindDue('sttp2b');
  const row = store.readRows(SHEET.issues, COLUMNS.issues).find(r => r.id === issue.id)!;
  assert.equal(row.lastRemindedOn, '2026-11-16');
  assert.equal(attempts, 1);
  results.reminderFailure = { firstReportedEmails: first.emails, retryReportedEmails: retry.emails, deliveryAttempts: attempts, markedReminded: row.lastRemindedOn };
}
{
  const { store, call } = fresh();
  data(call('POST', `${P}/snapshots`, { cutoff: '2026-11-13' }));
  const append = store.appendRows.bind(store);
  store.appendRows = (name, columns, rows) => {
    if (name === SHEET.snapshotData) throw new Error('Simulated storage failure');
    return append(name, columns, rows);
  };
  const replacement = call('POST', `${P}/snapshots`, { cutoff: '2026-11-13', replace: true });
  assert.equal(replacement.status, 500);
  const historical = call('GET', `${P}/risks?asOf=2026-11-13`);
  assert.equal(historical.status, 404);
  results.snapshotFailure = { replacementStatus: replacement.status, originalSnapshotReadStatus: historical.status };
}
console.log(JSON.stringify(results, null, 2));
