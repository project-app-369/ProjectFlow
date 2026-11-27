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
/** The exact Google Sheet that holds the data (set per environment, see .env.sheets). */
export const SPREADSHEET_URL: string = import.meta.env.VITE_SPREADSHEET_URL ?? '';
export const apiMode: 'rest' | 'sheets' = import.meta.env.VITE_API_MODE === 'sheets' ? 'sheets' : 'rest';
const sheetsUrl: string = import.meta.env.VITE_SHEETS_URL ?? '';
const sheetsToken: string = import.meta.env.VITE_SHEETS_TOKEN ?? '';

/** Demo identity (pre-build only): the chosen user id is sent with every request; it is not authentication. */
const USER_KEY = 'projectflow.user';
const DEFAULT_DEMO_USER_ID = 'u-admin';
/**
 * How the backend identifies people: `demo` (pick a name, the old pre-build) or `password` (e-mail and password, a signed session).
 * Learned from GET /auth/config and remembered, so the demo default below is never applied where passwords are required.
 */
export type AuthMode = 'demo' | 'password';
const MODE_KEY = 'projectflow.authmode';
const SESSION_KEY = 'projectflow.session';
export const getAuthMode = (): AuthMode => { try { return localStorage.getItem(MODE_KEY) === 'password' ? 'password' : 'demo'; } catch { return 'demo'; } };
export const setAuthMode = (mode: AuthMode) => { try { localStorage.setItem(MODE_KEY, mode); } catch { /* storage unavailable */ } };
export const getSession = (): string | null => { try { return localStorage.getItem(SESSION_KEY); } catch { return null; } };
export const setSession = (token: string | null) => { try { if (token) localStorage.setItem(SESSION_KEY, token); else localStorage.removeItem(SESSION_KEY); } catch { /* storage unavailable */ } };

export const getUserId = (): string | null => {
  const demo = apiMode === 'sheets' && getAuthMode() === 'demo' ? DEFAULT_DEMO_USER_ID : null;
  try { return localStorage.getItem(USER_KEY) ?? demo; }
  catch { return demo; }
};
export const setUserId = (id: string | null) => { try { if (id) localStorage.setItem(USER_KEY, id); else localStorage.removeItem(USER_KEY); } catch { /* storage unavailable */ } };

/**
 * Cut-off snapshot being viewed (a saved report date), or null for the current data. While set, reads of the
 * project's report data carry `?asOf=` and writes are refused here, since a snapshot is read-only.
 */
let currentAsOf: string | null = null;
export const setCurrentAsOf = (cutoff: string | null) => { currentAsOf = cutoff; };
export const getCurrentAsOf = () => currentAsOf;
const SNAPSHOT_PATH = /^\/projects\/[^/]+\/(dashboard|schedule|milestones|procurement|expediting|risks|issues|interfaces|interface-points)/;

interface Envelope { ok: boolean; status: number; data?: unknown; error?: { code?: string; message?: string; issues?: { path: string; message: string }[] } }

/** Turns a backend envelope into its data, or throws the error it carries. */
function unwrap<T>(envelope: Envelope | null, httpStatus: number): T {
  if (!envelope) throw new ApiError('The sheets API returned something other than JSON. Check the web app deployment and its access setting.', 'BAD_RESPONSE', httpStatus);
  if (!envelope.ok) {
    if (envelope.error?.code === 'USER_REQUIRED' || envelope.error?.code === 'AUTH_REQUIRED') window.dispatchEvent(new Event('projectflow:signed-out'));
    throw new ApiError(envelope.error?.message ?? 'Request failed.', envelope.error?.code, envelope.status, envelope.error?.issues);
  }
  return envelope.data as T;
}

async function getOne<T>(path: string): Promise<T> {
  const user = getUserId() ?? undefined;
  const session = getSession() ?? undefined;
  const res = await fetch(`${sheetsUrl}?${new URLSearchParams({ path, ...(sheetsToken && { token: sheetsToken }), ...(user && { user }), ...(session && { session }) })}`);
  return unwrap<T>((await res.json().catch(() => null)) as Envelope | null, res.status);
}

