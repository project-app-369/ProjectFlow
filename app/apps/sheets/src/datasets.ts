import { MANIFEST_BY_KEY, WORKSPACES, type ModuleManifest } from '../../api/src/registry/catalog';
import type { Column } from './store';

const text = (...keys: string[]): Column[] => keys.map(key => ({ key, type: 'text' }));
const num = (...keys: string[]): Column[] => keys.map(key => ({ key, type: 'number' }));
const date = (...keys: string[]): Column[] => keys.map(key => ({ key, type: 'date' }));
const stamp = (...keys: string[]): Column[] => keys.map(key => ({ key, type: 'datetime' as const }));

/**
 * Column layouts for every dataset sheet; row 1 of each sheet holds these keys in this order.
 * Sheets that belong to a project start with `projectId`; Settings and Personal sheets do not.
 */
export const COLUMNS = {
  projects: [...text('id', 'code', 'name', 'shortName', 'client', 'contract', 'location', 'lifecycle'), ...date('cutoff'), ...stamp('createdAt', 'updatedAt')],
  users: [...text('id', 'name', 'email', 'isAdmin', 'status'), ...stamp('createdAt'), ...text('title', 'company', 'party', 'passwordHash'), ...stamp('passwordChangedAt'), ...num('failedLogins'), ...stamp('lockedUntil', 'lastLoginAt')],
  /** Which screens each party (Contractor, Client, Subcontractor) sees; a module with no row is visible to everyone. */
  partyAccess: text('moduleKey', 'party', 'visible'),
  /** What each project role may do in each module: none, read or write. No row means the role's own default. */
  roleAccess: text('projectId', 'role', 'moduleKey', 'level'),
  /** The same for one person, which overrides their role. */
  personAccess: text('projectId', 'userId', 'moduleKey', 'level'),
  /** Who changed whom or what, and who signed in: the trail of user and access management. */
  accessLog: [...text('id'), ...stamp('at'), ...text('actor', 'actorName', 'action', 'target', 'detail', 'projectId')],
  memberships: text('projectId', 'userId', 'role', 'title'),
  modules: [...text('projectId', 'moduleKey', 'path', 'state'), ...stamp('updatedAt')],
  moduleChanges: [...text('projectId', 'id'), ...stamp('at'), ...text('moduleKey', 'fromState', 'toState', 'reason', 'actor')],
  tasks: [
    ...text('id', 'taskNo', 'title', 'description', 'urgency', 'assigner', 'projects'), ...date('planStart', 'planFinish', 'due'),
    ...text('status'), ...num('effort'), ...text('remarks'), ...stamp('createdAt', 'updatedAt'), ...text('owner'),
  ],
  subtasks: [...text('taskId', 'id', 'title', 'done'), ...num('position')],
  logistics: [
    ...text('projectId', 'id', 'source', 'packageNo', 'packageDescription', 'poNo', 'shipmentNo', 'shipmentDescription'), ...date('etdPol', 'etaPod', 'forecastOnSite', 'actualOnSite'),
    ...text('status'), ...num('grossWeightKg'), ...text('qty', 'packingList', 'vessel', 'blNo', 'portLoading', 'portDischarge', 'transport', 'deliveryYard', 'issue'), ...stamp('updatedAt'),
  ],
  materialBalance: [
    ...text('projectId', 'id', 'facility', 'supply', 'discipline', 'serialNo', 'category', 'materialCode', 'description', 'grade', 'poNo', 'shipmentNo', 'supplier', 'mrirNo', 'heatNo', 'unit'),
    ...num('balance'), ...text('yard', 'location', 'status', 'remark'), ...stamp('updatedAt'),
  ],
  materialSummary: [...text('projectId', 'id', 'supply', 'facility'), ...num('mtoKg', 'arrivedKg', 'vspYardKg', 'mcYardKg'), ...stamp('updatedAt')],
  procConcerns: [
    ...text('projectId', 'id', 'packageCode', 'type', 'title', 'description', 'severity', 'area', 'owner'), ...date('raisedDate', 'dueDate'),
    ...text('status', 'action', 'source', 'sourceRef'), ...stamp('createdAt', 'updatedAt'), ...text('createdBy'),
  ],
  issues: [
    ...text('projectId', 'id', 'title', 'description', 'priority', 'discipline', 'status'), ...date('startDate', 'dueDate', 'completedDate'), ...text('nextAction', 'remarks', 'pics', 'source'),
    ...date('lastRemindedOn'), ...stamp('createdAt', 'updatedAt'), ...text('createdBy'),
  ],
  issueSubtasks: [...text('projectId', 'id', 'issueId', 'title', 'pic'), ...date('dueDate'), ...text('done'), ...num('position'), ...date('lastRemindedOn'), ...stamp('updatedAt')],
  issueLog: [...text('projectId', 'id', 'issueId'), ...stamp('at'), ...text('actor', 'action', 'field', 'fromValue', 'toValue', 'note')],
  phaseProgress: [...text('projectId', 'id', 'phase'), ...num('plan', 'actual'), ...date('reportDate'), ...stamp('updatedAt')],
  procCurves: [...text('projectId', 'id', 'facility', 'scope'), ...date('start'), ...text('plan', 'forecast', 'actual'), ...stamp('updatedAt')],
  /** Weekly cumulative progress per facility and scope (overall, a phase, a construction curve), in percent. */
  facilityCurves: [...text('projectId', 'facilityId', 'scope'), ...date('date'), ...num('plan', 'forecast', 'actual')],
  facilityScopes: [...text('projectId', 'facilityId', 'scope', 'label'), ...num('weight')],
  /** The working schedules: CGF Topsides activity by activity, and the span of each group of the CGF Jacket schedule. each activity (or summary row) with its baseline, working-schedule, WK-planning and re-schedule dates. */
  workingSchedule: [
    ...text('projectId', 'id', 'facilityId', 'activityId', 'name', 'parent'), ...num('level'), ...text('leaf'), ...num('duration'), ...text('discipline'),
    ...date('baseStart', 'baseFinish', 'workStart', 'workFinish', 'wkpStart', 'wkpFinish', 'reStart', 'reFinish'),
  ],
  /** Critical-path-network progress by work package: weight, plan and actual at the cut-off, beside the same figures of the baseline plan. */
  cpnItems: [...text('projectId', 'code', 'name', 'kind'), ...num('weight', 'plan', 'actual', 'lastPlan', 'lastActual', 'basePlan', 'baseActual', 'baseWeight')],
  /** The WBS of a facility with its planned dates and its progress at the cut-off. */
  facilityWbs: [...text('projectId', 'facilityId', 'code', 'name'), ...num('level'), ...text('father'), ...date('start', 'finish'), ...num('weight', 'plan', 'actual'), ...text('shared')],
  /** Manhours per WBS row: the budget (`manhours`), what has been spent (`actualHours`) and the value earned for it (`earnedHours`). */
  budget: [...text('projectId', 'wbs', 'name', 'parentWbs', 'discipline'), ...num('manhours'), ...date('planStart', 'planFinish'), ...text('notes'), ...stamp('updatedAt'), ...num('actualHours', 'earnedHours')],
  /**
   * Large equipment of the 3D facility model, one row per tag. The page joins a row to the model by `tag` (the part's name in the GLB files),
   * so the dates, installation method (Lift by Crane / Skidding), remarks and comments are edited here, in the sheet.
   */
  facilityEquipment: [...text('projectId', 'tag', 'name', 'deck', 'packageCode', 'vendor'), ...date('rosDate', 'etaDate'), ...text('status', 'packageStatus', 'method', 'remarks', 'comments', 'source'), ...stamp('updatedAt')],
  knowledge: [
    ...text('projectId', 'id', 'domain', 'category', 'title', 'summary', 'body', 'tags', 'sources', 'status'),
    ...stamp('createdAt', 'updatedAt'), ...text('createdBy', 'updatedBy'),
  ],
  snapshots: [...text('projectId'), ...date('cutoff'), ...stamp('createdAt'), ...text('createdBy', 'note'), ...num('rowCount')],
  snapshotData: [...text('projectId'), ...date('cutoff'), ...text('dataset'), ...num('part'), ...text('json')],
  scurve: [...text('projectId'), ...date('date'), ...num('plan', 'forecast', 'actual')],
  /** The same overall curve at the weekly cut-offs; `scurve` keeps the monthly ones. */
  scurveWeekly: [...text('projectId'), ...date('date'), ...num('plan', 'forecast', 'actual')],
  workPackages: [...text('projectId', 'code', 'name'), ...num('weight', 'lastWeekPlan', 'lastWeekActual', 'achievedPlan', 'achievedActual', 'thisWeekPlan', 'thisWeekActual')],
  milestones: [...text('projectId', 'id', 'description'), ...date('planBaseline', 'planSub'), ...text('subName'), ...date('forecast', 'actual'), ...num('variance'), ...text('comment', 'facility'), ...text('major'), ...text('kind', 'package', 'tagNo', 'location', 'deck'), ...date('eta')],
  procurement: [
    ...text('projectId', 'id', 'code', 'discipline', 'description', 'vendorCode', 'vendor', 'origins', 'loaNo'), ...date('loaDate'),
    ...text('poNo'), ...date('poDate'), ...text('buyer', 'expeditor', 'pe', 'vqc', 'status', 'workPackage', 'packageType'), ...num('weightPct'),
  ],
  expediting: [
    ...text('projectId', 'id', 'discipline', 'code', 'name', 'vendor', 'status'), ...num('planPct', 'actualPct', 'variance'), ...date('rosDate'),
    ...text('etaSite', 'dateDiff'),
    ...num('engPlan', 'engActual', 'procPlan', 'procActual', 'fabPlan', 'fabActual', 'testPlan', 'testActual', 'delPlan', 'delActual'),
    ...text('highlight', 'actionPlan', 'remark', 'lsps', 'poNo', 'deliveryDate', 'currentStatusText'),
    ...num('planExw', 'actExw', 'planArrival', 'actArrival'),
  ],
  /** The project's risk register: ratings are scores on the project's matrix (see riskMatrix), one per impact dimension. */
  risks: [
    ...text('projectId', 'id'), ...num('no'), ...text('status', 'rbs', 'category', 'discipline', 'title', 'description', 'cause', 'effect', 'owner'), ...date('recordDate'),
    // Ratings are text so a word typed in the sheet ("Possible", "Major") is kept and read by meaning, as well as a score.
    ...text('preProbability', 'preSchedule', 'preCost', 'preScope', 'preQuality'),
    ...text('strategy', 'mitigationCause', 'mitigationEffect'), ...date('planDate'), ...text('actualActions'), ...date('actualDate'),
    ...text('postProbability', 'postSchedule', 'postCost', 'postScope', 'postQuality'),
    ...text('remark', 'external'), ...date('reviewDate'), ...text('milestoneId'), ...stamp('createdAt', 'updatedAt'), ...text('createdBy'),
  ],
  /** Mitigation actions of a risk, each with an owner and a due date. */
  riskActions: [...text('projectId', 'id', 'riskId', 'action', 'owner'), ...date('dueDate', 'doneDate'), ...stamp('createdAt', 'updatedAt')],
  /** The project's risk matrix: one row per probability x severity cell and the level that cell means. */
  riskMatrix: [...text('projectId'), ...num('probability'), ...text('probabilityLabel'), ...num('severity'), ...text('severityLabel', 'level')],
  /** Risk breakdown structure: category (level 1) and discipline (level 2); the code is what a risk's RBS holds. */
  riskBreakdown: text('projectId', 'code', 'category', 'categoryName', 'discipline', 'disciplineName'),
  interfaces: [
    ...text('projectId', 'id', 'title', 'type', 'originator', 'receiver', 'coordinator', 'discipline', 'boundary', 'requiredInput', 'requiredOutput'),
    ...date('needDate'), ...text('response', 'acceptance', 'evidence', 'status', 'milestoneId'), ...stamp('createdAt', 'updatedAt'),
  ],
  /** Interface points (queries) raised by one party to another; an interface in the register may group them. */
  interfacePoints: [
    ...text('projectId', 'id', 'interfaceId', 'title', 'description', 'owner', 'workPackage', 'discipline', 'originator', 'target', 'action'),
    ...date('queryDate', 'targetDate'), ...text('reference', 'status', 'resolution'), ...date('resolvedDate'), ...text('resolvedDocument', 'remarks'), ...stamp('createdAt', 'updatedAt'),
  ],
  interfaceParties: text('projectId', 'code', 'name'),
  /** Who performs each scope activity, per facility: one row per cell of the responsibility matrix. */
  responsibility: [...text('projectId'), ...num('order', 'level'), ...text('section', 'ref', 'activity', 'workPackage', 'facility', 'party', 'remark')],
  /** Each party's RASCI role per scope activity, one row per cell, for each matrix (facility group). */
  rasci: [...text('projectId', 'matrix'), ...num('order'), ...text('section', 'ref', 'activity', 'phase', 'party', 'role', 'remark')],
  /** Template for modules that have no dedicated schema yet. */
  generic: [...text('projectId', 'id', 'title', 'status', 'owner'), ...date('due'), ...text('notes'), ...stamp('updatedAt')],
} satisfies Record<string, Column[]>;

