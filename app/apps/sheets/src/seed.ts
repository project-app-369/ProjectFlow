import { MANIFESTS, defaultState } from '../../api/src/registry/catalog';
import { COLUMNS, SHEET, pathOf, tabColorOf } from './datasets';
import { milestoneFacility } from './registers-service';
import { splitActions } from './risks-service';
import { isIsoDate, type Row, type Store } from './store';

export const PROJECT_ID = 'sttp2b';
export const ADMIN_ID = 'u-admin';

const isoOrNull = (v: unknown) => (isIsoDate(v) ? v : null);
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

interface RawRow { [k: string]: unknown }

/**
 * The reference data file (apps/api/seed/sttp2b.json). It is a parameter, not an import, so the deployed script carries none of it:
 * Apps Script's setup reads it from the project's seed.html, and the simulator and tests load it from the file.
 */
export type SeedData = typeof import('../../api/seed/sttp2b.json');

/** Register code without its trailing split letter: STTP2B-GF-STR-013B belongs to plan package STTP2B-GF-STR-013. */
const baseCode = (code: string) => code.replace(/(?<=\d)[A-Z]$/, '');

/**
 * The procurement register from the Expediting Report, each package enriched with its work package, contract type (LS or PS)
 * and weight from the Procurement Plan, plus the planned packages that are not in the register yet (status Planned).
 */
function procurementRows(register: RawRow[], plan: RawRow[]): Row[] {
  const byCode = new Map(plan.map(p => [String(p.code), p]));
  const rows = register.map(p => {
    const code = String(p.code);
    const pl = byCode.get(code) ?? byCode.get(baseCode(code));
    return {
      projectId: PROJECT_ID, ...p, discipline: p.discipline === 'Pipline' ? 'Pipeline' : p.discipline, loaDate: isoOrNull(p.loaDate), poDate: isoOrNull(p.poDate),
      workPackage: (pl?.workPackage as string | null) ?? null, packageType: (pl?.packageType as string | null) ?? null, weightPct: (pl?.weightPct as number | null) ?? null,
    };
  });
  const have = new Set(register.map(p => baseCode(String(p.code))).concat(register.map(p => String(p.code))));
  const disciplineOf = new Map(register.map(p => [String(p.code).split('-').slice(-2, -1)[0], p.discipline === 'Pipline' ? 'Pipeline' : String(p.discipline)]));
  plan.filter(p => !have.has(String(p.code))).forEach((p, i) => rows.push({
    projectId: PROJECT_ID, id: `PR-${String(register.length + i + 1).padStart(3, '0')}`, code: String(p.code), discipline: disciplineOf.get(String(p.code).split('-').slice(-2, -1)[0]) ?? null,
    description: (p.name as string | null) ?? null, vendorCode: null, vendor: null, origins: null, loaNo: null, loaDate: null, poNo: null, poDate: null, buyer: null, expeditor: null, pe: null, vqc: null,
    status: 'Planned', workPackage: (p.workPackage as string | null) ?? null, packageType: (p.packageType as string | null) ?? null, weightPct: (p.weightPct as number | null) ?? null,
  } as never));
  return rows as unknown as Row[];
}

const RISK_STATUS = /^(Delay|At Risk|At High Risk)$/;
const firstSentence = (text: string, max: number) => {
  const one = text.replace(/\s+/g, ' ').trim();
  const cut = one.search(/[.;](\s|$)/);
  const s = cut > 20 ? one.slice(0, cut) : one;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
};

/**
 * Starter risks and concerns, taken from what the registers already flag: expediting packages that are late or at risk
 * with a recorded highlight, and shipments the weekly logistics report marks as pending or stuck. Edit or close freely.
 */
