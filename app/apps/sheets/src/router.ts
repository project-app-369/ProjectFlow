import type { Api } from './api';
import { readSession, requireConfigure, requireMember, requireWrite, resolveActor, type Actor } from './auth';
import type { Resource } from './crud';
import { HttpError } from './http';

export interface ApiRequest {
  method: string; path: string; body?: unknown;
  /** Id of the acting user (demo identity, see auth.ts). Ignored when the deployment requires sign-in. */
  user?: string;
  /** Session token from POST /auth/login; the acting user is taken from it when the deployment requires sign-in. */
  session?: string;
}
/** Apps Script web apps always answer HTTP 200, so the real status travels inside the envelope. */
export type Envelope = { ok: true; status: number; data: unknown } | { ok: false; status: number; error: { code: string; message: string; issues?: unknown } };

interface Ctx { api: Api; actor: Actor; p: Record<string, string>; q: Record<string, string>; body: unknown }
type Handler = (c: Ctx) => unknown;
/**
 * public: no user needed. user: any known user, the handler decides. projectAny: administrator or member of :pid.
 * member (default when the path has :pid): member of :pid, the business-data rule.
 */
type Access = 'public' | 'user' | 'projectAny' | 'member';
interface Route { method: string; pattern: RegExp; hasProject: boolean; access: Access; module?: string | ((p: Record<string, string>) => string); status?: number; handler: Handler }

const PID = 'projects/(?<pid>[^/]+)';
const route = (method: string, pattern: string, handler: Handler, opts: { access?: Access; module?: Route['module']; status?: number } = {}): Route => {
  const hasProject = pattern.includes('(?<pid>');
  return { method, pattern: new RegExp(`^/${pattern}$`), hasProject, access: opts.access ?? (hasProject ? 'member' : 'user'), handler, module: opts.module, status: opts.status };
};

/** The six routes of a register: list, CSV, one record, create, update, delete. */
const crud = (path: string, res: (c: Ctx) => Resource, module: string): Route[] => [
  route('GET', `${PID}/${path}[.]csv`, c => res(c).csv(c.p.pid, c.q), { module }),
  route('GET', `${PID}/${path}`, c => res(c).list(c.p.pid, c.q), { module }),
  route('GET', `${PID}/${path}/(?<id>[^/]+)`, c => res(c).get(c.p.pid, c.p.id), { module }),
  route('POST', `${PID}/${path}`, c => res(c).create(c.p.pid, c.body, c.actor), { module, status: 201 }),
  route('PATCH', `${PID}/${path}/(?<id>[^/]+)`, c => res(c).update(c.p.pid, c.p.id, c.body, c.actor), { module }),
  route('DELETE', `${PID}/${path}/(?<id>[^/]+)`, c => { res(c).remove(c.p.pid, c.p.id, c.actor); return null; }, { module, status: 204 }),
];

const OVERALL = 'planning.overall-progress';
const WORK_PACKAGES = 'planning.work-packages';
const MILESTONES = 'planning.milestones';
const FAC_PROGRESS = 'planning.progress';
const FAC_SCHEDULE = 'planning.schedule';
const CPN = 'planning.cpn';
const PROCUREMENT = 'procurement.procurement-plan';
const EXPEDITING = 'procurement.expediting.vendor-overview';
const RISKS = 'management.risks';
const ISSUES = 'management.issues';
const IF_REGISTER = 'interface.register';
const IF_MATRIX = 'interface.matrix';
const IF_POINTS = 'interface.points';
const BUDGET = 'construction.budget';
const KNOWLEDGE = 'knowledge';
const PROC_DASH = 'procurement.dashboard';
const LOGISTICS = 'procurement.logistics';
const MATERIALS = 'procurement.materials';
const CONCERNS = 'procurement.concerns';