/** Worksheets are grouped by area: general settings first, then one group per workspace. The prefix keeps each group together. */
export const SHEET = {
  projects: 'Settings - Projects',
  users: 'Settings - Users',
  partyAccess: 'Settings - Party access',
  roleAccess: 'Settings - Role access',
  personAccess: 'Settings - Person access',
  accessLog: 'Settings - Access log',
  memberships: 'Settings - Memberships',
  modules: 'Settings - Modules',
  moduleChanges: 'Settings - Module changes',
  tasks: 'Personal - Tasks',
  subtasks: 'Personal - Subtasks',
  scurve: 'EPCIC - S-curve',
  scurveWeekly: 'EPCIC - S-curve weekly',
  workPackages: 'EPCIC - Work packages',
  milestones: 'EPCIC - Milestones',
  procurement: 'EPCIC - Procurement packages',
  expediting: 'EPCIC - Expediting packages',
  budget: 'EPCIC - Construction budget',
  facilityEquipment: 'EPCIC - Facility equipment',
  logistics: 'EPCIC - Logistics shipments',
  materialBalance: 'EPCIC - Material balance',
  materialSummary: 'EPCIC - Material summary',
  procConcerns: 'EPCIC - Procurement concerns',
  procCurves: 'EPCIC - Procurement S-curves',
  facilityCurves: 'EPCIC - Facility curves',
  facilityScopes: 'EPCIC - Facility scopes',
  facilityWbs: 'EPCIC - Facility WBS',
  workingSchedule: 'EPCIC - Working schedule',
  cpnItems: 'EPCIC - CPN progress',
  phaseProgress: 'EPCIC - Phase progress',
  risks: 'Governance - Risks',
  riskActions: 'Governance - Risk actions',
  riskMatrix: 'Governance - Risk matrix',
  riskBreakdown: 'Governance - Risk breakdown',
  issues: 'Governance - Issues',
  issueSubtasks: 'Governance - Issue sub-tasks',
  issueLog: 'Governance - Issue log',
  interfaces: 'Governance - Interfaces',
  interfacePoints: 'Governance - Interface points',
  interfaceParties: 'Governance - Interface parties',
  responsibility: 'Governance - Responsibility matrix',
  rasci: 'Governance - RASCI',
  knowledge: 'Reports - Knowledge',
  snapshots: 'Reports - Cut-off snapshots',
  snapshotData: 'Reports - Snapshot data',
} as const;

