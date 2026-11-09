import { z } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, filterAndSort, listQuery, notFound, paginate, parse, toCsv, unique, type ListParams } from './http';
import { milestonesInsights } from './insights';
import { INTERFACE_STATUSES, INTERFACE_TYPES, POINT_STATUSES, allowedNext, interfaceSettled, pointResolved } from './interface-flow';
import { ACTIVE_RISK, IMPACT_LABELS, LIKELIHOOD_LABELS, RISK_CATEGORIES, RISK_MATRIX_VERSION, RISK_STATUSES, riskLevel, riskScore } from './risk-matrix';
import type { Service } from './service';
import type { Row } from './store';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));
const score = z.number().int().min(1).max(5);

const addDays = (date: string, days: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((new Date(`${b}T12:00:00Z`).getTime() - new Date(`${a}T12:00:00Z`).getTime()) / 86_400_000);
// Views add computed fields to rows; object spread drops Row's index signature, so views are loosely typed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = Record<string, any>;
const strip = ({ projectId: _p, ...rest }: Row): Any => rest;

/* ---------------- milestones (reference data) ---------------- */
const milestoneQuery = listQuery(['id', 'description', 'planBaseline', 'forecast', 'actual', 'subName', 'variance'] as const).extend({ sub: z.string().max(40).optional(), facility: z.string().max(60).optional(), within: z.string().max(10).optional() });

/** The facility a milestone belongs to, read from the workbook's ID: the digits before the first dash are the work package. */
export function milestoneFacility(id: string): string {
  const wp: Record<string, string> = { '01': 'Project', '02': 'CGF Topsides', '03': 'CGF Jacket & Bridge', '04': 'LQ Module #2', '05': 'Brown Field', '06': 'Pipeline' };
  const m = /^(\d{2})-/.exec(id);
  if (m) return wp[m[1]] ?? 'Project';
  if (/^LQM-/.test(id)) return 'LQ Module #2';
  if (/^M\d/.test(id)) return 'CGF Jacket & Bridge';
  return 'Project';
}

const milestoneFields = {
  description: z.string().trim().min(1).max(200),
  planBaseline: iso.nullish().transform(v => v ?? null), planSub: iso.nullish().transform(v => v ?? null),
  subName: txt(40), facility: txt(60), forecast: iso.nullish().transform(v => v ?? null), actual: iso.nullish().transform(v => v ?? null), comment: txt(500),
};
const milestoneCreate = z.object({ id: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$/, 'Use letters, digits, dots, dashes or underscores (2 to 40 characters).').optional(), ...milestoneFields });
const milestonePatch = z.object(milestoneFields).partial();

export type MilestoneStatus = 'Done' | 'Overdue' | 'Due soon' | 'Planned';
const MILESTONE_STATUSES: MilestoneStatus[] = ['Done', 'Overdue', 'Due soon', 'Planned'];

/** Status is derived against the project's reporting cut-off, never stored. */
export function milestoneStatus(m: Row, cutoff: string): MilestoneStatus {
  if (m.actual) return 'Done';
  const due = String(m.forecast ?? m.planBaseline ?? '');
  if (!due) return 'Planned';
  if (due < cutoff) return 'Overdue';
  return due <= addDays(cutoff, 30) ? 'Due soon' : 'Planned';
}

/* ---------------- risks ---------------- */
const riskFields = {
  title: z.string().trim().min(1).max(160),
  category: z.enum(RISK_CATEGORIES),
  cause: txt(1000), event: txt(1000), effect: txt(1000),
  owner: z.string().trim().min(1).max(120),
  likelihood: score, impact: score,
  mitigation: txt(2000), trigger: txt(500),
  residualLikelihood: score.nullish().transform(v => v ?? null),
  residualImpact: score.nullish().transform(v => v ?? null),
  reviewDate: iso.nullish().transform(v => v ?? null),
  status: z.enum(RISK_STATUSES),
  milestoneId: txt(40),
};
const residualPair = (v: { residualLikelihood?: number | null; residualImpact?: number | null }) => (v.residualLikelihood == null) === (v.residualImpact == null);
const residualMessage = { message: 'Give both residual likelihood and residual impact, or neither.', path: ['residualLikelihood'] };
const riskCreate = z.object({ ...riskFields, status: riskFields.status.default('Open') }).refine(residualPair, residualMessage);
const riskPatch = z.object(riskFields).partial();
const riskQuery = listQuery(['id', 'title', 'owner', 'status', 'score', 'reviewDate'] as const).extend({
  category: z.string().max(40).optional(), level: z.enum(['Low', 'Medium', 'High', 'Extreme']).optional(),
});

