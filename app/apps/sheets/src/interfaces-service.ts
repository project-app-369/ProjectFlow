import { z } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, filterAndSort, listQuery, notFound, paginate, parse, toCsv, unique, type ListParams } from './http';
import { agePredicate, pointsInsights, withinPredicate } from './insights';
import {
  INTERFACE_STATUSES, INTERFACE_TYPES, POINT_STATUSES, allowedNext, interfaceSettled, normPointStatus, pointAllowedNext, pointResolved,
} from './interface-flow';
import type { Service } from './service';
import type { Row } from './store';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = Record<string, any>;

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const isoOpt = iso.nullish().transform(v => v ?? null);
const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
const strip = ({ projectId: _p, ...rest }: Row): Any => rest;
const nextId = (prefix: string, rows: Row[]) => `${prefix}-${String(rows.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/^\D+/, '')) || 0), 0) + 1).padStart(3, '0')}`;
const sameParty = (a?: string | null, b?: string | null) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/* ---------------- interfaces (register, spec INT-01 to INT-04) ---------------- */
const interfaceFields = {
  title: z.string().trim().min(1).max(160), type: z.enum(INTERFACE_TYPES),
  originator: z.string().trim().min(1).max(120), receiver: z.string().trim().min(1).max(120),
  coordinator: txt(120), discipline: txt(80), boundary: txt(1000), requiredInput: txt(1000), requiredOutput: txt(1000),
  needDate: isoOpt, response: txt(2000), acceptance: txt(1000), evidence: txt(500), milestoneId: txt(40),
};
const differentParties = (v: { originator?: string; receiver?: string }) => !sameParty(v.originator, v.receiver);
const partiesMessage = { message: 'Originator and receiving party must be different.', path: ['receiver'] };
const interfaceCreate = z.object(interfaceFields).refine(differentParties, partiesMessage);
const interfacePatch = z.object(interfaceFields).partial().refine(differentParties, partiesMessage);
const transitionBody = z.object({ to: z.enum(INTERFACE_STATUSES) });
const interfaceQuery = listQuery(['id', 'title', 'status', 'needDate', 'originator', 'receiver', 'createdAt', 'updatedAt'] as const).extend({
  type: z.string().max(40).optional(), party: z.string().max(120).optional(), overdue: z.enum(['true', 'false']).optional(), originator: z.string().max(120).optional(), receiver: z.string().max(120).optional(),
});

/* ---------------- interface points ---------------- */
const pointFields = {
  title: txt(200), description: z.string().trim().min(1).max(3000), owner: txt(120), workPackage: txt(60), discipline: txt(40),
  originator: z.string().trim().min(1).max(120), target: z.string().trim().min(1).max(120), action: txt(3000),
  queryDate: isoOpt, targetDate: isoOpt, reference: txt(500), resolution: txt(3000), resolvedDocument: txt(300), remarks: txt(1500), interfaceId: txt(40),
};
const pointCreate = z.object(pointFields).refine(v => !sameParty(v.originator, v.target), { message: 'Originating and target party must be different.', path: ['target'] });
const pointPatch = z.object(pointFields).partial();
const pointMove = z.object({ to: z.enum(POINT_STATUSES), resolvedDate: isoOpt.optional(), resolution: txt(3000).optional() });
const pointQuery = listQuery(['id', 'title', 'status', 'targetDate', 'queryDate', 'ageDays', 'discipline', 'target', 'originator', 'owner', 'createdAt', 'updatedAt'] as const).extend({
  interfaceId: z.string().max(40).optional(), overdue: z.enum(['true', 'false']).optional(), party: z.string().max(120).optional(),
  originator: z.string().max(120).optional(), target: z.string().max(120).optional(), within: z.string().max(10).optional(), age: z.string().regex(/^\d+-\d*$/).optional(),
  open: z.enum(['true', 'false']).optional(), owner: z.string().max(120).optional(),
});
const pointWithin = withinPredicate(r => (r.targetDate ? String(r.targetDate) : null), r => !r.settled);

