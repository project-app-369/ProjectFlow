/**
 * Module catalog (spec §3.1 navigation, §11.2 manifests, §13.1 phases).
 * Manifests are code; per-project operation state lives in the database.
 */
export type WorkspaceId = 'personal' | 'epcic' | 'governance' | 'reports';
export type Phase = 'P1' | 'P2' | 'P3';
export type Availability = 'Available' | 'In development' | 'Planned';
export const OPERATION_STATES = ['Not assigned', 'Setup', 'Pilot', 'Enabled', 'Locked', 'Read-only', 'Disabled'] as const;
export type OperationState = (typeof OPERATION_STATES)[number];

export interface ModuleManifest {
  key: string;
  label: string;
  workspace: WorkspaceId;
  group?: string;
  icon?: string;
  parent?: string;
  order: number;
  depth: number;
  phase: Phase;
  availability: Availability;
  description: string;
  core: boolean;
  requires: string[];
}

export const WORKSPACES: { id: WorkspaceId; label: string }[] = [
  { id: 'personal', label: 'Personal' },
  { id: 'epcic', label: 'EPCIC' },
  { id: 'governance', label: 'Governance' },
  { id: 'reports', label: 'Reports' },
];

/** Keys that have a real implementation today. Everything else is a catalog placeholder. */
const IMPLEMENTED = new Set([
  'dashboard',
  'task-management.board',
  'task-management.calendar',
  'task-management.workload',
  'planning.overall-progress',
  'planning.schedule',
  'planning.progress',
  'planning.cpn',
  'planning.work-packages',
  'planning.milestones',
  'management.risks',
  'management.issues',
  'interface.register',
  'interface.matrix',
  'interface.points',
  'construction.budget',
  'knowledge.overview',
  'knowledge.engineering',
  'knowledge.procurement',
  'knowledge.services',
  'knowledge.quality',
  'knowledge.hse',
  'knowledge.construction',
  'knowledge.precom',
  'knowledge.ti',
  'knowledge.huc',
  'procurement.procurement-plan',
  'procurement.expediting.vendor-overview',
  'procurement.dashboard',
  'procurement.concerns',
  'procurement.logistics',
  'procurement.materials',
]);