export type SheetKey = keyof typeof SHEET;

/** Tab colours per area, applied when a sheet is created. */
export const AREA_COLOR = {
  Settings: '#6b7280',
  Personal: '#00877d',
  EPCIC: '#343c78',
  Governance: '#ad751d',
  Reports: '#bc5660',
} as const;

export const tabColorOf = (sheetName: string): string | undefined => {
  const area = sheetName.split(' - ')[0] as keyof typeof AREA_COLOR;
  return AREA_COLOR[area];
};

/** Sheets whose rows belong to a project (first column `projectId`). Deleting a project removes its rows from these. */
export const PROJECT_SHEETS: SheetKey[] = ['modules', 'moduleChanges', 'memberships', 'roleAccess', 'personAccess', 'scurve', 'scurveWeekly', 'workPackages', 'milestones', 'procurement', 'expediting', 'risks', 'riskActions', 'riskMatrix', 'riskBreakdown', 'interfaces', 'interfacePoints', 'interfaceParties', 'responsibility', 'rasci', 'budget', 'facilityEquipment', 'logistics', 'materialBalance', 'materialSummary', 'procConcerns', 'procCurves', 'facilityCurves', 'facilityScopes', 'facilityWbs', 'workingSchedule', 'cpnItems', 'phaseProgress', 'issues', 'issueSubtasks', 'issueLog', 'knowledge', 'snapshots', 'snapshotData'];