/**
 * GET requests made in the same moment (a screen asks for several things at once) travel as one BATCH request: each call to the
 * sheets backend costs a round trip and, on Apps Script, a fresh read of the sheets, so one call for five reads is far cheaper than five.
 * A backend that does not know BATCH (an older deployment) answers with a single error envelope; the app then switches batching off
 * and asks for each path on its own.
 */
interface Job { path: string; resolve: (v: unknown) => void; reject: (e: unknown) => void }
const BATCH_WINDOW_MS = 6;
const BATCH_MAX = 20;
let queue: Job[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let batchSupported = true;

function getBatched<T>(path: string): Promise<T> {
  if (!batchSupported) return getOne<T>(path);
  return new Promise<T>((resolve, reject) => {
    queue.push({ path, resolve: resolve as (v: unknown) => void, reject });
    timer ??= setTimeout(flush, BATCH_WINDOW_MS);
  });
}

function flush() {
  timer = undefined;
  const jobs = queue;
  queue = [];
  for (let i = 0; i < jobs.length; i += BATCH_MAX) void send(jobs.slice(i, i + BATCH_MAX));
}

async function send(jobs: Job[]) {
  const alone = () => jobs.forEach(j => getOne(j.path).then(j.resolve, j.reject));
  if (jobs.length === 1) return alone();
  try {
    const res = await fetch(sheetsUrl, {
      method: 'POST',
      headers: { 'content-type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ method: 'BATCH', requests: jobs.map(j => ({ method: 'GET', path: j.path })), token: sheetsToken || undefined, user: getUserId() ?? undefined, session: getSession() ?? undefined }),
    });
    const envelopes = (await res.json().catch(() => null)) as Envelope[] | null;
    if (!Array.isArray(envelopes) || envelopes.length !== jobs.length) { batchSupported = false; return alone(); }
    jobs.forEach((j, i) => { try { j.resolve(unwrap(envelopes[i], res.status)); } catch (e) { j.reject(e); } });
  } catch (e) {
    jobs.forEach(j => j.reject(e));
  }
}

async function requestSheets<T>(path: string, init?: RequestInit): Promise<T> {
  const asOfPath = currentAsOf && SNAPSHOT_PATH.test(path);
  if (asOfPath && (init?.method ?? 'GET').toUpperCase() !== 'GET') {
    throw new ApiError('A cut-off snapshot is read-only. Switch to the current data to make changes.', 'READ_ONLY_SNAPSHOT', 409);
  }
  if (asOfPath) path += `${path.includes('?') ? '&' : '?'}asOf=${currentAsOf}`;
  if (!sheetsUrl) throw new ApiError('VITE_SHEETS_URL is not set. Copy .env.sheets.example to .env.sheets.local and fill it in.', 'NOT_CONFIGURED');
  const method = (init?.method ?? 'GET').toUpperCase();
  if (method === 'GET') return getBatched<T>(path);
  const res = await fetch(sheetsUrl, {
    method: 'POST',
    // text/plain keeps this a "simple" request, so the browser sends no CORS preflight (Apps Script cannot answer one).
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ method, path, body: init?.body ? JSON.parse(String(init.body)) : undefined, token: sheetsToken || undefined, user: getUserId() ?? undefined, session: getSession() ?? undefined }),
  });
  return unwrap<T>((await res.json().catch(() => null)) as Envelope | null, res.status);
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

/**
 * Batch multiple GET requests in parallel.
 * Returns one result per path, in the same order.
 */
export async function requestBatch<T extends unknown[]>(...paths: { [K in keyof T]: string }): Promise<T> {
  return Promise.all(paths.map(p => request(p))) as Promise<T>;
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
/** A saved cut-off report: the project's data as it stood at a reporting date. */
export interface Snapshot { cutoff: string; createdAt: string; createdBy: string; note: string | null; rowCount: number }
export const PARTIES = ['Contractor', 'Client', 'Subcontractor'] as const;
export type Party = (typeof PARTIES)[number];
export interface AuthConfig { mode: AuthMode; passwordMinLength: number; lockAfter: number; lockMinutes: number }
export interface LoginResult { token: string; expiresAt: string; user: Me }
export type AccessLevel = 'none' | 'read' | 'write';
export const ACCESS_LEVELS: AccessLevel[] = ['none', 'read', 'write'];
export interface AccessModule { key: string; label: string; workspace: WorkspaceId; parent: string | null; depth: number; availability: string }
export interface RoleMatrix { roles: Role[]; caps: Record<Role, AccessLevel>; modules: (AccessModule & { levels: Record<Role, AccessLevel | null> })[] }
export interface PersonMatrix { userId: string; name: string; role: Role; cap: AccessLevel; party: Party | null; modules: (AccessModule & { byRole: AccessLevel; override: AccessLevel | null; effective: AccessLevel })[] }
export interface AccessLogEntry { id: string; at: string; actor: string | null; actorName: string | null; action: string; target: string; detail: string; projectId: string | null }
export interface Me {
  id: string; name: string; email: string | null; isAdmin: boolean; status: string; party: Party | null; title: string | null; company: string | null;
  hasPassword: boolean; passwordChangedAt: string | null;
  /** Modules the person's party does not see. */
  hiddenModules: string[];
  /** Per project: the screens this person cannot open (party, role and personal settings together) and those they can only read. */
  moduleAccess?: Record<string, { hidden: string[]; readOnly: string[] }>;
  memberships: { projectId: string; role: Role }[];
}
export interface DirectoryUser { id: string; name: string; party?: Party | null; title?: string | null }
export interface PartyAccessModule { key: string; label: string; workspace: WorkspaceId; parent: string | null; depth: number; availability: string; visible: Record<Party, boolean> }
export interface PartyAccess { parties: Party[]; modules: PartyAccessModule[] }
export type AccountState = 'Invited' | 'Active' | 'Suspended' | 'Deactivated';
export const ACCOUNT_STATES: AccountState[] = ['Invited', 'Active', 'Suspended', 'Deactivated'];
export interface UserRow {
  id: string; name: string; email: string; isAdmin: boolean; status: AccountState; createdAt: string | null;
  title: string | null; company: string | null; party: Party | null; hasPassword: boolean; lastLoginAt?: string | null; lockedUntil?: string | null;
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

export interface Page<T> { items: T[]; total: number; page: number; pageSize: number; facets: { disciplines: string[]; statuses: string[]; parties?: string[]; [filter: string]: string[] | undefined } }

export interface ProcurementPackage {
  id: string; code: string; discipline: string | null; description: string | null; vendorCode: string | null; vendor: string | null;
  origins: string | null; loaNo: string | null; loaDate: string | null; poNo: string | null; poDate: string | null;
  buyer: string | null; expeditor: string | null; pe: string | null; vqc: string | null; status: string;
  workPackage?: string | null; packageType?: string | null; weightPct?: number | null;
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
  scurve: ScurvePoint[]; scurveWeekly?: ScurvePoint[]; latest: ScurvePoint | null; thisWeek: { plan: number; actual: number }; lastWeek?: { plan: number; actual: number }; workPackageCount: number;
  /** Progress by phase (engineering, procurement, construction, ...) at the report date. */
  phases?: PhaseProgress[]; reportDate?: string | null;
}
export interface PhaseProgress { id: string; phase: string; plan: number | null; actual: number | null; reportDate: string | null }

/* ---------- facilities: schedule and progress per facility (sheets backend) ---------- */
export interface FacilityPoint { date: string; plan: number | null; forecast: number | null; actual: number | null }
export interface FacilityStanding { asOf: string | null; plan: number | null; forecast: number | null; actual: number | null; variance: number | null }
export interface FacilityScope extends FacilityStanding { scope: string; label: string; weight: number | null; headline: boolean; points: FacilityPoint[] }
export interface FacilityWbsRow { code: string; name: string; level: number; father: string | null; start: string | null; finish: string | null; weight: number | null; plan: number | null; actual: number | null; variance: number | null; shared: boolean }
export interface FacilityHead {
  id: string; label: string; later: boolean; start: string | null; finish: string | null; scopeCount: number;
  headline: (FacilityStanding & { scope: string; label: string }) | null;
  milestones: { total: number; done: number; overdue: number };
}
export interface FacilityList { cutoff: string; facilities: FacilityHead[] }
export interface ScheduleCheck {
  scope: string; label: string; asOf: string | null; baseline: number | null; working: number | null; plan: number | null;
  curve: { date: string; baseline: number; working: number }[];
}
export interface FacilityProgress { facility: FacilityHead; cutoff: string; scopes: FacilityScope[]; wbs: FacilityWbsRow[]; milestones: Milestone[]; scheduleCheck: ScheduleCheck | null }

/** A key date on the timeline and the network: its baseline, the subcontractor's working-schedule date, forecast and actual. */
export interface TimelineMilestone {
  id: string; description: string; baseline: string | null; working: string | null; forecast: string | null; actual: string | null; status: MilestoneStatus; major: boolean;
}
export interface TimelineFacility {
  id: string; label: string; later: boolean; start: string | null; finish: string | null; workStart: string | null; workFinish: string | null;
  actual: number | null; plan: number | null; variance: number | null; basis: string | null; milestones: TimelineMilestone[]; first: string | null; last: string | null;
}
export interface FacilityTimeline { cutoff: string; start: string | null; finish: string | null; facilities: TimelineFacility[] }

export interface CpnPackage {
  code: string; name: string; weight: number | null; baseWeight: number | null; plan: number | null; actual: number | null; variance: number | null;
  basePlan: number | null; baseActual: number | null; baseVariance: number | null; lastPlan: number | null; lastActual: number | null;
}
export interface CpnActivity {
  id: string; name: string; top: string; discipline: string | null; baseStart: string | null; baseFinish: string | null; workStart: string | null; workFinish: string | null;
  reStart: string | null; reFinish: string | null; finish: string; float: number;
}
export interface CpnData {
  cutoff: string; asOf: string | null; overall: CpnPackage | null; packages: CpnPackage[];
  curve: { date: string; plan: number | null; forecast: null; actual: number | null }[];
  critical: { total: number; threshold: number; count: number; items: CpnActivity[] };
  milestones: (TimelineMilestone & { facility: string })[];
}
export interface FacilitySchedule { facility: FacilityHead; cutoff: string; wbs: FacilityWbsRow[]; milestones: Milestone[] }

export type MilestoneStatus = 'Done' | 'Overdue' | 'Due soon' | 'Planned';
export interface Milestone {
  id: string; description: string; planBaseline: string | null; planSub: string | null; subName: string | null;
  forecast: string | null; actual: string | null; variance: number | null; comment: string | null; facility: string | null;
  kind?: string | null; package?: string | null; eta?: string | null; tagNo?: string | null; location?: string | null; deck?: string | null;
  status: MilestoneStatus; slipDays: number | null; daysToGo: number | null;
}
export interface MilestoneSummary {
  total: number; done: number; overdue: number; dueSoon: number; planned: number; bySub: Record<string, number>; next: Milestone[]; cutoff: string;
  /** The major milestones of the scope, in date order (drawn on the S-curve). */
  major?: Milestone[];
}

/* ---------- risk management (project matrix, MGT-01/06) ---------- */
export type RiskLevel = string;
export const RISK_STATUSES = ['New', 'Firmed', 'Under assessment', 'Under resolving', 'Monitor', 'Closed'] as const;
export type RiskStatus = (typeof RISK_STATUSES)[number];
export interface RiskMatrix { version: string; probabilityLabels: string[]; severityLabels: string[]; levels: string[]; cells: string[][] }
export interface RiskAction { id: string; riskId: string; action: string; owner: string | null; dueDate: string | null; doneDate: string | null; done: boolean; overdue: boolean }
export interface Risk {
  id: string; no: number | null; status: RiskStatus; rbs: string | null; category: string | null; discipline: string | null; title: string;
  description: string | null; cause: string | null; effect: string | null; owner: string | null; owners: string[]; recordDate: string | null;
  preProbability: number | null; preSchedule: number | null; preCost: number | null; preScope: number | null; preQuality: number | null;
  postProbability: number | null; postSchedule: number | null; postCost: number | null; postScope: number | null; postQuality: number | null;
  strategy: string | null; mitigationCause: string | null; mitigationEffect: string | null; planDate: string | null; actualActions: string | null; actualDate: string | null;
  remark: string | null; external: boolean; reviewDate: string | null; milestoneId: string | null; milestone: string | null; active: boolean;
  preSeverity: number | null; preScore: number | null; preLevel: string | null; preWorst: string[];
  postSeverity: number | null; postScore: number | null; postLevel: string | null; postWorst: string[];
  currentScore: number | null; currentLevel: string | null; responseOverdue: boolean; reviewOverdue: boolean;
  actionsTotal: number; actionsDone: number; actionsOverdue: number; actions?: RiskAction[]; updatedAt?: string; createdBy?: string | null;
}
export interface RiskOptions {
  matrix: RiskMatrix; statuses: string[]; strategies: string[]; dimensions: { key: string; label: string }[];
  breakdown: { code: string; category: string; categoryName: string; discipline: string; disciplineName: string }[]; owners: string[];
}
export interface RiskHeatmap { matrix: RiskMatrix; pre: number[][]; current: number[][]; unrated: number }
export interface RiskSummary { total: number; active: number; levels: string[]; byLevel: Record<string, number>; top: string; responseOverdue: number; reviewOverdue: number }

/* ---------- interface management (INT-01 to INT-04) ---------- */
export type InterfaceStatus = 'Identified' | 'Assigned' | 'Information requested' | 'Responded' | 'Under review' | 'Agreed' | 'Closed';
export const INTERFACE_TYPES = ['Technical', 'Contractual', 'Physical', 'Organizational', 'Information', 'Schedule'];
export const POINT_STATUSES = ['Open', 'Responded', 'Resolved', 'Closed'] as const;
export type PointStatus = (typeof POINT_STATUSES)[number];
export interface InterfaceRecord {
  id: string; title: string; type: string; originator: string; receiver: string; coordinator: string | null; discipline: string | null;
  boundary: string | null; requiredInput: string | null; requiredOutput: string | null; needDate: string | null;
  response: string | null; acceptance: string | null; evidence: string | null; status: InterfaceStatus; milestoneId: string | null;
  overdue: boolean; pointsTotal: number; pointsOpen: number; allowedNext: InterfaceStatus[]; milestone: string | null; points?: InterfacePoint[];
}
export interface InterfacePoint {
  id: string; interfaceId: string | null; interfaceTitle: string | null; title: string; description: string; owner: string | null; workPackage: string | null; discipline: string | null;
  originator: string; target: string; action: string | null; queryDate: string | null; targetDate: string | null; reference: string | null; status: PointStatus;
  resolution: string | null; resolvedDate: string | null; resolvedDocument: string | null; remarks: string | null;
  settled: boolean; overdue: boolean; daysLate: number | null; ageDays: number | null; allowedNext: PointStatus[]; updatedAt?: string;
  /** Revision number, from 0. Earlier revisions are kept, newest first, as superseded. */
  rev: number; revisions?: PointRevision[];
}
export interface PointRevision {
  rev: number; status: 'Superseded'; description: string | null; action: string | null; queryDate: string | null; targetDate: string | null;
  response: string | null; respondedDate: string | null; supersededAt: string; supersededBy: string | null; reason: string | null;
}
export interface InterfaceParty { code: string; name: string }
export interface InterfaceSummary { total: number; open: number; overdue: number; byStatus: Record<string, number>; points: number; pointsOpen: number; pointsOverdue: number }
export interface InterfaceMatrix {
  parties: string[]; names: Record<string, string>; total: number; interfaces: number;
  cells: { originator: string; receiver: string; total: number; open: number; overdue: number; settled: number; interfaces: number }[];
}
export interface ResponsibilityMatrix {
  facilities: { workPackage: string | null; facility: string }[];
  rows: { order: number; section: string; ref: string | null; activity: string; level: number; remark: string | null; cells: Record<string, string> }[];
  parties: { code: string; name: string; cells: number }[];
}
export interface RasciMatrices {
  roles: { code: string; label: string }[];
  matrices: { name: string; parties: { phase: string | null; party: string }[]; rows: { order: number; section: string; ref: string | null; activity: string; remark: string | null; roles: Record<string, string> }[] }[];
}

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

/* ---------- procurement registers and dashboard (sheets backend) ---------- */
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical';
export const SEVERITIES: Severity[] = ['Low', 'Medium', 'High', 'Critical'];
export const CONCERN_TYPES = ['Risk', 'Concern', 'Issue'];
export const CONCERN_AREAS = ['Schedule', 'Cost', 'Quality', 'Delivery', 'Documentation', 'Contractual', 'Other'];
export const CONCERN_STATUSES = ['Open', 'Mitigating', 'Resolved', 'Closed'];
export interface Concern {
  id: string; packageCode: string | null; type: string; title: string; description: string | null; severity: Severity; area: string; owner: string | null;
  raisedDate: string | null; dueDate: string | null; status: string; action: string | null; source: string; sourceRef: string | null; overdue: boolean; ageDays: number | null;
  createdAt?: string; updatedAt?: string;
}
export interface ConcernSummary {
  total: number; open: number; closed: number; overdue: number; bySeverity: Record<Severity, number>; byType: Record<string, number>; byArea: Record<string, number>;
  top: Concern[]; byPackage: { code: string; open: number; score: number; worst: Severity }[];
}
export interface Shipment {
  id: string; source: 'PTSC' | 'Client'; packageNo: string; packageDescription: string | null; poNo: string | null; shipmentNo: string | null; shipmentDescription: string | null;
  etdPol: string | null; etaPod: string | null; forecastOnSite: string | null; actualOnSite: string | null; status: string; grossWeightKg: number | null; qty: string | null; packingList: string | null;
  vessel: string | null; blNo: string | null; portLoading: string | null; portDischarge: string | null; transport: string | null; deliveryYard: string | null; issue: string | null;
  overdue: boolean; daysLate: number | null;
}
export interface StockLine {
  id: string; facility: string | null; supply: string | null; discipline: string | null; serialNo: string | null; category: string | null; materialCode: string | null; description: string;
  grade: string | null; poNo: string | null; shipmentNo: string | null; supplier: string | null; mrirNo: string | null; heatNo: string | null; unit: string | null; balance: number | null;
  yard: string | null; location: string | null; status: string | null; remark: string | null;
}
export interface MaterialWeight { id: string; supply: 'PTSC MC' | 'Client'; facility: string; mtoKg: number | null; arrivedKg: number | null; vspYardKg: number | null; mcYardKg: number | null; arrivedPct: number | null }
export interface AttentionItem { code: string; name: string | null; vendor: string | null; discipline: string | null; score: number; level: 'Critical' | 'High' | 'Medium'; reasons: string[] }
export interface ExpeditingBrief { id: string; code: string; name: string | null; vendor: string | null; discipline: string | null; status: string; planPct: number | null; actualPct: number | null; variance: number | null; rosDate: string | null }
export interface ProcurementDashboard {
  cutoff: string;
  pipeline: null | {
    total: number; byStatus: Record<string, number>; placedPct: number | null; byType: Record<string, number>;
    byDiscipline: ({ discipline: string; total: number } & Record<string, number | string>)[];
    slowAward: { code: string; description: string | null; vendor: string | null; loaDate: string; days: number }[]; slowAwardCount: number;
  };
  expediting: null | {
    total: number; byStatus: Record<string, number>; health: { delay: number; highRisk: number; atRisk: number; ok: number }; avgPlanPct: number | null; avgActualPct: number | null;
    behind: ExpeditingBrief[]; rosSoon: (ExpeditingBrief & { daysToRos: number })[]; rosSoonCount: number; rosPassed: (ExpeditingBrief & { daysPast: number })[]; rosPassedCount: number;
    byDiscipline: { discipline: string; total: number; delay: number; highRisk: number; atRisk: number; avgVariance: number | null }[];
  };
  logistics: null | {
    total: number; byStatus: Record<string, number>; bySource: Record<string, number>; weightKg: number; receivedKg: number; inTransit: number;
    overdueCount: number; overdue: Shipment[]; soonCount: number; soon: Shipment[]; heldCount: number; held: Shipment[];
  };
  materials: null | { rows: MaterialWeight[]; totals: { supply: string; mtoKg: number; arrivedKg: number; arrivedPct: number | null }[]; stockLines: number };
  concerns: null | ConcernSummary;
  workPackages: null | {
    overall: { plan?: number | null; actual?: number | null; thisWeekPlan?: number | null; thisWeekActual?: number | null };
    items: { code: string; name: string; plan?: number | null; actual?: number | null; thisWeekPlan?: number | null; thisWeekActual?: number | null }[];
  };
  attention: AttentionItem[]; attentionCount: number;
}

/** Weekly cumulative procurement progress for one facility and scope (OVR = lump sum and reimbursable together). */
export interface ProcurementCurve {
  cutoff: string; facilities: string[]; facility: string | null; scopes: ('OVR' | 'LS' | 'PS')[]; scope: 'OVR' | 'LS' | 'PS' | null;
  dates: string[]; plan: (number | null)[]; forecast: (number | null)[]; actual: (number | null)[];
  latest: null | { date: string; plan: number | null; forecast: number | null; actual: number | null };
}

/* ---------- construction budget (sheets backend) ---------- */
export interface WbsNode {
  wbs: string; name: string; parentWbs: string | null; discipline: string | null; planStart: string | null; planFinish: string | null; notes: string | null;
  level: number; children: number; leaf: boolean;
  /** Hours typed on the row; ignored when the row has children. */
  ownHours: number;
  /** Leaf: its own hours. Parent: the sum below it. */
  hours: number;
  /** Manhours spent and value earned: typed on an activity, summed up the tree; null where nothing was reported. */
  actualHours: number | null; earnedHours: number | null; ownActual: number | null; ownEarned: number | null;
  start: string | null; finish: string | null; top: string;
}
export interface BudgetSummary {
  totalHours: number; activities: number; nodes: number; scheduledHours: number; unscheduledHours: number;
  /** Spent and earned over the activities that report them; cpi = earned / spent. */
  actualHours: number | null; earnedHours: number | null; cpi: number | null; progressPct: number | null; reportedActivities: number; budgetOfReported: number;
  byDiscipline: Record<string, number>; start: string | null; finish: string | null; topLevel: { wbs: string; name: string; hours: number }[];
}
export interface BudgetResponse { items: WbsNode[]; summary: BudgetSummary }

/** Construction → Facility Layout: one large equipment of the 3D model, as kept in the Facility equipment sheet. */
export interface FacilityEquipment {
  tag: string; model: 'topside' | 'jacket' | 'lqm' | 'linkbridge'; name: string | null; deck: string; packageCode: string | null; vendor: string | null;
  rosDate: string | null; etaDate: string | null; status: string | null; packageStatus: string | null;
  method: string | null; remarks: string | null; comments: string | null; source: string | null;
}
export interface FacilityEquipmentResponse { items: FacilityEquipment[]; decks: string[] }
export interface BudgetInput {
  wbs?: string; name?: string; parentWbs?: string | null; discipline?: string | null; manhours?: number | null; actualHours?: number | null; earnedHours?: number | null; planStart?: string | null; planFinish?: string | null; notes?: string | null;
}
export interface BudgetHistogram {
  by: 'week' | 'month'; group: 'wbs' | 'discipline'; from: string | null; to: string | null;
  groups: { key: string; label: string }[];
  periods: { start: string; end: string; total: number; byGroup: Record<string, number> }[];
  cumulative: number[]; peak: { start: string; hours: number } | null;
  totalHours: number; scheduledHours: number; unscheduledHours: number; outsideHours: number; truncated: boolean;
}

/* ---------- general knowledge (sheets backend) ---------- */
export type KnowledgeDomain = 'engineering' | 'procurement' | 'services' | 'quality' | 'hse' | 'construction' | 'precom' | 'ti' | 'huc';
export interface KnowledgeSource { title: string; ref: string | null; url: string | null }
export interface KnowledgeArticle {
  id: string; domain: KnowledgeDomain; domainLabel: string; category: string; title: string; summary: string; body?: string;
  tags: string[]; sources: KnowledgeSource[]; status: 'Draft' | 'Published';
  createdAt: string; updatedAt: string; createdBy: string; updatedBy: string;
}
export interface KnowledgeTaxonomy { domain: KnowledgeDomain; label: string; moduleKey: string; categories: string[]; enabled: boolean }
export interface KnowledgeSummary {
  total: number; drafts: number; byDomain: Record<string, { total: number; byCategory: Record<string, number> }>; recent: KnowledgeArticle[]; taxonomy: KnowledgeTaxonomy[];
}
export interface KnowledgePage { items: KnowledgeArticle[]; total: number; page: number; pageSize: number; facets: { categories: Record<string, number>; tags: string[] } }
export interface KnowledgeInput {
  domain?: KnowledgeDomain; category?: string; title?: string; summary?: string; body?: string; tags?: string[]; sources?: KnowledgeSource[]; status?: 'Draft' | 'Published';
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

/* ---------- summaries at the top of each page ---------- */
export interface InsightCard { label: string; value: string | number; foot: string; icon: string; tone?: 'red' | 'amber' | 'green' }
export interface InsightBox { label: string; value: number; sub: string; tone?: 'red' | 'amber' | 'green'; filter?: Record<string, string> }
export interface InsightChart {
  title: string; sub: string; layout: 'column' | 'bar'; stacked?: boolean; unit: string; categoryKind?: 'month';
  categories: string[]; series: { name: string; color: string; data: number[] }[]; filterKey?: string; filterValues?: string[];
}
export interface Insights {
  cards: InsightCard[];
  strip?: { title: string; sub: string; boxes: InsightBox[] };
  lookAhead?: { title: string; sub: string; boxes: InsightBox[] };
  charts: InsightChart[];
}

/* ---------- issue management (sheets backend) ---------- */
export type IssueStatus = 'Not started' | 'In progress' | 'Pending' | 'Completed';
export type IssuePriority = 'Critical' | 'High' | 'Medium' | 'Low';
export interface Issue {
  id: string; title: string; description: string | null; priority: IssuePriority; discipline: string | null; status: IssueStatus;
  startDate: string | null; dueDate: string | null; completedDate: string | null; nextAction: string | null; remarks: string | null;
  pics: string[]; /** The same people with their account names. */ people?: { email: string; name: string; userId: string | null }[]; source: string | null; createdAt: string; updatedAt: string; overdue: boolean; daysToDue: number | null; subtasksTotal: number; subtasksDone: number;
  /** The procurement or expediting package, and the service subcontract, the issue belongs to. */
  packageCode?: string | null; subcontract?: string | null;
}
/** What an issue can be linked to (GET /issues/options). */
export interface IssueOptions { packages: { code: string; label: string; vendor: string | null; source: string }[]; subcontracts: { code: string; label: string }[] }
export interface IssueSubtask { id: string; issueId: string; title: string; pic: string | null; picName?: string | null; dueDate: string | null; done: boolean; position: number }
export interface IssueLogEntry { id: string; issueId: string; at: string; actor: string; action: string; field: string | null; fromValue: string | null; toValue: string | null; note: string | null }
export interface IssueDetail extends Issue { subtasks: IssueSubtask[]; log: IssueLogEntry[] }