/** Same URLs, methods and module guards as the NestJS controllers, plus the pre-build's project, user and register routes. */
const ROUTES: Route[] = [
  route('GET', 'health', c => c.api.svc.health(), { access: 'public' }),
  route('GET', 'directory', c => c.api.admin.directory(), { access: 'public' }),
  route('GET', 'auth/config', c => c.api.admin.authConfig(), { access: 'public' }),
  route('POST', 'auth/login', c => c.api.admin.login(c.body), { access: 'public' }),
  route('GET', 'me', c => c.api.admin.me(c.actor)),
  route('PATCH', 'me', c => c.api.admin.updateProfile(c.body, c.actor)),
  route('POST', 'me/password', c => c.api.admin.changePassword(c.body, c.actor)),
  route('GET', 'party-access', c => c.api.admin.partyAccess(c.actor)),
  route('PUT', 'party-access', c => c.api.admin.setPartyAccess(c.body, c.actor)),

  // projects and people
  route('GET', 'projects', c => c.api.admin.listProjects(c.actor, c.q)),
  route('POST', 'projects', c => c.api.admin.createProject(c.body, c.actor), { status: 201 }),
  route('GET', PID, c => c.api.admin.getProject(c.p.pid, c.actor), { access: 'user' }),
  route('PATCH', PID, c => c.api.admin.updateProject(c.p.pid, c.body, c.actor), { access: 'user' }),
  route('DELETE', PID, c => { c.api.admin.deleteProject(c.p.pid, c.actor); return null; }, { access: 'user', status: 204 }),
  route('POST', `${PID}/lifecycle`, c => c.api.admin.changeLifecycle(c.p.pid, c.body, c.actor), { access: 'user' }),
  route('GET', `${PID}/members`, c => c.api.admin.listMembers(c.p.pid, c.actor), { access: 'user' }),
  route('PUT', `${PID}/members/(?<uid>[^/]+)`, c => c.api.admin.setMember(c.p.pid, c.p.uid, c.body, c.actor), { access: 'user' }),
  route('DELETE', `${PID}/members/(?<uid>[^/]+)`, c => { c.api.admin.removeMember(c.p.pid, c.p.uid, c.actor); return null; }, { access: 'user', status: 204 }),
  route('GET', 'users', c => c.api.admin.listUsers(c.actor)),
  route('POST', 'users', c => c.api.admin.createUser(c.body, c.actor), { status: 201 }),
  route('PATCH', 'users/(?<id>[^/]+)', c => c.api.admin.updateUser(c.p.id, c.body, c.actor)),
  route('POST', 'users/(?<id>[^/]+)/password', c => c.api.admin.resetPassword(c.p.id, c.body, c.actor)),
  route('GET', 'access-log', c => c.api.access.entries(c.actor, c.q)),
  route('GET', `${PID}/access/roles`, c => c.api.access.roleMatrix(c.p.pid, c.actor), { access: 'user' }),
  route('PUT', `${PID}/access/roles`, c => c.api.access.setRoleAccess(c.p.pid, c.body, c.actor), { access: 'user' }),
  route('GET', `${PID}/access/users/(?<uid>[^/]+)`, c => c.api.access.personMatrix(c.p.pid, c.p.uid, c.actor), { access: 'user' }),
  route('PUT', `${PID}/access/users/(?<uid>[^/]+)`, c => c.api.access.setPersonAccess(c.p.pid, c.p.uid, c.body, c.actor), { access: 'user' }),

  // module registry
  route('GET', 'modules', c => c.api.svc.catalog()),
  route('GET', `${PID}/modules`, c => ({ workspaces: c.api.svc.catalog().workspaces, modules: c.api.svc.modules(c.p.pid) }), { access: 'projectAny' }),
  route('PUT', `${PID}/modules/(?<key>[^/]+)`, c => { requireConfigure(c.actor, c.p.pid); return c.api.svc.changeModule(c.p.pid, c.p.key, c.body, c.actor); }, { access: 'user' }),
  route('POST', `${PID}/modules/(?<key>[^/]+)/sheet`, c => { requireWrite(c.actor, c.p.pid); return c.api.svc.generateSheet(c.p.key); }, { module: p => p.key }),
  route('GET', `${PID}/modules/(?<key>[^/]+)/records`, c => c.api.svc.records(c.p.pid, c.p.key), { module: p => p.key }),
  route('GET', `${PID}/module-changes`, c => c.api.svc.moduleChanges(c.p.pid), { access: 'projectAny' }),

  route('GET', `${PID}/dashboard`, c => c.api.dashboard(c.p.pid, c.actor), { module: 'dashboard' }),

  // planning
  route('GET', `${PID}/schedule/overall-progress`, c => c.api.svc.overall(c.p.pid), { module: OVERALL }),
  route('GET', `${PID}/schedule/work-packages`, c => c.api.svc.workPackages(c.p.pid), { module: WORK_PACKAGES }),
  route('GET', `${PID}/milestones/insights`, c => c.api.reg.milestoneInsights(c.p.pid), { module: MILESTONES }),
  route('GET', `${PID}/facilities`, c => c.api.facilities.list(c.p.pid), { module: FAC_PROGRESS }),
  route('GET', `${PID}/facilities/(?<fid>[^/]+)/progress`, c => c.api.facilities.progress(c.p.pid, c.p.fid), { module: FAC_PROGRESS }),
  route('GET', `${PID}/facilities/(?<fid>[^/]+)/schedule`, c => c.api.facilities.schedule(c.p.pid, c.p.fid), { module: FAC_SCHEDULE }),
  route('GET', `${PID}/facility-timeline`, c => c.api.facilities.timeline(c.p.pid), { module: FAC_SCHEDULE }),
  route('GET', `${PID}/cpn`, c => c.api.facilities.cpn(c.p.pid), { module: CPN }),
  route('GET', `${PID}/milestones/summary`, c => c.api.reg.milestoneSummary(c.p.pid), { module: MILESTONES }),
  route('GET', `${PID}/milestones[.]csv`, c => c.api.reg.milestoneCsv(c.p.pid, c.q), { module: MILESTONES }),
  route('GET', `${PID}/milestones`, c => c.api.reg.milestoneList(c.p.pid, c.q), { module: MILESTONES }),
  route('POST', `${PID}/milestones`, c => c.api.reg.milestoneCreate(c.p.pid, c.body, c.actor), { module: MILESTONES, status: 201 }),
  route('GET', `${PID}/milestones/(?<id>[^/]+)`, c => c.api.reg.milestoneGet(c.p.pid, c.p.id), { module: MILESTONES }),
  route('PATCH', `${PID}/milestones/(?<id>[^/]+)`, c => c.api.reg.milestoneUpdate(c.p.pid, c.p.id, c.body, c.actor), { module: MILESTONES }),
  route('DELETE', `${PID}/milestones/(?<id>[^/]+)`, c => { c.api.reg.milestoneDelete(c.p.pid, c.p.id, c.actor); return null; }, { module: MILESTONES, status: 204 }),

  // procurement and expediting
  route('GET', `${PID}/procurement/summary`, c => c.api.svc.procurementSummary(c.p.pid), { module: PROCUREMENT }),
  route('GET', `${PID}/procurement/packages[.]csv`, c => c.api.svc.procurementCsv(c.p.pid, c.q), { module: PROCUREMENT }),
  route('GET', `${PID}/procurement/packages`, c => c.api.svc.procurementList(c.p.pid, c.q), { module: PROCUREMENT }),
  route('GET', `${PID}/procurement/packages/(?<id>[^/]+)`, c => c.api.svc.procurementGet(c.p.pid, c.p.id), { module: PROCUREMENT }),
  route('POST', `${PID}/procurement/packages`, c => c.api.proc.packages.create(c.p.pid, c.body, c.actor), { module: PROCUREMENT, status: 201 }),
  route('PATCH', `${PID}/procurement/packages/(?<id>[^/]+)`, c => c.api.proc.packages.update(c.p.pid, c.p.id, c.body, c.actor), { module: PROCUREMENT }),
  route('DELETE', `${PID}/procurement/packages/(?<id>[^/]+)`, c => { c.api.proc.packages.remove(c.p.pid, c.p.id, c.actor); return null; }, { module: PROCUREMENT, status: 204 }),
  route('POST', `${PID}/expediting/packages`, c => c.api.proc.expediting.create(c.p.pid, c.body, c.actor), { module: EXPEDITING, status: 201 }),
  route('PATCH', `${PID}/expediting/packages/(?<id>[^/]+)`, c => c.api.proc.expediting.update(c.p.pid, c.p.id, c.body, c.actor), { module: EXPEDITING }),
  route('DELETE', `${PID}/expediting/packages/(?<id>[^/]+)`, c => { c.api.proc.expediting.remove(c.p.pid, c.p.id, c.actor); return null; }, { module: EXPEDITING, status: 204 }),
  route('GET', `${PID}/procurement/dashboard`, c => c.api.proc.dashboard(c.p.pid), { module: PROC_DASH }),
  route('GET', `${PID}/procurement/s-curve`, c => c.api.proc.curves(c.p.pid, c.q.facility, c.q.scope), { module: PROC_DASH }),
  route('GET', `${PID}/procurement/insights`, c => c.api.proc.planInsights(c.p.pid), { module: PROCUREMENT }),
  route('GET', `${PID}/expediting/insights`, c => c.api.proc.expeditingInsights(c.p.pid), { module: EXPEDITING }),
  route('GET', `${PID}/logistics/insights`, c => c.api.proc.logisticsInsights(c.p.pid), { module: LOGISTICS }),
  route('GET', `${PID}/materials/insights`, c => c.api.proc.materialsInsights(c.p.pid), { module: MATERIALS }),
  route('GET', `${PID}/procurement/concerns/insights`, c => c.api.proc.concernsInsights(c.p.pid), { module: CONCERNS }),
  route('GET', `${PID}/procurement/concerns/summary`, c => c.api.proc.concernSummary(c.p.pid), { module: CONCERNS }),
  ...crud('procurement/concerns', c => c.api.proc.concerns, CONCERNS),
  ...crud('logistics/shipments', c => c.api.proc.logistics, LOGISTICS),
  ...crud('materials/balance', c => c.api.proc.balance, MATERIALS),
  ...crud('materials/summary', c => c.api.proc.summary, MATERIALS),
  route('GET', `${PID}/expediting/summary`, c => c.api.svc.expeditingSummary(c.p.pid), { module: EXPEDITING }),
  route('GET', `${PID}/expediting/packages[.]csv`, c => c.api.svc.expeditingCsv(c.p.pid, c.q), { module: EXPEDITING }),
  route('GET', `${PID}/expediting/packages`, c => c.api.svc.expeditingList(c.p.pid, c.q), { module: EXPEDITING }),
  route('GET', `${PID}/expediting/packages/(?<id>[^/]+)`, c => c.api.svc.expeditingGet(c.p.pid, c.p.id), { module: EXPEDITING }),

  // issue management
  route('GET', `${PID}/issues/insights`, c => c.api.issues.insights(c.p.pid), { module: ISSUES }),
  route('GET', `${PID}/issues[.]csv`, c => c.api.issues.csv(c.p.pid, c.q), { module: ISSUES }),
  route('GET', `${PID}/issues`, c => c.api.issues.list(c.p.pid, c.q), { module: ISSUES }),
  route('POST', `${PID}/issues`, c => c.api.issues.create(c.p.pid, c.body, c.actor), { module: ISSUES, status: 201 }),
  route('POST', `${PID}/issues/remind-due`, c => { requireWrite(c.actor, c.p.pid); return c.api.issues.remindDue(c.p.pid); }, { module: ISSUES }),
  route('GET', `${PID}/issues/(?<id>[^/]+)`, c => c.api.issues.get(c.p.pid, c.p.id), { module: ISSUES }),
  route('PATCH', `${PID}/issues/(?<id>[^/]+)`, c => c.api.issues.update(c.p.pid, c.p.id, c.body, c.actor), { module: ISSUES }),
  route('DELETE', `${PID}/issues/(?<id>[^/]+)`, c => { c.api.issues.delete(c.p.pid, c.p.id, c.actor); return null; }, { module: ISSUES, status: 204 }),
  route('POST', `${PID}/issues/(?<id>[^/]+)/comments`, c => c.api.issues.comment(c.p.pid, c.p.id, c.body, c.actor), { module: ISSUES, status: 201 }),
  route('POST', `${PID}/issues/(?<id>[^/]+)/remind`, c => c.api.issues.remind(c.p.pid, c.p.id, c.actor), { module: ISSUES }),
  route('POST', `${PID}/issues/(?<id>[^/]+)/subtasks`, c => c.api.issues.addSubtask(c.p.pid, c.p.id, c.body, c.actor), { module: ISSUES, status: 201 }),
  route('PATCH', `${PID}/issues/(?<id>[^/]+)/subtasks/(?<sid>[^/]+)`, c => c.api.issues.updateSubtask(c.p.pid, c.p.id, c.p.sid, c.body, c.actor), { module: ISSUES }),
  route('DELETE', `${PID}/issues/(?<id>[^/]+)/subtasks/(?<sid>[^/]+)`, c => c.api.issues.deleteSubtask(c.p.pid, c.p.id, c.p.sid, c.actor), { module: ISSUES }),
  // risk management
  route('GET', `${PID}/risks/insights`, c => c.api.risks.insights(c.p.pid), { module: RISKS }),
  route('GET', `${PID}/risks/heatmap`, c => c.api.risks.heatmap(c.p.pid), { module: RISKS }),
  route('GET', `${PID}/risks/options`, c => c.api.risks.options(c.p.pid), { module: RISKS }),
  route('GET', `${PID}/risks/summary`, c => c.api.risks.summary(c.p.pid), { module: RISKS }),
  route('GET', `${PID}/risks[.]csv`, c => c.api.risks.csv(c.p.pid, c.q), { module: RISKS }),
  route('GET', `${PID}/risks`, c => c.api.risks.list(c.p.pid, c.q), { module: RISKS }),
  route('POST', `${PID}/risks`, c => c.api.risks.create(c.p.pid, c.body, c.actor), { module: RISKS, status: 201 }),
  route('GET', `${PID}/risks/(?<id>[^/]+)`, c => c.api.risks.get(c.p.pid, c.p.id), { module: RISKS }),
  route('PATCH', `${PID}/risks/(?<id>[^/]+)`, c => c.api.risks.update(c.p.pid, c.p.id, c.body, c.actor), { module: RISKS }),
  route('DELETE', `${PID}/risks/(?<id>[^/]+)`, c => { c.api.risks.delete(c.p.pid, c.p.id, c.actor); return null; }, { module: RISKS, status: 204 }),
  route('POST', `${PID}/risks/(?<id>[^/]+)/actions`, c => c.api.risks.addAction(c.p.pid, c.p.id, c.body, c.actor), { module: RISKS, status: 201 }),
  route('PATCH', `${PID}/risks/(?<id>[^/]+)/actions/(?<aid>[^/]+)`, c => c.api.risks.updateAction(c.p.pid, c.p.id, c.p.aid, c.body, c.actor), { module: RISKS }),
  route('DELETE', `${PID}/risks/(?<id>[^/]+)/actions/(?<aid>[^/]+)`, c => c.api.risks.deleteAction(c.p.pid, c.p.id, c.p.aid, c.actor), { module: RISKS }),

  // interface management
  route('GET', `${PID}/interfaces/summary`, c => c.api.interfaces.interfaceSummary(c.p.pid), { module: IF_REGISTER }),
  route('GET', `${PID}/interfaces/matrix`, c => c.api.interfaces.interfaceMatrix(c.p.pid), { module: IF_MATRIX }),
  route('GET', `${PID}/interfaces/responsibility`, c => c.api.interfaces.responsibility(c.p.pid), { module: IF_MATRIX }),
  route('GET', `${PID}/interfaces/rasci`, c => c.api.interfaces.rasci(c.p.pid), { module: IF_MATRIX }),
  route('GET', `${PID}/interfaces/parties`, c => c.api.interfaces.parties(c.p.pid)),
  route('GET', `${PID}/interfaces[.]csv`, c => c.api.interfaces.interfaceCsv(c.p.pid, c.q), { module: IF_REGISTER }),
  route('GET', `${PID}/interfaces`, c => c.api.interfaces.interfaceList(c.p.pid, c.q), { module: IF_REGISTER }),
  route('POST', `${PID}/interfaces`, c => c.api.interfaces.interfaceCreate(c.p.pid, c.body, c.actor), { module: IF_REGISTER, status: 201 }),
  route('GET', `${PID}/interfaces/(?<id>[^/]+)`, c => c.api.interfaces.interfaceGet(c.p.pid, c.p.id), { module: IF_REGISTER }),
  route('PATCH', `${PID}/interfaces/(?<id>[^/]+)`, c => c.api.interfaces.interfaceUpdate(c.p.pid, c.p.id, c.body, c.actor), { module: IF_REGISTER }),
  route('POST', `${PID}/interfaces/(?<id>[^/]+)/transition`, c => c.api.interfaces.interfaceTransition(c.p.pid, c.p.id, c.body, c.actor), { module: IF_REGISTER }),
  route('DELETE', `${PID}/interfaces/(?<id>[^/]+)`, c => { c.api.interfaces.interfaceDelete(c.p.pid, c.p.id, c.actor); return null; }, { module: IF_REGISTER, status: 204 }),
  route('GET', `${PID}/interface-points/insights`, c => c.api.interfaces.pointInsights(c.p.pid), { module: IF_POINTS }),
  route('GET', `${PID}/interface-points[.]csv`, c => c.api.interfaces.pointCsv(c.p.pid, c.q), { module: IF_POINTS }),
  route('GET', `${PID}/interface-points`, c => c.api.interfaces.pointList(c.p.pid, c.q), { module: IF_POINTS }),
  route('POST', `${PID}/interface-points`, c => c.api.interfaces.pointCreate(c.p.pid, c.body, c.actor), { module: IF_POINTS, status: 201 }),
  route('GET', `${PID}/interface-points/(?<id>[^/]+)`, c => c.api.interfaces.pointGet(c.p.pid, c.p.id), { module: IF_POINTS }),
  route('PATCH', `${PID}/interface-points/(?<id>[^/]+)`, c => c.api.interfaces.pointUpdate(c.p.pid, c.p.id, c.body, c.actor), { module: IF_POINTS }),
  route('POST', `${PID}/interface-points/(?<id>[^/]+)/transition`, c => c.api.interfaces.pointTransition(c.p.pid, c.p.id, c.body, c.actor), { module: IF_POINTS }),
  route('DELETE', `${PID}/interface-points/(?<id>[^/]+)`, c => { c.api.interfaces.pointDelete(c.p.pid, c.p.id, c.actor); return null; }, { module: IF_POINTS, status: 204 }),

  // construction budget (manhours by WBS activity)
  route('GET', `${PID}/construction/budget`, c => c.api.budget.list(c.p.pid), { module: BUDGET }),
  route('GET', `${PID}/construction/budget/histogram`, c => c.api.budget.histogram(c.p.pid, c.q), { module: BUDGET }),
  route('GET', `${PID}/construction/budget[.]csv`, c => c.api.budget.csv(c.p.pid), { module: BUDGET }),
  route('POST', `${PID}/construction/budget/import`, c => c.api.budget.import(c.p.pid, c.body, c.actor), { module: BUDGET }),
  route('POST', `${PID}/construction/budget`, c => c.api.budget.create(c.p.pid, c.body, c.actor), { module: BUDGET, status: 201 }),
  route('PATCH', `${PID}/construction/budget/(?<wbs>[^/]+)`, c => c.api.budget.update(c.p.pid, c.p.wbs, c.body, c.actor), { module: BUDGET }),
  route('DELETE', `${PID}/construction/budget/(?<wbs>[^/]+)`, c => { c.api.budget.remove(c.p.pid, c.p.wbs, c.actor); return null; }, { module: BUDGET, status: 204 }),

  // general knowledge
  route('GET', `${PID}/knowledge`, c => c.api.knowledge.list(c.p.pid, c.q), { module: KNOWLEDGE }),
  route('GET', `${PID}/knowledge/summary`, c => c.api.knowledge.summary(c.p.pid), { module: KNOWLEDGE }),
  route('GET', `${PID}/knowledge/(?<id>[^/]+)`, c => c.api.knowledge.get(c.p.pid, c.p.id), { module: KNOWLEDGE }),
  route('POST', `${PID}/knowledge`, c => c.api.knowledge.create(c.p.pid, c.body, c.actor), { module: KNOWLEDGE, status: 201 }),
  route('PATCH', `${PID}/knowledge/(?<id>[^/]+)`, c => c.api.knowledge.update(c.p.pid, c.p.id, c.body, c.actor), { module: KNOWLEDGE }),
  route('DELETE', `${PID}/knowledge/(?<id>[^/]+)`, c => { c.api.knowledge.remove(c.p.pid, c.p.id, c.actor); return null; }, { module: KNOWLEDGE, status: 204 }),

  // cut-off snapshots (the saved report of the data at a reporting date)
  route('GET', `${PID}/snapshots`, c => c.api.snapshots.list(c.p.pid)),
  route('POST', `${PID}/snapshots`, c => c.api.snapshots.create(c.p.pid, c.body, c.actor), { status: 201 }),
  route('DELETE', `${PID}/snapshots/(?<cutoff>\\d{4}-\\d{2}-\\d{2})`, c => { c.api.snapshots.remove(c.p.pid, c.p.cutoff, c.actor); return null; }, { status: 204 }),

  // personal tasks (owner-scoped)
  route('GET', 'tasks', c => c.api.tasks.list(c.actor, c.q)),
  route('GET', 'tasks/workload', c => c.api.tasks.workload(c.actor, c.q)),
  route('POST', 'tasks', c => c.api.tasks.create(c.body, c.actor, c.q), { status: 201 }),
  route('PATCH', 'tasks/(?<id>[^/]+)', c => c.api.tasks.update(c.p.id, c.body, c.actor, c.q)),
  route('DELETE', 'tasks/(?<id>[^/]+)', c => { c.api.tasks.remove(c.p.id, c.actor); return null; }, { status: 204 }),
];