/** Datasets copied into a cut-off snapshot. Settings, module states and personal tasks are not part of a report. */
export const SNAPSHOT_DATASETS = ['scurve', 'workPackages', 'milestones', 'procurement', 'expediting', 'budget', 'logistics', 'materialBalance', 'materialSummary', 'procConcerns', 'phaseProgress', 'issues', 'issueSubtasks', 'risks', 'riskActions', 'interfaces', 'interfacePoints'] as const satisfies readonly SheetKey[];
export type SnapshotDataset = (typeof SNAPSHOT_DATASETS)[number];
export const SNAPSHOT_KEY_OF_SHEET: Record<string, SnapshotDataset> = Object.fromEntries(SNAPSHOT_DATASETS.map(k => [SHEET[k], k]));

/** Modules whose data lives in a dedicated dataset sheet. */
export const DATASET_OF_MODULE: Record<string, { sheet: string; columns: Column[] }> = {
  'planning.overall-progress': { sheet: SHEET.scurve, columns: COLUMNS.scurve },
  'planning.work-packages': { sheet: SHEET.workPackages, columns: COLUMNS.workPackages },
  'planning.milestones': { sheet: SHEET.milestones, columns: COLUMNS.milestones },
  'procurement.procurement-plan': { sheet: SHEET.procurement, columns: COLUMNS.procurement },
  'procurement.expediting.vendor-overview': { sheet: SHEET.expediting, columns: COLUMNS.expediting },
  'task-management.board': { sheet: SHEET.tasks, columns: COLUMNS.tasks },
  'construction.budget': { sheet: SHEET.budget, columns: COLUMNS.budget },
  'construction.facility-layout': { sheet: SHEET.facilityEquipment, columns: COLUMNS.facilityEquipment },
  'procurement.logistics': { sheet: SHEET.logistics, columns: COLUMNS.logistics },
  'procurement.materials': { sheet: SHEET.materialBalance, columns: COLUMNS.materialBalance },
  'procurement.concerns': { sheet: SHEET.procConcerns, columns: COLUMNS.procConcerns },
  ...Object.fromEntries(['overview', 'engineering', 'procurement', 'services', 'quality', 'hse', 'construction', 'precom', 'ti', 'huc'].map(d => [`knowledge.${d}`, { sheet: SHEET.knowledge, columns: COLUMNS.knowledge }])),
  'management.risks': { sheet: SHEET.risks, columns: COLUMNS.risks },
  'management.issues': { sheet: SHEET.issues, columns: COLUMNS.issues },
  'interface.register': { sheet: SHEET.interfaces, columns: COLUMNS.interfaces },
  'interface.matrix': { sheet: SHEET.responsibility, columns: COLUMNS.responsibility },
  'interface.points': { sheet: SHEET.interfacePoints, columns: COLUMNS.interfacePoints },
};