export function concernsSeed(expediting: RawRow[], procurement: RawRow[], logistics: RawRow[], raisedDate: string, now: string): Row[] {
  const expeditor = new Map(procurement.map(p => [String(p.code), (p.expeditor as string | null) ?? null]));
  const out: Row[] = [];
  const add = (r: Omit<Row, 'projectId' | 'id' | 'createdAt' | 'updatedAt' | 'createdBy' | 'status'>) => out.push({
    projectId: PROJECT_ID, id: `PC-${String(out.length + 1).padStart(3, '0')}`, status: 'Open', ...r, createdAt: now, updatedAt: now, createdBy: ADMIN_ID,
  });
  for (const x of expediting) {
    const status = String(x.status);
    if (!RISK_STATUS.test(status) || !x.highlight || x.highlight === 'No') continue;
    add({
      packageCode: String(x.code), type: status === 'Delay' ? 'Issue' : 'Risk', title: `${x.name || x.code}: ${firstSentence(String(x.highlight), 110)}`, description: String(x.highlight),
      severity: status === 'At Risk' ? 'Medium' : 'High', area: 'Delivery', owner: expeditor.get(String(x.code)) ?? null, raisedDate, dueDate: null,
      action: (x.actionPlan as string | null) ?? null, source: 'Expediting', sourceRef: String(x.id),
    });
  }
  for (const l of logistics) {
    if (!l.issue) continue;
    add({
      packageCode: (l.packageNo as string | null) ?? null, type: 'Concern', title: `Shipment ${l.shipmentNo}: ${firstSentence(String(l.issue), 100)}`,
      description: `${l.packageDescription ?? l.packageNo} (${l.status}). Note in the weekly logistics report: ${l.issue}`, severity: 'Medium', area: 'Delivery', owner: null, raisedDate, dueDate: null,
      action: null, source: 'Logistics', sourceRef: String(l.shipmentNo ?? ''),
    });
  }
  return out;
}

/** Demo accounts. Names are descriptive on purpose; replace them in Settings → Users. */
export const SEED_USERS = [
  { id: ADMIN_ID, name: 'Admin (demo)', email: 'admin@example.com', isAdmin: 'Yes', role: 'Project Manager', title: 'Project administrator' },
  { id: 'u-manager', name: 'Manager (demo)', email: 'manager@example.com', isAdmin: 'No', role: 'Manager', title: 'Discipline manager' },
  { id: 'u-member', name: 'Team member (demo)', email: 'member@example.com', isAdmin: 'No', role: 'Team Member', title: 'Expeditor' },
  { id: 'u-client', name: 'Client (demo)', email: 'client@example.com', isAdmin: 'No', role: 'Client', title: 'Client representative' },
] as const;