/* ---------------- interfaces ---------------- */
const interfaceFields = {
  title: z.string().trim().min(1).max(160),
  type: z.enum(INTERFACE_TYPES),
  originator: z.string().trim().min(1).max(120),
  receiver: z.string().trim().min(1).max(120),
  coordinator: txt(120), discipline: txt(80),
  boundary: txt(1000), requiredInput: txt(1000), requiredOutput: txt(1000),
  needDate: iso.nullish().transform(v => v ?? null),
  response: txt(2000), acceptance: txt(1000), evidence: txt(500), milestoneId: txt(40),
};
const differentParties = (v: { originator?: string; receiver?: string }) => !v.originator || !v.receiver || v.originator.toLowerCase() !== v.receiver.toLowerCase();
const partiesMessage = { message: 'Originator and receiving party must be different.', path: ['receiver'] };
const interfaceCreate = z.object(interfaceFields).refine(differentParties, partiesMessage);
const interfacePatch = z.object(interfaceFields).partial().refine(differentParties, partiesMessage);
const transitionBody = z.object({ to: z.enum(INTERFACE_STATUSES) });
const interfaceQuery = listQuery(['id', 'title', 'status', 'needDate', 'originator', 'receiver'] as const).extend({
  type: z.string().max(40).optional(), party: z.string().max(120).optional(), overdue: z.enum(['true', 'false']).optional(), originator: z.string().max(120).optional(), receiver: z.string().max(120).optional(),
});
const pointFields = {
  title: z.string().trim().min(1).max(160), owner: z.string().trim().min(1).max(120),
  due: iso.nullish().transform(v => v ?? null), status: z.enum(POINT_STATUSES), response: txt(2000),
};
const pointCreate = z.object({ ...pointFields, interfaceId: z.string().min(1).max(40), status: pointFields.status.default('Open') });
const pointPatch = z.object(pointFields).partial();
const pointQuery = listQuery(['id', 'title', 'owner', 'status', 'due'] as const).extend({ interfaceId: z.string().max(40).optional(), overdue: z.enum(['true', 'false']).optional() });

const nextId = (prefix: string, rows: Row[]) => {
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/^\D+/, '')) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
};

