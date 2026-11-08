export class ApiError extends Error {
  constructor(message: string, readonly code?: string, readonly status?: number, readonly issues?: { path: string; message: string }[]) {
    super(message);
  }
}

/** A message for a toast or form: field issues from validation are listed after the summary. */
export function errorText(e: unknown): string {
  if (!(e instanceof Error)) return 'Something went wrong.';
  const issues = e instanceof ApiError ? e.issues : undefined;
  return issues?.length ? `${e.message} ${issues.map(i => `${i.path}: ${i.message}`).join('; ')}` : e.message;
}

/**
 * Two backends serve the same routes. "rest" is the NestJS API behind the Vite proxy. "sheets" is the pre-build
 * backend: a Google Apps Script web app over a spreadsheet, which only accepts simple GET/POST requests and always
 * answers HTTP 200, so the route travels as a parameter and the status inside a JSON envelope.
 */
export const apiMode: 'rest' | 'sheets' = import.meta.env.VITE_API_MODE === 'sheets' ? 'sheets' : 'rest';
const sheetsUrl: string = import.meta.env.VITE_SHEETS_URL ?? '';
const sheetsToken: string = import.meta.env.VITE_SHEETS_TOKEN ?? '';

/** Demo identity (pre-build only): the chosen user id is sent with every request; it is not authentication. */
const USER_KEY = 'projectflow.user';
export const getUserId = (): string | null => { try { return localStorage.getItem(USER_KEY); } catch { return null; } };
export const setUserId = (id: string | null) => { try { if (id) localStorage.setItem(USER_KEY, id); else localStorage.removeItem(USER_KEY); } catch { /* storage unavailable */ } };

interface Envelope { ok: boolean; status: number; data?: unknown; error?: { code?: string; message?: string; issues?: { path: string; message: string }[] } }

