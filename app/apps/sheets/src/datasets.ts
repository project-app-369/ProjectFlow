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
  users: [...text('id', 'name', 'email', 'isAdmin', 'status'), ...stamp('createdAt')],
  memberships: text('projectId', 'userId', 'role', 'title'),
  modules: [...text('projectId', 'moduleKey', 'path', 'state'), ...stamp('updatedAt')],
  moduleChanges: [...text('projectId', 'id'), ...stamp('at'), ...text('moduleKey', 'fromState', 'toState', 'reason', 'actor')],
  tasks: [
    ...text('id', 'taskNo', 'title', 'description', 'urgency', 'assigner', 'projects'), ...date('planStart', 'planFinish', 'due'),
    ...text('status'), ...num('effort'), ...text('remarks'), ...stamp('createdAt', 'updatedAt'), ...text('owner'),
  ],
  subtasks: [...text('taskId', 'id', 'title', 'done'), ...num('position')],
  scurve: [...text('projectId'), ...date('date'), ...num('plan', 'forecast', 'actual')],
  workPackages: [...text('projectId', 'code', 'name'), ...num('weight', 'lastWeekPlan', 'lastWeekActual', 'achievedPlan', 'achievedActual', 'thisWeekPlan', 'thisWeekActual')],
  milestones: [...text('projectId', 'id', 'description'), ...date('planBaseline', 'planSub'), ...text('subName'), ...date('forecast', 'actual'), ...num('variance'), ...text('comment')],
  procurement: [
    ...text('projectId', 'id', 'code', 'discipline', 'description', 'vendorCode', 'vendor', 'origins', 'loaNo'), ...date('loaDate'),
    ...text('poNo'), ...date('poDate'), ...text('buyer', 'expeditor', 'pe', 'vqc', 'status'),
  ],
  expediting: [
    ...text('projectId', 'id', 'discipline', 'code', 'name', 'vendor', 'status'), ...num('planPct', 'actualPct', 'variance'), ...date('rosDate'),
    ...text('etaSite', 'dateDiff'),
    ...num('engPlan', 'engActual', 'procPlan', 'procActual', 'fabPlan', 'fabActual', 'testPlan', 'testActual', 'delPlan', 'delActual'),
    ...text('highlight', 'actionPlan', 'remark', 'lsps', 'poNo', 'deliveryDate', 'currentStatusText'),
    ...num('planExw', 'actExw', 'planArrival', 'actArrival'),
  ],
  risks: [
    ...text('projectId', 'id', 'title', 'category', 'cause', 'event', 'effect', 'owner'), ...num('likelihood', 'impact'),
    ...text('mitigation', 'trigger'), ...num('residualLikelihood', 'residualImpact'), ...date('reviewDate'),
    ...text('status', 'milestoneId'), ...stamp('createdAt', 'updatedAt'), ...text('createdBy'),
  ],
  interfaces: [
    ...text('projectId', 'id', 'title', 'type', 'originator', 'receiver', 'coordinator', 'discipline', 'boundary', 'requiredInput', 'requiredOutput'),
    ...date('needDate'), ...text('response', 'acceptance', 'evidence', 'status', 'milestoneId'), ...stamp('createdAt', 'updatedAt'),
  ],
  interfacePoints: [...text('projectId', 'id', 'interfaceId', 'title', 'owner'), ...date('due'), ...text('status', 'response'), ...stamp('createdAt', 'updatedAt')],
  /** Template for modules that have no dedicated schema yet. */
  generic: [...text('projectId', 'id', 'title', 'status', 'owner'), ...date('due'), ...text('notes'), ...stamp('updatedAt')],
} satisfies Record<string, Column[]>;

/** Worksheets are grouped by area: general settings first, then one group per workspace. The prefix keeps each group together. */
export const SHEET = {
  projects: 'Settings - Projects',
  users: 'Settings - Users',
  memberships: 'Settings - Memberships',
  modules: 'Settings - Modules',
  moduleChanges: 'Settings - Module changes',
  tasks: 'Personal - Tasks',
  subtasks: 'Personal - Subtasks',
  scurve: 'EPCIC - S-curve',
  workPackages: 'EPCIC - Work packages',
  milestones: 'EPCIC - Milestones',
  procurement: 'EPCIC - Procurement packages',
  expediting: 'EPCIC - Expediting packages',
  risks: 'Governance - Risks',
  interfaces: 'Governance - Interfaces',
  interfacePoints: 'Governance - Interface points',
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
export const PROJECT_SHEETS: SheetKey[] = ['modules', 'moduleChanges', 'memberships', 'scurve', 'workPackages', 'milestones', 'procurement', 'expediting', 'risks', 'interfaces', 'interfacePoints'];

/** Modules whose data lives in a dedicated dataset sheet. */
export const DATASET_OF_MODULE: Record<string, { sheet: string; columns: Column[] }> = {
  'planning.overall-progress': { sheet: SHEET.scurve, columns: COLUMNS.scurve },
  'planning.work-packages': { sheet: SHEET.workPackages, columns: COLUMNS.workPackages },
  'planning.milestones': { sheet: SHEET.milestones, columns: COLUMNS.milestones },
  'procurement.procurement-plan': { sheet: SHEET.procurement, columns: COLUMNS.procurement },
  'procurement.expediting.vendor-overview': { sheet: SHEET.expediting, columns: COLUMNS.expediting },
  'task-management.board': { sheet: SHEET.tasks, columns: COLUMNS.tasks },
  'management.risks': { sheet: SHEET.risks, columns: COLUMNS.risks },
  'interface.register': { sheet: SHEET.interfaces, columns: COLUMNS.interfaces },
  'interface.matrix': { sheet: SHEET.interfaces, columns: COLUMNS.interfaces },
  'interface.points': { sheet: SHEET.interfacePoints, columns: COLUMNS.interfacePoints },
};

/** Modules that show derived data only and have no register of their own. */
const WITHOUT_SHEET = new Set(['dashboard', 'task-management.calendar', 'task-management.workload']);

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