export class RegistersService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }
  private cutoff(projectId: string) { return String(this.svc.project(projectId).cutoff); }

  private requireMilestone(projectId: string, id: string | null | undefined) {
    if (id && !this.milestones(projectId).some(m => m.id === id)) {
      throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'milestoneId', message: `Milestone "${id}" does not exist in this project.` }] });
    }
  }

  /* ================= milestones ================= */
  private milestones(projectId: string) {
    return this.svc.rows(SHEET.milestones, COLUMNS.milestones, projectId);
  }

  private milestoneView(m: Row, cutoff: string): Any {
    const status = milestoneStatus(m, cutoff);
    const due = String(m.forecast ?? m.planBaseline ?? '');
    return { ...strip(m), status, slipDays: m.planBaseline && m.forecast ? daysBetween(String(m.planBaseline), String(m.forecast)) : null, daysToGo: !m.actual && due ? daysBetween(cutoff, due) : null };
  }

  /** Keeps milestones by the look-ahead window: not yet achieved and due (forecast, else baseline) inside it. */
  private withinWindow(rows: Row[], within: string | undefined, cutoff: string): Row[] {
    if (!within) return rows;
    return rows.filter(m => {
      if (m.actual) return false;
      const d = m.forecast ?? m.planBaseline ? String(m.forecast ?? m.planBaseline) : null;
      if (within === 'none') return !d;
      if (!d) return false;
      return within === 'overdue' ? d < cutoff : d >= cutoff && d <= addDays(cutoff, Number(within));
    });
  }

  milestoneInsights(projectId: string) {
    const cutoff = this.cutoff(projectId);
    return milestonesInsights(this.milestones(projectId).map(m => this.milestoneView(m, cutoff)), cutoff);
  }

  milestoneList(projectId: string, raw: unknown) {
    const cutoff = this.cutoff(projectId);
    const { sub, facility, within, ...f } = parse(milestoneQuery, raw);
    const every = this.milestones(projectId).map(m => ({ ...this.milestoneView(m, cutoff), discipline: m.subName })) as unknown as Row[];
    const all = this.withinWindow(every, within, cutoff).filter(m => !facility || m.facility === facility);
    const rows = filterAndSort(all, { ...f, discipline: sub ?? f.discipline } as ListParams, ['id', 'description', 'subName', 'facility', 'comment'], 'planBaseline');
    return {
      items: paginate(rows, f).map(({ discipline: _d, ...r }) => r), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: { disciplines: unique(every.map(r => r.discipline)), facilities: unique(every.map(r => r.facility as string | null)), statuses: MILESTONE_STATUSES },
    };
  }

  milestoneCsv(projectId: string, raw: unknown) {
    const cutoff = this.cutoff(projectId);
    const { sub, ...f } = parse(milestoneQuery, raw);
    const all = this.milestones(projectId).map(m => ({ ...this.milestoneView(m, cutoff), discipline: m.subName })) as unknown as Row[];
    const rows = filterAndSort(all, { ...f, discipline: sub ?? f.discipline } as ListParams, ['id', 'description', 'subName', 'comment'], 'planBaseline');
    return {
      filename: 'milestones.csv',
      csv: toCsv([['ID', 'Key date', 'Baseline', 'Subcontractor plan', 'Sub', 'Forecast', 'Actual', 'Variance (days)', 'Status', 'Comment'],
        ...rows.map(m => [m.id, m.description, m.planBaseline, m.planSub, m.subName, m.forecast, m.actual, m.variance, m.status, m.comment])]),
    };
  }

  milestoneSummary(projectId: string) {
    const cutoff = this.cutoff(projectId);
    const all = this.milestones(projectId).map(m => this.milestoneView(m, cutoff));
    const count = (s: MilestoneStatus) => all.filter(m => m.status === s).length;
    const bySub = all.reduce<Record<string, number>>((a, m) => { const k = String(m.subName ?? 'Unassigned'); a[k] = (a[k] ?? 0) + 1; return a; }, {});
    const next = all.filter(m => m.status !== 'Done').sort((a, b) => String(a.forecast ?? a.planBaseline).localeCompare(String(b.forecast ?? b.planBaseline))).slice(0, 5);
    return { total: all.length, done: count('Done'), overdue: count('Overdue'), dueSoon: count('Due soon'), planned: count('Planned'), bySub, next, cutoff };
  }

  /** Days from the baseline to the actual date, or to the forecast while not done; null when either is missing. */
  private milestoneVariance(m: Any): number | null {
    const end = m.actual ?? m.forecast;
    return m.planBaseline && end ? daysBetween(String(m.planBaseline), String(end)) : null;
  }

  milestoneCreate(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const { id: wanted, ...v } = parse(milestoneCreate, body);
    return this.store.withLock(() => {
      const rows = this.milestones(projectId);
      if (wanted && rows.some(r => r.id === wanted)) throw new HttpError(409, { code: 'ID_TAKEN', message: `A milestone with the ID ${wanted} already exists.` });
      const id = wanted ?? nextId('KM', rows.filter(r => /^KM-\d+$/.test(String(r.id))));
      this.store.appendRows(SHEET.milestones, COLUMNS.milestones, [{ projectId, id, ...v, facility: v.facility ?? milestoneFacility(id), variance: this.milestoneVariance(v) }]);
      return this.milestoneGet(projectId, id);
    });
  }

  milestoneGet(projectId: string, id: string) {
    const m = this.milestones(projectId).find(r => r.id === id);
    if (!m) throw notFound('NOT_FOUND', `Milestone "${id}" was not found.`);
    return this.milestoneView(m, this.cutoff(projectId));
  }

  milestoneUpdate(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(milestonePatch, body);
    return this.store.withLock(() => {
      const current = this.milestones(projectId).find(r => r.id === id);
      if (!current) throw notFound('NOT_FOUND', `Milestone "${id}" was not found.`);
      const merged = { ...current, ...patch };
      this.store.updateRow(SHEET.milestones, COLUMNS.milestones, 'id', id, { ...(patch as Row), variance: this.milestoneVariance(merged) }, { projectId });
      return this.milestoneGet(projectId, id);
    });
  }

  milestoneDelete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      const users = [
        ...this.riskRows(projectId).filter(r => r.milestoneId === id).map(r => `risk ${r.id}`),
        ...this.interfaceRows(projectId).filter(r => r.milestoneId === id).map(r => `interface ${r.id}`),
      ];
      if (users.length) throw new HttpError(409, { code: 'IN_USE', message: `Milestone ${id} is linked from ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` and ${users.length - 3} more` : ''}. Unlink it first.` });
      if (!this.store.deleteRow(SHEET.milestones, COLUMNS.milestones, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Milestone "${id}" was not found.`);
    });
  }

  /* ================= risks ================= */
  private riskRows(projectId: string) {
    return this.svc.rows(SHEET.risks, COLUMNS.risks, projectId);
  }

  private riskView(r: Row, cutoff: string, milestones: Map<string, string>): Any {
    const inherentScore = riskScore(r.likelihood as number | null, r.impact as number | null);
    const residualScore = riskScore(r.residualLikelihood as number | null, r.residualImpact as number | null);
    const current = residualScore ?? inherentScore;
    return {
      ...strip(r), inherentScore, inherentLevel: riskLevel(inherentScore), residualScore, residualLevel: riskLevel(residualScore),
      currentScore: current, currentLevel: riskLevel(current),
      reviewOverdue: !!r.reviewDate && String(r.reviewDate) < cutoff && ACTIVE_RISK.has(String(r.status)),
      milestone: r.milestoneId ? milestones.get(String(r.milestoneId)) ?? null : null,
    };
  }

  private riskViews(projectId: string): Any[] {
    const cutoff = this.cutoff(projectId);
    const ms = new Map(this.milestones(projectId).map(m => [String(m.id), String(m.description)]));
    return this.riskRows(projectId).map(r => this.riskView(r, cutoff, ms));
  }

  private riskFilter(projectId: string, raw: unknown) {
    const { category, level, ...f } = parse(riskQuery, raw);
    const all = this.riskViews(projectId).map(r => ({ ...r, score: r.currentScore })) as unknown as Row[];
    const kept = all.filter(r => (!category || r.category === category) && (!level || r.currentLevel === level));
    return { f, all, rows: filterAndSort(kept, f as ListParams, ['id', 'title', 'owner', 'cause', 'event', 'effect', 'mitigation'], 'id') };
  }

  riskList(projectId: string, raw: unknown) {
    const { f, all, rows } = this.riskFilter(projectId, raw);
    return {
      items: paginate(rows, f).map(({ score: _s, ...r }) => r), total: rows.length, page: f.page, pageSize: f.pageSize,
      facets: { disciplines: unique(all.map(r => r.category)), statuses: [...RISK_STATUSES] },
    };
  }

  riskCsv(projectId: string, raw: unknown) {
    const { rows } = this.riskFilter(projectId, raw);
    return {
      filename: 'risk-register.csv',
      csv: toCsv([['ID', 'Title', 'Category', 'Owner', 'Likelihood', 'Impact', 'Inherent score', 'Residual score', 'Level', 'Status', 'Review date', 'Mitigation', 'Trigger'],
        ...rows.map(r => [r.id, r.title, r.category, r.owner, r.likelihood, r.impact, r.inherentScore, r.residualScore, r.currentLevel, r.status, r.reviewDate, r.mitigation, r.trigger])]),
    };
  }

  riskGet(projectId: string, id: string) {
    const r = this.riskViews(projectId).find(x => x.id === id);
    if (!r) throw notFound('NOT_FOUND', `Risk "${id}" was not found.`);
    return r;
  }

  riskSummary(projectId: string) {
    const views = this.riskViews(projectId);
    const active = views.filter(r => ACTIVE_RISK.has(String(r.status)));
    const grid = (pick: (r: (typeof active)[number]) => [number | null, number | null]) => {
      const g = Array.from({ length: 5 }, () => Array(5).fill(0) as number[]);
      for (const r of active) { const [l, i] = pick(r); if (l && i) g[l - 1][i - 1]++; }
      return g;
    };
    const byLevel = { Low: 0, Medium: 0, High: 0, Extreme: 0 } as Record<string, number>;
    for (const r of active) if (r.currentLevel) byLevel[r.currentLevel]++;
    const byStatus = RISK_STATUSES.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: views.filter(r => r.status === s).length }), {});
    return {
      total: views.length, active: active.length, byStatus, byLevel, reviewOverdue: views.filter(r => r.reviewOverdue).length,
      heatmap: {
        version: RISK_MATRIX_VERSION, likelihoodLabels: LIKELIHOOD_LABELS, impactLabels: IMPACT_LABELS,
        inherent: grid(r => [r.likelihood as number, r.impact as number]),
        current: grid(r => (r.residualLikelihood ? [r.residualLikelihood as number, r.residualImpact as number] : [r.likelihood as number, r.impact as number])),
      },
    };
  }

  riskCreate(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(riskCreate, body);
    this.requireMilestone(projectId, v.milestoneId);
    return this.store.withLock(() => {
      const now = this.now();
      const row: Row = { projectId, id: nextId('RSK', this.riskRows(projectId)), ...v, createdAt: now, updatedAt: now, createdBy: actor.id };
      this.store.appendRows(SHEET.risks, COLUMNS.risks, [row]);
      return this.riskGet(projectId, String(row.id));
    });
  }

  riskUpdate(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(riskPatch, body);
    this.requireMilestone(projectId, patch.milestoneId);
    return this.store.withLock(() => {
      const current = this.riskRows(projectId).find(r => r.id === id);
      if (!current) throw notFound('NOT_FOUND', `Risk "${id}" was not found.`);
      const merged: Any = { residualLikelihood: current.residualLikelihood, residualImpact: current.residualImpact, ...patch };
      if (!residualPair(merged)) throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'residualLikelihood', message: residualMessage.message }] });
      this.store.updateRow(SHEET.risks, COLUMNS.risks, 'id', id, { ...(patch as Row), updatedAt: this.now() }, { projectId });
      return this.riskGet(projectId, id);
    });
  }

  riskDelete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (!this.store.deleteRow(SHEET.risks, COLUMNS.risks, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Risk "${id}" was not found.`);
    });
  }

  /* ================= interfaces ================= */
  private interfaceRows(projectId: string) { return this.svc.rows(SHEET.interfaces, COLUMNS.interfaces, projectId); }
  private pointRows(projectId: string) { return this.svc.rows(SHEET.interfacePoints, COLUMNS.interfacePoints, projectId); }

  private pointView(p: Row, cutoff: string): Any {
    return { ...strip(p), overdue: !!p.due && String(p.due) < cutoff && !pointResolved(String(p.status)) };
  }

  private interfaceViews(projectId: string): Any[] {
    const cutoff = this.cutoff(projectId);
    const points = this.pointRows(projectId);
    const ms = new Map(this.milestones(projectId).map(m => [String(m.id), String(m.description)]));
    return this.interfaceRows(projectId).map(i => {
      const mine = points.filter(p => p.interfaceId === i.id);
      return {
        ...strip(i), overdue: !!i.needDate && String(i.needDate) < cutoff && !interfaceSettled(String(i.status)),
        pointsTotal: mine.length, pointsOpen: mine.filter(p => !pointResolved(String(p.status))).length,
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
      facets: { disciplines: unique(all.map(r => r.type)), statuses: [...INTERFACE_STATUSES], parties: unique(all.flatMap(r => [r.originator, r.receiver])) },
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
    const cutoff = this.cutoff(projectId);
    return { ...i, points: this.pointRows(projectId).filter(p => p.interfaceId === id).map(p => this.pointView(p, cutoff)) };
  }

  interfaceSummary(projectId: string) {
    const views = this.interfaceViews(projectId);
    const open = views.filter(i => !interfaceSettled(String(i.status)));
    const byStatus = INTERFACE_STATUSES.reduce<Record<string, number>>((a, s) => ({ ...a, [s]: views.filter(i => i.status === s).length }), {});
    return { total: views.length, open: open.length, overdue: views.filter(i => i.overdue).length, pointsOpen: views.reduce((n, i) => n + i.pointsOpen, 0), byStatus };
  }

  /** Party x party counts derived from the register (spec INT-03). */
  interfaceMatrix(projectId: string) {
    const views = this.interfaceViews(projectId);
    const parties = unique(views.flatMap(i => [i.originator, i.receiver]));
    const cells = new Map<string, { originator: string; receiver: string; total: number; open: number; overdue: number; settled: number }>();
    for (const i of views) {
      const key = `${i.originator}\u0000${i.receiver}`;
      const c = cells.get(key) ?? { originator: String(i.originator), receiver: String(i.receiver), total: 0, open: 0, overdue: 0, settled: 0 };
      c.total++;
      if (interfaceSettled(String(i.status))) c.settled++; else c.open++;
      if (i.overdue) c.overdue++;
      cells.set(key, c);
    }
    return { parties, cells: [...cells.values()], total: views.length };
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
      if (!differentParties({ originator: String(patch.originator ?? current.originator), receiver: String(patch.receiver ?? current.receiver) })) {
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
        const open = this.pointRows(projectId).filter(p => p.interfaceId === id && !pointResolved(String(p.status))).length;
        if (open) throw new HttpError(409, { code: 'POINTS_UNRESOLVED', message: `${open} interface point${open === 1 ? ' is' : 's are'} not accepted or closed yet.` });
      }
      this.store.updateRow(SHEET.interfaces, COLUMNS.interfaces, 'id', id, { status: to, updatedAt: this.now() }, { projectId });
      return this.interfaceGet(projectId, id);
    });
  }

  interfaceDelete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (this.pointRows(projectId).some(p => p.interfaceId === id)) throw new HttpError(409, { code: 'HAS_POINTS', message: 'Remove or close the interface points first.' });
      if (!this.store.deleteRow(SHEET.interfaces, COLUMNS.interfaces, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Interface "${id}" was not found.`);
    });
  }

  /* ================= interface points ================= */
  private pointFilter(projectId: string, raw: unknown) {
    const { interfaceId, overdue, ...f } = parse(pointQuery, raw);
    const cutoff = this.cutoff(projectId);
    const titles = new Map(this.interfaceRows(projectId).map(i => [String(i.id), String(i.title)]));
    const all = this.pointRows(projectId).map(p => ({ ...this.pointView(p, cutoff), interfaceTitle: titles.get(String(p.interfaceId)) ?? null })) as unknown as Row[];
    const kept = all.filter(p => (!interfaceId || p.interfaceId === interfaceId) && (overdue === undefined || !!p.overdue === (overdue === 'true')));
    return { f, all, rows: filterAndSort(kept, f as ListParams, ['id', 'title', 'owner', 'interfaceId', 'interfaceTitle'], 'id') };
  }

  pointList(projectId: string, raw: unknown) {
    const { f, rows } = this.pointFilter(projectId, raw);
    return { items: paginate(rows, f), total: rows.length, page: f.page, pageSize: f.pageSize, facets: { disciplines: [], statuses: [...POINT_STATUSES] } };
  }

  pointCreate(projectId: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const v = parse(pointCreate, body);
    return this.store.withLock(() => {
      const parent = this.interfaceRows(projectId).find(i => i.id === v.interfaceId);
      if (!parent) throw new HttpError(400, { code: 'VALIDATION_ERROR', message: 'Request validation failed.', issues: [{ path: 'interfaceId', message: `Interface "${v.interfaceId}" does not exist in this project.` }] });
      if (parent.status === 'Closed') throw new HttpError(409, { code: 'INTERFACE_CLOSED', message: 'Reopen the interface before adding points to it.' });
      const now = this.now();
      const row: Row = { projectId, id: nextId('IP', this.pointRows(projectId)), ...v, createdAt: now, updatedAt: now };
      this.store.appendRows(SHEET.interfacePoints, COLUMNS.interfacePoints, [row]);
      return this.pointView(row, this.cutoff(projectId));
    });
  }

  pointUpdate(projectId: string, id: string, body: unknown, actor: Actor) {
    requireWrite(actor, projectId);
    const patch = parse(pointPatch, body);
    return this.store.withLock(() => {
      if (!this.pointRows(projectId).some(p => p.id === id)) throw notFound('NOT_FOUND', `Interface point "${id}" was not found.`);
      this.store.updateRow(SHEET.interfacePoints, COLUMNS.interfacePoints, 'id', id, { ...(patch as Row), updatedAt: this.now() }, { projectId });
      return this.pointView(this.pointRows(projectId).find(p => p.id === id)!, this.cutoff(projectId));
    });
  }

  pointDelete(projectId: string, id: string, actor: Actor) {
    requireManage(actor, projectId);
    this.store.withLock(() => {
      if (!this.store.deleteRow(SHEET.interfacePoints, COLUMNS.interfacePoints, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Interface point "${id}" was not found.`);
    });
  }
}