/** Modules that show derived data only and have no register of their own. */
const WITHOUT_SHEET = new Set(['dashboard', 'procurement.dashboard', 'task-management.calendar', 'task-management.workload']);

export const isLeaf = (key: string, manifests: ModuleManifest[]) => !manifests.some(m => m.parent === key);

/** Labels from workspace down to the module, used for generic sheet names and for the Modules sheet. */
export function pathOf(key: string): string[] {
  const chain: ModuleManifest[] = [];
  for (let m = MANIFEST_BY_KEY.get(key); m; m = m.parent ? MANIFEST_BY_KEY.get(m.parent) : undefined) chain.unshift(m);
  if (!chain.length) return [];
  return [WORKSPACES.find(w => w.id === chain[0].workspace)?.label ?? '', ...chain.map(m => m.label)];
}

/** Sheet names may not contain : \ / ? * [ ] and are limited to 100 characters. */
export const safeSheetName = (s: string) => s.replace(/[:\\/?*[\]]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 99);

/** Which sheet holds this module's data, or null when the module keeps none. */
export function moduleSheet(key: string, manifests: ModuleManifest[]): { sheet: string; columns: Column[]; generic: boolean } | null {
  if (WITHOUT_SHEET.has(key) || !MANIFEST_BY_KEY.has(key) || !isLeaf(key, manifests)) return null;
  const known = DATASET_OF_MODULE[key];
  if (known) return { ...known, generic: false };
  return { sheet: safeSheetName(pathOf(key).join(' - ')), columns: COLUMNS.generic, generic: true };
}