async function requestSheets<T>(path: string, init?: RequestInit): Promise<T> {
  if (!sheetsUrl) throw new ApiError('VITE_SHEETS_URL is not set. Copy .env.sheets.example to .env.sheets.local and fill it in.', 'NOT_CONFIGURED');
  const method = (init?.method ?? 'GET').toUpperCase();
  const user = getUserId() ?? undefined;
  const res = method === 'GET'
    ? await fetch(`${sheetsUrl}?${new URLSearchParams({ path, ...(sheetsToken && { token: sheetsToken }), ...(user && { user }) })}`)
    : await fetch(sheetsUrl, {
        method: 'POST',
        // text/plain keeps this a "simple" request, so the browser sends no CORS preflight (Apps Script cannot answer one).
        headers: { 'content-type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined, token: sheetsToken || undefined, user }),
      });
  const envelope = (await res.json().catch(() => null)) as Envelope | null;
  if (!envelope) throw new ApiError('The sheets API returned something other than JSON. Check the web app deployment and its access setting.', 'BAD_RESPONSE', res.status);
  if (!envelope.ok) {
    if (envelope.error?.code === 'USER_REQUIRED') window.dispatchEvent(new Event('projectflow:signed-out'));
    throw new ApiError(envelope.error?.message ?? 'Request failed.', envelope.error?.code, envelope.status, envelope.error?.issues);
  }
  return envelope.data as T;
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (apiMode === 'sheets') return requestSheets<T>(path, init);
  const res = await fetch(`/api/v1${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers } });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.message ?? res.statusText, body.code, res.status, body.issues);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Fetches a CSV route and saves it as a file (the sheets backend cannot send a download response). */
export async function downloadCsv(path: string, fallbackName: string) {
  let csv: string;
  let filename = fallbackName;
  if (apiMode === 'sheets') {
    const r = await request<{ csv: string; filename: string }>(path);
    csv = r.csv;
    filename = r.filename || fallbackName;
  } else {
    const res = await fetch(`/api/v1${path}`);
    if (!res.ok) throw new ApiError(res.statusText, undefined, res.status);
    csv = await res.text();
  }
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export type WorkspaceId = 'personal' | 'epcic' | 'governance' | 'reports';
export type OperationState = 'Not assigned' | 'Setup' | 'Pilot' | 'Enabled' | 'Locked' | 'Read-only' | 'Disabled';

export type Lifecycle = 'Draft' | 'Setup' | 'Active' | 'On hold' | 'Closing' | 'Archived';
export type Role = 'Project Manager' | 'Manager' | 'Leader' | 'Team Member' | 'Client';
export const ROLES: Role[] = ['Project Manager', 'Manager', 'Leader', 'Team Member', 'Client'];
export const LIFECYCLES: Lifecycle[] = ['Draft', 'Setup', 'Active', 'On hold', 'Closing', 'Archived'];
/** Allowed lifecycle moves (spec PRJ-03); mirrors the sheets backend. */
export const LIFECYCLE_NEXT: Record<Lifecycle, Lifecycle[]> = {
  Draft: ['Setup', 'Active'], Setup: ['Active', 'Draft'], Active: ['On hold', 'Closing'], 'On hold': ['Active', 'Closing'], Closing: ['Archived', 'Active'], Archived: ['Active'],
};

export interface Project {
  id: string; code: string; name: string; contract: string; cutoff: string;
  /** Present when the sheets backend serves the project. */
  shortName?: string | null; client?: string | null; location?: string | null; lifecycle?: Lifecycle;
  myRole?: Role | null; memberCount?: number; createdAt?: string; updatedAt?: string;
}
export interface Me { id: string; name: string; email: string | null; isAdmin: boolean; memberships: { projectId: string; role: Role }[] }
export interface DirectoryUser { id: string; name: string }
export type AccountState = 'Invited' | 'Active' | 'Suspended' | 'Deactivated';
export const ACCOUNT_STATES: AccountState[] = ['Invited', 'Active', 'Suspended', 'Deactivated'];
export interface UserRow {
  id: string; name: string; email: string; isAdmin: boolean; status: AccountState; createdAt: string | null;
  memberships: { projectId: string; projectCode: string; role: Role; title: string | null }[];
}
export interface Member { userId: string; name: string; email: string | null; status: string; role: Role; title: string | null }

export interface ModuleInfo {
  key: string;
  label: string;
  workspace: WorkspaceId;
  group?: string;
  icon?: string;
  parent?: string;
  order: number;
  depth: number;
  phase: 'P1' | 'P2' | 'P3';
  availability: 'Available' | 'In development' | 'Planned';
  description: string;
  core: boolean;
  requires: string[];
  state: OperationState;
  effective: boolean;
  /** Sheets backend only: where the module's data lives and whether it can have a sheet. */
  sheet?: SheetInfo | null;
  sheetCapable?: boolean;
  sheetsCreated?: SheetInfo[];
}
export interface SheetInfo { name: string; gid: number; url: string }
export interface ModuleRecords { sheet: SheetInfo | null; columns: string[]; items: Record<string, string | number | null>[] }
export interface ModulesResponse { workspaces: { id: WorkspaceId; label: string }[]; modules: ModuleInfo[] }

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number; facets: { disciplines: string[]; statuses: string[]; parties?: string[] } }

export interface ProcurementPackage {
  id: string; code: string; discipline: string | null; description: string | null; vendorCode: string | null; vendor: string | null;
  origins: string | null; loaNo: string | null; loaDate: string | null; poNo: string | null; poDate: string | null;
  buyer: string | null; expeditor: string | null; pe: string | null; vqc: string | null; status: string;
}
export interface ProcurementSummary { total: number; byStatus: Record<string, number>; byDiscipline: Record<string, number> }

export interface ExpeditingPackage {
  id: string; discipline: string; code: string; name: string | null; vendor: string | null; status: string;
  planPct: number | null; actualPct: number | null; variance: number | null; rosDate: string | null;
  [detail: string]: unknown;
}
export interface ExpeditingSummary {
  total: number; delayed: number; atRisk: number; normal: number;
  flags: { id: string; code: string; name: string | null; vendor: string | null; status: string; discipline: string }[];
}

export interface WorkPackage {
  code: string; name: string; weight: number | null;
  lastWeekPlan: number | null; lastWeekActual: number | null; achievedPlan: number | null; achievedActual: number | null;
  thisWeekPlan: number | null; thisWeekActual: number | null;
}
export interface WeeklyOverall { lastWeekPlan: number; lastWeekActual: number; thisWeekPlan: number; thisWeekActual: number }
export interface WorkPackagesResponse { items: WorkPackage[]; overall: WeeklyOverall }
export interface ScurvePoint { date: string; plan: number | null; forecast: number | null; actual: number | null }
export interface OverallProgressResponse {
  scurve: ScurvePoint[]; latest: ScurvePoint | null; thisWeek: { plan: number; actual: number }; workPackageCount: number;
}

export type MilestoneStatus = 'Done' | 'Overdue' | 'Due soon' | 'Planned';
export interface Milestone {
  id: string; description: string; planBaseline: string | null; planSub: string | null; subName: string | null;
  forecast: string | null; actual: string | null; variance: number | null; comment: string | null;
  status: MilestoneStatus; slipDays: number | null; daysToGo: number | null;
}
export interface MilestoneSummary {
  total: number; done: number; overdue: number; dueSoon: number; planned: number; bySub: Record<string, number>; next: Milestone[]; cutoff: string;
}

export type RiskLevel = 'Low' | 'Medium' | 'High' | 'Extreme';
export type RiskStatus = 'Open' | 'Mitigating' | 'Accepted' | 'Closed';
export const RISK_STATUSES: RiskStatus[] = ['Open', 'Mitigating', 'Accepted', 'Closed'];
export const RISK_CATEGORIES = ['Schedule', 'Cost', 'Quality', 'HSE', 'Supply chain', 'Contractual', 'Technical', 'Interface', 'Other'];
export interface Risk {
  id: string; title: string; category: string; cause: string | null; event: string | null; effect: string | null; owner: string;
  likelihood: number; impact: number; mitigation: string | null; trigger: string | null;
  residualLikelihood: number | null; residualImpact: number | null; reviewDate: string | null; status: RiskStatus; milestoneId: string | null;
  inherentScore: number | null; inherentLevel: RiskLevel | null; residualScore: number | null; residualLevel: RiskLevel | null;
  currentScore: number | null; currentLevel: RiskLevel | null; reviewOverdue: boolean; milestone: string | null; createdAt: string; updatedAt: string; createdBy: string | null;
}
export interface RiskSummary {
  total: number; active: number; byStatus: Record<string, number>; byLevel: Record<RiskLevel, number>; reviewOverdue: number;
  heatmap: { version: string; likelihoodLabels: string[]; impactLabels: string[]; inherent: number[][]; current: number[][] };
}

export type InterfaceStatus = 'Identified' | 'Assigned' | 'Information requested' | 'Responded' | 'Under review' | 'Agreed' | 'Closed';
export type PointStatus = 'Open' | 'In progress' | 'Accepted' | 'Closed';
export const INTERFACE_TYPES = ['Physical', 'Technical', 'Contractual', 'Operational', 'Schedule'];
export const POINT_STATUSES: PointStatus[] = ['Open', 'In progress', 'Accepted', 'Closed'];
export interface InterfaceRecord {
  id: string; title: string; type: string; originator: string; receiver: string; coordinator: string | null; discipline: string | null;
  boundary: string | null; requiredInput: string | null; requiredOutput: string | null; needDate: string | null;
  response: string | null; acceptance: string | null; evidence: string | null; status: InterfaceStatus; milestoneId: string | null;
  overdue: boolean; pointsTotal: number; pointsOpen: number; allowedNext: InterfaceStatus[]; milestone: string | null; points?: InterfacePoint[];
}
export interface InterfacePoint {
  id: string; interfaceId: string; title: string; owner: string; due: string | null; status: PointStatus; response: string | null; overdue: boolean; interfaceTitle?: string | null;
}
export interface InterfaceSummary { total: number; open: number; overdue: number; pointsOpen: number; byStatus: Record<string, number> }
export interface InterfaceMatrix { parties: string[]; cells: { originator: string; receiver: string; total: number; open: number; overdue: number; settled: number }[]; total: number }

export interface Dashboard {
  project: Project;
  overallProgress: OverallProgressResponse | null;
  workPackages: WorkPackagesResponse | null;
  procurement: ProcurementSummary | null;
  expediting: ExpeditingSummary | null;
  milestones?: MilestoneSummary | null;
  risks?: RiskSummary | null;
  interfaces?: InterfaceSummary | null;
}

/* ---------- personal task management (sheets backend) ---------- */
export type TaskStatus = 'Backlog' | 'Planned' | 'Ongoing' | 'Completed';
export type Urgency = 'Low' | 'Normal' | 'High' | 'Urgent';
export const TASK_STATUSES: TaskStatus[] = ['Backlog', 'Planned', 'Ongoing', 'Completed'];
export const URGENCIES: Urgency[] = ['Low', 'Normal', 'High', 'Urgent'];
export interface Subtask { id?: string; title: string; done: boolean }
export interface PTask {
  id: string; taskNo: string; title: string; description: string | null; urgency: Urgency; assigner: string | null; projects: string[];
  planStart: string | null; planFinish: string | null; due: string | null; status: TaskStatus; effort: number | null; remarks: string | null;
  subtasks: Required<Subtask>[]; subtasksDone: number; subtasksTotal: number;
  /** Derived: deadline passed and not Completed. */
  overdue: boolean;
  /** Plan start, plan finish and deadline are all set, so the task can be drawn on the Gantt. */
  ganttReady: boolean;
  createdAt: string; updatedAt: string;
}
export type TaskInput = Partial<Omit<PTask, 'id' | 'taskNo' | 'subtasks' | 'subtasksDone' | 'subtasksTotal' | 'overdue' | 'ganttReady' | 'createdAt' | 'updatedAt'>> & { subtasks?: Subtask[] };
export interface WorkloadStat { tasks: number; hours: number; open: number; openHours: number }
export interface Workload {
  by: 'week' | 'month'; from: string; to: string; today: string; projects: string[];
  periods: { start: string; end: string; total: WorkloadStat; byProject: Record<string, WorkloadStat> }[];
  totals: { total: WorkloadStat; byProject: Record<string, WorkloadStat> };
  unscheduled: WorkloadStat; outside: { tasks: number; hours: number };
}
/** Workload key of tasks that belong to no project. */
export const PERSONAL_KEY = '_personal';

export interface Task { id: string; title: string; note: string | null; due: string; priority: 'High' | 'Normal' | 'Low'; status: 'To do' | 'In progress' | 'Done'; createdAt: string }

/** Builds a query string from defined, non-empty values. */
export const qs = (params: Record<string, string | number | undefined>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && u.set(k, String(v)));
  const s = u.toString();
  return s ? `?${s}` : '';
};