interface Def {
  label: string;
  key?: string;
  icon?: string;
  group?: string;
  description?: string;
  phase?: Phase;
  core?: boolean;
  requires?: string[];
  subs?: (Def | string)[];
}
interface WorkspaceDef { id: WorkspaceId; modules: Def[] }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const TREE: WorkspaceDef[] = [
  { id: 'personal', modules: [
    { key: 'my-workspace', label: 'My Workspace', icon: 'brief', description: 'Personal home across projects', subs: ['My Day', 'Inbox', 'Assigned to Me', 'Assigned by Me', 'Approvals'] },
    { key: 'task-management', label: 'Task Management', icon: 'check', description: 'Tasks, assignments and PIC coordination', subs: ['Project Tasks', { label: 'Tasks', key: 'task-management.board', description: 'Personal tasks: list, cards, kanban and gantt' }, { label: 'Calendar', description: 'Tasks by day, week and month' }, { label: 'Workload', description: 'Tasks and hours per week or month, by project' }] },
  ] },
  { id: 'epcic', modules: [
    { key: 'dashboard', label: 'Dashboard', icon: 'grid', description: 'Project overview widgets', core: true },
    { key: 'engineering', label: 'Engineering', icon: 'layers', description: 'Work packages, deliverables and review queue', requires: ['document-control'], subs: ['Work Packages', 'Deliverables', 'Review Queue'] },
    { key: 'procurement', label: 'Procurement', icon: 'box', description: 'Supply chain from plan to materials', subs: [
      { label: 'Dashboard', key: 'procurement.dashboard', description: 'Where procurement stands, and which packages need attention' },
      'Procurement Plan',
      { label: 'Expediting', subs: ['Vendor Overview', 'Production Schedule Monitoring'] },
      { label: 'Logistics', description: 'Shipments from vendor to yard' },
      { label: 'Materials', description: 'Stock on hand and material weights' },
      { label: 'Risks & Concerns', key: 'procurement.concerns', description: 'Risks, concerns and issues raised against packages' },
    ] },
    { key: 'planning', label: 'Planning & Progress', icon: 'calendar', description: 'Overall progress, schedule and progress per facility, work packages and milestones', subs: ['Overall Progress', { label: 'Schedule', key: 'planning.schedule', description: 'Timeline of the facilities with their milestones: CGF Topside, CGF Jacket, Pile & Conductor, Bridge, LQM#2' }, { label: 'Progress', key: 'planning.progress', description: 'S-curve, phases, WBS progress and milestones per facility' }, { label: 'Critical Path Network', key: 'planning.cpn', description: 'CPN progress by work package, critical activities and the key-milestone chain' }, 'Work Packages', 'Milestones'] },
    { key: 'construction', label: 'Construction', icon: 'building', group: 'Yard Execution', phase: 'P2', description: 'Yard and facility construction', subs: ['Yard Layout', { label: 'Facility Layout', phase: 'P3' }, 'Workfront', { label: 'Construction Sequence', phase: 'P3' }, 'Progress & KPI', 'Productivity', { label: 'Budget', description: 'Manhour budget by WBS activity, with histogram' }] },
    { key: 'fabrication', label: 'Fabrication Subcontracting', icon: 'people', group: 'Yard Execution', phase: 'P2', description: 'Subcontractor fabrication tracking', subs: ['Progress', 'Concerns & Highlights'] },
    { key: 'qaqc', label: 'QAQC', icon: 'shield', group: 'Yard Execution', phase: 'P2', description: 'Quality assurance and control' },
    { key: 'hse', label: 'HSE', icon: 'risk', group: 'Yard Execution', phase: 'P2', description: 'Health, safety and environment' },
    { key: 'ti', label: 'T&I', icon: 'anchor', group: 'Installation', phase: 'P3', description: 'Transportation and installation', subs: ['Workpacks', 'Timeline & Schedule', 'Sequence', 'Progress'] },
    { key: 'precom', label: 'Onshore Precom-Commissioning', icon: 'check', group: 'Commissioning', phase: 'P2', description: 'Onshore precommissioning and commissioning', subs: ['Systems & Subsystems', { label: 'Sequence', phase: 'P3' }, { label: 'Handover Schedule', phase: 'P3' }, 'Check Sheets', 'Punches'] },
    { key: 'huc', label: 'Offshore HUC', icon: 'flag', group: 'Commissioning', phase: 'P3', description: 'Offshore hook-up and commissioning', subs: ['Marine Spread', 'Timeline & Schedule', 'Progress'] },
  ] },
  { id: 'governance', modules: [
    { key: 'management', label: 'Management', icon: 'risk', description: 'Management registers (MGT-01 to MGT-05)', subs: ['Risks', { label: 'Issues', key: 'management.issues', description: 'Issue monitoring with several people in charge, sub-tasks, a history log and due-date reminders' }, 'Lessons Learned', 'Management of Change (MOC)', 'Stakeholders'] },
    { key: 'interface', label: 'Interface Management', icon: 'link', description: 'Interface register, matrix and points', subs: ['Register', 'Matrix', 'Points'] },
    { key: 'document-control', label: 'Document Control', icon: 'doc', description: 'Controlled documents, reviews and transmittals', subs: ['MDR', 'Package/Engineering Registers', 'Vendor Registers', 'Transmittals', 'Reviews', 'CRS', 'Correspondence', { label: 'Dossiers', phase: 'P3' }] },
    { key: 'events', label: 'Event Management', icon: 'calendar', description: 'Calendar of meetings and events' },
  ] },
  { id: 'reports', modules: [
    { key: 'knowledge', label: 'General Knowledge', icon: 'book', description: 'What the project documents say, organized by discipline and topic', subs: [
      { label: 'Overview', key: 'knowledge.overview', description: 'Search and browse all topics' },
      { label: 'Detailed Engineering', key: 'knowledge.engineering', description: 'Process, safety, structure, piping, mechanical, electrical, instrument, telecom, materials, pipeline' },
      { label: 'Procurement', key: 'knowledge.procurement', description: 'Workflow and policy' },
      { label: 'Services', key: 'knowledge.services', description: 'Facilities, external yards and services' },
      { label: 'Quality', key: 'knowledge.quality', description: 'Standards and special requirements' },
      { label: 'HSE', key: 'knowledge.hse', description: 'Campaigns and events' },
      { label: 'Construction', key: 'knowledge.construction', description: 'Sequence, plan, layout and methods' },
      { label: 'Pre-com / Commissioning', key: 'knowledge.precom', description: 'Sequence and how the systems work' },
      { label: 'T&I', key: 'knowledge.ti', description: 'Transportation and installation sequence and simulation' },
      { label: 'HUC', key: 'knowledge.huc', description: 'Hook-up and commissioning campaign and simulation' },
    ] },
    { key: 'minutes', label: 'Minutes of Meetings', icon: 'doc', description: 'Agenda, decisions and shared actions' },
    { key: 'documents', label: 'Documents', icon: 'layers', description: 'Authorized view of Document Control' },
    { key: 'analytics', label: 'Analytics', icon: 'chart', phase: 'P2', description: 'Cross-module analytics' },
    { key: 'periodic', label: 'Periodic Reports', icon: 'calendar', description: 'Predefined weekly and monthly reports', subs: ['Weekly Progress', 'Monthly Progress', 'Milestones', 'Engineering', 'Procurement', 'Risk & Issue', 'Interface', 'Actions'] },
  ] },
];

