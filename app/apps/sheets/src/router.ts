import type { Api } from './api';
import { requireConfigure, requireMember, requireWrite, resolveActor, type Actor } from './auth';
import { HttpError } from './http';

export interface ApiRequest { method: string; path: string; body?: unknown; /** Id of the acting user (demo identity, see auth.ts). */ user?: string }
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

const OVERALL = 'planning.overall-progress';
const WORK_PACKAGES = 'planning.work-packages';
const MILESTONES = 'planning.milestones';
const PROCUREMENT = 'procurement.procurement-plan';
const EXPEDITING = 'procurement.expediting.vendor-overview';
const RISKS = 'management.risks';
const IF_REGISTER = 'interface.register';
const IF_MATRIX = 'interface.matrix';
const IF_POINTS = 'interface.points';

/** Same URLs, methods and module guards as the NestJS controllers, plus the pre-build's project, user and register routes. */
const ROUTES: Route[] = [
  route('GET', 'health', c => c.api.svc.health(), { access: 'public' }),
  route('GET', 'directory', c => c.api.admin.directory(), { access: 'public' }),
  route('GET', 'me', c => c.api.admin.me(c.actor)),

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

  // module registry
  route('GET', 'modules', c => c.api.svc.catalog()),
  route('GET', `${PID}/modules`, c => ({ workspaces: c.api.svc.catalog().workspaces, modules: c.api.svc.modules(c.p.pid) }), { access: 'projectAny' }),
  route('PUT', `${PID}/modules/(?<key>[^/]+)`, c => { requireConfigure(c.actor, c.p.pid); return c.api.svc.changeModule(c.p.pid, c.p.key, c.body, c.actor); }, { access: 'user' }),
  route('POST', `${PID}/modules/(?<key>[^/]+)/sheet`, c => { requireWrite(c.actor, c.p.pid); return c.api.svc.generateSheet(c.p.key); }, { module: p => p.key }),
  route('GET', `${PID}/modules/(?<key>[^/]+)/records`, c => c.api.svc.records(c.p.pid, c.p.key), { module: p => p.key }),
  route('GET', `${PID}/module-changes`, c => c.api.svc.moduleChanges(c.p.pid), { access: 'projectAny' }),

  route('GET', `${PID}/dashboard`, c => c.api.dashboard(c.p.pid), { module: 'dashboard' }),

  // planning
  route('GET', `${PID}/schedule/overall-progress`, c => c.api.svc.overall(c.p.pid), { module: OVERALL }),
  route('GET', `${PID}/schedule/work-packages`, c => c.api.svc.workPackages(c.p.pid), { module: WORK_PACKAGES }),
  route('GET', `${PID}/milestones/summary`, c => c.api.reg.milestoneSummary(c.p.pid), { module: MILESTONES }),
  route('GET', `${PID}/milestones[.]csv`, c => c.api.reg.milestoneCsv(c.p.pid, c.q), { module: MILESTONES }),
  route('GET', `${PID}/milestones`, c => c.api.reg.milestoneList(c.p.pid, c.q), { module: MILESTONES }),

  // procurement and expediting
  route('GET', `${PID}/procurement/summary`, c => c.api.svc.procurementSummary(c.p.pid), { module: PROCUREMENT }),
  route('GET', `${PID}/procurement/packages[.]csv`, c => c.api.svc.procurementCsv(c.p.pid, c.q), { module: PROCUREMENT }),
  route('GET', `${PID}/procurement/packages`, c => c.api.svc.procurementList(c.p.pid, c.q), { module: PROCUREMENT }),
  route('GET', `${PID}/procurement/packages/(?<id>[^/]+)`, c => c.api.svc.procurementGet(c.p.pid, c.p.id), { module: PROCUREMENT }),
  route('GET', `${PID}/expediting/summary`, c => c.api.svc.expeditingSummary(c.p.pid), { module: EXPEDITING }),
  route('GET', `${PID}/expediting/packages[.]csv`, c => c.api.svc.expeditingCsv(c.p.pid, c.q), { module: EXPEDITING }),
  route('GET', `${PID}/expediting/packages`, c => c.api.svc.expeditingList(c.p.pid, c.q), { module: EXPEDITING }),
  route('GET', `${PID}/expediting/packages/(?<id>[^/]+)`, c => c.api.svc.expeditingGet(c.p.pid, c.p.id), { module: EXPEDITING }),

  // risk management
  route('GET', `${PID}/risks/summary`, c => c.api.reg.riskSummary(c.p.pid), { module: RISKS }),
  route('GET', `${PID}/risks[.]csv`, c => c.api.reg.riskCsv(c.p.pid, c.q), { module: RISKS }),
  route('GET', `${PID}/risks`, c => c.api.reg.riskList(c.p.pid, c.q), { module: RISKS }),
  route('POST', `${PID}/risks`, c => c.api.reg.riskCreate(c.p.pid, c.body, c.actor), { module: RISKS, status: 201 }),
  route('GET', `${PID}/risks/(?<id>[^/]+)`, c => c.api.reg.riskGet(c.p.pid, c.p.id), { module: RISKS }),
  route('PATCH', `${PID}/risks/(?<id>[^/]+)`, c => c.api.reg.riskUpdate(c.p.pid, c.p.id, c.body, c.actor), { module: RISKS }),
  route('DELETE', `${PID}/risks/(?<id>[^/]+)`, c => { c.api.reg.riskDelete(c.p.pid, c.p.id, c.actor); return null; }, { module: RISKS, status: 204 }),

  // interface management
  route('GET', `${PID}/interfaces/summary`, c => c.api.reg.interfaceSummary(c.p.pid), { module: IF_REGISTER }),
  route('GET', `${PID}/interfaces/matrix`, c => c.api.reg.interfaceMatrix(c.p.pid), { module: IF_MATRIX }),
  route('GET', `${PID}/interfaces[.]csv`, c => c.api.reg.interfaceCsv(c.p.pid, c.q), { module: IF_REGISTER }),
  route('GET', `${PID}/interfaces`, c => c.api.reg.interfaceList(c.p.pid, c.q), { module: IF_REGISTER }),
  route('POST', `${PID}/interfaces`, c => c.api.reg.interfaceCreate(c.p.pid, c.body, c.actor), { module: IF_REGISTER, status: 201 }),
  route('GET', `${PID}/interfaces/(?<id>[^/]+)`, c => c.api.reg.interfaceGet(c.p.pid, c.p.id), { module: IF_REGISTER }),
  route('PATCH', `${PID}/interfaces/(?<id>[^/]+)`, c => c.api.reg.interfaceUpdate(c.p.pid, c.p.id, c.body, c.actor), { module: IF_REGISTER }),
  route('POST', `${PID}/interfaces/(?<id>[^/]+)/transition`, c => c.api.reg.interfaceTransition(c.p.pid, c.p.id, c.body, c.actor), { module: IF_REGISTER }),
  route('DELETE', `${PID}/interfaces/(?<id>[^/]+)`, c => { c.api.reg.interfaceDelete(c.p.pid, c.p.id, c.actor); return null; }, { module: IF_REGISTER, status: 204 }),
  route('GET', `${PID}/interface-points`, c => c.api.reg.pointList(c.p.pid, c.q), { module: IF_POINTS }),
  route('POST', `${PID}/interface-points`, c => c.api.reg.pointCreate(c.p.pid, c.body, c.actor), { module: IF_POINTS, status: 201 }),
  route('PATCH', `${PID}/interface-points/(?<id>[^/]+)`, c => c.api.reg.pointUpdate(c.p.pid, c.p.id, c.body, c.actor), { module: IF_POINTS }),
  route('DELETE', `${PID}/interface-points/(?<id>[^/]+)`, c => { c.api.reg.pointDelete(c.p.pid, c.p.id, c.actor); return null; }, { module: IF_POINTS, status: 204 }),

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

export function handle(api: Api, req: ApiRequest): Envelope {
  try {
    const { pathname, query } = parsePath(req.path);
    const method = req.method.toUpperCase();
    for (const r of ROUTES) {
      if (r.method !== method) continue;
      const m = r.pattern.exec(pathname);
      if (!m) continue;
      const params = Object.fromEntries(Object.entries(m.groups ?? {}).map(([k, v]) => [k, decodeURIComponent(v)]));
      const actor = r.access === 'public' ? (undefined as unknown as Actor) : resolveActor(api.svc.store, req.user);
      if (r.hasProject) api.svc.project(params.pid); // unknown projects are a 404 before any permission talk
      if (r.access === 'member') requireMember(actor, params.pid);
      if (r.access === 'projectAny' && !actor.isAdmin) requireMember(actor, params.pid);
      const key = typeof r.module === 'function' ? r.module(params) : r.module;
      if (key) api.svc.assertAccess(params.pid, key, method !== 'GET');
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