/** A short title for a point that has none: its subject, else the first sentence of the description. */
export const pointTitle = (r: Row) => String(r.title ?? '').trim() || String(r.description ?? '').split(/\n|(?<=\.)\s/)[0].replace(/\s+/g, ' ').trim().slice(0, 140);

export class InterfacesService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }
  private cutoff(projectId: string) { return String(this.svc.project(projectId).cutoff); }
  private interfaceRows(projectId: string) { return this.svc.rows(SHEET.interfaces, COLUMNS.interfaces, projectId); }
  private pointRows(projectId: string) { return this.svc.rows(SHEET.interfacePoints, COLUMNS.interfacePoints, projectId); }
  private milestoneTitles(projectId: string) { return new Map(this.svc.rows(SHEET.milestones, COLUMNS.milestones, projectId).map(m => [String(m.id), String(m.description)])); }

  private requireMilestone(projectId: string, id: string | null | undefined) {
    if (id && !this.milestoneTitles(projectId).has(id)) {
      throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'milestoneId', message: `Milestone "${id}" does not exist in this project.` }] });
    }
  }

  /* ================= parties ================= */
  parties(projectId: string) {
    const named = this.svc.rows(SHEET.interfaceParties, COLUMNS.interfaceParties, projectId).map(({ projectId: _p, ...r }) => r);
    const used = unique([...this.pointRows(projectId).flatMap(p => [p.originator, p.target]), ...this.interfaceRows(projectId).flatMap(i => [i.originator, i.receiver])].map(v => (v == null ? null : String(v))));
    return [...named, ...used.filter(c => !named.some(n => n.code === c)).map(code => ({ code, name: code }))];
  }

  /* ================= points ================= */
  private pointView(p: Row, cutoff: string, titles: Map<string, string>): Any {
    const status = normPointStatus(p.status);
    const settled = pointResolved(status);
    const end = settled ? (p.resolvedDate ? String(p.resolvedDate) : null) : cutoff;
    return {
      ...strip(p), title: pointTitle(p), status, settled, allowedNext: pointAllowedNext(status),
      overdue: !settled && !!p.targetDate && String(p.targetDate) < cutoff,
      daysLate: !settled && p.targetDate && String(p.targetDate) < cutoff ? daysBetween(String(p.targetDate), cutoff) : null,
      ageDays: p.queryDate && end ? Math.max(0, daysBetween(String(p.queryDate), end)) : null,
      interfaceTitle: p.interfaceId ? titles.get(String(p.interfaceId)) ?? null : null,
    };
  }

  private pointViews(projectId: string) {
    const cutoff = this.cutoff(projectId);
    const titles = new Map(this.interfaceRows(projectId).map(i => [String(i.id), String(i.title)]));
    return { cutoff, all: this.pointRows(projectId).map(p => this.pointView(p, cutoff, titles)) };
  }

  private pointFilter(projectId: string, raw: unknown) {
    const { interfaceId, overdue, party, originator, target, within, age, open, owner, ...f } = parse(pointQuery, raw);
    const { all, cutoff } = this.pointViews(projectId);
    const needle = party?.toLowerCase();
    const kept = all.filter(p =>
      (!interfaceId || p.interfaceId === interfaceId) && (overdue === undefined || p.overdue === (overdue === 'true')) && (open === undefined || !p.settled === (open === 'true')) &&
      (!originator || p.originator === originator) && (!target || (target === 'No target' ? !p.target : p.target === target)) && (!owner || p.owner === owner) &&
      (!needle || String(p.originator).toLowerCase() === needle || String(p.target).toLowerCase() === needle) &&
      (!within || pointWithin(p, within, { cutoff })) && (!age || agePredicate(p, age)));
    const rows = filterAndSort(kept as Row[], { ...f, discipline: f.discipline === 'Unclassified' ? undefined : f.discipline } as ListParams, ['id', 'title', 'description', 'action', 'resolution', 'owner', 'originator', 'target', 'reference', 'remarks'], 'id') as Any[];
    return { f, all, rows: f.discipline === 'Unclassified' ? rows.filter(r => !r.discipline) : rows };
  }

  pointInsights(projectId: string) {
    const { all, cutoff } = this.pointViews(projectId);
    return pointsInsights(all, cutoff);
  }

  pointList(projectId: string, raw: unknown) {
    const { f, all, rows } = this.pointFilter(projectId, raw);
    return {
      items: paginate(rows, f), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: { disciplines: unique(all.map(r => r.discipline)), statuses: [...POINT_STATUSES], parties: unique(all.flatMap(r => [r.originator, r.target])), owners: unique(all.map(r => r.owner)) },
    };
  }

  pointCsv(projectId: string, raw: unknown) {
    const { rows } = this.pointFilter(projectId, raw);
    return {
      filename: 'interface-points.csv',
      csv: toCsv([['IP No', 'Subject', 'Discipline', 'Status', 'Originated party', 'Target party', 'IP owner', 'Interface description', 'Recommended action', 'Query date', 'Target date', 'Overdue', 'Age (days)', 'Reference document', 'Resolution', 'Resolved date', 'Resolved document', 'Remarks', 'Interface'],
        ...rows.map(p => [p.id, p.title, p.discipline, p.status, p.originator, p.target, p.owner, p.description, p.action, p.queryDate, p.targetDate, p.overdue ? 'Yes' : 'No', p.ageDays, p.reference, p.resolution, p.resolvedDate, p.resolvedDocument, p.remarks, p.interfaceId])]),
    };
  }

  pointGet(projectId: string, id: string) {
    const p = this.pointViews(projectId).all.find(x => x.id === id);
    if (!p) throw notFound('NOT_FOUND', `Interface point "${id}" was not found.`);
    return p;
  }

  private requireInterface(projectId: string, id: string | null | undefined) {
    if (!id) return;
    const parent = this.interfaceRows(projectId).find(i => i.id === id);
    if (!parent) throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'interfaceId', message: `Interface "${id}" does not exist in this project.` }] });
    if (parent.status === 'Closed') throw new HttpError(409, { code: 'INTERFACE_CLOSED', message: 'Reopen the interface before adding points to it.' });
  }

  pointCreate(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(pointCreate, body);
    return this.store.withLock(() => {
      this.requireInterface(projectId, v.interfaceId);
      const rows = this.pointRows(projectId);
      // Like the register: IP-<discipline>-<number>, the number running across all points.
      const n = rows.reduce((m, r) => Math.max(m, Number(/(\d+)$/.exec(String(r.id))?.[1] ?? 0)), 0) + 1;
      const id = `IP-${(v.discipline ?? 'GEN').toUpperCase().replace(/[^A-Z0-9&]/g, '')}-${String(n).padStart(4, '0')}`;
      const now = this.now();
      this.store.appendRows(SHEET.interfacePoints, COLUMNS.interfacePoints, [{ projectId, id, ...v, queryDate: v.queryDate ?? now.slice(0, 10), status: 'Open', createdAt: now, updatedAt: now }]);
      return this.pointGet(projectId, id);
    });
  }

  pointUpdate(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(pointPatch, body);
    return this.store.withLock(() => {
      const current = this.pointRows(projectId).find(p => p.id === id);
      if (!current) throw notFound('NOT_FOUND', `Interface point "${id}" was not found.`);
      if (sameParty(String(patch.originator ?? current.originator ?? ''), String(patch.target ?? current.target ?? ''))) {
        throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'target', message: 'Originating and target party must be different.' }] });
      }
      if (patch.interfaceId && patch.interfaceId !== current.interfaceId) this.requireInterface(projectId, patch.interfaceId);
      this.store.updateRow(SHEET.interfacePoints, COLUMNS.interfacePoints, 'id', id, { ...(patch as Row), updatedAt: this.now() }, { projectId });
      return this.pointGet(projectId, id);
    });
  }

  /** Status changes only here: a response is needed to mark a point responded or resolved; resolving dates it. */
  pointTransition(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const { to, resolvedDate, resolution } = parse(pointMove, body);
    return this.store.withLock(() => {
      const current = this.pointRows(projectId).find(p => p.id === id);
      if (!current) throw notFound('NOT_FOUND', `Interface point "${id}" was not found.`);
      const from = normPointStatus(current.status);
      if (!pointAllowedNext(from).includes(to)) throw new HttpError(409, { code: 'INVALID_TRANSITION', message: `A point that is ${from} cannot move to ${to}. Allowed: ${pointAllowedNext(from).join(', ')}.` });
      const answer = resolution ?? current.resolution;
      if ((to === 'Responded' || to === 'Resolved') && !answer) throw new HttpError(409, { code: 'RESPONSE_REQUIRED', message: 'Record the response (resolution) before marking the point responded or resolved.' });
      const patch: Row = { status: to, updatedAt: this.now(), ...(resolution ? { resolution } : {}) };
      if (to === 'Resolved') patch.resolvedDate = resolvedDate ?? current.resolvedDate ?? this.now().slice(0, 10);
      if (to === 'Open') patch.resolvedDate = null;
      this.store.updateRow(SHEET.interfacePoints, COLUMNS.interfacePoints, 'id', id, patch, { projectId });
      return this.pointGet(projectId, id);
    });
  }

  pointDelete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (!this.store.deleteRow(SHEET.interfacePoints, COLUMNS.interfacePoints, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Interface point "${id}" was not found.`);
    });
  }

  /* ================= interfaces ================= */
  private interfaceViews(projectId: string): Any[] {
    const cutoff = this.cutoff(projectId);
    const points = this.pointRows(projectId);
    const ms = this.milestoneTitles(projectId);
    return this.interfaceRows(projectId).map(i => {
      const mine = points.filter(p => p.interfaceId === i.id);
      return {
        ...strip(i), overdue: !!i.needDate && String(i.needDate) < cutoff && !interfaceSettled(String(i.status)),
        pointsTotal: mine.length, pointsOpen: mine.filter(p => !pointResolved(p.status)).length,
        allowedNext: allowedNext(String(i.status)), milestone: i.milestoneId ? ms.get(String(i.milestoneId)) ?? null : null,
      };
    });
  }

  private interfaceFilter(projectId: string, raw: unknown) {
    const { type, party, overdue, originator, receiver, ...f } = parse(interfaceQuery, raw);
    const all = this.interfaceViews(projectId) as unknown as Row[];
    const needle = party?.toLowerCase();
    const kept = all.filter(i =>
      (!type || i.type === type) && (!originator || i.originator === originator) && (!receiver || i.receiver === receiver) &&
      (!needle || String(i.originator).toLowerCase() === needle || String(i.receiver).toLowerCase() === needle) &&
      (overdue === undefined || !!i.overdue === (overdue === 'true')));
    return { f, all, rows: filterAndSort(kept, f as ListParams, ['id', 'title', 'originator', 'receiver', 'coordinator', 'discipline'], 'id') };
  }

  interfaceList(projectId: string, raw: unknown) {
    const { f, all, rows } = this.interfaceFilter(projectId, raw);
    return {
      items: paginate(rows, f), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: { disciplines: unique(all.map(r => r.type)), statuses: [...INTERFACE_STATUSES], types: [...INTERFACE_TYPES], parties: unique(all.flatMap(r => [r.originator, r.receiver])) },
    };
  }

  interfaceCsv(projectId: string, raw: unknown) {
    const { rows } = this.interfaceFilter(projectId, raw);
    return {
      filename: 'interface-register.csv',
      csv: toCsv([['ID', 'Title', 'Type', 'Originator', 'Receiver', 'Coordinator', 'Discipline', 'Need date', 'Status', 'Overdue', 'Open points', 'Points'],
        ...rows.map(i => [i.id, i.title, i.type, i.originator, i.receiver, i.coordinator, i.discipline, i.needDate, i.status, i.overdue ? 'Yes' : 'No', i.pointsOpen, i.pointsTotal])]),
    };
  }

  interfaceGet(projectId: string, id: string) {
    const i = this.interfaceViews(projectId).find(x => x.id === id);
    if (!i) throw notFound('NOT_FOUND', `Interface "${id}" was not found.`);
    const { all } = this.pointViews(projectId);
    return { ...i, points: all.filter(p => p.interfaceId === id) };
  }

  /** Dashboard figures: interfaces in the register and the open interface points. */
  interfaceSummary(projectId: string) {
    const views = this.interfaceViews(projectId);
    const { all: points } = this.pointViews(projectId);
    const byStatus = INTERFACE_STATUSES.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: views.filter(i => i.status === s).length }), {});
    return {
      total: views.length, open: views.filter(i => !interfaceSettled(String(i.status))).length, overdue: views.filter(i => i.overdue).length, byStatus,
      points: points.length, pointsOpen: points.filter(p => !p.settled).length, pointsOverdue: points.filter(p => p.overdue).length,
    };
  }

  /**
   * Party x party matrix (spec INT-03): rows are the party that raises, columns the party that must answer. Counts come from
   * the interface points and from the register's interfaces, each cell drilling down to the filtered list.
   */
  interfaceMatrix(projectId: string) {
    const { all: points } = this.pointViews(projectId);
    const ifaces = this.interfaceViews(projectId);
    const cells = new Map<string, { originator: string; receiver: string; total: number; open: number; overdue: number; settled: number; interfaces: number }>();
    const cell = (o: string, r: string) => {
      const key = `${o}\u0000${r}`;
      const c = cells.get(key) ?? { originator: o, receiver: r, total: 0, open: 0, overdue: 0, settled: 0, interfaces: 0 };
      cells.set(key, c);
      return c;
    };
    for (const p of points) {
      if (!p.originator || !p.target) continue;
      const c = cell(String(p.originator), String(p.target));
      c.total++;
      if (p.settled) c.settled++; else c.open++;
      if (p.overdue) c.overdue++;
    }
    for (const i of ifaces) cell(String(i.originator), String(i.receiver)).interfaces++;
    const list = [...cells.values()];
    const weight = (p: string) => list.filter(c => c.originator === p || c.receiver === p).reduce((n, c) => n + c.total + c.interfaces, 0);
    const parties = unique(list.flatMap(c => [c.originator, c.receiver])).sort((a, b) => weight(b) - weight(a) || a.localeCompare(b));
    const names = new Map(this.parties(projectId).map(p => [String(p.code), String(p.name)]));
    return { parties, names: Object.fromEntries(parties.map(p => [p, names.get(p) ?? p])), cells: list, total: points.length, interfaces: ifaces.length };
  }

  /** Scope activity x facility: who performs each activity (the project's responsibility matrix, level 1 sections and level 2 items). */
  responsibility(projectId: string) {
    const rows = this.svc.rows(SHEET.responsibility, COLUMNS.responsibility, projectId);
    const facilities: { workPackage: string | null; facility: string }[] = [];
    for (const r of rows) if (!facilities.some(f => f.facility === r.facility)) facilities.push({ workPackage: (r.workPackage as string | null) ?? null, facility: String(r.facility) });
    const byOrder = new Map<number, Any>();
    for (const r of rows) {
      const o = Number(r.order);
      const item = byOrder.get(o) ?? { order: o, section: r.section, ref: r.ref, activity: r.activity, level: Number(r.level) || 2, remark: r.remark ?? null, cells: {} as Record<string, string> };
      item.cells[String(r.facility)] = String(r.party);
      if (r.remark && !item.remark) item.remark = r.remark;
      byOrder.set(o, item);
    }
    const names = new Map(this.parties(projectId).map(p => [String(p.code), String(p.name)]));
    const used = unique(rows.map(r => String(r.party)));
    return { facilities, rows: [...byOrder.values()].sort((a, b) => a.order - b.order), parties: used.map(code => ({ code, name: names.get(code) ?? code, cells: rows.filter(r => r.party === code).length })) };
  }

  /** RASCI per matrix: each party's role (Responsible, Accountable, Support, Consulted, Informed) per scope activity. */
  rasci(projectId: string) {
    const rows = this.svc.rows(SHEET.rasci, COLUMNS.rasci, projectId);
    const matrices = [...new Set(rows.map(r => String(r.matrix)))]; // in workbook order
    return {
      roles: [['R', 'Responsible'], ['A', 'Accountable'], ['R&A', 'Responsible & accountable'], ['S', 'Support'], ['C', 'Consulted'], ['I', 'Informed']].map(([code, label]) => ({ code, label })),
      matrices: matrices.map(name => {
        const mine = rows.filter(r => r.matrix === name);
        const parties: { phase: string | null; party: string }[] = [];
        for (const r of mine) if (!parties.some(p => p.party === r.party)) parties.push({ phase: (r.phase as string | null) ?? null, party: String(r.party) });
        const byOrder = new Map<number, Any>();
        for (const r of mine) {
          const o = Number(r.order);
          const item = byOrder.get(o) ?? { order: o, section: r.section, ref: r.ref, activity: r.activity, remark: r.remark ?? null, roles: {} as Record<string, string> };
          item.roles[String(r.party)] = String(r.role);
          byOrder.set(o, item);
        }
        return { name, parties, rows: [...byOrder.values()].sort((a, b) => a.order - b.order) };
      }),
    };
  }

  interfaceCreate(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(interfaceCreate, body);
    this.requireMilestone(projectId, v.milestoneId);
    return this.store.withLock(() => {
      const now = this.now();
      const row: Row = { projectId, id: nextId('INT', this.interfaceRows(projectId)), ...v, status: 'Identified', createdAt: now, updatedAt: now };
      this.store.appendRows(SHEET.interfaces, COLUMNS.interfaces, [row]);
      return this.interfaceGet(projectId, String(row.id));
    });
  }

  interfaceUpdate(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(interfacePatch, body);
    this.requireMilestone(projectId, patch.milestoneId);
    return this.store.withLock(() => {
      const current = this.interfaceRows(projectId).find(r => r.id === id);
      if (!current) throw notFound('NOT_FOUND', `Interface "${id}" was not found.`);
      if (sameParty(String(patch.originator ?? current.originator), String(patch.receiver ?? current.receiver))) {
        throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'receiver', message: partiesMessage.message }] });
      }
      this.store.updateRow(SHEET.interfaces, COLUMNS.interfaces, 'id', id, { ...(patch as Row), updatedAt: this.now() }, { projectId });
      return this.interfaceGet(projectId, id);
    });
  }

  /** Status changes go through this transition only, so a generic edit cannot skip the workflow (spec API-01). */
  interfaceTransition(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const { to } = parse(transitionBody, body);
    return this.store.withLock(() => {
      const current = this.interfaceRows(projectId).find(r => r.id === id);
      if (!current) throw notFound('NOT_FOUND', `Interface "${id}" was not found.`);
      const from = String(current.status);
      if (!allowedNext(from).includes(to)) {
        throw new HttpError(409, { code: 'INVALID_TRANSITION', message: `An interface that is ${from} cannot move to ${to}. Allowed: ${allowedNext(from).join(', ') || 'none'}.` });
      }
      if (to === 'Assigned' && !current.coordinator) throw new HttpError(409, { code: 'COORDINATOR_REQUIRED', message: 'Name an accountable coordinator before assigning the interface.' });
      if (to === 'Responded' && !current.response) throw new HttpError(409, { code: 'RESPONSE_REQUIRED', message: 'Record the response before marking the interface as responded.' });
      if (to === 'Closed') {
        const open = this.pointRows(projectId).filter(p => p.interfaceId === id && !pointResolved(p.status)).length;
        if (open) throw new HttpError(409, { code: 'POINTS_UNRESOLVED', message: `${open} interface point${open === 1 ? ' is' : 's are'} not resolved or closed yet.` });
      }
      this.store.updateRow(SHEET.interfaces, COLUMNS.interfaces, 'id', id, { status: to, updatedAt: this.now() }, { projectId });
      return this.interfaceGet(projectId, id);
    });
  }

  interfaceDelete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (this.pointRows(projectId).some(p => p.interfaceId === id)) throw new HttpError(409, { code: 'HAS_POINTS', message: 'Move or remove the interface points first.' });
      if (!this.store.deleteRow(SHEET.interfaces, COLUMNS.interfaces, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Interface "${id}" was not found.`);
    });
  }
}