/** Reference data extracted from the /data workbooks (the file the NestJS API also seeds from). */
export function seedRows(raw: SeedData) {
  const pid = PROJECT_ID;
  const withProject = <T extends RawRow>(rows: T[]) => rows.map(r => ({ projectId: pid, ...r })) as unknown as Row[];
  const expediting = raw.expediting as RawRow[];
  const flagged = expediting.filter(x => /Delay|At Risk/i.test(String(x.status)) && x.highlight && x.highlight !== 'No').slice(0, 3);
  return {
    project: [{ id: pid, code: raw.project.code, name: raw.project.name, shortName: 'STTP2B', client: null, contract: raw.project.contract, location: null, lifecycle: 'Active', cutoff: raw.project.cutoff }] as Row[],
    scurve: withProject(raw.schedule.scurve),
    workPackages: withProject(raw.schedule.workPackages),
    milestones: withProject((raw as unknown as { milestones: RawRow[] }).milestones.map(m => ({ ...m, facility: m.facility ?? milestoneFacility(String(m.id)) }))),
    procurement: procurementRows(raw.procurement as RawRow[], (raw as unknown as { procurementPlan?: RawRow[] }).procurementPlan ?? []),
    logistics: withProject(((raw as unknown as { logistics?: RawRow[] }).logistics ?? []).map((r, i) => ({ id: `LG-${String(i + 1).padStart(4, '0')}`, ...r }))),
    materialBalance: withProject(((raw as unknown as { materialBalance?: RawRow[] }).materialBalance ?? []).map((r, i) => ({ id: `MB-${String(i + 1).padStart(3, '0')}`, ...r }))),
    issues: (raw as unknown as { issues?: RawRow[] }).issues ?? [],
    phaseProgress: withProject(((raw as unknown as { phaseProgress?: RawRow[] }).phaseProgress ?? []).map((r, i) => ({ id: `PH-${String(i + 1).padStart(2, '0')}`, reportDate: (raw as unknown as { progressCutoff?: string }).progressCutoff ?? null, ...r }))),
    procCurves: withProject(((raw as unknown as { procCurves?: RawRow[] }).procCurves ?? []).map((r, i) => ({ id: `SC-${String(i + 1).padStart(2, '0')}`, ...r }))),
    materialSummary: withProject(((raw as unknown as { materialSummary?: RawRow[] }).materialSummary ?? []).map((r, i) => ({ id: `MS-${String(i + 1).padStart(2, '0')}`, ...r }))),
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


const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const longDate = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;

/**
 * Starter General Knowledge articles. Everything in them is taken from the loaded reference data (the Key Milestones
 * workbook and the status rules of the procurement and expediting registers); nothing is invented. Edit or delete freely.
 */
export function knowledgeSeed(milestones: RawRow[], now: string): Row[] {
  const byId = new Map(milestones.map(m => [String(m.id), m]));
  const lines = (ids: string[]) => ids
    .map(id => byId.get(id))
    .filter((m): m is RawRow => !!m && !!m.planBaseline)
    .sort((a, b) => String(a.planBaseline).localeCompare(String(b.planBaseline)))
    .map(m => `- ${longDate(String(m.planBaseline))}: ${m.description} (${m.id}${m.subName ? `, ${m.subName}` : ''})`)
    .join('\n');
  const milestoneSource = [{ title: 'STTP2B - Key Milestones Rev 0', ref: 'Rev 0', url: null }];
  const article = (n: number, domain: string, category: string, title: string, summary: string, body: string, tags: string[], sources: unknown[]): Row => ({
    projectId: PROJECT_ID, id: `KB-${String(n).padStart(3, '0')}`, domain, category, title, summary, body, tags: tags.join(','), sources: JSON.stringify(sources), status: 'Published',
    createdAt: now, updatedAt: now, createdBy: ADMIN_ID, updatedBy: ADMIN_ID,
  });
  return [
    article(1, 'procurement', 'Workflow', 'How a procurement package moves through the registers',
      'The status rules behind the Procurement Plan and Expediting registers: tendering, letter of award, PO, and the progress tracked once a vendor is working.',
      [
        '## Procurement Plan register',
        'Every package has a code, discipline, description, vendor, and the people who own it: buyer, expeditor, project engineer (PE) and VQC.',
        '',
        'A package status is worked out from what has been recorded:',
        '- In tendering: no letter of award (LOA) is recorded yet.',
        '- LOA issued: an LOA number is recorded but no PO number.',
        '- PO placed: a PO number is recorded. A PO date may still be shown as TBA.',
        '',
        '## Expediting register',
        'Once packages are with vendors, expediting tracks them by discipline with a status of Normal, At Risk or Delay, planned and actual cumulative progress, the variance between them, and the ROS and ETA dates.',
        'Equipment packages also carry progress by stage: engineering, procurement, fabrication, testing and delivery. Highlights, action plans and remarks explain packages that are late or at risk.',
      ].join('\n'),
      ['status', 'LOA', 'PO', 'expediting'],
      [{ title: 'STT2B - Expediting Report (cut-off 6 Nov 2026)', ref: 'pgk_gen_info and the discipline summaries', url: null }, { title: 'STTP2B Procurement Plan', ref: 'updated 06-Nov-26', url: null }]),
    article(2, 'construction', 'Sequence', 'Fabrication and construction sequence at key-milestone level',
      'The order of the main steel-cut, roll-up, stack-up and load-out dates for the topsides, jacket, piles, conductors, bridge and LQ module (baseline dates).',
      [
        'Baseline dates from the Key Milestones workbook, in date order. Forecast and actual dates are tracked in Planning → Milestones.',
        '',
        lines(['02-M-1030', '03-M-1020', '04-M-1140', '03-F1130', '03-F1300', 'LQM-F-3120', 'LQM-F-3190', 'M1030', 'LQM-F-3290', 'M1040', 'LQM-F-3380', '03-F2640', '02-F-1870', '02-F-2630', 'M1050', 'M1060', '02-F-2710', '02-F-3160', '02-F-2210', '03-M-1100', '03-F2380', '03-F2690', '03-F2360', '04-M-1230', '02-M-1130']),
      ].join('\n'),
      ['milestones', 'jacket', 'LQ module', 'topsides'],
      milestoneSource),
    article(3, 'ti', 'Sequence', 'Sail-away and installation milestones',
      'From jacket sail-away to topsides float-over: the baseline order of sail-away, installation completions and the topsides jacking and float-over.',
      [
        'Baseline dates from the Key Milestones workbook, in date order.',
        '',
        lines(['03-M-1110', '04-M-1260', '03-M-1150', '03-M-1090', '04-M-1170', '06-M-1210', '06-M-1200', '06-M-1190', '06-M-1220', '02-F-1290', '02-M-1160', '02-M-1180']),
      ].join('\n'),
      ['sail-away', 'installation', 'float-over'],
      milestoneSource),
    article(4, 'huc', 'Campaign', 'Hook-up and commissioning to acceptance',
      'The baseline sequence from the start of topsides hook-up and commissioning to provisional and final acceptance.',
      [
        'Baseline dates from the Key Milestones workbook, in date order.',
        '',
        lines(['02-M-1450', '02-M-1460', '01-M-1250', '02-M-1420', '01-M-1350']),
      ].join('\n'),
      ['HUC', 'acceptance'],
      milestoneSource),
  ];
}

/** Creates one sheet per dataset, grouped by area, and returns the sheet names that were not there before. */
export function ensureAllSheets(store: Store) {
  const sheets: [string, readonly { key: string; type: string }[]][] = [
    [SHEET.projects, COLUMNS.projects], [SHEET.users, COLUMNS.users], [SHEET.memberships, COLUMNS.memberships], [SHEET.modules, COLUMNS.modules], [SHEET.moduleChanges, COLUMNS.moduleChanges],
    [SHEET.tasks, COLUMNS.tasks], [SHEET.subtasks, COLUMNS.subtasks],
    [SHEET.scurve, COLUMNS.scurve], [SHEET.workPackages, COLUMNS.workPackages], [SHEET.milestones, COLUMNS.milestones], [SHEET.procurement, COLUMNS.procurement], [SHEET.expediting, COLUMNS.expediting], [SHEET.logistics, COLUMNS.logistics], [SHEET.materialBalance, COLUMNS.materialBalance], [SHEET.materialSummary, COLUMNS.materialSummary], [SHEET.procConcerns, COLUMNS.procConcerns], [SHEET.procCurves, COLUMNS.procCurves], [SHEET.phaseProgress, COLUMNS.phaseProgress], [SHEET.budget, COLUMNS.budget],
    [SHEET.risks, COLUMNS.risks], [SHEET.riskActions, COLUMNS.riskActions], [SHEET.riskMatrix, COLUMNS.riskMatrix], [SHEET.riskBreakdown, COLUMNS.riskBreakdown],
    [SHEET.issues, COLUMNS.issues], [SHEET.issueSubtasks, COLUMNS.issueSubtasks], [SHEET.issueLog, COLUMNS.issueLog],
    [SHEET.interfaces, COLUMNS.interfaces], [SHEET.interfacePoints, COLUMNS.interfacePoints], [SHEET.interfaceParties, COLUMNS.interfaceParties], [SHEET.responsibility, COLUMNS.responsibility], [SHEET.rasci, COLUMNS.rasci],
    [SHEET.knowledge, COLUMNS.knowledge], [SHEET.snapshots, COLUMNS.snapshots], [SHEET.snapshotData, COLUMNS.snapshotData],
  ];
  for (const [name, columns] of sheets) store.ensureSheet(name, columns as never, tabColorOf(name));
}

function appendSeedIssues(store: Store, issues: RawRow[], cutoff: string, now: string) {
  // Preserve the task monitor number: item 5 is ISS-005.
  const seen = new Set<string>();
  const numbers = issues.map(i => { const n = /^\d{1,4}$/.test(String(i.ref ?? '')) ? Number(i.ref) : 0; if (n && !seen.has(String(n))) { seen.add(String(n)); return n; } return 0; });
  let spare = Math.max(0, ...numbers);
  const issueRows = issues.map((i, n) => ({
    projectId: PROJECT_ID, id: `ISS-${String(numbers[n] || ++spare).padStart(3, '0')}`, title: i.title, description: i.description ?? null, priority: i.priority, discipline: i.discipline ?? null, status: i.status,
    startDate: isoOrNull(i.startDate), dueDate: isoOrNull(i.dueDate), completedDate: i.status === 'Completed' ? isoOrNull(i.raisedDate) ?? cutoff : null,
    nextAction: i.nextAction ?? null, remarks: i.remarks ?? null, pics: '', source: 'Task monitor', lastRemindedOn: null, createdAt: now, updatedAt: now, createdBy: ADMIN_ID,
  })) as unknown as Row[];
  store.appendRows(SHEET.issues, COLUMNS.issues, issueRows);
  store.appendRows(SHEET.issueLog, COLUMNS.issueLog, issueRows.map((i, n) => ({
    projectId: PROJECT_ID, id: `LG-${String(n + 1).padStart(5, '0')}`, issueId: i.id, at: now, actor: 'Import', action: 'Created', note: 'Loaded from the task monitor workbook (TASK_MONITOR_2026-11-10)',
  })));
}

/** Governance datasets of the risk register and the interface workbooks (extract_governance.py). */
export function governanceRows(raw: SeedData) {
  const g = raw as unknown as Record<string, RawRow[] | undefined>;
  const pid = PROJECT_ID;
  const withProject = (rows: RawRow[] | undefined) => (rows ?? []).map(r => ({ projectId: pid, ...r })) as unknown as Row[];
  const risks = (g.risks ?? []).map(({ riskId, ...r }) => ({ projectId: pid, id: riskId, ...r, createdBy: 'Import' })) as unknown as Row[];
  // Each numbered line of the response plan becomes a tracked action, due on the plan action date, done once the actions were taken.
  let n = 0;
  const riskActions = (g.risks ?? []).flatMap(r => [...splitActions(r.mitigationCause as string | null), ...splitActions(r.mitigationEffect as string | null)].map(action => ({
    projectId: pid, id: `RA-${String(++n).padStart(4, '0')}`, riskId: r.riskId, action: action.slice(0, 1000), owner: r.owner ?? null, dueDate: r.planDate ?? null, doneDate: r.actualDate ?? null,
  }))) as unknown as Row[];
  const interfacePoints = (g.interfacePoints ?? []).map(({ no: _no, subject, ...p }) => ({ projectId: pid, ...p, title: subject ?? null, interfaceId: null })) as unknown as Row[];
  return {
    risks, riskActions, riskMatrix: withProject(g.riskMatrix), riskBreakdown: withProject(g.riskBreakdown),
    interfacePoints, interfaceParties: withProject(g.interfaceParties), responsibility: withProject(g.responsibility), rasci: withProject(g.rasci),
  };
}

const GOVERNANCE: [keyof ReturnType<typeof governanceRows>, keyof typeof SHEET][] = [
  ['risks', 'risks'], ['riskActions', 'riskActions'], ['riskMatrix', 'riskMatrix'], ['riskBreakdown', 'riskBreakdown'],
  ['interfacePoints', 'interfacePoints'], ['interfaceParties', 'interfaceParties'], ['responsibility', 'responsibility'], ['rasci', 'rasci'],
];

/**
 * Loads the governance datasets into sheets that have no rows for the project yet, after adding any column the sheet lacks
 * (an older workbook may have the risk or point sheet with the earlier columns). Rows already there are never touched.
 */
export function appendSeedGovernance(store: Store, raw: SeedData) {
  const rows = governanceRows(raw);
  for (const [key, sheet] of GOVERNANCE) {
    const columns = COLUMNS[sheet as keyof typeof COLUMNS];
    store.addMissingColumns(SHEET[sheet], columns);
    if (rows[key].length && !store.readRows(SHEET[sheet], columns).some(r => r.projectId === PROJECT_ID)) store.appendRows(SHEET[sheet], columns, rows[key]);
  }
}

/**
 * Creates every dataset sheet and loads the reference data. Safe to run again: sheets that already exist
 * are left untouched, and the data load is skipped once the Projects sheet has a row. Sheets for modules without a
 * dataset are generated later, when such a module is enabled or its sheet is requested.
 */
export function seedStore(store: Store, raw: SeedData, now = new Date().toISOString()) {
  return store.withLock(() => {
    const hadIssuesSheet = Boolean(store.sheetInfo(SHEET.issues));
    const hadRiskMatrix = Boolean(store.sheetInfo(SHEET.riskMatrix));
    ensureAllSheets(store);
    if (store.readRows(SHEET.projects, COLUMNS.projects).length) {
      // Upgrade existing workbooks once, without overwriting their project data.
      if (!hadIssuesSheet) appendSeedIssues(store, seedRows(raw).issues, String(raw.project.cutoff), now);
      if (!hadRiskMatrix) appendSeedGovernance(store, raw);
      return false;
    }

    const rows = seedRows(raw);
    const pid = PROJECT_ID;
    store.appendRows(SHEET.projects, COLUMNS.projects, rows.project.map(p => ({ ...p, createdAt: now, updatedAt: now })));
    store.appendRows(SHEET.users, COLUMNS.users, SEED_USERS.map(u => ({ id: u.id, name: u.name, email: u.email, isAdmin: u.isAdmin, status: 'Active', createdAt: now })));
    store.appendRows(SHEET.memberships, COLUMNS.memberships, SEED_USERS.map(u => ({ projectId: pid, userId: u.id, role: u.role, title: u.title })));
    store.appendRows(SHEET.modules, COLUMNS.modules, MANIFESTS.map(m => ({ projectId: pid, moduleKey: m.key, path: pathOf(m.key).join(' / '), state: defaultState(m), updatedAt: now })));
    store.appendRows(SHEET.scurve, COLUMNS.scurve, rows.scurve);
    store.appendRows(SHEET.workPackages, COLUMNS.workPackages, rows.workPackages);
    store.appendRows(SHEET.milestones, COLUMNS.milestones, rows.milestones);
    store.appendRows(SHEET.knowledge, COLUMNS.knowledge, knowledgeSeed((raw as unknown as { milestones: RawRow[] }).milestones, now));
    store.appendRows(SHEET.procurement, COLUMNS.procurement, rows.procurement);
    store.appendRows(SHEET.expediting, COLUMNS.expediting, rows.expediting);
    store.appendRows(SHEET.logistics, COLUMNS.logistics, rows.logistics);
    store.appendRows(SHEET.materialBalance, COLUMNS.materialBalance, rows.materialBalance);
    store.appendRows(SHEET.materialSummary, COLUMNS.materialSummary, rows.materialSummary);
    store.appendRows(SHEET.procCurves, COLUMNS.procCurves, rows.procCurves);
    store.appendRows(SHEET.phaseProgress, COLUMNS.phaseProgress, rows.phaseProgress);
    appendSeedIssues(store, rows.issues, String(raw.project.cutoff), now);
    appendSeedGovernance(store, raw);
    store.appendRows(SHEET.procConcerns, COLUMNS.procConcerns, concernsSeed(raw.expediting as RawRow[], raw.procurement as RawRow[], (raw as unknown as { logistics?: RawRow[] }).logistics ?? [], String(raw.project.cutoff), now));
    const cutoff = String(raw.project.cutoff);
    const shift = (n: number | null) => (n === null ? null : new Date(new Date(`${cutoff}T12:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10));
    store.appendRows(SHEET.tasks, COLUMNS.tasks, rows.tasks.map(({ planStartOffset, planFinishOffset, dueOffset, ...t }, i) => ({
      id: store.newId(), taskNo: `TSK-${String(i + 1).padStart(4, '0')}`, assigner: SEED_USERS[0].name, ...t,
      planStart: shift(planStartOffset), planFinish: shift(planFinishOffset), due: shift(dueOffset), createdAt: now, updatedAt: now, owner: ADMIN_ID,
    })));
    return true;
  });
}