const DESCRIPTIONS: Record<string, string> = {
  'procurement.procurement-plan': 'LOA / PO award register',
  'procurement.expediting.vendor-overview': 'Fabrication & delivery status',
  'planning.overall-progress': 'Procurement S-curve, plan vs. actual',
  'planning.work-packages': 'Work package register',
};

function build(): ModuleManifest[] {
  const out: ModuleManifest[] = [];
  const walk = (def: Def | string, ws: WorkspaceId, parent: ModuleManifest | undefined, inheritedPhase: Phase, key?: string) => {
    const d: Def = typeof def === 'string' ? { label: def } : def;
    const k = d.key ?? key ?? `${parent?.key}.${slug(d.label)}`;
    const m: ModuleManifest = {
      key: k,
      label: d.label,
      workspace: ws,
      group: d.group ?? parent?.group,
      icon: d.icon,
      parent: parent?.key,
      order: out.length,
      depth: parent ? parent.depth + 1 : 0,
      phase: d.phase ?? inheritedPhase,
      availability: 'Planned',
      description: DESCRIPTIONS[k] ?? d.description ?? '',
      core: !!d.core,
      requires: d.requires ?? [],
    };
    out.push(m);
    (d.subs ?? []).forEach(s => walk(s, ws, m, m.phase, typeof s === 'string' ? undefined : s.key));
  };
  TREE.forEach(w => w.modules.forEach(m => walk(m, w.id, undefined, 'P1')));

  const byKey = new Map(out.map(m => [m.key, m]));
  for (const m of out) {
    const implemented = IMPLEMENTED.has(m.key);
    m.availability = implemented ? 'Available' : m.phase === 'P1' ? 'In development' : 'Planned';
  }
  for (const m of out) {
    if (m.availability !== 'Available') continue;
    for (let p = m.parent ? byKey.get(m.parent) : undefined; p; p = p.parent ? byKey.get(p.parent) : undefined) p.availability = 'Available';
  }
  return out;
}

export const MANIFESTS: ModuleManifest[] = build();
export const MANIFEST_BY_KEY = new Map(MANIFESTS.map(m => [m.key, m]));

/** Default project state: P1 modules start enabled; later-phase modules are available to tick but off. */
export const defaultState = (m: ModuleManifest): OperationState => (m.core || m.availability !== 'Planned' ? 'Enabled' : 'Disabled');

/** States in which a module is visible and reachable. Locked/Read-only stay visible but reject writes. */
export const isOperational = (s: OperationState) => s === 'Enabled' || s === 'Pilot' || s === 'Locked' || s === 'Read-only';
export const allowsWrites = (s: OperationState) => s === 'Enabled' || s === 'Pilot';

export type StateMap = Record<string, OperationState>;

/** A module is effectively on only if it and every ancestor is operational (spec MOD-04, MOD-09). */
export function isEffective(key: string, states: StateMap, manifests = MANIFEST_BY_KEY): boolean {
  for (let m = manifests.get(key); m; m = m.parent ? manifests.get(m.parent) : undefined) {
    if (!isOperational(states[m.key] ?? 'Disabled')) return false;
  }
  return manifests.has(key);
}

export type ChangeError = { code: 'UNKNOWN_MODULE' | 'CORE_MODULE' | 'INVALID_STATE' | 'REQUIRED_BY' | 'REQUIRES'; message: string };

/** Validates a state change against core, dependency and required-by rules (MOD-03, MOD-05, MOD-10). */
export function validateStateChange(key: string, to: string, states: StateMap, manifests = MANIFESTS): ChangeError | null {
  const byKey = new Map(manifests.map(m => [m.key, m]));
  const m = byKey.get(key);
  if (!m) return { code: 'UNKNOWN_MODULE', message: `Unknown module "${key}".` };
  if (!(OPERATION_STATES as readonly string[]).includes(to)) return { code: 'INVALID_STATE', message: `"${to}" is not a valid module state.` };
  const next = to as OperationState;
  if (m.core && !isOperational(next)) return { code: 'CORE_MODULE', message: `${m.label} is a core module and cannot be disabled.` };
  const after: StateMap = { ...states, [key]: next };
  if (isOperational(next)) {
    for (const req of m.requires) {
      if (!isEffective(req, after, byKey)) return { code: 'REQUIRES', message: `${m.label} requires ${byKey.get(req)?.label ?? req}, which is not enabled.` };
    }
  } else {
    const dependents = manifests.filter(o => o.requires.includes(key) && isEffective(o.key, states, byKey));
    if (dependents.length) return { code: 'REQUIRED_BY', message: `${m.label} is required by ${dependents.map(d => d.label).join(', ')}. Disable those first.` };
  }
  return null;
}