function parsePath(path: string): { pathname: string; query: Record<string, string> } {
  const [pathname, qs = ''] = path.split('?');
  const query: Record<string, string> = {};
  for (const part of qs.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    query[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return { pathname: pathname.replace(/\/+$/, '') || '/', query };
}

/**
 * Batch handler: accepts an array of GET requests and runs each through the router,
 * returning all responses in one HTTP round trip. Errors on individual requests
 * are captured per-item so one failure does not block the rest.
 */
export function handleBatch(api: Api, requests: ApiRequest[]): Envelope[] {
  return requests.map(req => handle(api, req));
}

export function handle(api: Api, req: ApiRequest): Envelope {
  try {
    const { pathname, query } = parsePath(req.path);
    const method = req.method.toUpperCase();
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      const params = Object.fromEntries(Object.entries(m.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]));
      // with a signing secret the user comes from the session token the API issued; a stated `user` is never believed
      const actor = r.access === 'public' ? (undefined as unknown as Actor) : resolveActor(api.svc.store, api.auth ? readSession(api.svc.store, api.auth, req.session, api.svc.clock()) : req.user);
      if (r.hasProject) api.svc.project(params.pid); // unknown projects are a 404 before any permission talk
      if (r.access === 'member') requireMember(actor, params.pid);
      if (r.access === 'projectAny' && !actor.isAdmin) requireMember(actor, params.pid);
      const key = typeof r.module === 'function' ? r.module(params) : r.module;
      if (key) {
        api.admin.assertParty(actor, key);
        api.svc.assertAccess(params.pid, key, method !== 'GET');
        if (r.hasProject) api.access.assert(actor, params.pid, key, method !== 'GET'); // role matrix and personal settings
      }
      const ctx = { api, actor, p: params, q: query, body: req.body };
      if (r.hasProject && query.asOf) {
        // ?asOf=<cut-off date> reads the saved snapshot of that date; snapshots are read-only
        if (!/^\d{4}-\d{2}-\d{2}$/.test(query.asOf)) throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'asOf must be a cut-off date (YYYY-MM-DD).' });
        if (method !== 'GET') throw new HttpError(409, { code: 'READ_ONLY_SNAPSHOT', message: 'A cut-off snapshot is read-only. Switch to the current data to make changes.' });
        const data = api.snapshots.load(params.pid, query.asOf);
        if (!data) throw new HttpError(404, { code: 'SNAPSHOT_NOT_FOUND', message: `No snapshot was saved for the cut-off ${query.asOf}.` });
        return { ok: true, status: r.status ?? 200, data: api.svc.atSnapshot(params.pid, query.asOf, data, () => r.handler(ctx)) };
      }
      return { ok: true, status: r.status ?? 200, data: r.handler(ctx) };
    }
    return { ok: false, status: 404, error: { code: 'ROUTE_NOT_FOUND', message: `No route for ${method} ${pathname}.` } };
  } catch (e) {
    if (e instanceof HttpError) return { ok: false, status: e.status, error: e.body };
    return { ok: false, status: 500, error: { code: 'INTERNAL_ERROR', message: e instanceof Error ? e.message : 'Unexpected error.' } };
  }
}
