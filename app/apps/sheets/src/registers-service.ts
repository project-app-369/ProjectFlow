import { z } from 'zod';
import { requireManage, requireWrite, type Actor } from './auth';
import { COLUMNS, SHEET } from './datasets';
import { HttpError, filterAndSort, listQuery, notFound, paginate, parse, toCsv, unique, type ListParams } from './http';
import { milestonesInsights } from './insights';
import type { Service } from './service';
import type { Row } from './store';

const iso = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD');
const txt = (max: number) => z.string().trim().max(max).nullish().transform(v => (v ? v : null));

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
  subName: txt(40), facility: txt(60), package: txt(60), forecast: iso.nullish().transform(v => v ?? null), actual: iso.nullish().transform(v => v ?? null), comment: txt(500),
};
const milestoneCreate = z.object({ id: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9_.-]{1,39}$/, 'Use letters, digits, dots, dashes or underscores (2 to 40 characters).').optional(), ...milestoneFields });
const milestonePatch = z.object(milestoneFields).partial();

/**
 * The milestones that mark the course of the EPCIC scope, shown on the S-curve: the project dates, first steel cut of the main
 * structures, end of detailed engineering, ready for sail-away, installation and mechanical completion, float-over, HUC and acceptance.
 * Type Yes or No in a milestone's Major column of the sheet to override this for one milestone.
 */
const MAJOR = /effective date|first steel cut for (cgf topsides|jacket)\b|complete detailed engineering|ready for sail-?away|installation completion|mechanical completion|float-?over completion|huc start|ready for hydrocarbon|performance test completion|provisional acceptance|final acceptance/i;
export const isMajorMilestone = (m: Row) => (/^yes$/i.test(String(m.major ?? '')) ? true : /^no$/i.test(String(m.major ?? '')) ? false : MAJOR.test(String(m.description ?? '')));

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

const nextId = (prefix: string, rows: Row[]) => {
  const max = rows.reduce((m, r) => Math.max(m, Number(String(r.id).replace(/^\D+/, '')) || 0), 0);
  return `${prefix}-${String(max + 1).padStart(3, '0')}`;
};

/** Milestones: reference data from the project's key-milestone workbook (spec PLAN-03). Risks and interfaces have their own services. */
export class RegistersService {
  constructor(private readonly svc: Service) {}

  private get store() { return this.svc.store; }
  private now() { return this.svc.clock().toISOString(); }
  private cutoff(projectId: string) { return String(this.svc.project(projectId).cutoff); }

  /* ================= milestones ================= */
  private milestones(projectId: string) {
    return this.svc.rows(SHEET.milestones, COLUMNS.milestones, projectId);
  }

  private milestoneView(m: Row, cutoff: string): Any {
    const status = milestoneStatus(m, cutoff);
    const due = String(m.forecast ?? m.planBaseline ?? '');
    return { ...strip(m), major: isMajorMilestone(m), status, slipDays: m.planBaseline && m.forecast ? daysBetween(String(m.planBaseline), String(m.forecast)) : null, daysToGo: !m.actual && due ? daysBetween(cutoff, due) : null };
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

  /** Every milestone with its status against the cut-off (the same rows the register lists). */
  milestoneViews(projectId: string): Any[] {
    const cutoff = this.cutoff(projectId);
    return this.milestones(projectId).map(m => this.milestoneView(m, cutoff));
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
    return { total: all.length, done: count('Done'), overdue: count('Overdue'), dueSoon: count('Due soon'), planned: count('Planned'), bySub, next, cutoff,
      major: all.filter(m => m.major && (m.actual ?? m.forecast ?? m.planBaseline)).sort((a, b) => String(a.actual ?? a.forecast ?? a.planBaseline).localeCompare(String(b.actual ?? b.forecast ?? b.planBaseline))) };
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
        ...this.svc.rows(SHEET.risks, COLUMNS.risks, projectId).filter(r => r.milestoneId === id).map(r => `risk ${r.id}`),
        ...this.svc.rows(SHEET.interfaces, COLUMNS.interfaces, projectId).filter(r => r.milestoneId === id).map(r => `interface ${r.id}`),
      ];
      if (users.length) throw new HttpError(409, { code: 'IN_USE', message: `Milestone ${id} is linked from ${users.slice(0, 3).join(', ')}${users.length > 3 ? ` and ${users.length - 3} more` : ''}. Unlink it first.` });
      if (!this.store.deleteRow(SHEET.milestones, COLUMNS.milestones, 'id', id, { projectId })) throw notFound('NOT_FOUND', `Milestone "${id}" was not found.`);
    });
  }
}
