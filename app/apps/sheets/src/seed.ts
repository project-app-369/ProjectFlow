import raw from '../../api/seed/sttp2b.json';
import { MANIFESTS, defaultState } from '../../api/src/registry/catalog';
import { COLUMNS, SHEET, pathOf, tabColorOf } from './datasets';
import { isIsoDate, type Row, type Store } from './store';

export const PROJECT_ID = 'sttp2b';
export const ADMIN_ID = 'u-admin';

const isoOrNull = (v: unknown) => (isIsoDate(v) ? v : null);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

interface RawRow { [k: string]: unknown }

/** Demo accounts. Names are descriptive on purpose; replace them in Settings → Users. */
export const SEED_USERS = [
  { id: ADMIN_ID, name: 'Admin (demo)', email: 'admin@example.com', isAdmin: 'Yes', role: 'Project Manager', title: 'Project administrator' },
  { id: 'u-manager', name: 'Manager (demo)', email: 'manager@example.com', isAdmin: 'No', role: 'Manager', title: 'Discipline manager' },
  { id: 'u-member', name: 'Team member (demo)', email: 'member@example.com', isAdmin: 'No', role: 'Team Member', title: 'Expeditor' },
  { id: 'u-client', name: 'Client (demo)', email: 'client@example.com', isAdmin: 'No', role: 'Client', title: 'Client representative' },
] as const;

/** Reference data extracted from the /data workbooks (the file the NestJS API also seeds from). */
export function seedRows() {
  const pid = PROJECT_ID;
  const withProject = <T extends RawRow>(rows: T[]) => rows.map(r => ({ projectId: pid, ...r })) as unknown as Row[];
  const expediting = raw.expediting as RawRow[];
  const flagged = expediting.filter(x => /Delay|At Risk/i.test(String(x.status)) && x.highlight && x.highlight !== 'No').slice(0, 3);
  return {
    project: [{ id: pid, code: raw.project.code, name: raw.project.name, shortName: 'STTP2B', client: null, contract: raw.project.contract, location: null, lifecycle: 'Active', cutoff: raw.project.cutoff }] as Row[],
    scurve: withProject(raw.schedule.scurve),
    workPackages: withProject(raw.schedule.workPackages),
    milestones: withProject((raw as unknown as { milestones: RawRow[] }).milestones),
    procurement: withProject(raw.procurement.map(p => ({
      ...p, discipline: p.discipline === 'Pipline' ? 'Pipeline' : p.discipline, loaDate: isoOrNull(p.loaDate), poDate: isoOrNull(p.poDate),
    }))),
    expediting: withProject(expediting.map(x => ({
      ...x, rosDate: isoOrNull(x.rosDate), etaSite: str(x.etaSite), dateDiff: str(x.dateDiff), deliveryDate: str(x.deliveryDate),
    }))),
    /** Personal demo tasks for the administrator: follow-ups on flagged expediting packages, one recurring item. */
    tasks: [
      ...flagged.map((x, i) => ({
        title: `Follow up: ${x.name || x.code}`, description: `${x.discipline} · ${x.vendor ?? 'vendor tbc'} · ${x.status}`, urgency: x.status === 'Delay' ? 'High' : 'Normal',
        status: i === 0 ? 'Ongoing' : 'Planned', effort: 2 + i, projects: pid, planStartOffset: 1 + i, planFinishOffset: 4 + i, dueOffset: 7 + i,
      })),
      { title: 'Prepare weekly vendor review agenda', description: 'Personal · recurring', urgency: 'Normal', status: 'Ongoing', effort: 1, projects: '', planStartOffset: null, planFinishOffset: null, dueOffset: 7 },
    ],
  };
}

/** Creates one sheet per dataset, grouped by area, and returns the sheet names that were not there before. */
export function ensureAllSheets(store: Store) {
  const sheets: [string, readonly { key: string; type: string }[]][] = [
    [SHEET.projects, COLUMNS.projects], [SHEET.users, COLUMNS.users], [SHEET.memberships, COLUMNS.memberships], [SHEET.modules, COLUMNS.modules], [SHEET.moduleChanges, COLUMNS.moduleChanges],
    [SHEET.tasks, COLUMNS.tasks], [SHEET.subtasks, COLUMNS.subtasks],
    [SHEET.scurve, COLUMNS.scurve], [SHEET.workPackages, COLUMNS.workPackages], [SHEET.milestones, COLUMNS.milestones], [SHEET.procurement, COLUMNS.procurement], [SHEET.expediting, COLUMNS.expediting],
    [SHEET.risks, COLUMNS.risks], [SHEET.interfaces, COLUMNS.interfaces], [SHEET.interfacePoints, COLUMNS.interfacePoints],
    [SHEET.snapshots, COLUMNS.snapshots], [SHEET.snapshotData, COLUMNS.snapshotData],
  ];
  for (const [name, columns] of sheets) store.ensureSheet(name, columns as never, tabColorOf(name));
}

/**
 * Creates every dataset sheet and loads the reference data. Safe to run again: sheets that already exist
 * are left untouched, and the data load is skipped once the Projects sheet has a row. Sheets for modules without a
 * dataset are generated later, when such a module is enabled or its sheet is requested.
 */
export function seedStore(store: Store, now = new Date().toISOString()) {
  return store.withLock(() => {
    ensureAllSheets(store);
    if (store.readRows(SHEET.projects, COLUMNS.projects).length) return false;

    const rows = seedRows();
    const pid = PROJECT_ID;
    store.appendRows(SHEET.projects, COLUMNS.projects, rows.project.map(p => ({ ...p, createdAt: now, updatedAt: now })));
    store.appendRows(SHEET.users, COLUMNS.users, SEED_USERS.map(u => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin, status: 'Active', createdAt: now })));
    store.appendRows(SHEET.memberships, COLUMNS.memberships, SEED_USERS.map(u => ({ projectId: pid, userId: u.id, role: u.role, title: u.title })));
    store.appendRows(SHEET.modules, COLUMNS.modules, MANIFESTS.map(m => ({ projectId: pid, moduleKey: m.key, path: pathOf(m.key).join(' / '), state: defaultState(m), updatedAt: now })));
    store.appendRows(SHEET.scurve, COLUMNS.scurve, rows.scurve);
    store.appendRows(SHEET.workPackages, COLUMNS.workPackages, rows.workPackages);
    store.appendRows(SHEET.milestones, COLUMNS.milestones, rows.milestones);
    store.appendRows(SHEET.procurement, COLUMNS.procurement, rows.procurement);
    store.appendRows(SHEET.expediting, COLUMNS.expediting, rows.expediting);
    const cutoff = String(raw.project.cutoff);
    const shift = (n: number | null) => (n === null ? null : new Date(new Date(`${cutoff}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10));
    store.appendRows(SHEET.tasks, COLUMNS.tasks, rows.tasks.map(({ planStartOffset, planFinishOffset, dueOffset, ...t }, i) => ({
      id: store.newId(), taskNo: `TSK-${String(i + 1).padStart(4, '0')}`, assigner: SEED_USERS[0].name, ...t,
      planStart: shift(planStartOffset), planFinish: shift(planFinishOffset), due: shift(dueOffset), createdAt: now, updatedAt: now, owner: ADMIN_ID,
    })));
    return true;
  });
}
